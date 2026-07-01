import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle, CreditCard, Phone, Mail, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type BillingData = {
  subscriptionStatus: string;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  monthlyAmount: string;
  payments: {
    id: number;
    referenceMonth: string;
    status: string;
    amount: string;
    notes: string | null;
    paidAt: string | null;
    dueDate: string | null;
  }[];
};

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${months[parseInt(m!) - 1]} ${y}`;
}

export default function Financeiro() {
  const { data, isLoading } = useQuery<BillingData>({
    queryKey: ["billing-me"],
    queryFn: () => fetch("/api/billing/me", { credentials: "include" }).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  const status = data?.subscriptionStatus ?? "trial";

  const statusConfig = {
    active: {
      icon: CheckCircle2,
      label: "Assinatura Ativa",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
      badge: <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Ativo</Badge>,
    },
    trial: {
      icon: Clock,
      label: "Período de Trial",
      color: "text-yellow-400",
      bg: "bg-yellow-500/10 border-yellow-500/20",
      badge: <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30">Trial</Badge>,
    },
    suspended: {
      icon: XCircle,
      label: "Acesso Suspenso",
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/20",
      badge: <Badge className="bg-red-500/15 text-red-400 border-red-500/30">Suspenso</Badge>,
    },
    cancelled: {
      icon: XCircle,
      label: "Assinatura Cancelada",
      color: "text-white/40",
      bg: "bg-white/5 border-white/10",
      badge: <Badge className="bg-white/10 text-white/40">Cancelado</Badge>,
    },
  };

  const cfg = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.suspended;
  const Icon = cfg.icon;

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Financeiro</h1>
        <p className="text-sm text-white/45 mt-0.5">Situação da sua assinatura</p>
      </div>

      {/* Status card */}
      <div className={`border rounded-xl p-5 ${cfg.bg}`}>
        <div className="flex items-center gap-3 mb-3">
          <Icon className={`w-8 h-8 ${cfg.color}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-white">{cfg.label}</span>
              {cfg.badge}
            </div>
            {status === "trial" && data?.trialDaysLeft !== null && (
              <p className="text-sm text-white/55 mt-0.5">
                {data!.trialDaysLeft} dia{data!.trialDaysLeft !== 1 ? "s" : ""} restantes de trial
              </p>
            )}
            {status === "active" && (
              <p className="text-sm text-white/55 mt-0.5">
                Plano mensal · R$ {data?.monthlyAmount}/mês
              </p>
            )}
          </div>
        </div>

        {status === "suspended" && (
          <div className="mt-3 flex items-start gap-2.5 bg-red-500/10 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-300">
              <p className="font-medium">Acesso bloqueado por inadimplência</p>
              <p className="text-red-300/70 mt-0.5">
                Procure o suporte para regularizar sua situação e liberar o acesso.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Contact support */}
      <div className="bg-white/4 border border-white/10 rounded-xl p-4">
        <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">Suporte</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Phone className="w-3.5 h-3.5 text-white/35" />
            <span>Entre em contato com nosso suporte para dúvidas ou pagamentos</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Mail className="w-3.5 h-3.5 text-white/35" />
            <span className="text-blue-400">suporte@rpshow.com.br</span>
          </div>
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-white/4 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-white/50" />
          <span className="text-sm font-medium text-white/80">Histórico de mensalidades</span>
        </div>

        {!data?.payments || data.payments.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm">
            Nenhum pagamento registrado ainda
          </div>
        ) : (
          <div className="divide-y divide-white/6">
            {data.payments.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <CreditCard className="w-4 h-4 text-white/25 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-white/85">{formatMonth(p.referenceMonth)}</p>
                  {p.notes && <p className="text-xs text-white/35 mt-0.5">{p.notes}</p>}
                </div>
                <span className="text-sm text-white/55">R$ {p.amount}</span>
                {p.status === "paid" && (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Pago</Badge>
                )}
                {p.status === "pending" && (
                  <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs">Pendente</Badge>
                )}
                {p.status === "overdue" && (
                  <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">Vencido</Badge>
                )}
                {p.paidAt && (
                  <span className="text-xs text-white/30">
                    {new Date(p.paidAt).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
