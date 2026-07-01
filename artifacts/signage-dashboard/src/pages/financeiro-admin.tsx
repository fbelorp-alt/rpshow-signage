import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  TrendingUp, CheckCircle2, Clock, AlertCircle, Users, RefreshCw,
  Plus, ChevronDown, ChevronUp, Search, Download, Zap, Trash2,
  CreditCard, Calendar, Monitor, DollarSign, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type Payment = {
  id: number;
  operatorId: number;
  referenceMonth: string;
  status: string;
  amount: string;
  notes: string | null;
  paidAt: string | null;
  dueDate: string | null;
  createdAt: string;
};

type Operator = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  trialDays: number;
  pricePerScreen: string;
  monthlyAmount: string;
  screenCount: number;
  createdAt: string;
  payments: Payment[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[parseInt(m!) - 1]}/${y}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysOverdue(dueDate: string | null) {
  if (!dueDate) return null;
  const diff = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
  return diff > 0 ? diff : null;
}

function trialDaysLeft(trialEndsAt: string | null) {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000));
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    overdue: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  const label: Record<string, string> = { paid: "Pago", pending: "Pendente", overdue: "Em atraso" };
  return <Badge className={`text-[10px] ${map[status] ?? "bg-zinc-500/15 text-zinc-400"}`}>{label[status] ?? status}</Badge>;
}

function SubBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    trial: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    pending_approval: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    suspended: "bg-red-500/15 text-red-400 border-red-500/30",
    cancelled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  };
  const label: Record<string, string> = {
    active: "Ativo", trial: "Trial", pending_approval: "Aguardando",
    suspended: "Suspenso", cancelled: "Cancelado",
  };
  return <Badge className={`text-[10px] ${map[status] ?? "bg-zinc-500/15 text-zinc-400"}`}>{label[status] ?? status}</Badge>;
}

// ─── Register Payment Modal ───────────────────────────────────────────────────

function PaymentModal({
  operator,
  open,
  onClose,
}: {
  operator: Operator | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [refMonth, setRefMonth] = useState(currentMonth());
  const [status, setStatus] = useState("pending");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (operator && open) {
      setAmount(operator.monthlyAmount);
      setStatus("pending");
      setRefMonth(currentMonth());
      const d = new Date(); d.setDate(10);
      setDueDate(d.toISOString().slice(0, 10));
      setPaidAt("");
      setNotes("");
      setError("");
    }
  }, [operator, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { referenceMonth: refMonth, status, amount };
      if (dueDate) body["dueDate"] = new Date(dueDate).toISOString();
      if (status === "paid" && paidAt) body["paidAt"] = new Date(paidAt).toISOString();
      if (notes.trim()) body["notes"] = notes.trim();
      const r = await fetch(`/api/admin/operators/${operator!.id}/payments`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Erro ao registrar cobrança");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-financial"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!operator) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4" /> Registrar Cobrança — {operator.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Mês de Referência</label>
              <Input type="month" value={refMonth} onChange={e => setRefMonth(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vencimento</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valor (R$)</label>
              <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="overdue">Em atraso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {status === "paid" && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data de Pagamento</label>
              <Input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} className="h-8 text-sm" />
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Observações</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional..." className="h-8 text-sm" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mark Paid Modal ──────────────────────────────────────────────────────────

function MarkPaidModal({
  payment,
  operator,
  open,
  onClose,
}: {
  payment: Payment | null;
  operator: Operator | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/admin/operators/${operator!.id}/payments/${payment!.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid", paidAt: new Date(paidAt).toISOString(), notes: notes || undefined }),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-financial"] }); onClose(); },
  });

  if (!payment || !operator) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Confirmar Pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            {operator.name} — {monthLabel(payment.referenceMonth)} — {brl(parseFloat(payment.amount))}
          </p>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data de Pagamento</label>
            <Input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Observações</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional..." className="h-8 text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirmar Pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Client Row ───────────────────────────────────────────────────────────────

function ClientRow({
  op,
  onNewPayment,
  onMarkPaid,
}: {
  op: Operator;
  onNewPayment: (op: Operator) => void;
  onMarkPaid: (payment: Payment, op: Operator) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const cm = currentMonth();
  const currentMonthPay = op.payments.find(p => p.referenceMonth === cm);
  const lastPaid = [...op.payments].reverse().find(p => p.status === "paid");
  const overduePayments = op.payments.filter(p => p.status === "overdue" || (p.status === "pending" && p.dueDate && new Date(p.dueDate) < new Date()));
  const trialLeft = trialDaysLeft(op.trialEndsAt);

  const deletePay = useMutation({
    mutationFn: (pid: number) => fetch(`/api/admin/operators/${op.id}/payments/${pid}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-financial"] }),
  });

  return (
    <div className="border-b last:border-0">
      <div
        className="px-4 py-3 grid items-center gap-x-3 cursor-pointer hover:bg-muted/30 transition-colors"
        style={{ gridTemplateColumns: "1fr 60px 90px 100px 120px 130px 110px auto" }}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Cliente */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">{op.name}</span>
            <SubBadge status={op.subscriptionStatus} />
            {overduePayments.length > 0 && (
              <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">
                {overduePayments.length} atras{overduePayments.length > 1 ? "os" : "o"}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            @{op.username}
            {op.email && ` · ${op.email}`}
            {op.subscriptionStatus === "trial" && trialLeft !== null && (
              <span className="text-blue-400 ml-1">· {trialLeft}d trial</span>
            )}
          </p>
        </div>

        {/* Telas */}
        <div className="text-center">
          <span className="text-sm font-medium">{op.screenCount}</span>
          <p className="text-[10px] text-muted-foreground">telas</p>
        </div>

        {/* Preço/tela */}
        <div className="text-center">
          <span className="text-sm">{brl(parseFloat(op.pricePerScreen))}</span>
          <p className="text-[10px] text-muted-foreground">por tela</p>
        </div>

        {/* Mensalidade */}
        <div className="text-center">
          <span className="text-sm font-semibold text-foreground">{brl(parseFloat(op.monthlyAmount))}</span>
          <p className="text-[10px] text-muted-foreground">mensalidade</p>
        </div>

        {/* Mês atual */}
        <div className="text-center">
          {currentMonthPay ? (
            <div className="space-y-0.5">
              <PaymentBadge status={currentMonthPay.status} />
              <p className="text-[10px] text-muted-foreground">{brl(parseFloat(currentMonthPay.amount))}</p>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground">Sem cobrança</span>
          )}
        </div>

        {/* Vencimento / dias */}
        <div className="text-center">
          {currentMonthPay?.dueDate ? (
            <div>
              <p className="text-xs text-foreground">{new Date(currentMonthPay.dueDate).toLocaleDateString("pt-BR")}</p>
              {currentMonthPay.status !== "paid" && (() => {
                const days = daysOverdue(currentMonthPay.dueDate);
                return days !== null
                  ? <p className="text-[10px] text-red-400">{days}d em atraso</p>
                  : <p className="text-[10px] text-muted-foreground">no prazo</p>;
              })()}
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          )}
        </div>

        {/* Último pagamento */}
        <div className="text-center">
          {lastPaid ? (
            <div>
              <p className="text-xs text-foreground">{monthLabel(lastPaid.referenceMonth)}</p>
              <p className="text-[10px] text-muted-foreground">
                {lastPaid.paidAt ? new Date(lastPaid.paidAt).toLocaleDateString("pt-BR") : "—"}
              </p>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground">Nenhum</span>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {currentMonthPay && currentMonthPay.status !== "paid" && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-400 hover:text-emerald-300 text-[11px]"
              onClick={() => onMarkPaid(currentMonthPay, op)}>
              <CheckCircle2 className="w-3 h-3 mr-1" />Pagar
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]"
            onClick={() => onNewPayment(op)}>
            <Plus className="w-3 h-3 mr-1" />Lançar
          </Button>
          <button onClick={() => setExpanded(v => !v)} className="p-1 text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded: payment history */}
      {expanded && (
        <div className="px-4 pb-4 bg-muted/10">
          <p className="text-[11px] font-medium text-muted-foreground mb-2 mt-1">Histórico de Cobranças</p>
          {op.payments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma cobrança registrada</p>
          ) : (
            <div className="space-y-1">
              {[...op.payments].reverse().map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-background/60 rounded-lg px-3 py-2 text-xs">
                  <span className="text-muted-foreground w-16 shrink-0 font-medium">{monthLabel(p.referenceMonth)}</span>
                  <PaymentBadge status={p.status} />
                  <span className="font-semibold w-24 shrink-0">{brl(parseFloat(p.amount))}</span>
                  <span className="text-muted-foreground w-28 shrink-0">
                    Venc: {p.dueDate ? new Date(p.dueDate).toLocaleDateString("pt-BR") : "—"}
                  </span>
                  {p.paidAt && (
                    <span className="text-emerald-400">
                      Pago em {new Date(p.paidAt).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {p.notes && <span className="text-muted-foreground truncate max-w-48">{p.notes}</span>}
                  <div className="ml-auto flex gap-1">
                    {p.status !== "paid" && (
                      <button className="text-emerald-400 hover:text-emerald-300 text-[10px] font-medium"
                        onClick={() => onMarkPaid(p, op)}>Marcar pago</button>
                    )}
                    <button className="text-muted-foreground hover:text-red-400 ml-2"
                      onClick={() => { if (confirm("Excluir este lançamento?")) deletePay.mutate(p.id); }}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinanceiroAdmin() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [payModal, setPayModal] = useState<Operator | null>(null);
  const [markPaidData, setMarkPaidData] = useState<{ payment: Payment; op: Operator } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [purging, setPurging] = useState(false);

  const { data: operators = [], isLoading } = useQuery<Operator[]>({
    queryKey: ["admin-financial"],
    queryFn: () => fetch("/api/admin/financial", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60000,
  });

  // ── Aggregated KPIs ──────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const allPays = operators.flatMap(o => o.payments);
    const cm = currentMonth();
    const now = new Date();
    const yearStart = `${now.getFullYear()}-01`;

    const mrr = operators.filter(o => o.subscriptionStatus === "active")
      .reduce((s, o) => s + parseFloat(o.monthlyAmount), 0);

    const paidYtd = allPays
      .filter(p => p.status === "paid" && p.referenceMonth >= yearStart)
      .reduce((s, p) => s + parseFloat(p.amount), 0);

    const pending = allPays.filter(p => p.status === "pending").reduce((s, p) => s + parseFloat(p.amount), 0);

    const overdue = allPays.filter(p =>
      p.status === "overdue" || (p.status === "pending" && p.dueDate && new Date(p.dueDate) < now)
    ).reduce((s, p) => s + parseFloat(p.amount), 0);

    const byStatus = (s: string) => operators.filter(o => o.subscriptionStatus === s).length;

    const currentMonthRevenue = allPays
      .filter(p => p.referenceMonth === cm && p.status === "paid")
      .reduce((s, p) => s + parseFloat(p.amount), 0);

    return { mrr, paidYtd, pending, overdue, currentMonthRevenue, byStatus };
  }, [operators]);

  // ── Monthly revenue chart data (last 12 months) ───────────────────────────
  const chartData = useMemo(() => {
    const map = new Map<string, { paid: number; pending: number }>();
    operators.forEach(o => o.payments.forEach(p => {
      const cur = map.get(p.referenceMonth) ?? { paid: 0, pending: 0 };
      if (p.status === "paid") cur.paid += parseFloat(p.amount);
      else cur.pending += parseFloat(p.amount);
      map.set(p.referenceMonth, cur);
    }));

    const months: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    return months.map(m => ({
      month: monthLabel(m),
      pago: map.get(m)?.paid ?? 0,
      pendente: map.get(m)?.pending ?? 0,
    }));
  }, [operators]);

  // ── Filtered clients ──────────────────────────────────────────────────────
  const filtered = useMemo(() => operators.filter(op => {
    const matchSearch = !search || op.name.toLowerCase().includes(search.toLowerCase())
      || op.username.toLowerCase().includes(search.toLowerCase())
      || (op.email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || op.subscriptionStatus === statusFilter;
    return matchSearch && matchStatus;
  }), [operators, search, statusFilter]);

  // ── Export CSV ────────────────────────────────────────────────────────────
  function exportCsv() {
    const rows = [["Cliente", "Login", "Email", "Telas", "Preço/Tela", "Mensalidade", "Status", "Total Pago", "Pendente"]];
    operators.forEach(op => {
      const paid = op.payments.filter(p => p.status === "paid").reduce((s, p) => s + parseFloat(p.amount), 0);
      const pend = op.payments.filter(p => p.status === "pending").reduce((s, p) => s + parseFloat(p.amount), 0);
      rows.push([op.name, op.username, op.email ?? "", String(op.screenCount),
        op.pricePerScreen, op.monthlyAmount,
        op.subscriptionStatus, paid.toFixed(2), pend.toFixed(2)]);
    });
    const csv = rows.map(r => r.join(";")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `financeiro-${currentMonth()}.csv`; a.click();
  }

  // ── Generate monthly ──────────────────────────────────────────────────────
  async function generateMonthly() {
    setGenerating(true);
    const r = await fetch("/api/admin/generate-monthly", { method: "POST", credentials: "include" });
    const data = await r.json() as { created: number; month: string };
    qc.invalidateQueries({ queryKey: ["admin-financial"] });
    setGenerating(false);
    alert(`${data.created} cobrança(s) gerada(s) para ${monthLabel(data.month)}.`);
  }

  async function purgeOrphans() {
    if (!confirm("Isso vai remover todos os plays e registros de atividade sem dono (dados de teste). Continuar?")) return;
    setPurging(true);
    const r = await fetch("/api/admin/purge-orphans", { method: "POST", credentials: "include" });
    const data = await r.json() as { deletedPlays: number; deletedActivity: number };
    setPurging(false);
    alert(`Limpeza concluída: ${data.deletedPlays} plays e ${data.deletedActivity} atividades removidos.`);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão de cobranças, receita e clientes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin-financial"] })} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </Button>
          <Button size="sm" variant="outline" onClick={purgeOrphans} disabled={purging} className="gap-1.5 border-red-800 text-red-400 hover:bg-red-950 hover:text-red-300">
            {purging ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Limpar dados de teste
          </Button>
          <Button size="sm" onClick={generateMonthly} disabled={generating} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
            {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Gerar cobranças do mês
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground font-medium">MRR (Ativos)</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{brl(kpis.mrr)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{kpis.byStatus("active")} clientes ativos</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-muted-foreground font-medium">Recebido no Ano</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{brl(kpis.paidYtd)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">pagamentos confirmados em {new Date().getFullYear()}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-muted-foreground font-medium">A Receber</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{brl(kpis.pending)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">cobranças pendentes em aberto</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-muted-foreground font-medium">Em Atraso</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{brl(kpis.overdue)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">vencimento ultrapassado</p>
        </div>
      </div>

      {/* ── Status bar ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Ativos", status: "active", icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Trial", status: "trial", icon: Calendar, color: "text-blue-400" },
          { label: "Suspensos", status: "suspended", icon: AlertCircle, color: "text-red-400" },
          { label: "Total clientes", status: "", icon: Users, color: "text-muted-foreground" },
        ].map(({ label, status, icon: Icon, color }) => (
          <div key={label} className="bg-card border rounded-xl p-3 flex items-center gap-3">
            <Icon className={`w-5 h-5 ${color}`} />
            <div>
              <p className="text-lg font-bold text-foreground">
                {status ? kpis.byStatus(status) : operators.length}
              </p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Revenue Chart ─────────────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Receita Mensal — Últimos 12 Meses</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} barSize={18} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false}
              tickFormatter={v => `R$${(v as number / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(val: number, name: string) => [brl(val), name === "pago" ? "Recebido" : "Pendente"]}
              contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: 12 }}
            />
            <Bar dataKey="pago" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="pendente" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 justify-end">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /><span className="text-[11px] text-muted-foreground">Recebido</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-amber-500" /><span className="text-[11px] text-muted-foreground">Pendente</span></div>
        </div>
      </div>

      {/* ── Client Table ──────────────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {/* Filters */}
        <div className="px-4 py-3 border-b flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm" />
          </div>
          <div className="flex gap-1">
            {["all", "active", "trial", "suspended", "pending_approval"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${statusFilter === s
                  ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                {s === "all" ? "Todos" : s === "active" ? "Ativos" : s === "trial" ? "Trial"
                  : s === "suspended" ? "Suspensos" : "Aguardando"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{filtered.length} cliente(s)</span>
          </div>
        </div>

        {/* Table header */}
        <div
          className="px-4 py-2 bg-muted/30 grid text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
          style={{ gridTemplateColumns: "1fr 60px 90px 100px 120px 130px 110px auto" }}
        >
          <span>Cliente</span>
          <span className="text-center">Telas</span>
          <span className="text-center">Preço/Tela</span>
          <span className="text-center">Mensalidade</span>
          <span className="text-center">Mês atual</span>
          <span className="text-center">Vencimento</span>
          <span className="text-center">Último pagto</span>
          <span />
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhum cliente encontrado</div>
        ) : (
          filtered.map(op => (
            <ClientRow key={op.id} op={op} onNewPayment={setPayModal} onMarkPaid={(p, o) => setMarkPaidData({ payment: p, op: o })} />
          ))
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <PaymentModal operator={payModal} open={!!payModal} onClose={() => setPayModal(null)} />
      <MarkPaidModal
        payment={markPaidData?.payment ?? null}
        operator={markPaidData?.op ?? null}
        open={!!markPaidData}
        onClose={() => setMarkPaidData(null)}
      />
    </div>
  );
}
