export default function LoginPage() {
  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans">
      {/* ── Painel esquerdo: formulário ── */}
      <div className="flex w-[360px] shrink-0 flex-col justify-between bg-white px-10 py-10 shadow-xl">
        {/* Logo */}
        <div>
          <div className="mb-12 flex items-center gap-2">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="#79B4B0" />
              <path d="M10 26V10h8a6 6 0 0 1 0 12h-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="26" cy="22" r="4" fill="#fff" />
            </svg>
            <span className="text-2xl font-bold tracking-tight text-[#1a1a2e]">RPShow</span>
          </div>

          <h1 className="mb-1 text-2xl font-bold text-gray-900">Entrar</h1>
          <p className="mb-8 text-sm text-gray-500">
            Novo por aqui?{" "}
            <a href="#" className="font-medium text-[#79B4B0] hover:underline">
              Crie uma conta
            </a>
          </p>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                E-mail
              </label>
              <input
                type="email"
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-[#79B4B0] focus:ring-2 focus:ring-[#79B4B0]/20"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Senha
                </label>
                <a href="#" className="text-xs text-[#79B4B0] hover:underline">
                  Esqueceu a senha?
                </a>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-[#79B4B0] focus:ring-2 focus:ring-[#79B4B0]/20"
              />
            </div>

            <button className="w-full rounded-lg bg-[#79B4B0] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6aa3a0] active:scale-[0.98]">
              Entrar
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">ou</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50">
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Entrar com Google
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-6 text-xs text-gray-400">
          <a href="#" className="hover:text-gray-600">Privacidade</a>
          <a href="#" className="hover:text-gray-600">Termos</a>
          <a href="#" className="hover:text-gray-600">Suporte</a>
        </div>
      </div>

      {/* ── Painel direito: hero ── */}
      <div className="relative flex-1 overflow-hidden">
        {/* Imagem de fundo */}
        <img
          src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1400&q=80"
          alt="Digital signage"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Overlay teal */}
        <div className="absolute inset-0 bg-[#79B4B0]/75" />

        {/* Conteúdo sobre o overlay */}
        <div className="relative flex h-full flex-col items-start justify-center px-16 pb-16">
          {/* Badge */}
          <div className="mb-6 flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-green-300 shadow-[0_0_6px_2px_rgba(74,222,128,0.6)]" />
            <span className="text-xs font-medium text-white/90">Plataforma ativa • 99.9% uptime</span>
          </div>

          <h2 className="mb-4 max-w-sm text-4xl font-bold leading-tight text-white">
            Bem-vindo ao<br />
            <span className="text-white/80">RPShow TV</span>
          </h2>

          <p className="mb-10 max-w-xs text-base leading-relaxed text-white/80">
            Gerencie sua comunicação visual em qualquer tela, de qualquer lugar.
          </p>

          {/* Estatísticas */}
          <div className="flex gap-8">
            {[
              { value: "1.200+", label: "Telas ativas" },
              { value: "98%", label: "Satisfação" },
              { value: "24/7", label: "Suporte" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-white/60">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Decoração: círculos de fundo */}
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -top-10 right-32 h-48 w-48 rounded-full bg-white/5" />
      </div>
    </div>
  );
}
