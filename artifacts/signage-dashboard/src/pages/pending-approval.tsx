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

        <div className="bg-white/4 border border-white/10 rounded-xl p-4 text-left space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Próximos passos</p>
          <ul className="space-y-1.5 text-sm text-white/60">
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 mt-0.5">•</span>
              O administrador foi notificado do seu cadastro
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 mt-0.5">•</span>
              Após aprovação, você terá acesso completo à plataforma
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 mt-0.5">•</span>
              Caso precise de ajuda, entre em contato com o suporte
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
