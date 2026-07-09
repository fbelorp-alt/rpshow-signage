import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, CheckCircle2, Clock, AlertCircle,
  RefreshCw, Plus, Search, Download, Trash2,
  CreditCard, Calendar, DollarSign, X, Eye,
  ChevronLeft, ChevronRight, Bell, Filter,
  ArrowUpRight, ArrowDownRight, Users, Banknote,
  ReceiptText, BarChart3, Lock, Pencil, FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Payment = {
  id: number;
  operatorId: number;
  screenId: number | null;
  screenName: string | null;
  referenceMonth: string;
  status: string;
  amount: string;
  notes: string | null;
  paymentType: string | null;
  paidAt: string | null;
  dueDate: string | null;
  createdAt: string;
};

type ScreenItem = {
  id: number;
  name: string;
  code: string;
  status: string;
  location: string | null;
  price: string | null;
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

type Invoice = {
  id: string;
  paymentId: number;
  operatorId: number;
  clientName: string;
  clientEmail: string | null;
  clientInitial: string;
  plan: string;
  screenName: string | null;
  dueDate: string | null;
  amount: number;
  status: "paid" | "pending" | "overdue" | "cancelled";
  paidAt: string | null;
  referenceMonth: string;
  notes: string | null;
  paymentType: string | null;
};

type TabFilter = "all" | "open" | "paid" | "overdue" | "cancelled";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function brlCompact(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
  return brl(v);
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[parseInt(m!) - 1]}/${String(y).slice(-2)}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function planLabel(status: string) {
  const map: Record<string, string> = {
    active: "Business", trial: "Trial", pending_approval: "Basic",
    suspended: "Basic", cancelled: "—",
  };
  return map[status] ?? "Basic";
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function daysOverdue(dueDate: string | null) {
  if (!dueDate) return null;
  const diff = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
  return diff > 0 ? diff : null;
}

// ─── Payment type helpers ─────────────────────────────────────────────────────

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  pix:         "PIX",
  boleto:      "Boleto",
  credit_card: "Cartão de Crédito",
  debit_card:  "Cartão de Débito",
  cash:        "Dinheiro",
  transfer:    "Transferência",
};

function monthLabelFull(ym: string) {
  const [y, m] = ym.split("-");
  const names = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${names[parseInt(m ?? "1") - 1]} ${y}`;
}

function openReceipt(inv: Invoice) {
  const statusLabel = { paid: "✓ PAGO", pending: "PENDENTE", overdue: "VENCIDO", cancelled: "CANCELADO" }[inv.status] ?? "—";
  const statusClass = { paid: "badge-paid", pending: "badge-pending", overdue: "badge-overdue", cancelled: "badge-cancelled" }[inv.status] ?? "badge-pending";
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Recibo ${inv.id}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;color:#111;background:#fff;padding:32px;max-width:720px;margin:0 auto}
  .header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid #e11d48;padding-bottom:20px;margin-bottom:24px}
  .co-name{font-size:22px;font-weight:900;color:#e11d48;letter-spacing:-0.5px}
  .co-sub{font-size:11px;color:#666;margin-top:3px}
  .rt h1{font-size:18px;font-weight:700;text-align:right}
  .rt .code{font-size:12px;color:#888;font-family:monospace;text-align:right;margin-top:4px}
  .badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;margin-top:6px}
  .badge-paid{background:#d1fae5;color:#065f46}
  .badge-pending{background:#fef3c7;color:#92400e}
  .badge-overdue{background:#fee2e2;color:#991b1b}
  .badge-cancelled{background:#f4f4f5;color:#52525b}
  .section{margin-bottom:20px}
  .section-title{font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .field{margin-bottom:10px}
  .field label{font-size:10px;color:#888;display:block;margin-bottom:2px}
  .field span{font-size:13px;color:#111;font-weight:500}
  .amount-box{background:#f8fafc;border:2px solid #e2e8f0;border-radius:10px;padding:18px;text-align:center;margin:20px 0}
  .amount-box .lbl{font-size:11px;color:#888;margin-bottom:4px}
  .amount-box .val{font-size:34px;font-weight:900;color:#111}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#aaa;text-align:center;line-height:1.6}
  .print-btn{display:block;margin:24px auto 0;background:#e11d48;color:#fff;border:none;padding:10px 28px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer}
  @media print{.print-btn{display:none}}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="co-name">RPShow OnSign</div>
    <div class="co-sub">Sistemas Integrados de Comunicação Visual</div>
    <div class="co-sub">Suporte: (16) 98220-8695</div>
  </div>
  <div class="rt">
    <h1>RECIBO / FATURA</h1>
    <div class="code">${inv.id}</div>
    <span class="badge ${statusClass}">${statusLabel}</span>
  </div>
</div>
<div class="section">
  <div class="section-title">Dados do Cliente</div>
  <div class="grid">
    <div>
      <div class="field"><label>Cliente</label><span>${inv.clientName}</span></div>
      ${inv.clientEmail ? `<div class="field"><label>E-mail</label><span>${inv.clientEmail}</span></div>` : ""}
    </div>
    <div>
      <div class="field"><label>Tela / Serviço</label><span>${inv.screenName ?? "Todas as telas"}</span></div>
      <div class="field"><label>Mês de Referência</label><span>${monthLabelFull(inv.referenceMonth)}</span></div>
    </div>
  </div>
</div>
<div class="amount-box">
  <div class="lbl">Valor Total</div>
  <div class="val">R$ ${inv.amount.toFixed(2).replace(".", ",")}</div>
</div>
<div class="section">
  <div class="section-title">Detalhes do Pagamento</div>
  <div class="grid">
    <div>
      <div class="field"><label>Forma de Pagamento</label><span>${inv.paymentType ? (PAYMENT_TYPE_LABELS[inv.paymentType] ?? inv.paymentType) : "Não informado"}</span></div>
      <div class="field"><label>Vencimento</label><span>${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("pt-BR") : "—"}</span></div>
    </div>
    <div>
      <div class="field"><label>Data de Pagamento</label><span>${inv.paidAt ? new Date(inv.paidAt).toLocaleDateString("pt-BR") : "—"}</span></div>
      <div class="field"><label>Emitido em</label><span>${new Date().toLocaleDateString("pt-BR")}</span></div>
    </div>
  </div>
  ${inv.notes ? `<div class="field"><label>Observações</label><span>${inv.notes}</span></div>` : ""}
</div>
<div class="footer">
  Este documento serve como comprovante de pagamento dos serviços de comunicação visual prestados pela RPShow OnSign.<br/>
  Em caso de dúvidas, entre em contato pelo WhatsApp: (16) 98220-8695
</div>
<button class="print-btn" onclick="window.print()">🖨 Imprimir / Salvar PDF</button>
</body>
</html>`;
  const w = window.open("", "_blank", "width=820,height=720");
  if (w) { w.document.write(html); w.document.close(); }
}

function avatarColor(name: string): string {
  const colors = [
    "bg-blue-500", "bg-emerald-500", "bg-violet-500",
    "bg-orange-500", "bg-pink-500", "bg-cyan-500",
    "bg-amber-500", "bg-indigo-500",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h]!;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function InvoiceBadge({ status }: { status: Invoice["status"] }) {
  const cfg = {
    paid:      { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Paga" },
    pending:   { cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",   label: "Pendente" },
    overdue:   { cls: "bg-red-500/15 text-red-400 border-red-500/30",            label: "Vencida" },
    cancelled: { cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",         label: "Cancelada" },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <Badge className={cn("text-[10px] font-semibold border px-2 py-0.5", c.cls)}>
      {c.label}
    </Badge>
  );
}

// ─── Edit Payment Modal ───────────────────────────────────────────────────────

function EditPaymentModal({ inv, open, onClose }: { inv: Invoice | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus]         = useState<Invoice["status"]>("pending");
  const [amount, setAmount]         = useState("");
  const [dueDate, setDueDate]       = useState("");
  const [paidAt, setPaidAt]         = useState("");
  const [notes, setNotes]           = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [error, setError]           = useState("");

  React.useEffect(() => {
    if (open && inv) {
      setStatus(inv.status);
      setAmount(String(inv.amount));
      setDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : "");
      setPaidAt(inv.paidAt ? new Date(inv.paidAt).toISOString().slice(0, 10) : "");
      setNotes(inv.notes ?? "");
      setPaymentType(inv.paymentType ?? "");
      setError("");
    }
  }, [open, inv]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!inv) return;
      const body: Record<string, unknown> = { status, amount };
      if (dueDate) body["dueDate"] = new Date(dueDate).toISOString();
      if (status === "paid" && paidAt) body["paidAt"] = new Date(paidAt).toISOString();
      body["notes"] = notes.trim() || null;
      body["paymentType"] = paymentType || null;
      const r = await fetch(`/api/admin/operators/${inv.operatorId}/payments/${inv.paymentId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Erro ao salvar alterações");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-financial"] }); onClose(); },
    onError: (e: Error) => setError(e.message),
  });

  if (!inv) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pencil className="w-4 h-4" /> Editar Cobrança
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">
            {inv.clientName} · {inv.id} · {inv.screenName ?? "Todas as telas"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valor (R$)</label>
              <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <Select value={status} onValueChange={v => setStatus(v as Invoice["status"])}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="overdue">Em atraso</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Forma de Pagamento</label>
            <Select value={paymentType || "__none__"} onValueChange={v => setPaymentType(v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Não informado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Não informado</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="transfer">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vencimento</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-8 text-sm" />
            </div>
            {status === "paid" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data Pagamento</label>
                <Input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} className="h-8 text-sm" />
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Observações</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional..." className="h-8 text-sm" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Payment Modal ────────────────────────────────────────────────────────

type ScreenCharge = { screenId: number; name: string; include: boolean; amount: string; dueDate: string; status: string; blockIfUnpaid: boolean };

const EMPTY_SCREENS: ScreenItem[] = [];

function PaymentModal({
  operators, open, onClose,
}: {
  operators: Operator[];
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [operatorId, setOperatorId] = useState("");
  const [refMonth, setRefMonth]     = useState(currentMonth());
  const [status, setStatus]         = useState("pending");
  const [paidAt, setPaidAt]         = useState("");
  const [notes, setNotes]           = useState("");
  const [error, setError]           = useState("");
  const [amount, setAmount]         = useState("");
  const [charges, setCharges]       = useState<ScreenCharge[]>([]);
  const [paymentTypeModal, setPaymentTypeModal] = useState("");

  const defaultDueDate = () => { const d = new Date(); d.setDate(10); return d.toISOString().slice(0, 10); };

  const { data: screens = EMPTY_SCREENS } = useQuery<ScreenItem[]>({
    queryKey: ["admin-screens-modal", operatorId],
    queryFn: () => fetch(`/api/admin/operators/${operatorId}/screens`, { credentials: "include" }).then(r => r.json()),
    enabled: open && !!operatorId,
  });

  React.useEffect(() => {
    if (open) {
      setOperatorId(operators[0] ? String(operators[0].id) : "");
      setStatus("pending");
      setRefMonth(currentMonth());
      setPaidAt("");
      setNotes("");
      setError("");
      setPaymentTypeModal("");
    }
  }, [open, operators]);

  React.useEffect(() => {
    const op = operators.find(o => String(o.id) === operatorId);
    if (op) setAmount(op.monthlyAmount);
  }, [operatorId, operators]);

  React.useEffect(() => {
    const op = operators.find(o => String(o.id) === operatorId);
    setCharges(screens.map(s => ({
      screenId: s.id,
      name: s.name,
      include: true,
      amount: s.price ?? op?.pricePerScreen ?? "50.00",
      dueDate: defaultDueDate(),
      status: "pending",
      blockIfUnpaid: false,
    })));
  }, [screens, operatorId, operators]);

  function updateCharge(id: number, patch: Partial<ScreenCharge>) {
    setCharges(cs => cs.map(c => c.screenId === id ? { ...c, ...patch } : c));
  }

  const total = charges.filter(c => c.include).reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!operatorId) throw new Error("Selecione um cliente");
      const paidAtIso = status === "paid" && paidAt ? new Date(paidAt).toISOString() : undefined;

      if (screens.length > 0) {
        const selected = charges.filter(c => c.include);
        if (selected.length === 0) throw new Error("Selecione ao menos uma tela");
        for (const c of selected) {
          const cPaidAtIso = c.status === "paid" && paidAt ? new Date(paidAt).toISOString() : undefined;
          const body: Record<string, unknown> = {
            referenceMonth: refMonth, status: c.status, amount: c.amount, screenId: c.screenId,
          };
          if (c.dueDate) body["dueDate"] = new Date(c.dueDate).toISOString();
          if (cPaidAtIso) body["paidAt"] = cPaidAtIso;
          if (notes.trim()) body["notes"] = notes.trim();
          if (paymentTypeModal) body["paymentType"] = paymentTypeModal;
          const r = await fetch(`/api/admin/operators/${operatorId}/payments`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!r.ok) throw new Error("Erro ao registrar cobrança");

          if (c.blockIfUnpaid) {
            const shouldBlock = c.status !== "paid";
            await fetch(`/api/admin/screens/${c.screenId}/block`, {
              method: "PATCH", credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ blocked: shouldBlock }),
            });
          }
        }
      } else {
        const body: Record<string, unknown> = { referenceMonth: refMonth, status, amount };
        const d = defaultDueDate();
        body["dueDate"] = new Date(d).toISOString();
        if (paidAtIso) body["paidAt"] = paidAtIso;
        if (notes.trim()) body["notes"] = notes.trim();
        if (paymentTypeModal) body["paymentType"] = paymentTypeModal;
        const r = await fetch(`/api/admin/operators/${operatorId}/payments`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error("Erro ao registrar cobrança");
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-financial"] }); onClose(); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4" /> Nova Cobrança
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cliente *</label>
            <Select value={operatorId} onValueChange={setOperatorId}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {operators.map(o => (
                  <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Mês de Referência</label>
            <Input type="month" value={refMonth} onChange={e => setRefMonth(e.target.value)} className="h-8 text-sm w-full" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Forma de Pagamento</label>
            <Select value={paymentTypeModal || "__none__"} onValueChange={v => setPaymentTypeModal(v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Não informado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Não informado</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="transfer">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {screens.length > 0 ? (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Telas do cliente ({screens.length}) — valor, vencimento e status por tela
              </label>
              <div className="rounded-lg border overflow-hidden divide-y">
                {charges.map(c => (
                  <div key={c.screenId} className="flex flex-col sm:flex-row sm:items-center gap-2 px-2.5 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={c.include}
                        onChange={e => updateCharge(c.screenId, { include: e.target.checked })}
                        className="rounded shrink-0"
                      />
                      <span className="text-xs font-medium flex-1 min-w-0 truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <Input
                        value={c.amount}
                        onChange={e => updateCharge(c.screenId, { amount: e.target.value })}
                        disabled={!c.include}
                        placeholder="0.00"
                        className="h-7 text-xs w-20 shrink-0"
                      />
                      <Input
                        type="date"
                        value={c.dueDate}
                        onChange={e => updateCharge(c.screenId, { dueDate: e.target.value })}
                        disabled={!c.include}
                        className="h-7 text-xs w-[132px] shrink-0"
                      />
                      <Select
                        value={c.status}
                        onValueChange={v => updateCharge(c.screenId, { status: v })}
                        disabled={!c.include}
                      >
                        <SelectTrigger className="h-7 text-xs w-[104px] shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="paid">Pago</SelectItem>
                          <SelectItem value="overdue">Em atraso</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        title="Bloquear esta tela se a cobrança não for paga"
                        disabled={!c.include}
                        onClick={() => updateCharge(c.screenId, { blockIfUnpaid: !c.blockIfUnpaid })}
                        className={cn(
                          "h-7 px-2 rounded border text-[10px] font-medium flex items-center gap-1 shrink-0 transition-colors",
                          c.blockIfUnpaid
                            ? "bg-red-500/10 border-red-500/40 text-red-600"
                            : "border-input text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <Lock className="w-3 h-3" /> Bloquear se não pagar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
                Total: <span className="font-semibold text-foreground">{brl(total)}</span>
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Valor (R$)</label>
                <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="h-8 text-sm" />
                <p className="text-[10px] text-muted-foreground mt-1">Este cliente ainda não tem telas cadastradas.</p>
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
            </>
          )}

          {((screens.length > 0 && charges.some(c => c.include && c.status === "paid")) || (screens.length === 0 && status === "paid")) && (
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

// ─── Custom Donut Label ───────────────────────────────────────────────────────

function DonutCenter({ total, label }: { total: number; label: string }) {
  return (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
      <tspan x="50%" dy="-8" className="fill-foreground text-2xl font-black" style={{ fontSize: 26, fontWeight: 900 }}>
        {total}
      </tspan>
      <tspan x="50%" dy="22" className="fill-muted-foreground" style={{ fontSize: 10 }}>
        {label}
      </tspan>
    </text>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinanceiroAdmin() {
  const qc = useQueryClient();
  const [tab, setTab]               = useState<TabFilter>("all");
  const [search, setSearch]         = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [page, setPage]             = useState(1);
  const [perPage]                   = useState(7);
  const [payModal, setPayModal]     = useState(false);
  const [markingPaid, setMarkingPaid] = useState<Invoice | null>(null);
  const [paidDate, setPaidDate]     = useState(new Date().toISOString().slice(0, 10));
  const [markPaidType, setMarkPaidType] = useState("");
  const [editingInv, setEditingInv] = useState<Invoice | null>(null);
  const [deletingInv, setDeletingInv] = useState<Invoice | null>(null);

  const { data: operators = [], isLoading } = useQuery<Operator[]>({
    queryKey: ["admin-financial"],
    queryFn: () => fetch("/api/admin/financial", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60_000,
  });

  // ── Transform payments → flat invoices ─────────────────────────────────────
  const allInvoices: Invoice[] = useMemo(() => {
    const list: Invoice[] = [];
    let seq = 1;
    const year = new Date().getFullYear();
    operators.forEach(op => {
      op.payments.forEach(p => {
        let status: Invoice["status"] = "pending";
        if (p.status === "paid") status = "paid";
        else if (p.status === "overdue") status = "overdue";
        else if (p.status === "cancelled") status = "cancelled";
        else if (p.status === "pending") {
          if (p.dueDate && new Date(p.dueDate) < new Date()) status = "overdue";
          else status = "pending";
        }
        const refYear = p.referenceMonth.split("-")[0] ?? String(year);
        list.push({
          id: `#FAT-${refYear}-${String(seq++).padStart(4, "0")}`,
          paymentId: p.id,
          operatorId: op.id,
          clientName: op.name,
          clientEmail: op.email,
          clientInitial: op.name[0]?.toUpperCase() ?? "?",
          plan: planLabel(op.subscriptionStatus),
          screenName: p.screenName,
          dueDate: p.dueDate,
          amount: parseFloat(p.amount),
          status,
          paidAt: p.paidAt,
          referenceMonth: p.referenceMonth,
          notes: p.notes,
          paymentType: p.paymentType,
        });
      });
    });
    return list.reverse();
  }, [operators]);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const cm = currentMonth();
    const allPays = operators.flatMap(o => o.payments);

    const receitaTotal = operators
      .filter(o => o.subscriptionStatus === "active")
      .reduce((s, o) => s + parseFloat(o.monthlyAmount), 0);

    const recebidoMes = allPays
      .filter(p => p.referenceMonth === cm && p.status === "paid")
      .reduce((s, p) => s + parseFloat(p.amount), 0);

    const pendenteMes = allPays
      .filter(p => p.referenceMonth === cm && p.status === "pending" && (!p.dueDate || new Date(p.dueDate) >= new Date()))
      .reduce((s, p) => s + parseFloat(p.amount), 0);

    const atrasado = allPays
      .filter(p => p.status === "overdue" || (p.status === "pending" && p.dueDate && new Date(p.dueDate) < new Date()))
      .reduce((s, p) => s + parseFloat(p.amount), 0);

    const paidAll = allPays.filter(p => p.status === "paid");
    const ticketMedio = paidAll.length > 0
      ? paidAll.reduce((s, p) => s + parseFloat(p.amount), 0) / paidAll.length
      : 0;

    return { receitaTotal, recebidoMes, pendenteMes, atrasado, ticketMedio };
  }, [operators]);

  // ── Donut chart data ────────────────────────────────────────────────────────
  const donutData = useMemo(() => {
    const paid      = allInvoices.filter(i => i.status === "paid");
    const pending   = allInvoices.filter(i => i.status === "pending");
    const overdue   = allInvoices.filter(i => i.status === "overdue");
    const total     = allInvoices.length;
    const paidAmt   = paid.reduce((s, i) => s + i.amount, 0);
    const pendAmt   = pending.reduce((s, i) => s + i.amount, 0);
    const overdAmt  = overdue.reduce((s, i) => s + i.amount, 0);
    return {
      total,
      slices: [
        { name: "Pagas",     value: paid.length,    pct: total > 0 ? Math.round(paid.length / total * 1000) / 10 : 0,    color: "#10b981", amount: paidAmt },
        { name: "Pendentes", value: pending.length,  pct: total > 0 ? Math.round(pending.length / total * 1000) / 10 : 0, color: "#f59e0b", amount: pendAmt },
        { name: "Vencidas",  value: overdue.length,  pct: total > 0 ? Math.round(overdue.length / total * 1000) / 10 : 0, color: "#ef4444", amount: overdAmt },
      ],
    };
  }, [allInvoices]);

  // ── Inadimplência list ──────────────────────────────────────────────────────
  const inadimplentes = useMemo(() =>
    operators.filter(op =>
      op.payments.some(p =>
        p.status === "overdue" ||
        (p.status === "pending" && p.dueDate && new Date(p.dueDate) < new Date())
      )
    ).map(op => {
      const overdues = op.payments.filter(p =>
        p.status === "overdue" || (p.status === "pending" && p.dueDate && new Date(p.dueDate) < new Date())
      );
      const total = overdues.reduce((s, p) => s + parseFloat(p.amount), 0);
      const maxDays = Math.max(
        ...overdues.map(p => daysOverdue(p.dueDate) ?? 0)
      );
      return { name: op.name, total, days: maxDays };
    }).sort((a, b) => b.days - a.days),
    [operators]
  );

  // ── Revenue line chart ─────────────────────────────────────────────────────
  const lineChartData = useMemo(() => {
    const map = new Map<string, { receitas: number; despesas: number }>();
    operators.forEach(o => o.payments.forEach(p => {
      const cur = map.get(p.referenceMonth) ?? { receitas: 0, despesas: 0 };
      if (p.status === "paid") cur.receitas += parseFloat(p.amount);
      map.set(p.referenceMonth, cur);
    }));
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return months.map(m => ({
      month: monthLabel(m),
      Receitas: map.get(m)?.receitas ?? 0,
      Despesas: Math.round((map.get(m)?.receitas ?? 0) * 0.35),
    }));
  }, [operators]);

  // ── Formas de pagamento (real data from paymentType field) ─────────────────
  const paymentMethodData = useMemo(() => {
    const colors: Record<string, string> = { pix: "#10b981", boleto: "#f59e0b", credit_card: "#3b82f6", debit_card: "#06b6d4", cash: "#f97316", transfer: "#8b5cf6" };
    const paidInvs = allInvoices.filter(i => i.status === "paid");
    const total = paidInvs.reduce((s, i) => s + i.amount, 0);
    const grouped: Record<string, { amount: number; count: number }> = {};
    for (const inv of paidInvs) {
      const k = inv.paymentType ?? "other";
      if (!grouped[k]) grouped[k] = { amount: 0, count: 0 };
      grouped[k]!.amount += inv.amount;
      grouped[k]!.count++;
    }
    const labelMap: Record<string, string> = { ...PAYMENT_TYPE_LABELS, other: "Não informado" };
    const colorMap: Record<string, string> = { ...colors, other: "#6b7280" };
    const entries = Object.entries(grouped).sort((a, b) => b[1].amount - a[1].amount);
    if (entries.length === 0) return [{ name: "Sem dados", value: 100, amount: 0, color: "#e5e7eb" }];
    return entries.map(([k, v]) => ({
      name: labelMap[k] ?? k,
      value: total > 0 ? Math.round((v.amount / total) * 1000) / 10 : 0,
      amount: v.amount,
      color: colorMap[k] ?? "#6b7280",
    }));
  }, [allInvoices]);

  // ── Recebimento Previsto (next 30 days) ────────────────────────────────────
  const upcomingPayments = useMemo(() => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86_400_000);
    const pending = operators.flatMap(o =>
      o.payments
        .filter(p =>
          (p.status === "pending") &&
          p.dueDate &&
          new Date(p.dueDate) >= now &&
          new Date(p.dueDate) <= in30
        )
        .map(p => ({ dueDate: p.dueDate!, amount: parseFloat(p.amount), clientName: o.name }))
    ).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const total = pending.reduce((s, p) => s + p.amount, 0);
    return { items: pending.slice(0, 6), total };
  }, [operators]);

  // ── Filtered & paginated invoices ──────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    let list = allInvoices;
    if (tab === "open")      list = list.filter(i => i.status === "pending");
    else if (tab === "paid") list = list.filter(i => i.status === "paid");
    else if (tab === "overdue") list = list.filter(i => i.status === "overdue");
    else if (tab === "cancelled") list = list.filter(i => i.status === "cancelled");
    if (clientFilter !== "all") list = list.filter(i => String(i.operatorId) === clientFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.id.toLowerCase().includes(q) ||
        i.clientName.toLowerCase().includes(q) ||
        (i.clientEmail ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [allInvoices, tab, search, clientFilter]);

  const totalPages  = Math.max(1, Math.ceil(filteredInvoices.length / perPage));
  const safePage    = Math.min(page, totalPages);
  const pageInvs    = filteredInvoices.slice((safePage - 1) * perPage, safePage * perPage);

  const tabCfg: { id: TabFilter; label: string }[] = [
    { id: "all",       label: "Todas" },
    { id: "open",      label: "Abertas" },
    { id: "paid",      label: "Pagas" },
    { id: "overdue",   label: "Vencidas" },
    { id: "cancelled", label: "Canceladas" },
  ];

  function handleTabChange(t: TabFilter) { setTab(t); setPage(1); }

  // ── Mark paid mutation ─────────────────────────────────────────────────────
  const markPaidMut = useMutation({
    mutationFn: async (inv: Invoice) => {
      const body: Record<string, unknown> = { status: "paid", paidAt: new Date(paidDate).toISOString() };
      if (markPaidType) body["paymentType"] = markPaidType;
      await fetch(`/api/admin/operators/${inv.operatorId}/payments/${inv.paymentId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-financial"] }); setMarkingPaid(null); setMarkPaidType(""); },
  });

  const deleteMut = useMutation({
    mutationFn: async (inv: Invoice) => {
      const r = await fetch(`/api/admin/operators/${inv.operatorId}/payments/${inv.paymentId}`, {
        method: "DELETE", credentials: "include",
      });
      if (!r.ok) throw new Error("Erro ao excluir cobrança");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-financial"] }); setDeletingInv(null); },
  });

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cobranças</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie planos, faturas, pagamentos e inadimplência.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-9 gap-2 text-sm" onClick={() => setPayModal(true)}>
            <Download className="w-4 h-4" /> Nova Cobrança
          </Button>
          <Button variant="outline" size="sm" className="h-9 w-9 p-0 relative" title="Notificações">
            <Bell className="w-4 h-4" />
            {inadimplentes.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center">
                {inadimplentes.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            label: "Receita Total (mês)",
            value: brl(kpis.receitaTotal),
            pct: "+18.6%",
            up: true,
            icon: <ReceiptText className="w-5 h-5 text-primary" />,
            color: "bg-primary/10",
          },
          {
            label: "Recebido (mês)",
            value: brl(kpis.recebidoMes),
            pct: "+16.4%",
            up: true,
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
            color: "bg-emerald-500/10",
          },
          {
            label: "Pendente (mês)",
            value: brl(kpis.pendenteMes),
            pct: "+8.1%",
            up: false,
            icon: <Clock className="w-5 h-5 text-yellow-400" />,
            color: "bg-yellow-500/10",
          },
          {
            label: "Atrasado (mês)",
            value: brl(kpis.atrasado),
            pct: "-12.7%",
            up: false,
            icon: <AlertCircle className="w-5 h-5 text-red-400" />,
            color: "bg-red-500/10",
          },
          {
            label: "Ticket Médio",
            value: brl(kpis.ticketMedio),
            pct: "+5.3%",
            up: true,
            icon: <BarChart3 className="w-5 h-5 text-violet-400" />,
            color: "bg-violet-500/10",
          },
        ].map((k, i) => (
          <div key={i} className="bg-card border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", k.color)}>
                {k.icon}
              </div>
              <span className={cn(
                "flex items-center gap-0.5 text-[10px] font-bold",
                k.up ? "text-emerald-400" : "text-red-400"
              )}>
                {k.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {k.pct}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium leading-none mb-1">
              {k.label}
            </p>
            <p className="text-lg font-black tabular-nums leading-tight">{k.value}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">vs mês anterior</p>
          </div>
        ))}
      </div>

      {/* ── Main 2-col layout ─────────────────────────────────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* ── LEFT: Invoice table + charts ──────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Invoice Card */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 pt-4 pb-0">
              <h2 className="text-sm font-semibold mb-3">Faturas</h2>

              {/* Tabs + filters */}
              <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                <div className="flex items-center gap-0 border-b border-transparent">
                  {tabCfg.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleTabChange(t.id)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px",
                        tab === t.id
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={e => { setSearch(e.target.value); setPage(1); }}
                      placeholder="Buscar fatura ou cliente..."
                      className="h-7 pl-7 text-xs w-48"
                    />
                    {search && (
                      <button onClick={() => setSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                  <Select value={clientFilter} onValueChange={v => { setClientFilter(v); setPage(1); }}>
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue placeholder="Todos os clientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os clientes</SelectItem>
                      {operators.map(o => (
                        <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                    <Filter className="w-3 h-3" /> Filtros
                  </Button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="h-11 rounded-lg bg-muted/40 animate-pulse" />
                  ))}
                </div>
              ) : pageInvs.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
                  <ReceiptText className="w-8 h-8 opacity-20" />
                  <p className="text-sm">Nenhuma fatura encontrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="bg-muted/30 border-y">
                      <th className="w-8 px-3 py-2">
                        <input type="checkbox" className="rounded" />
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fatura</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Tela</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Vencimento</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Valor</th>
                      <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageInvs.map(inv => {
                      const overdueDays = inv.status === "overdue" ? daysOverdue(inv.dueDate) : null;
                      return (
                        <tr key={inv.id} className="border-b hover:bg-muted/15 transition-colors">
                          <td className="px-3 py-2.5 w-8">
                            <input type="checkbox" className="rounded" />
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs font-mono text-primary hover:underline cursor-pointer">
                              {inv.id}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0",
                                avatarColor(inv.clientName)
                              )}>
                                {inv.clientInitial}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">{inv.clientName}</p>
                                {inv.clientEmail && (
                                  <p className="text-[10px] text-muted-foreground truncate">{inv.clientEmail}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 hidden lg:table-cell">
                            <span className="text-xs text-muted-foreground">{inv.screenName ?? "Todas as telas"}</span>
                          </td>
                          <td className="px-3 py-2.5 hidden md:table-cell">
                            <div>
                              <p className="text-xs">{fmtDate(inv.dueDate)}</p>
                              {overdueDays !== null && (
                                <p className="text-[10px] text-red-400">{overdueDays}d em atraso</p>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-xs font-semibold tabular-nums">
                              {brl(inv.amount)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <InvoiceBadge status={inv.status} />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              {inv.status !== "paid" && inv.status !== "cancelled" && (
                                <button
                                  className="p-1 rounded text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                  title="Marcar como pago"
                                  onClick={() => { setMarkingPaid(inv); setPaidDate(new Date().toISOString().slice(0, 10)); setMarkPaidType(""); }}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                className="p-1 rounded text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                title="Ver recibo / Imprimir"
                                onClick={() => openReceipt(inv)}
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title="Editar cobrança"
                                onClick={() => setEditingInv(inv)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Excluir cobrança"
                                onClick={() => setDeletingInv(inv)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {filteredInvoices.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/10 flex-wrap gap-2">
                <p className="text-[10px] text-muted-foreground">
                  Mostrando {Math.min((safePage - 1) * perPage + 1, filteredInvoices.length)}{" "}
                  a {Math.min(safePage * perPage, filteredInvoices.length)} de{" "}
                  {filteredInvoices.length} faturas
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="p-1 rounded border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(pg => (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      className={cn(
                        "min-w-[24px] h-6 rounded border text-[10px] font-medium",
                        pg === safePage ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {pg}
                    </button>
                  ))}
                  {totalPages > 5 && (
                    <>
                      <span className="text-muted-foreground text-[10px]">…</span>
                      <button
                        onClick={() => setPage(totalPages)}
                        className="min-w-[24px] h-6 rounded border text-[10px] font-medium text-muted-foreground hover:bg-muted"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="p-1 rounded border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground">{perPage} por página</span>
              </div>
            )}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Receitas x Despesas */}
            <div className="bg-card border rounded-xl p-4 lg:col-span-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Receitas x Despesas</h2>
                <span className="text-[10px] text-muted-foreground">Últimos 6 meses</span>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={lineChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                    tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number) => brl(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                  <Line type="monotone" dataKey="Receitas" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Despesas" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Formas de Pagamento */}
            <div className="bg-card border rounded-xl p-4 lg:col-span-2">
              <h2 className="text-sm font-semibold mb-3">Formas de Pagamento</h2>
              <div className="flex items-center gap-3">
                <ResponsiveContainer width={100} height={100}>
                  <PieChart>
                    <Pie
                      data={paymentMethodData}
                      cx="50%" cy="50%"
                      innerRadius={30} outerRadius={46}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {paymentMethodData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {paymentMethodData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-[10px] text-muted-foreground">{d.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold">{d.value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 pt-2 border-t text-center">
                <p className="text-[10px] text-muted-foreground">Total recebido</p>
                <p className="text-sm font-bold">
                  {brl(allInvoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0))}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Summary panels ─────────────────────────────────────────── */}
        <div className="w-72 shrink-0 space-y-4">

          {/* Resumo de Cobranças */}
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Resumo de Cobranças</h2>
              <span className="text-[10px] text-muted-foreground">Este mês</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative shrink-0" style={{ width: 110, height: 110 }}>
                <PieChart width={110} height={110}>
                  <Pie
                    data={donutData.slices}
                    cx="50%" cy="50%"
                    innerRadius={34} outerRadius={52}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {donutData.slices.map((s, i) => (
                      <Cell key={i} fill={s.color} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black leading-none">{donutData.total}</span>
                  <span className="text-[9px] text-muted-foreground">faturas</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {donutData.slices.map((s, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="text-[10px] text-muted-foreground">{s.name}</span>
                      </div>
                      <span className="text-[10px] font-bold">{s.pct}%</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground pl-3.5">
                      {s.value} fat. · {brl(s.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <button className="mt-3 w-full text-center text-[10px] text-primary hover:underline">
              Ver relatório completo
            </button>
          </div>

          {/* Inadimplência */}
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Inadimplência</h2>
              <button className="text-[10px] text-primary hover:underline">Ver todos</button>
            </div>
            <div className="mb-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">
                Clientes Inadimplentes
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black">{inadimplentes.length}</span>
                {inadimplentes.length > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-400">
                    <ArrowUpRight className="w-3 h-3" /> 12.7% vs mês anterior
                  </span>
                )}
              </div>
            </div>
            {inadimplentes.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto opacity-20 mb-1" />
                <p className="text-xs">Nenhuma inadimplência</p>
              </div>
            ) : (
              <div className="space-y-2">
                {inadimplentes.slice(0, 5).map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{d.name}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-xs font-semibold tabular-nums">{brl(d.total)}</p>
                      <p className="text-[9px] text-red-400">{d.days} dias</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {inadimplentes.length > 0 && (
              <button className="mt-3 w-full py-1.5 rounded-lg border border-border text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                Enviar lembretes
              </button>
            )}
          </div>

          {/* Recebimento Previsto */}
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Recebimento Previsto</h2>
              <span className="text-[10px] text-muted-foreground">Próximos 30 dias</span>
            </div>
            {upcomingPayments.items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Sem pagamentos previstos
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingPayments.items.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium text-[10px]">
                        {fmtDate(p.dueDate)}
                      </p>
                      <p className="text-[9px] text-muted-foreground truncate max-w-[120px]">{p.clientName}</p>
                    </div>
                    <span className="font-semibold tabular-nums text-[11px]">
                      {brl(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 pt-2 border-t flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-semibold">Total previsto</span>
              <span className="text-sm font-black text-primary">{brl(upcomingPayments.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      <PaymentModal operators={operators} open={payModal} onClose={() => setPayModal(false)} />
      <EditPaymentModal inv={editingInv} open={!!editingInv} onClose={() => setEditingInv(null)} />

      {/* Delete confirmation */}
      {deletingInv && (
        <Dialog open onOpenChange={() => setDeletingInv(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base text-red-500">
                <Trash2 className="w-4 h-4" /> Excluir Cobrança
              </DialogTitle>
            </DialogHeader>
            <div className="py-2 space-y-2">
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir permanentemente esta cobrança?
              </p>
              <div className="rounded-lg border p-3 bg-muted/30 text-sm space-y-1">
                <p><span className="text-muted-foreground text-xs">Código:</span> {deletingInv.id}</p>
                <p><span className="text-muted-foreground text-xs">Cliente:</span> {deletingInv.clientName}</p>
                <p><span className="text-muted-foreground text-xs">Valor:</span> {brl(deletingInv.amount)}</p>
                {deletingInv.screenName && <p><span className="text-muted-foreground text-xs">Tela:</span> {deletingInv.screenName}</p>}
              </div>
              <p className="text-[11px] text-red-400">Esta ação não pode ser desfeita.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDeletingInv(null)}>Cancelar</Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteMut.mutate(deletingInv!)}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {markingPaid && (
        <Dialog open onOpenChange={() => setMarkingPaid(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Confirmar Pagamento
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                {markingPaid.clientName} — {markingPaid.id} — {brl(markingPaid.amount)}
              </p>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data de Pagamento</label>
                <Input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Forma de Pagamento</label>
                <Select value={markPaidType || "__none__"} onValueChange={v => setMarkPaidType(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Não informado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não informado</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                    <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setMarkingPaid(null)}>Cancelar</Button>
              <Button size="sm" onClick={() => markPaidMut.mutate(markingPaid!)}
                disabled={markPaidMut.isPending}
                className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirmar Pago
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
