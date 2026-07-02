import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, User, Smartphone, ArrowLeft, Mail } from "lucide-react";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: object) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

type Step = "credentials" | "totp" | "setup" | "register" | "forgot";

function PasswordStrength({ value }: { value: string }) {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;

  const labels = ["", "Senha fraca", "Senha razoável", "Senha boa", "Senha forte"];
  const colors = ["", "#ef4444", "#f59e0b", "#22c55e", "#22c55e"];
  const barColors = [
    "bg-white/10",
    "bg-red-500",
    "bg-amber-500",
    "bg-green-500",
    "bg-green-500",
  ];

  if (!value) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`flex-1 h-1 rounded-full transition-colors duration-200 ${i <= score ? barColors[score] : "bg-white/10"}`}
          />
        ))}
      </div>
      {score > 0 && (
        <p className="text-[11px]" style={{ color: colors[score] }}>
          {labels[score]}
        </p>
      )}
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group">
      <div
        onClick={onChange}
        className={`w-[17px] h-[17px] rounded-[5px] border flex items-center justify-center flex-shrink-0 transition-all ${checked ? "bg-blue-500 border-blue-500" : "border-[#1c2740] bg-[#0d1424]"}`}
      >
        {checked && (
          <svg className="w-[11px] h-[11px]" fill="none" viewBox="0 0 24 24">
            <path d="m5 12 5 5 9-10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-[13px] text-[#8b97ad] group-hover:text-[#eef2f9] transition-colors">{label}</span>
    </label>
  );
}

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12.5px] font-semibold text-[#8b97ad] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function TextInput({
  type = "text",
  placeholder,
  value,
  onChange,
  required,
  autoComplete,
  minLength,
  inputMode,
  maxLength,
  icon,
  rightSlot,
  className = "",
}: {
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="relative">
      {icon && (
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5d6b84]">
          {icon}
        </div>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        inputMode={inputMode}
        maxLength={maxLength}
        className={`w-full bg-[#0d1424] border border-[#1c2740] rounded-[10px] py-3 text-[14px] text-[#eef2f9] placeholder-[#5d6b84] outline-none transition-all focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] ${icon ? "pl-10" : "pl-4"} ${rightSlot ? "pr-10" : "pr-4"} ${className}`}
      />
      {rightSlot && (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
          {rightSlot}
        </div>
      )}
    </div>
  );
}

function PrimaryBtn({ children, disabled, loading }: { children: React.ReactNode; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] text-[14.5px] font-semibold text-white bg-gradient-to-b from-blue-500 to-blue-600 shadow-[0_8px_24px_rgba(37,99,235,0.28)] transition-all hover:brightness-110 active:scale-[.99] disabled:opacity-60 disabled:cursor-wait"
    >
      {loading && <div className="w-4 h-4 rounded-full border-2 border-white/35 border-t-white animate-spin" />}
      {!loading && children}
      {loading && <span className="opacity-0 select-none">{children}</span>}
    </button>
  );
}

function ErrorAlert({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/35 text-red-300 rounded-[10px] px-3.5 py-3 text-[13px]">
      <svg className="w-4 h-4 flex-shrink-0 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{msg}</span>
    </div>
  );
}

function SuccessAlert({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 bg-green-500/8 border border-green-500/35 text-green-300 rounded-[10px] px-3.5 py-3 text-[13px]">
      <svg className="w-4 h-4 flex-shrink-0 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m5 12 5 5 9-10" />
      </svg>
      <span>{msg}</span>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[13px] text-[#8b97ad] hover:text-[#eef2f9] transition-colors mb-5"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Voltar para o login
    </button>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  const [step, setStep] = useState<Step>("credentials");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [cfToken, setCfToken] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [needSetup, setNeedSetup] = useState(false);

  const [regName, setRegName] = useState("");
  const [regUser, setRegUser] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSubmitting, setRegSubmitting] = useState(false);

  const [tempToken, setTempToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [totpError, setTotpError] = useState("");
  const [totpSubmitting, setTotpSubmitting] = useState(false);
  const totpInputRef = useRef<HTMLInputElement>(null);

  const [setupName, setSetupName] = useState("");
  const [setupUser, setSetupUser] = useState("");
  const [setupPass, setSetupPass] = useState("");
  const [setupMsg, setSetupMsg] = useState("");

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) setLocation("/");
  }, [isAuthenticated, isLoading, setLocation]);

  useEffect(() => {
    fetch("/api/auth/user", { credentials: "include" })
      .then(r => r.json())
      .then((data: any) => { if (data.setupRequired) setNeedSetup(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const existing = document.getElementById("cf-turnstile-script");
    if (!existing) {
      const script = document.createElement("script");
      script.id = "cf-turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (!turnstileRef.current) return;
    const tryRender = () => {
      if (window.turnstile && turnstileRef.current && !widgetId.current) {
        widgetId.current = window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => setCfToken(token),
          "error-callback": () => setCfToken(""),
          "expired-callback": () => setCfToken(""),
          theme: "dark",
          size: "normal",
        });
      }
    };
    const interval = setInterval(() => { tryRender(); if (widgetId.current) clearInterval(interval); }, 300);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (step === "totp") setTimeout(() => totpInputRef.current?.focus(), 100);
  }, [step]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, cfToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "E-mail ou senha inválidos.");
        if (widgetId.current) window.turnstile?.reset(widgetId.current);
        setCfToken("");
        return;
      }
      if (data.requiresTotp) { setTempToken(data.tempToken); setStep("totp"); return; }
      window.location.href = "/";
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTotpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpError("");
    setTotpSubmitting(true);
    try {
      const res = await fetch("/api/auth/totp/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code: totpCode.replace(/\s/g, ""), rememberDevice }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTotpError(data.error ?? "Código inválido");
        setTotpCode("");
        if (data.tempToken) setTempToken(data.tempToken);
        setTimeout(() => totpInputRef.current?.focus(), 50);
        return;
      }
      window.location.href = "/";
    } catch {
      setTotpError("Erro de conexão. Tente novamente.");
    } finally {
      setTotpSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setRegSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: regUser.trim(), password: regPass, name: regName, email: regEmail || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setRegError(data.error ?? "Erro ao criar conta"); return; }
      window.location.href = "/";
    } catch {
      setRegError("Erro de conexão. Tente novamente.");
    } finally {
      setRegSubmitting(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupMsg("");
    const res = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: setupUser, password: setupPass, name: setupName }),
    });
    const data = await res.json();
    if (!res.ok) { setSetupMsg(data.error ?? "Erro ao criar conta"); return; }
    setNeedSetup(false);
    setSetupMsg("Conta criada! Faça login.");
  };

  const goTo = (s: Step) => {
    setError(""); setRegError(""); setTotpError(""); setSetupMsg("");
    setForgotSent(false);
    setStep(s);
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen flex" style={{ background: "#070b14", fontFamily: "'Inter', system-ui, sans-serif", color: "#eef2f9" }}>

      {/* ── LEFT BRAND PANEL ── */}
      <aside
        className="hidden lg:flex flex-col justify-between relative overflow-hidden"
        style={{
          flex: "1.1",
          background: `radial-gradient(900px 500px at -10% -10%, rgba(37,99,235,.22), transparent 60%), radial-gradient(700px 500px at 110% 110%, rgba(124,58,237,.14), transparent 60%), #0a0f1d`,
          borderRight: "1px solid #16203a",
          padding: "48px 56px",
        }}
      >
        {/* Grid pattern */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(rgba(59,130,246,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,.05) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            WebkitMaskImage: "radial-gradient(ellipse at 30% 20%, #000 0%, transparent 70%)",
            maskImage: "radial-gradient(ellipse at 30% 20%, #000 0%, transparent 70%)",
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <img src="/logo-rpshow.png" alt="RPShow OnSign" style={{ height: 56, objectFit: "contain", objectPosition: "left" }} />
        </div>

        {/* Hero */}
        <div className="relative z-10 max-w-[520px]">
          <h1 className="font-extrabold leading-[1.15] tracking-tight mb-3.5" style={{ fontSize: "clamp(26px,3vw,38px)", letterSpacing: "-0.8px" }}>
            Todas as suas telas,<br />sob controle em <em className="not-italic" style={{ color: "#3b82f6" }}>tempo real</em>.
          </h1>
          <p className="mb-8 leading-relaxed" style={{ color: "#8b97ad", fontSize: "15px" }}>
            Gerencie playlists, dispositivos, agendamentos e cobranças da sua rede de digital signage em um único painel.
          </p>

          {/* Mini dashboard preview */}
          <div
            className="rounded-[14px] p-[18px_20px] grid gap-3.5"
            style={{
              background: "linear-gradient(180deg, #111a2e, #0d1424)",
              border: "1px solid #1c2740",
              boxShadow: "0 24px 60px rgba(0,0,0,.45), 0 0 0 1px rgba(59,130,246,.05)",
              maxWidth: "460px",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ color: "#8b97ad" }}>Visão geral da rede</span>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "#22c55e" }}>
                <span className="w-[7px] h-[7px] rounded-full bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.15)] animate-pulse inline-block" />
                Ao vivo
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { v: "48", k: "Telas totais", c: "#eef2f9" },
                { v: "42", k: "Online agora", c: "#22c55e" },
                { v: "6", k: "Offline", c: "#ef4444" },
              ].map(({ v, k, c }) => (
                <div key={k} className="rounded-[10px] p-3" style={{ background: "rgba(255,255,255,.02)", border: "1px solid #16203a" }}>
                  <div className="text-[20px] font-bold tracking-tight" style={{ color: c }}>{v}</div>
                  <div className="text-[10.5px] mt-0.5" style={{ color: "#8b97ad" }}>{k}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-2">
              {[
                { label: "Promoção Verão", pct: 88, count: "412" },
                { label: "Cardápio Digital", pct: 74, count: "378" },
                { label: "Treino & Motivação", pct: 58, count: "289" },
              ].map(({ label, pct, count }) => (
                <div key={label} className="flex items-center gap-2.5 text-[11.5px]" style={{ color: "#8b97ad" }}>
                  <span className="font-semibold min-w-[110px]" style={{ color: "#eef2f9", fontSize: "11.5px" }}>{label}</span>
                  <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.05)" }}>
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="min-w-[34px] text-right tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex gap-5 text-[12px]" style={{ color: "#5d6b84" }}>
          <span>© 2026 RPShow</span>
          <a href="#" className="hover:text-[#8b97ad] transition-colors no-underline" style={{ color: "#5d6b84" }}>Termos de uso</a>
          <a href="#" className="hover:text-[#8b97ad] transition-colors no-underline" style={{ color: "#5d6b84" }}>Privacidade</a>
        </div>
      </aside>

      {/* ── RIGHT FORM PANEL ── */}
      <main className="flex items-center justify-center p-8 lg:p-12" style={{ flex: "1", background: "#070b14", minHeight: "100vh" }}>
        <div className="w-full" style={{ maxWidth: "400px" }}>

          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <img src="/logo-rpshow.png" alt="RPShow OnSign" style={{ height: 48, objectFit: "contain", objectPosition: "left" }} />
          </div>

          {/* ── FIRST-TIME SETUP ── */}
          {needSetup ? (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <h2 className="text-[24px] font-bold tracking-tight" style={{ letterSpacing: "-0.4px" }}>Criar conta administrador</h2>
              </div>
              <p className="text-[14px] mb-7" style={{ color: "#8b97ad" }}>Configure o primeiro acesso à plataforma.</p>
              <form onSubmit={handleSetup} className="grid gap-4">
                <FieldWrap label="Nome completo">
                  <TextInput value={setupName} onChange={setSetupName} placeholder="Ex: João Silva" required icon={<User className="w-4 h-4" />} />
                </FieldWrap>
                <FieldWrap label="Usuário">
                  <TextInput value={setupUser} onChange={setSetupUser} placeholder="Ex: admin" required icon={<User className="w-4 h-4" />} />
                </FieldWrap>
                <FieldWrap label="Senha (mín. 6 caracteres)">
                  <TextInput type="password" value={setupPass} onChange={setSetupPass} placeholder="••••••••" required minLength={6} icon={<Lock className="w-4 h-4" />} />
                </FieldWrap>
                {setupMsg && <p className="text-[13px] text-blue-400">{setupMsg}</p>}
                <PrimaryBtn>Criar conta e entrar</PrimaryBtn>
              </form>
            </div>

          /* ── TOTP ── */
          ) : step === "totp" ? (
            <div>
              <button type="button" onClick={() => goTo("credentials")} className="inline-flex items-center gap-1.5 text-[13px] mb-5 transition-colors hover:text-[#eef2f9]" style={{ color: "#8b97ad", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar
              </button>
              <div className="flex items-center gap-2 mb-1.5">
                <Smartphone className="w-4 h-4 text-blue-400" />
                <h2 className="text-[24px] font-bold tracking-tight">Verificação em 2 etapas</h2>
              </div>
              <p className="text-[14px] mb-7" style={{ color: "#8b97ad" }}>
                Abra o <span style={{ color: "#eef2f9" }}>Google Authenticator</span> e informe o código de 6 dígitos.
              </p>
              <form onSubmit={handleTotpVerify} className="grid gap-4">
                <FieldWrap label="Código de verificação">
                  <input
                    ref={totpInputRef}
                    type="text"
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000 000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    className="w-full rounded-[10px] text-center text-[20px] font-mono tracking-[0.4em] py-3 outline-none transition-all"
                    style={{
                      background: "#0d1424",
                      border: "1px solid #1c2740",
                      color: "#eef2f9",
                    }}
                    onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)"; }}
                    onBlur={e => { e.target.style.borderColor = "#1c2740"; e.target.style.boxShadow = "none"; }}
                  />
                </FieldWrap>

                <Checkbox
                  checked={rememberDevice}
                  onChange={() => setRememberDevice(v => !v)}
                  label="Confiar neste dispositivo por 30 dias"
                />

                <ErrorAlert msg={totpError} />

                <PrimaryBtn disabled={totpCode.length !== 6} loading={totpSubmitting}>
                  Verificar e entrar
                </PrimaryBtn>
              </form>
            </div>

          /* ── FORGOT PASSWORD ── */
          ) : step === "forgot" ? (
            <div>
              <BackLink onClick={() => goTo("credentials")} />
              <h2 className="text-[24px] font-bold mb-1.5" style={{ letterSpacing: "-0.4px" }}>Recuperar senha</h2>
              <p className="text-[14px] mb-7" style={{ color: "#8b97ad" }}>
                Informe seu e-mail e enviaremos um link para criar uma nova senha.
              </p>

              {forgotSent ? (
                <SuccessAlert msg="Se este e-mail estiver cadastrado, você receberá o link de recuperação em instantes." />
              ) : (
                <form onSubmit={e => { e.preventDefault(); setForgotSent(true); }} className="grid gap-4">
                  <FieldWrap label="E-mail cadastrado">
                    <TextInput
                      type="email"
                      value={forgotEmail}
                      onChange={setForgotEmail}
                      placeholder="voce@empresa.com.br"
                      required
                      autoComplete="email"
                      icon={<Mail className="w-4 h-4" />}
                    />
                  </FieldWrap>
                  <PrimaryBtn>Enviar link de recuperação</PrimaryBtn>
                </form>
              )}
            </div>

          /* ── REGISTER ── */
          ) : step === "register" ? (
            <div>
              <BackLink onClick={() => goTo("credentials")} />
              <h2 className="text-[24px] font-bold mb-1.5" style={{ letterSpacing: "-0.4px" }}>Criar conta</h2>
              <p className="text-[14px] mb-7" style={{ color: "#8b97ad" }}>
                30 dias de trial grátis ao se cadastrar.
              </p>
              <form onSubmit={handleRegister} className="grid gap-4">
                <FieldWrap label="Nome completo">
                  <TextInput value={regName} onChange={setRegName} placeholder="Seu nome" required autoComplete="name" icon={<User className="w-4 h-4" />} />
                </FieldWrap>
                <FieldWrap label="Usuário">
                  <TextInput value={regUser} onChange={setRegUser} placeholder="seu.usuario" required autoComplete="username" icon={<User className="w-4 h-4" />} />
                </FieldWrap>
                <FieldWrap label="E-mail (opcional)">
                  <TextInput type="email" value={regEmail} onChange={setRegEmail} placeholder="email@empresa.com" autoComplete="email" icon={<Mail className="w-4 h-4" />} />
                </FieldWrap>
                <FieldWrap label="Senha">
                  <TextInput
                    type={showRegPass ? "text" : "password"}
                    value={regPass}
                    onChange={setRegPass}
                    placeholder="Mínimo de 8 caracteres"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    icon={<Lock className="w-4 h-4" />}
                    rightSlot={
                      <button type="button" onClick={() => setShowRegPass(v => !v)} className="p-1.5 transition-colors hover:text-[#eef2f9]" style={{ background: "none", border: "none", cursor: "pointer", color: "#5d6b84" }}>
                        {showRegPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />
                  <PasswordStrength value={regPass} />
                </FieldWrap>

                <ErrorAlert msg={regError} />
                <PrimaryBtn loading={regSubmitting}>Criar conta e entrar</PrimaryBtn>

                <p className="text-center text-[13.5px]" style={{ color: "#8b97ad" }}>
                  Já tem conta?{" "}
                  <button type="button" onClick={() => goTo("credentials")} className="font-medium text-blue-400 hover:underline" style={{ background: "none", border: "none", cursor: "pointer" }}>
                    Entrar
                  </button>
                </p>
              </form>
            </div>

          /* ── CREDENTIALS (LOGIN) ── */
          ) : (
            <div>
              <h2 className="text-[24px] font-bold mb-1.5" style={{ letterSpacing: "-0.4px" }}>Entrar na sua conta</h2>
              <p className="text-[14px] mb-7" style={{ color: "#8b97ad" }}>
                Acesse o painel para gerenciar suas telas e conteúdos.
              </p>

              <form onSubmit={handleLogin} className="grid gap-4">
                <FieldWrap label="Usuário">
                  <TextInput
                    value={username}
                    onChange={setUsername}
                    placeholder="seu.usuario"
                    required
                    autoComplete="username"
                    icon={<User className="w-4 h-4" />}
                  />
                </FieldWrap>

                <FieldWrap label="Senha">
                  <TextInput
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={setPassword}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    icon={<Lock className="w-4 h-4" />}
                    rightSlot={
                      <button type="button" onClick={() => setShowPass(v => !v)} className="p-1.5 transition-colors hover:text-[#eef2f9]" style={{ background: "none", border: "none", cursor: "pointer", color: "#5d6b84" }}>
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />
                </FieldWrap>

                <div className="flex items-center justify-between -mt-1">
                  <div />
                  <button
                    type="button"
                    onClick={() => goTo("forgot")}
                    className="text-[13px] font-medium text-blue-400 hover:underline"
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                  >
                    Esqueci a senha
                  </button>
                </div>

                <div className="flex justify-center">
                  <div ref={turnstileRef} />
                </div>

                <ErrorAlert msg={error} />

                <PrimaryBtn loading={submitting}>Entrar</PrimaryBtn>

                {/* Divider */}
                <div className="flex items-center gap-3 text-[12px]" style={{ color: "#5d6b84" }}>
                  <div className="flex-1 h-px" style={{ background: "#16203a" }} />
                  ou continue com
                  <div className="flex-1 h-px" style={{ background: "#16203a" }} />
                </div>

                {/* Social */}
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-2.5 py-3 rounded-[10px] text-[14px] font-medium transition-all hover:border-[#2a3a5e]"
                  style={{ background: "#0d1424", border: "1px solid #1c2740", color: "#eef2f9", cursor: "pointer", fontFamily: "inherit" }}
                  onClick={() => alert("SSO: conecte seu provedor (Google Workspace, Microsoft Entra, etc.)")}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
                    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16A11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38Z"/>
                  </svg>
                  Entrar com Google
                </button>

                <p className="text-center text-[13.5px]" style={{ color: "#8b97ad" }}>
                  Ainda não tem conta?{" "}
                  <button
                    type="button"
                    onClick={() => goTo("register")}
                    className="font-medium text-blue-400 hover:underline"
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                  >
                    Criar conta
                  </button>
                </p>
              </form>
            </div>
          )}

          {/* Support box */}
          <div
            className="mt-8 flex items-center justify-between gap-3 rounded-[12px] p-[14px_16px]"
            style={{ background: "#0d1424", border: "1px solid #16203a" }}
          >
            <div>
              <div className="text-[12.5px] font-semibold">Suporte Técnico</div>
              <div className="text-[12px] mt-0.5" style={{ color: "#8b97ad" }}>(16) 98220-8695 · suporte@rpshow.com.br</div>
            </div>
            <a
              href="https://wa.me/5516982208695?text=Ol%C3%A1%2C+preciso+de+ajuda+com+o+RPShow+OnSign."
              target="_blank"
              rel="noreferrer"
              className="text-[12.5px] font-semibold text-blue-400 no-underline rounded-[8px] py-1.5 px-3.5 whitespace-nowrap transition-colors hover:brightness-110"
              style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}
            >
              Abrir chamado
            </a>
          </div>

          <p className="text-center mt-4 text-[11px]" style={{ color: "#5d6b84" }}>
            Protegido por Cloudflare Turnstile
          </p>
        </div>
      </main>
    </div>
  );
}
