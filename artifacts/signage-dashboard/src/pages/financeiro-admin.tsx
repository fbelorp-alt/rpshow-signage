import React from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, CheckCircle2, Clock, AlertCircle, TrendingUp, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

type Payment = {
  id: number;
  referenceMonth: string;
  status: string;
  amount: string;
  paidAt: string | null;
  notes: string | null;
};

type Operator = {
  id: number;
  name: string;
  username: string;
  subscriptionStatus: string;
  monthlyAmount: string;
  trialEndsAt: string | null;
  payments: Payment[];
};

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m!) - 1]}/${y}`;
}

function statusBadge(s: string) {
  const map: Record<string, React.ReactElement> = {
    paid: <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Pago</Badge>,
    pending: <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-[10px]">Pendente</Badge>,
    overdue: <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">Vencido</Badge>,
  };
  return map[s] ?? <Badge variant="outline" className="text-[10px]">{s}</Badge>;
}

function subBadge(s: string) {
  const map: Record<string, React.ReactElement> = {
    active: <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Ativo</Badge>,
    trial: <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-[10px]">Trial</Badge>,
    suspended: <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">Suspenso</Badge>,
    cancelled: <Badge className="bg-zinc-500/15 text-zinc-400 border-zinc-500/30 text-[10px]">Cancelado</Badge>,
  };
  return map[s] ?? <Badge variant="outline" className="text-[10px]">{s}</Badge>;
}

export default function FinanceiroAdmin() {
  const qc = useQueryClient();
  const { data: operators = [], isLoading } = useQuery<Operator[]>({
    queryKey: ["admin-operators"],
    queryFn: () =>
      fetch("/api/admin/operators", { credentials: "include" }).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Aggregate stats
  const allPayments = operators.flatMap(o => o.payments ?? []);
  const totalPaid = allPayments.filter(p => p.status === "paid").reduce((s, p) => s + parseFloat(p.amount || "0"), 0);
  const totalPending = allPayments.filter(p => p.status === "pending").reduce((s, p) => s + parseFloat(p.amount || "0"), 0);
  const totalOverdue = allPayments.filter(p => p.status === "overdue").reduce((s, p) => s + parseFloat(p.amount || "0"), 0);
  const mrr = operators
    .filter(o => o.subscriptionStatus === "active")
    .reduce((s, o) => s + parseFloat(o.monthlyAmount || "0"), 0);

  const stats = [
    { label: "MRR (Receita Mensal)", value: `R$ ${mrr.toFixed(2)}`, icon: TrendingUp, color: "text-emerald-400" },
    { label: "Total Recebido", value: `R$ ${totalPaid.toFixed(2)}`, icon: CheckCircle2, color: "text-blue-400" },
    { label: "A Receber", value: `R$ ${totalPending.toFixed(2)}`, icon: Clock, color: "text-yellow-400" },
    { label: "Em Atraso", value: `R$ ${totalOverdue.toFixed(2)}`, icon: AlertCircle, color: "text-red-400" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão consolidada de cobranças e pagamentos</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin-operators"] })} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color} flex-shrink-0`} />
            <div>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Per-client billing table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Clientes — Situação Financeira</span>
        </div>

        {operators.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Nenhum cliente cadastrado</div>
        ) : (
          <div className="divide-y">
            {operators.map(op => {
              const lastPayments = (op.payments ?? []).slice(0, 3);
              const hasOverdue = (op.payments ?? []).some(p => p.status === "overdue");
              return (
                <div key={op.id} className="px-4 py-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{op.name}</span>
                        {subBadge(op.subscriptionStatus)}
                        {hasOverdue && (
                          <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] gap-1">
                            <AlertCircle className="w-2.5 h-2.5" /> Pagamento em atraso
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        @{op.username} · Mensalidade: R$ {op.monthlyAmount}
                      </p>
                    </div>
                  </div>

                  {lastPayments.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-1">Sem pagamentos registrados</p>
                  ) : (
                    <div className="space-y-1.5">
                      {lastPayments.map(p => (
                        <div key={p.id} className="flex items-center gap-3 bg-muted/40 rounded-lg px-3 py-2">
                          <span className="text-xs text-muted-foreground w-20 shrink-0">{formatMonth(p.referenceMonth)}</span>
                          {statusBadge(p.status)}
                          <span className="text-sm text-foreground font-medium">R$ {p.amount}</span>
                          {p.paidAt && (
                            <span className="text-xs text-muted-foreground">
                              Pago em {new Date(p.paidAt).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                          {p.notes && (
                            <span className="text-xs text-muted-foreground truncate max-w-40">{p.notes}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
