import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, User, Smartphone } from "lucide-react";

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

type Step = "credentials" | "totp" | "setup" | "register";

export default function Login() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  // Step control
  const [step, setStep] = useState<Step>("credentials");

  // Credentials step
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [cfToken, setCfToken] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [needSetup, setNeedSetup] = useState(false);

  // Register step
  const [regName, setRegName] = useState("");
  const [regUser, setRegUser] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regError, setRegError] = useState("");
  const [regSubmitting, setRegSubmitting] = useState(false);

  // TOTP step
  const [tempToken, setTempToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [totpError, setTotpError] = useState("");
  const [totpSubmitting, setTotpSubmitting] = useState(false);
  const totpInputRef = useRef<HTMLInputElement>(null);

  // Setup form
  const [setupName, setSetupName] = useState("");
  const [setupUser, setSetupUser] = useState("");
  const [setupPass, setSetupPass] = useState("");
  const [setupMsg, setSetupMsg] = useState("");

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

  // Auto-focus TOTP input when step changes
  useEffect(() => {
    if (step === "totp") {
      setTimeout(() => totpInputRef.current?.focus(), 100);
    }
  }, [step]);

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
        setError(data.error ?? "Erro ao fazer login");
        if (widgetId.current) window.turnstile?.reset(widgetId.current);
        setCfToken("");
        return;
      }
      if (data.requiresTotp) {
        setTempToken(data.tempToken);
        setStep("totp");
        return;
      }
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
        // Server returns new tempToken on invalid code so user can retry
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

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-[#0a0d12] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/8 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          {/* Crop proporcional: mostra top 52% da imagem (logo text), esconde ícones inferiores */}
          <div className="mx-auto" style={{ maxWidth: "360px", width: "100%" }}>
            <div style={{ position: "relative", overflow: "hidden", paddingBottom: "38%" }}>
              {/* paddingBottom = 38% → mostra top 58% da imagem, esconde ícones (começam em 56%) */}
              <img
                src="/logo-rpshow.png"
                alt="RPShow onSign"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "auto" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          </div>
          <p className="text-white/50 tracking-[0.25em] uppercase mt-2" style={{ fontSize: "13px", fontWeight: 500, letterSpacing: "0.22em" }}>
            Sistemas Integrados
          </p>
        </div>

        <div className="bg-white/4 border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-2xl">

          {/* ── First-time setup ── */}
          {needSetup ? (
            <>
              <div className="flex items-center gap-2 mb-5">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white">Criar conta administrador</h2>
              </div>
              <form onSubmit={handleSetup} className="space-y-4">
                <div>
                  <Label className="text-xs text-white/60 mb-1.5">Nome completo</Label>
                  <Input value={setupName} onChange={e => setSetupName(e.target.value)} placeholder="Ex: João Silva" required className="bg-white/6 border-white/12 text-white placeholder:text-white/25 focus:border-blue-500/60 h-10" />
                </div>
                <div>
                  <Label className="text-xs text-white/60 mb-1.5">Usuário</Label>
                  <Input value={setupUser} onChange={e => setSetupUser(e.target.value)} placeholder="Ex: admin" required className="bg-white/6 border-white/12 text-white placeholder:text-white/25 focus:border-blue-500/60 h-10" />
                </div>
                <div>
                  <Label className="text-xs text-white/60 mb-1.5">Senha (mín. 6 caracteres)</Label>
                  <Input type="password" value={setupPass} onChange={e => setSetupPass(e.target.value)} placeholder="••••••••" required minLength={6} className="bg-white/6 border-white/12 text-white placeholder:text-white/25 focus:border-blue-500/60 h-10" />
                </div>
                {setupMsg && <p className="text-xs text-blue-400">{setupMsg}</p>}
                <Button type="submit" className="w-full h-10">Criar conta e entrar</Button>
              </form>
            </>

          /* ── TOTP verification step ── */
          ) : step === "totp" ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Smartphone className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white">Verificação em 2 etapas</h2>
              </div>
              <p className="text-xs text-white/45 mb-5">
                Abra o <span className="text-white/70">Google Authenticator</span> e informe o código de 6 dígitos.
              </p>
              <form onSubmit={handleTotpVerify} className="space-y-4">
                <div>
                  <Label className="text-xs text-white/60 mb-1.5">Código de verificação</Label>
                  <Input
                    ref={totpInputRef}
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000 000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    className="bg-white/6 border-white/12 text-white placeholder:text-white/25 focus:border-blue-500/60 h-10 text-center text-lg tracking-[0.4em] font-mono"
                  />
                </div>

                {/* Remember device checkbox */}
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <div
                    onClick={() => setRememberDevice(v => !v)}
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${rememberDevice ? "bg-blue-500 border-blue-500" : "border-white/30 bg-white/5"}`}
                  >
                    {rememberDevice && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors select-none">
                    Confiar neste dispositivo por 30 dias
                  </span>
                </label>

                {totpError && (
                  <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {totpError}
                  </div>
                )}

                <Button type="submit" disabled={totpSubmitting || totpCode.length !== 6} className="w-full h-10 gap-2">
                  {totpSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Verificar e entrar
                </Button>

                <button
                  type="button"
                  onClick={() => { setStep("credentials"); setTotpCode(""); setTotpError(""); setTempToken(""); }}
                  className="w-full text-xs text-white/30 hover:text-white/50 transition-colors pt-1"
                >
                  ← Voltar
                </button>
              </form>
            </>

          /* ── Register ── */
          ) : step === "register" ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white">Criar nova conta</h2>
              </div>
              <p className="text-xs text-white/45 mb-5">30 dias de trial grátis ao se cadastrar.</p>
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <Label className="text-xs text-white/60 mb-1.5">Nome completo</Label>
                  <Input value={regName} onChange={e => setRegName(e.target.value)} placeholder="Seu nome" required className="bg-white/6 border-white/12 text-white placeholder:text-white/25 focus:border-blue-500/60 h-10" />
                </div>
                <div>
                  <Label className="text-xs text-white/60 mb-1.5">Usuário</Label>
                  <Input value={regUser} onChange={e => setRegUser(e.target.value)} placeholder="seu.usuario" required autoComplete="username" className="bg-white/6 border-white/12 text-white placeholder:text-white/25 focus:border-blue-500/60 h-10" />
                </div>
                <div>
                  <Label className="text-xs text-white/60 mb-1.5">E-mail (opcional)</Label>
                  <Input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="email@empresa.com" className="bg-white/6 border-white/12 text-white placeholder:text-white/25 focus:border-blue-500/60 h-10" />
                </div>
                <div>
                  <Label className="text-xs text-white/60 mb-1.5">Senha (mín. 6 caracteres)</Label>
                  <Input type="password" value={regPass} onChange={e => setRegPass(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete="new-password" className="bg-white/6 border-white/12 text-white placeholder:text-white/25 focus:border-blue-500/60 h-10" />
                </div>
                {regError && (
                  <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{regError}</div>
                )}
                <Button type="submit" disabled={regSubmitting} className="w-full h-10 gap-2">
                  {regSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Criar conta e entrar
                </Button>
                <button type="button" onClick={() => { setStep("credentials"); setRegError(""); }} className="w-full text-xs text-white/30 hover:text-white/50 transition-colors pt-1">
                  ← Já tenho conta
                </button>
              </form>
            </>

          /* ── Normal login ── */
          ) : (
            <>
              <h2 className="text-sm font-semibold text-white mb-5">Entrar na plataforma</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label className="text-xs text-white/60 mb-1.5">Usuário</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                    <Input
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="seu.usuario"
                      required
                      autoComplete="username"
                      className="pl-9 bg-white/6 border-white/12 text-white placeholder:text-white/25 focus:border-blue-500/60 h-10"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-white/60 mb-1.5">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                    <Input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="pl-9 pr-9 bg-white/6 border-white/12 text-white placeholder:text-white/25 focus:border-blue-500/60 h-10"
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-center">
                  <div ref={turnstileRef} />
                </div>

                {error && (
                  <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <Button type="submit" disabled={submitting} className="w-full h-10 gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Entrar
                </Button>

                <button
                  type="button"
                  onClick={() => { setStep("register"); setError(""); }}
                  className="w-full text-xs text-white/30 hover:text-white/50 transition-colors pt-1"
                >
                  Não tem conta? <span className="text-blue-400/70">Criar agora</span>
                </button>
              </form>
            </>
          )}
        </div>

        {/* WhatsApp suporte */}
        <a
          href="https://wa.me/5516982208695?text=Ol%C3%A1%2C+preciso+de+ajuda+com+o+RPShow+OnSign."
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 mt-5 text-white/40 hover:text-emerald-400 transition-colors group"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <span className="text-[12px]">Suporte: <strong className="font-semibold">(16) 98220-8695</strong></span>
        </a>

        <p className="text-center text-[11px] text-white/20 mt-3">
          Protegido por Cloudflare Turnstile
        </p>
      </div>
    </div>
  );
}
