import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import {
  CheckCircle2, Clock, XCircle, CreditCard, Mail, AlertCircle,
  TrendingUp, CalendarClock, BadgeAlert, RefreshCw, Monitor,
  MapPin, Wifi, WifiOff, Monitor as MonitorIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ScreenItem = {
  id: number;
  name: string;
  location: string | null;
  status: string;
  code: string;
  monthlyPrice: string;
  createdAt: string;
};

type Payment = {
  id: number;
  screenId: number | null;
  screenName: string | null;
  screenCode: string | null;
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
  pricePerScreen: string;
  screenCount: number;
  screens: ScreenItem[];
  payments: Payment[];
};

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  const full = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${full[parseInt(m!) - 1]} ${y}`;
}

function shortMonth(ym: string) {
  const [, m] = ym.split("-");
  return MONTHS_PT[parseInt(m!) - 1] ?? m;
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseAmt(s: string | null | undefined) {
  if (!s) return 0;
  return parseFloat(String(s).replace(",", ".")) || 0;
}

function statusBadge(status: string) {
  if (status === "paid")
    return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs">Pago</Badge>;
  if (status === "pending")
    return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30 text-xs">Pendente</Badge>;
  if (status === "overdue")
    return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-xs">Vencido</Badge>;
  return <Badge className="text-xs">{status}</Badge>;
}

// Badge de status de pagamento de uma tela específica
function screenPaymentBadge(payment: Payment | undefined, subscriptionStatus: string) {
  if (!payment) {
    if (subscriptionStatus === "trial")
      return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px] px-1.5 py-0">Trial</Badge>;
    return <Badge className="bg-muted/50 text-muted-foreground text-[10px] px-1.5 py-0">Sem cobrança</Badge>;
  }
  if (payment.status === "paid")
    return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] px-1.5 py-0">✓ Pago</Badge>;
  if (payment.status === "overdue")
    return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px] px-1.5 py-0">⚠ Vencido</Badge>;
  if (payment.status === "pending") {
    const isLate = payment.dueDate && new Date(payment.dueDate) < new Date();
    if (isLate)
      return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px] px-1.5 py-0">⚠ Vencido</Badge>;
    return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30 text-[10px] px-1.5 py-0">Pendente</Badge>;
  }
  return <Badge className="text-[10px] px-1.5 py-0">{payment.status}</Badge>;
}

export default function Financeiro() {
  const { data, isLoading, refetch } = useQuery<BillingData>({
    queryKey: ["billing-me"],
    queryFn: () => fetch("/api/billing/me", { credentials: "include" }).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status = data?.subscriptionStatus ?? "trial";
  const monthly = parseAmt(data?.monthlyAmount);
  const pricePerScreen = parseAmt(data?.pricePerScreen);
  const screens = data?.screens ?? [];
  const payments = data?.payments ?? [];
  const cm = currentMonth();

  // Mapa: screenId → pagamento do mês atual
  const currentMonthPaymentByScreen = new Map<number, Payment>();
  for (const p of payments) {
    if (p.referenceMonth === cm && p.screenId !== null) {
      // Se já há um registro, prefere o mais recente (maior id)
      const existing = currentMonthPaymentByScreen.get(p.screenId!);
      if (!existing || p.id > existing.id) {
        currentMonthPaymentByScreen.set(p.screenId!, p);
      }
    }
  }

  const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + parseAmt(p.amount), 0);
  const totalPending = payments.filter(p => p.status === "pending").reduce((s, p) => s + parseAmt(p.amount), 0);
  const overdueCount = payments.filter(p =>
    p.status === "overdue" || (p.status === "pending" && p.dueDate && new Date(p.dueDate) < new Date())
  ).length;
  const chartData = payments.slice(-6).map(p => ({
    month: shortMonth(p.referenceMonth),
    valor: parseAmt(p.amount),
    status: p.status,
  }));

  const statusConfig = {
    active: {
      Icon: CheckCircle2, label: "Assinatura Ativa", color: "text-emerald-500",
      bg: "bg-emerald-50 border-emerald-200",
      badge: <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Ativo</Badge>,
    },
    trial: {
      Icon: Clock, label: "Período de Trial", color: "text-yellow-500",
      bg: "bg-yellow-50 border-yellow-200",
      badge: <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">Trial</Badge>,
    },
    suspended: {
      Icon: XCircle, label: "Acesso Suspenso", color: "text-red-500",
      bg: "bg-red-50 border-red-200",
      badge: <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Suspenso</Badge>,
    },
    cancelled: {
      Icon: XCircle, label: "Assinatura Cancelada", color: "text-muted-foreground",
      bg: "bg-muted border-border",
      badge: <Badge variant="secondary">Cancelado</Badge>,
    },
  };

  const cfg = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.suspended;
  const { Icon } = cfg;

  // Agrupa histórico por tela para exibição
  const paymentsWithScreen = [...payments].reverse();

  return (
    <div className="space-y-5 p-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sua assinatura, telas contratadas e histórico de pagamentos</p>
        </div>
        <button onClick={() => refetch()} className="p-1.5 rounded-lg border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Status card */}
      <div className={`border rounded-xl p-5 ${cfg.bg}`}>
        <div className="flex items-center gap-3">
          <Icon className={`w-9 h-9 ${cfg.color} flex-shrink-0`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-foreground">{cfg.label}</span>
              {cfg.badge}
            </div>
            {status === "trial" && data?.trialDaysLeft != null && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {data.trialDaysLeft} dia{data.trialDaysLeft !== 1 ? "s" : ""} restantes de teste gratuito
                {data.trialEndsAt && (
                  <span className="text-muted-foreground/60"> · vence em {new Date(data.trialEndsAt).toLocaleDateString("pt-BR")}</span>
                )}
              </p>
            )}
            {status === "active" && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {screens.length} tela{screens.length !== 1 ? "s" : ""} · {brl(pricePerScreen)}/tela/mês · Total: {brl(monthly)}/mês
              </p>
            )}
          </div>
        </div>
        {status === "suspended" && (
          <div className="mt-4 flex items-start gap-2.5 bg-red-100 border border-red-200 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <p className="font-medium">Acesso bloqueado por inadimplência</p>
              <p className="text-red-600/80 mt-0.5">Entre em contato com o suporte para regularizar e liberar o acesso.</p>
            </div>
          </div>
        )}
        {status === "trial" && (
          <div className="mt-4 bg-yellow-100 border border-yellow-200 rounded-lg px-3 py-2.5">
            <p className="text-sm text-yellow-700">Para contratar o plano após o trial, entre em contato com nosso suporte.</p>
          </div>
        )}
      </div>

      {/* ── Per-screen breakdown com status de pagamento ────────────────────── */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Monitor className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Telas contratadas</span>
          <span className="ml-auto text-xs text-muted-foreground">{brl(pricePerScreen)}/tela/mês</span>
        </div>

        {screens.length === 0 ? (
          <div className="text-center py-10">
            <MonitorIcon className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Nenhuma tela cadastrada ainda</p>
            <p className="text-muted-foreground/60 text-xs mt-1">As telas aparecem aqui após serem pareadas</p>
          </div>
        ) : (
          <>
            {/* Legenda do mês atual */}
            <div className="px-4 py-2 bg-muted/30 border-b">
              <p className="text-[11px] text-muted-foreground">
                Status de pagamento · <span className="font-medium text-foreground">{formatMonth(cm)}</span>
              </p>
            </div>

            <div className="divide-y">
              {screens.map((s, i) => {
                const pay = currentMonthPaymentByScreen.get(s.id);
                return (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{s.name}</p>
                        {s.status === "online" ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                            <Wifi className="w-3 h-3" /> online
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <WifiOff className="w-3 h-3" /> offline
                          </span>
                        )}
                        {/* Badge de status do pagamento do mês atual */}
                        {screenPaymentBadge(pay, status)}
                      </div>
                      {s.location && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-muted-foreground/50" />
                          <p className="text-xs text-muted-foreground truncate">{s.location}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[11px] text-muted-foreground/50">Código: {s.code}</p>
                        {pay?.dueDate && pay.status !== "paid" && (
                          <p className="text-[11px] text-muted-foreground/60">
                            · Vence: {new Date(pay.dueDate).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                        {pay?.paidAt && (
                          <p className="text-[11px] text-muted-foreground/60">
                            · Pago em {new Date(pay.paidAt).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-foreground">{brl(parseAmt(pay?.amount ?? s.monthlyPrice))}</p>
                      <p className="text-[11px] text-muted-foreground">por mês</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Subtotal row */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-t">
              <span className="text-sm text-muted-foreground">
                {screens.length} tela{screens.length !== 1 ? "s" : ""} × {brl(pricePerScreen)}
              </span>
              <span className="text-base font-bold text-foreground">{brl(screens.length * pricePerScreen)}/mês</span>
            </div>
          </>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-muted-foreground font-medium">Mensalidade</span>
          </div>
          <p className="text-xl font-bold text-foreground">{brl(monthly)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{screens.length} tela{screens.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground font-medium">Total Pago</span>
          </div>
          <p className="text-xl font-bold text-foreground">{brl(totalPaid)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{payments.filter(p => p.status === "paid").length} parcela(s)</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-muted-foreground font-medium">A Pagar</span>
          </div>
          <p className="text-xl font-bold text-foreground">{brl(totalPending)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{payments.filter(p => p.status === "pending").length} pendente(s)</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BadgeAlert className="w-4 h-4 text-red-500" />
            <span className="text-xs text-muted-foreground font-medium">Em Atraso</span>
          </div>
          <p className={`text-xl font-bold ${overdueCount > 0 ? "text-red-500" : "text-foreground"}`}>{overdueCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">mensalidade{overdueCount !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Histórico de pagamentos</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v: number) => [brl(v), "Valor"]}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.status === "paid" ? "#10b981" : entry.status === "overdue" ? "#ef4444" : "#eab308"} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center">
            {[["#10b981","Pago"],["#eab308","Pendente"],["#ef4444","Vencido"]].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c, opacity: 0.8 }} /> {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Histórico de mensalidades — agora com nome da tela */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Histórico de mensalidades</span>
          {payments.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">{payments.length} registro{payments.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        {payments.length === 0 ? (
          <div className="text-center py-10">
            <CreditCard className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Nenhum pagamento registrado ainda</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Os registros aparecem aqui conforme o admin lançar as cobranças</p>
          </div>
        ) : (
          <div className="divide-y">
            {paymentsWithScreen.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-foreground font-medium">{formatMonth(p.referenceMonth)}</p>
                    {/* Nome + código da tela */}
                    {p.screenName && (
                      <span className="text-[11px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 font-mono">
                        {p.screenName}
                        {p.screenCode && <span className="text-muted-foreground/50"> · {p.screenCode}</span>}
                      </span>
                    )}
                  </div>
                  {p.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.notes}</p>}
                  {p.dueDate && p.status !== "paid" && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">Vencimento: {new Date(p.dueDate).toLocaleDateString("pt-BR")}</p>
                  )}
                </div>
                <span className="text-sm font-semibold text-foreground">{brl(parseAmt(p.amount))}</span>
                {statusBadge(p.status)}
                {p.paidAt && (
                  <span className="text-xs text-muted-foreground hidden sm:block">{new Date(p.paidAt).toLocaleDateString("pt-BR")}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Support */}
      <div className="bg-card border rounded-xl p-4 flex items-start gap-3">
        <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-foreground">Dúvidas sobre cobrança ou pagamentos? Fale com o suporte:</p>
          <a href="mailto:suporte@rpshow.com.br" className="text-sm text-blue-500 hover:text-blue-600 transition-colors">
            suporte@rpshow.com.br
          </a>
        </div>
      </div>
    </div>
  );
}
