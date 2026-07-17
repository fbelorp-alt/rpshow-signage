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

type Step = "credentials" | "totp" | "setup" | "register" | "forgot" | "reset";

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

  // Forgot password step
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  // Reset password step (via emailed token)
  const [resetToken, setResetToken] = useState("");
  const [resetPass, setResetPass] = useState("");
  const [resetPass2, setResetPass2] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);

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

  // If the user arrived via the e-mail reset link (?resetToken=...), jump straight to the reset step
  // Also handles ?error= from Google OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("resetToken");
    if (t) {
      setResetToken(t);
      setStep("reset");
    }
    const oauthError = params.get("error");
    if (oauthError) {
      const msgs: Record<string, string> = {
        google_denied: "Acesso com Google cancelado.",
        google_not_configured: "Login com Google não configurado.",
        google_token_failed: "Falha ao autenticar com Google. Tente novamente.",
        google_userinfo_failed: "Não foi possível obter dados do Google. Tente novamente.",
        google_error: "Erro no login com Google. Tente novamente.",
        account_blocked: "Conta bloqueada. Entre em contato com o suporte.",
      };
      setError(msgs[oauthError] ?? "Erro ao entrar. Tente novamente.");
      window.history.replaceState({}, "", "/login");
    }
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotMsg("");
    setForgotSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setForgotError(data.error ?? "Erro ao solicitar recuperação"); return; }
      setForgotMsg(data.message ?? "Se o e-mail estiver cadastrado, enviaremos um link de recuperação.");
    } catch {
      setForgotError("Erro de conexão. Tente novamente.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetMsg("");
    if (resetPass !== resetPass2) { setResetError("As senhas não coincidem"); return; }
    setResetSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password: resetPass }),
      });
      const data = await res.json();
      if (!res.ok) { setResetError(data.error ?? "Erro ao redefinir senha"); return; }
      setResetMsg("Senha redefinida com sucesso! Você já pode entrar.");
    } catch {
      setResetError("Erro de conexão. Tente novamente.");
    } finally {
      setResetSubmitting(false);
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
    <div className="flex h-screen w-screen overflow-hidden font-sans">

      {/* ── Painel esquerdo: login ── */}
      <div
        className="flex w-full shrink-0 flex-col justify-between overflow-y-auto px-8 py-10 md:w-[440px] md:px-10"
        style={{ background: "linear-gradient(160deg, #0f2044 0%, #0a0a1a 100%)" }}
      >
        <div>
          {/* Logo */}
          <div className="mb-8">
            <img
              src="/logo-rpshow-transparent.png"
              alt="RPShow OnSign"
              className="h-32 w-auto object-contain"
            />
            <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Sistema de <span className="text-[#79B4B0]">Gestão</span> de Painéis de LED
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

          /* ── Forgot password ── */
          ) : step === "forgot" ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white">Recuperar senha</h2>
              </div>
              <p className="text-xs text-white/45 mb-5">
                Informe o e-mail cadastrado na sua conta. Enviaremos um link para redefinir sua senha.
              </p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <Label className="text-xs text-white/60 mb-1.5">E-mail</Label>
                  <Input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="email@empresa.com"
                    required
                    autoComplete="email"
                    className="bg-white/6 border-white/12 text-white placeholder:text-white/25 focus:border-blue-500/60 h-10"
                  />
                </div>

                {forgotMsg && (
                  <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                    {forgotMsg}
                  </div>
                )}
                {forgotError && (
                  <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {forgotError}
                  </div>
                )}

                <Button type="submit" disabled={forgotSubmitting || !!forgotMsg} className="w-full h-10 gap-2">
                  {forgotSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Enviar link de recuperação
                </Button>

                <button
                  type="button"
                  onClick={() => { setStep("credentials"); setForgotError(""); setForgotMsg(""); setForgotEmail(""); }}
                  className="w-full text-xs text-white/30 hover:text-white/50 transition-colors pt-1"
                >
                  ← Voltar para o login
                </button>
              </form>
            </>

          /* ── Reset password (via e-mail link) ── */
          ) : step === "reset" ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white">Criar nova senha</h2>
              </div>
              <p className="text-xs text-white/45 mb-5">Escolha uma nova senha para sua conta.</p>
              {resetMsg ? (
                <>
                  <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 mb-4">
                    {resetMsg}
                  </div>
                  <Button
                    type="button"
                    onClick={() => { setStep("credentials"); setResetMsg(""); window.history.replaceState({}, "", "/login"); }}
                    className="w-full h-10"
                  >
                    Ir para o login
                  </Button>
                </>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <Label className="text-xs text-white/60 mb-1.5">Nova senha (mín. 6 caracteres)</Label>
                    <Input
                      type="password"
                      value={resetPass}
                      onChange={e => setResetPass(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="bg-white/6 border-white/12 text-white placeholder:text-white/25 focus:border-blue-500/60 h-10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-white/60 mb-1.5">Confirmar nova senha</Label>
                    <Input
                      type="password"
                      value={resetPass2}
                      onChange={e => setResetPass2(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="bg-white/6 border-white/12 text-white placeholder:text-white/25 focus:border-blue-500/60 h-10"
                    />
                  </div>
                  {resetError && (
                    <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      {resetError}
                    </div>
                  )}
                  <Button type="submit" disabled={resetSubmitting} className="w-full h-10 gap-2">
                    {resetSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Redefinir senha
                  </Button>
                </form>
              )}
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
                  <Label className="text-xs text-white/60 mb-1.5">E-mail</Label>
                  <Input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="email@empresa.com" required autoComplete="email" className="bg-white/6 border-white/12 text-white placeholder:text-white/25 focus:border-blue-500/60 h-10" />
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

              {/* Botão Google */}
              <a
                href="/api/auth/google"
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/15 bg-white/5 px-4 h-10 text-sm font-medium text-white transition-colors hover:bg-white/10 mb-4"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Entrar com Google
              </a>

              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] text-white/30">ou</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

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
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs text-white/60">Senha</Label>
                    <button
                      type="button"
                      onClick={() => { setStep("forgot"); setError(""); }}
                      className="text-xs text-blue-400/70 hover:text-blue-400 transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
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

        </div>{/* fecha wrapper logo+card */}

        {/* Rodapé esquerdo */}
        <div className="mt-6">
          <a
            href="https://wa.me/5516982208695?text=Ol%C3%A1%2C+preciso+de+ajuda+com+o+RPShow+OnSign."
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 text-white/40 hover:text-emerald-400 transition-colors"
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
      </div>{/* fecha painel esquerdo */}

      {/* ── Painel direito: hero (oculto no mobile) ── */}
      <div className="relative hidden flex-1 overflow-hidden md:block">
        <img
          src="/login-bg-lab.png"
          alt="Equipe gerenciando sistemas"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgba(10,20,60,0.45) 0%, rgba(15,32,68,0.30) 60%, rgba(121,180,176,0.05) 100%)" }}
        />
        <div className="relative flex h-full flex-col items-start justify-center px-16 pb-16">
          <div className="mb-6 flex items-center gap-2 rounded-full border border-[#79B4B0]/40 bg-[#79B4B0]/10 px-4 py-1.5 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-[#79B4B0] shadow-[0_0_8px_3px_rgba(121,180,176,0.7)]" />
            <span className="text-xs font-medium text-white/90">Plataforma ativa · 99.9% uptime</span>
          </div>
          <h2 className="mb-4 max-w-md text-5xl font-extrabold leading-tight text-white drop-shadow-lg">
            Sistemas<br />
            <span className="text-[#79B4B0]">Integrados</span>
          </h2>
          <p className="mb-10 max-w-xs text-base leading-relaxed text-white/70">
            Conecte TVs, painéis LED e telas ao sistema de gestão de conteúdo RPShow OnSign.
          </p>
          <div className="flex gap-10">
            {[
              { value: "1.200+", label: "Telas ativas" },
              { value: "98%",    label: "Satisfação" },
              { value: "24/7",   label: "Suporte" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-extrabold text-white">{s.value}</p>
                <p className="text-xs text-white/50">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
