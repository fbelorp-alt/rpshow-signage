export default function LoginPage() {
  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans">

      {/* ── Painel esquerdo ── */}
      <div
        className="flex w-[380px] shrink-0 flex-col justify-between px-10 py-10"
        style={{ background: "linear-gradient(160deg, #0f2044 0%, #0a0a1a 100%)" }}
      >
        <div>
          {/* Logo real RPShow — sem fundo, cores originais */}
          <div className="mb-8">
            <img
              src="/__mockup/logo-rpshow-nobg.png"
              alt="RPShow OnSign"
              className="h-36 w-auto object-contain"
            />
          </div>

          <h1 className="mb-2 text-4xl font-bold text-white">Bem-vindo</h1>
          <p className="mb-8 text-base text-white/60">
            Entre com sua conta para continuar.{" "}
            <a href="#" className="font-semibold text-[#79B4B0] hover:underline">
              Criar conta
            </a>
          </p>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-white/50">
                E-mail
              </label>
              <input
                type="email"
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder-white/25 outline-none focus:border-[#79B4B0] focus:ring-2 focus:ring-[#79B4B0]/20"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-semibold uppercase tracking-wide text-white/50">
                  Senha
                </label>
                <a href="#" className="text-sm text-[#79B4B0] hover:underline">
                  Esqueceu?
                </a>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder-white/25 outline-none focus:border-[#79B4B0] focus:ring-2 focus:ring-[#79B4B0]/20"
              />
            </div>

            <button className="w-full rounded-lg bg-[#79B4B0] py-3 text-base font-bold text-white shadow-lg shadow-[#79B4B0]/30 transition hover:bg-[#6aa3a0] active:scale-[0.98]">
              Entrar
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-sm text-white/30">ou</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/10 bg-white/5 py-3 text-base font-medium text-white/80 transition hover:bg-white/10">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Entrar com Google
            </button>
          </div>
        </div>

        <div className="flex gap-6 text-xs text-white/25">
          <a href="#" className="hover:text-white/50">Privacidade</a>
          <a href="#" className="hover:text-white/50">Termos</a>
          <a href="#" className="hover:text-white/50">Suporte</a>
        </div>
      </div>

      {/* ── Painel direito: hero ── */}
      <div className="relative flex-1 overflow-hidden">
        {/* Foto Gemini: moça com logo RPShow OnSign na camiseta */}
        <img
          src="/__mockup/login-bg-gemini.png"
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

        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-[#79B4B0]/5" />
      </div>
    </div>
  );
}
