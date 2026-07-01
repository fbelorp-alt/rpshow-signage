import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import {
  CheckCircle2, Clock, XCircle, CreditCard, Mail, AlertCircle,
  TrendingUp, DollarSign, CalendarClock, BadgeAlert, RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Payment = {
  id: number;
  referenceMonth: string;
  status: string;
  amount: string;
  notes: string | null;
  paidAt: string | null;
  dueDate: string | null;
};

type BillingData = {
  subscriptionStatus: string;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  monthlyAmount: string;
  payments: Payment[];
};

const MONTHS_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  const full = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${full[parseInt(m!) - 1]} ${y}`;
}

function shortMonth(ym: string) {
  const [, m] = ym.split("-");
  return MONTHS_PT[parseInt(m!) - 1] ?? m;
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseAmount(s: string | null | undefined) {
  if (!s) return 0;
  return parseFloat(String(s).replace(",", ".")) || 0;
}

function statusBadge(status: string) {
  if (status === "paid")
    return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Pago</Badge>;
  if (status === "pending")
    return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs">Pendente</Badge>;
  if (status === "overdue")
    return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">Vencido</Badge>;
  return <Badge className="bg-white/10 text-white/40 text-xs">{status}</Badge>;
}

export default function Financeiro() {
  const { data, isLoading, refetch } = useQuery<BillingData>({
    queryKey: ["billing-me"],
    queryFn: () => fetch("/api/billing/me", { credentials: "include" }).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-white/30" />
      </div>
    );
  }

  const status = data?.subscriptionStatus ?? "trial";
  const monthly = parseAmount(data?.monthlyAmount);
  const payments = data?.payments ?? [];

  const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + parseAmount(p.amount), 0);
  const totalPending = payments.filter(p => p.status === "pending").reduce((s, p) => s + parseAmount(p.amount), 0);
  const overdueCount = payments.filter(p => p.status === "overdue").length;

  // Last 6 months of payment history for chart (or all payments if fewer)
  const chartData = payments.slice(-6).map(p => ({
    month: shortMonth(p.referenceMonth),
    valor: parseAmount(p.amount),
    status: p.status,
  }));

  const statusConfig = {
    active: {
      Icon: CheckCircle2,
      label: "Assinatura Ativa",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
      badge: <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Ativo</Badge>,
    },
    trial: {
      Icon: Clock,
      label: "Período de Trial",
      color: "text-yellow-400",
      bg: "bg-yellow-500/10 border-yellow-500/20",
      badge: <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30">Trial</Badge>,
    },
    suspended: {
      Icon: XCircle,
      label: "Acesso Suspenso",
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/20",
      badge: <Badge className="bg-red-500/15 text-red-400 border-red-500/30">Suspenso</Badge>,
    },
    cancelled: {
      Icon: XCircle,
      label: "Assinatura Cancelada",
      color: "text-white/40",
      bg: "bg-white/5 border-white/10",
      badge: <Badge className="bg-white/10 text-white/40">Cancelado</Badge>,
    },
  };

  const cfg = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.suspended;
  const { Icon } = cfg;

  return (
    <div className="space-y-5 p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Financeiro</h1>
          <p className="text-sm text-white/45 mt-0.5">Situação da sua assinatura e histórico de pagamentos</p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Status card */}
      <div className={`border rounded-xl p-5 ${cfg.bg}`}>
        <div className="flex items-center gap-3">
          <Icon className={`w-9 h-9 ${cfg.color} flex-shrink-0`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-white">{cfg.label}</span>
              {cfg.badge}
            </div>
            {status === "trial" && data?.trialDaysLeft != null && (
              <p className="text-sm text-white/55 mt-0.5">
                {data.trialDaysLeft} dia{data.trialDaysLeft !== 1 ? "s" : ""} restantes de teste gratuito
                {data.trialEndsAt && (
                  <span className="text-white/35">
                    {" "}· vence em {new Date(data.trialEndsAt).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </p>
            )}
            {status === "active" && (
              <p className="text-sm text-white/55 mt-0.5">
                Plano mensal · {brl(monthly)}/mês
              </p>
            )}
          </div>
        </div>

        {status === "suspended" && (
          <div className="mt-4 flex items-start gap-2.5 bg-red-500/10 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-300">
              <p className="font-medium">Acesso bloqueado por inadimplência</p>
              <p className="text-red-300/70 mt-0.5">Entre em contato com o suporte para regularizar e liberar o acesso.</p>
            </div>
          </div>
        )}

        {status === "trial" && (
          <div className="mt-4 bg-yellow-500/8 border border-yellow-500/15 rounded-lg px-3 py-2.5">
            <p className="text-sm text-yellow-300/80">
              Para contratar o plano após o trial, entre em contato com nosso suporte.
            </p>
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/4 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-white/45 font-medium">Mensalidade</span>
          </div>
          <p className="text-xl font-bold text-white">{brl(monthly)}</p>
          <p className="text-[11px] text-white/30 mt-0.5">por mês</p>
        </div>

        <div className="bg-white/4 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-white/45 font-medium">Total Pago</span>
          </div>
          <p className="text-xl font-bold text-white">{brl(totalPaid)}</p>
          <p className="text-[11px] text-white/30 mt-0.5">{payments.filter(p => p.status === "paid").length} parcela(s)</p>
        </div>

        <div className="bg-white/4 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-white/45 font-medium">A Pagar</span>
          </div>
          <p className="text-xl font-bold text-white">{brl(totalPending)}</p>
          <p className="text-[11px] text-white/30 mt-0.5">{payments.filter(p => p.status === "pending").length} pendente(s)</p>
        </div>

        <div className="bg-white/4 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BadgeAlert className="w-4 h-4 text-red-400" />
            <span className="text-xs text-white/45 font-medium">Em Atraso</span>
          </div>
          <p className="text-xl font-bold text-white">{overdueCount}</p>
          <p className="text-[11px] text-white/30 mt-0.5">mensalidade{overdueCount !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Chart — only show if there are payments */}
      {chartData.length > 0 && (
        <div className="bg-white/4 border border-white/10 rounded-xl p-4">
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-4">
            Histórico de pagamentos
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v: number) => [brl(v), "Valor"]}
                contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "rgba(255,255,255,0.7)" }}
              />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.status === "paid"
                        ? "#10b981"
                        : entry.status === "overdue"
                        ? "#ef4444"
                        : "#eab308"
                    }
                    fillOpacity={0.75}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <span className="flex items-center gap-1.5 text-[11px] text-white/40">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/75 inline-block" /> Pago
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-white/40">
              <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500/75 inline-block" /> Pendente
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-white/40">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500/75 inline-block" /> Vencido
            </span>
          </div>
        </div>
      )}

      {/* Payment history table */}
      <div className="bg-white/4 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-white/50" />
          <span className="text-sm font-medium text-white/80">Histórico de mensalidades</span>
          {payments.length > 0 && (
            <span className="ml-auto text-xs text-white/30">{payments.length} registro{payments.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {payments.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="w-8 h-8 text-white/15 mx-auto mb-2" />
            <p className="text-white/30 text-sm">Nenhum pagamento registrado ainda</p>
            <p className="text-white/20 text-xs mt-1">Os registros aparecerão aqui conforme forem lançados</p>
          </div>
        ) : (
          <div className="divide-y divide-white/6">
            {[...payments].reverse().map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-3.5 h-3.5 text-white/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/85 font-medium">{formatMonth(p.referenceMonth)}</p>
                  {p.notes && <p className="text-xs text-white/35 mt-0.5 truncate">{p.notes}</p>}
                  {p.dueDate && p.status !== "paid" && (
                    <p className="text-xs text-white/30 mt-0.5">
                      Vencimento: {new Date(p.dueDate).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
                <span className="text-sm font-medium text-white/70">{brl(parseAmount(p.amount))}</span>
                {statusBadge(p.status)}
                {p.paidAt && (
                  <span className="text-xs text-white/25 hidden sm:block">
                    {new Date(p.paidAt).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Support */}
      <div className="bg-white/4 border border-white/10 rounded-xl p-4 flex items-start gap-3">
        <Mail className="w-4 h-4 text-white/35 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-white/70">Dúvidas sobre cobrança ou pagamentos? Fale com o suporte:</p>
          <a href="mailto:suporte@rpshow.com.br" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            suporte@rpshow.com.br
          </a>
        </div>
      </div>
    </div>
  );
}
