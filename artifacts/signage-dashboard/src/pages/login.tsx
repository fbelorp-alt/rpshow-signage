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

type Step = "credentials" | "totp" | "setup";

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
          <div className="overflow-hidden mx-auto" style={{ height: "100px", maxWidth: "384px" }}>
            <img
              src="/logo-rpshow.png"
              alt="RPShow onSign"
              className="w-full object-top"
              style={{ height: "190px", objectFit: "cover", objectPosition: "top" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <p className="text-[10px] text-white/35 mt-2 tracking-widest uppercase">Sistemas Integrados</p>
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
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-white/20 mt-4">
          Protegido por Cloudflare Turnstile
        </p>
      </div>
    </div>
  );
}
