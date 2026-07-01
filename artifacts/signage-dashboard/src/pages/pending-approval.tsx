import { Clock, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PendingApproval() {
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-[#0a0d12] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-yellow-500/6 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8 text-yellow-400" />
        </div>

        <div>
          <h1 className="text-xl font-bold text-white mb-2">Cadastro em análise</h1>
          <p className="text-sm text-white/50 leading-relaxed">
            Sua conta foi criada e está aguardando aprovação do administrador.
            Você receberá acesso assim que for liberado.
          </p>
        </div>

        {/* WhatsApp CTA */}
        <a
          href="https://wa.me/5516982208695?text=Ol%C3%A1%2C+acabei+de+me+cadastrar+no+RPShow+OnSign+e+gostaria+de+liberar+meu+acesso."
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 hover:bg-emerald-500/15 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-emerald-400" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-emerald-300">Fale com o suporte RPShow</p>
            <p className="text-xs text-white/50 mt-0.5">(16) 98220-8695 · Clique para abrir o WhatsApp</p>
          </div>
        </a>

        <div className="bg-white/4 border border-white/10 rounded-xl p-4 text-left space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Como funciona</p>
          <ul className="space-y-1.5 text-sm text-white/60">
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 mt-0.5">1.</span>
              Clique no botão acima e envie uma mensagem no WhatsApp
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 mt-0.5">2.</span>
              Nossa equipe vai liberar seu acesso em instantes
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 mt-0.5">3.</span>
              Volte aqui e clique em "Verificar status" para entrar
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full gap-2 border-white/15 text-white/60 hover:text-white hover:border-white/30"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-4 h-4" /> Verificar status
          </Button>
          <button
            onClick={handleLogout}
            className="w-full text-xs text-white/25 hover:text-white/50 transition-colors pt-1 flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
