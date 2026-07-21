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
  CalendarRange, Layers, ChevronsUpDown, ChevronUp, ChevronDown,
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
  boletoUrl: string | null;
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
  cnpj?: string | null;
  companyName?: string | null;
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
  paymentMethod: string;
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
  screenId: number | null;
  screenName: string | null;
  screenCnpj: string | null;
  screenCompanyName: string | null;
  screenLocation: string | null;
  dueDate: string | null;
  amount: number;
  status: "paid" | "pending" | "overdue" | "cancelled";
  paidAt: string | null;
  referenceMonth: string;
  notes: string | null;
  paymentType: string | null;
  boletoUrl: string | null;
  installmentNumber: number;
  totalInstallments: number;
};

type SortField = "id" | "clientName" | "screenName" | "dueDate" | "amount" | "status" | "installment";
type SortDir   = "asc" | "desc";

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
  wallet:      "Carteira",
};

function monthLabelFull(ym: string) {
  const [y, m] = ym.split("-");
  const names = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${names[parseInt(m ?? "1") - 1]} ${y}`;
}

function openReceipt(inv: Invoice) {
  const statusLabel = { paid: "✓ PAGO", pending: "PENDENTE", overdue: "VENCIDO", cancelled: "CANCELADO" }[inv.status] ?? "—";
  const statusColor = { paid: "#065f46", pending: "#92400e", overdue: "#991b1b", cancelled: "#52525b" }[inv.status] ?? "#92400e";
  const statusBg   = { paid: "#d1fae5", pending: "#fef3c7", overdue: "#fee2e2", cancelled: "#f4f4f5" }[inv.status] ?? "#fef3c7";
  const logoUrl = `${location.origin}/logo-onsign.png`;
  const now = new Date();
  const emitidoEm = now.toLocaleDateString("pt-BR") + " às " + now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Recibo / Fatura ${inv.id}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;background:#f5f6fa;min-height:100vh}
  .page{background:#fff;max-width:760px;margin:32px auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10)}

  /* ── CABEÇALHO ── */
  .header{display:flex;align-items:stretch;justify-content:space-between;padding:0;background:#fff;border-bottom:4px solid #c8102e}
  .header-left{display:flex;align-items:center;gap:18px;padding:22px 28px;flex:1}
  .header-logo{width:160px;height:auto;object-fit:contain;flex-shrink:0}
  .header-company{display:flex;flex-direction:column;justify-content:center}
  .company-name{font-size:13px;font-weight:700;color:#1a1a2e;letter-spacing:.3px;line-height:1.3}
  .company-detail{font-size:10.5px;color:#666;margin-top:2px;line-height:1.5}
  .header-right{background:#1a1a2e;padding:22px 28px;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;min-width:220px;gap:4px}
  .doc-title{font-size:17px;font-weight:900;color:#fff;letter-spacing:1.5px;text-transform:uppercase}
  .doc-code{font-size:11px;color:#c8102e;font-family:monospace;font-weight:700;margin-top:2px}
  .doc-badge{display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:800;margin-top:6px;letter-spacing:.5px}
  .doc-emit{font-size:10px;color:#aaa;margin-top:8px;text-align:right;line-height:1.6}
  .doc-emit strong{color:#ddd;display:block}

  /* ── BODY ── */
  .body{padding:28px 32px}

  /* ── SEÇÃO ── */
  .section{margin-bottom:22px}
  .section-title{font-size:9.5px;font-weight:800;color:#c8102e;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;display:flex;align-items:center;gap:8px}
  .section-title::after{content:'';flex:1;height:1px;background:#e8e8e8}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .field{margin-bottom:8px}
  .field label{font-size:9.5px;color:#999;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.8px}
  .field span{font-size:13px;color:#1a1a2e;font-weight:600}

  /* ── VALOR DESTAQUE ── */
  .amount-box{background:linear-gradient(135deg,#1a1a2e 0%,#2d2d4e 100%);border-radius:10px;padding:24px 20px;text-align:center;margin:22px 0;position:relative;overflow:hidden}
  .amount-box::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:#c8102e}
  .amount-box .lbl{font-size:10px;color:#aaa;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px}
  .amount-box .val{font-size:38px;font-weight:900;color:#fff;letter-spacing:-1px}
  .amount-box .val span{font-size:20px;font-weight:600;color:#c8102e;margin-right:4px}

  /* ── TABELA DE DETALHES ── */
  .detail-table{width:100%;border-collapse:collapse;font-size:12px}
  .detail-table tr{border-bottom:1px solid #f0f0f0}
  .detail-table tr:last-child{border-bottom:none}
  .detail-table td{padding:8px 4px;vertical-align:top}
  .detail-table td:first-child{color:#888;font-size:10px;text-transform:uppercase;letter-spacing:.6px;width:40%;padding-top:10px}
  .detail-table td:last-child{color:#1a1a2e;font-weight:600}

  /* ── RODAPÉ ── */
  .footer{background:#f8f9fb;border-top:1px solid #e8e8e8;padding:16px 32px;text-align:center}
  .footer p{font-size:10px;color:#999;line-height:1.7}
  .footer .brand{font-size:11px;font-weight:700;color:#c8102e;margin-bottom:4px}

  /* ── BOTÃO ── */
  .print-btn{display:flex;align-items:center;gap:8px;margin:20px auto 0;background:#c8102e;color:#fff;border:none;padding:11px 32px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.3px}
  .print-btn:hover{background:#a00d25}
  .print-btn-wrap{text-align:center;padding:0 32px 28px}

  @media print{
    body{background:#fff}
    .page{box-shadow:none;margin:0;border-radius:0}
    .print-btn-wrap{display:none}
  }
</style>
</head>
<body>
<div class="page">

  <!-- CABEÇALHO PROFISSIONAL -->
  <div class="header">
    <div class="header-left">
      <img class="header-logo" src="${logoUrl}" alt="RPShow OnSign" onerror="this.style.display='none'"/>
      <div class="header-company">
        <div class="company-name">RPSHOW Comércio de Importação e Exportação LTDA</div>
        <div class="company-detail">CNPJ 43.738.727/0001-83</div>
        <div class="company-detail">Rua Marechal Deodoro, 319 – Centro · Ribeirão Preto – SP · 14010-190</div>
        <div class="company-detail">rpshow.com.br &nbsp;|&nbsp; (16) 98220-8695</div>
      </div>
    </div>
    <div class="header-right">
      <div class="doc-title">Recibo / Fatura</div>
      <div class="doc-code">${inv.id}</div>
      <span class="doc-badge" style="background:${statusBg};color:${statusColor}">${statusLabel}</span>
      <div class="doc-emit">
        <strong>Emitido em:</strong>
        ${emitidoEm}
      </div>
    </div>
  </div>

  <div class="body">

    <!-- DADOS DO LOCAL (TELA) -->
    ${(inv.screenCnpj || inv.screenCompanyName || inv.screenLocation) ? `
    <div class="section">
      <div class="section-title">Dados do Local / Estabelecimento</div>
      <div class="grid">
        <div>
          ${inv.screenCompanyName ? `<div class="field"><label>Empresa / Local</label><span>${inv.screenCompanyName}</span></div>` : ""}
          ${inv.screenCnpj ? `<div class="field"><label>CNPJ</label><span>${inv.screenCnpj}</span></div>` : ""}
        </div>
        <div>
          <div class="field"><label>Tela</label><span>${inv.screenName ?? "—"}</span></div>
          ${inv.screenLocation ? `<div class="field"><label>Endereço</label><span>${inv.screenLocation}</span></div>` : ""}
        </div>
      </div>
    </div>` : ""}

    <!-- DADOS DO CLIENTE / RESPONSÁVEL -->
    <div class="section">
      <div class="section-title">Responsável pela Conta</div>
      <div class="grid">
        <div>
          <div class="field"><label>Nome</label><span>${inv.clientName}</span></div>
          ${inv.clientEmail ? `<div class="field"><label>E-mail</label><span>${inv.clientEmail}</span></div>` : ""}
        </div>
        <div>
          ${!(inv.screenCnpj || inv.screenCompanyName) ? `<div class="field"><label>Tela / Serviço</label><span>${inv.screenName ?? "Todas as telas"}</span></div>` : ""}
          <div class="field"><label>Mês de Referência</label><span>${monthLabelFull(inv.referenceMonth)}</span></div>
        </div>
      </div>
    </div>

    <!-- VALOR DESTAQUE -->
    <div class="amount-box">
      <div class="lbl">Valor Total</div>
      <div class="val"><span>R$</span>${inv.amount.toFixed(2).replace(".", ",")}</div>
    </div>

    <!-- DETALHES DO PAGAMENTO -->
    <div class="section">
      <div class="section-title">Detalhes do Pagamento</div>
      <table class="detail-table">
        <tr>
          <td>Forma de Pagamento</td>
          <td>${inv.paymentType ? (PAYMENT_TYPE_LABELS[inv.paymentType] ?? inv.paymentType) : "—"}</td>
        </tr>
        <tr>
          <td>Vencimento</td>
          <td>${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("pt-BR") : "—"}</td>
        </tr>
        <tr>
          <td>Data de Pagamento</td>
          <td>${inv.paidAt ? new Date(inv.paidAt).toLocaleDateString("pt-BR") : "—"}</td>
        </tr>
        ${inv.notes ? `<tr><td>Observações</td><td>${inv.notes}</td></tr>` : ""}
      </table>
    </div>

  </div>

  <!-- RODAPÉ -->
  <div class="footer">
    <div class="brand">RPShow OnSign — Sistema de Gestão de Painéis de LED</div>
    <p>Este documento serve como comprovante de pagamento dos serviços de comunicação visual prestados pela RPShow OnSign.<br/>
    Em caso de dúvidas, entre em contato pelo WhatsApp: (16) 98220-8695 · rpshow.com.br</p>
  </div>

  <!-- BOTÃO IMPRIMIR -->
  <div class="print-btn-wrap">
    <button class="print-btn" onclick="window.print()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      Imprimir / Salvar PDF
    </button>
  </div>

</div>
</body>
</html>`;
  const w = window.open("", "_blank", "width=860,height=780");
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

// ─── Sortable Table Header ────────────────────────────────────────────────────

function SortTh({
  label, field, sortField, sortDir, onSort, align = "left", className,
}: {
  label: string;
  field: SortField;
  sortField: SortField | null;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const active = sortField === field;
  const alignCls = align === "right" ? "text-right justify-end" : align === "center" ? "text-center justify-center" : "text-left justify-start";
  return (
    <th
      className={cn("px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none group", alignCls, className)}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {active
          ? sortDir === "asc"
            ? <ChevronUp className="w-3 h-3 text-primary" />
            : <ChevronDown className="w-3 h-3 text-primary" />
          : <ChevronsUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
        }
      </span>
    </th>
  );
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
  const [boletoUrl, setBoletoUrl]   = useState("");
  const [error, setError]           = useState("");

  React.useEffect(() => {
    if (open && inv) {
      setStatus(inv.status);
      setAmount(String(inv.amount));
      setDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : "");
      setPaidAt(inv.paidAt ? new Date(inv.paidAt).toISOString().slice(0, 10) : "");
      setNotes(inv.notes ?? "");
      setPaymentType(inv.paymentType ?? "");
      setBoletoUrl((inv as Invoice & { boletoUrl?: string | null }).boletoUrl ?? "");
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
      body["boletoUrl"] = boletoUrl.trim() || null;
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
            <label className="text-xs text-muted-foreground mb-1 block">Forma de Pagamento Registrada</label>
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
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Link do Boleto (URL)</label>
            <Input
              value={boletoUrl}
              onChange={e => setBoletoUrl(e.target.value)}
              placeholder="https://... (cole o link do boleto aqui)"
              className="h-8 text-sm"
            />
            {boletoUrl && (
              <a href={boletoUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary mt-0.5 block hover:underline">
                ↗ Abrir boleto para conferir
              </a>
            )}
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

// ─── Unified Cobrança Modal ──────────────────────────────────────────────────

type CobrancaMode = "single" | "plan";
type CCharge = { screenId: number; name: string; include: boolean; price: string; dueDate: string; status: string; blockIfUnpaid: boolean };

const EMPTY_SCREENS: ScreenItem[] = [];
const PAY_TYPES = [
  { value: "pix", label: "PIX" }, { value: "boleto", label: "Boleto" },
  { value: "credit_card", label: "Cartão de Crédito" }, { value: "debit_card", label: "Cartão de Débito" },
  { value: "cash", label: "Dinheiro" }, { value: "transfer", label: "Transferência" },
];

function defDueDate(offsetMonths = 0) {
  const d = new Date(); d.setMonth(d.getMonth() + offsetMonths); d.setDate(10);
  return d.toISOString().slice(0, 10);
}
function addMonthsStr(dateStr: string, n: number) {
  const d = new Date(dateStr + "T12:00:00"); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10);
}
function refMonFromDate(dateStr: string) { return dateStr.slice(0, 7); }

function CobrancaModal({ operators, open, onClose }: { operators: Operator[]; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode]             = useState<CobrancaMode>("plan");
  const [operatorId, setOperatorId] = useState("");
  const [planMonths, setPlanMonths] = useState(3);
  const [firstDue, setFirstDue]     = useState(defDueDate());
  const [payType, setPayType]       = useState("");
  const [notes, setNotes]           = useState("");
  const [charges, setCharges]       = useState<CCharge[]>([]);
  const [manualPrice, setManualPrice] = useState("");
  const [manualDueDate, setManualDueDate] = useState(defDueDate());
  const [manualStatus, setManualStatus] = useState("pending");
  const [error, setError]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);

  const { data: screens = EMPTY_SCREENS } = useQuery<ScreenItem[]>({
    queryKey: ["cobranca-modal-screens", operatorId],
    queryFn: () => fetch(`/api/admin/operators/${operatorId}/screens`, { credentials: "include" }).then(r => r.json()),
    enabled: open && !!operatorId,
  });

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setMode("plan");
      const first = operators[0];
      setOperatorId(first ? String(first.id) : "");
      setPlanMonths(3); setFirstDue(defDueDate()); setPayType(""); setNotes("");
      setManualPrice(""); setManualDueDate(defDueDate()); setManualStatus("pending");
      setError(""); setSubmitting(false); setDone(false);
    }
  }, [open, operators]);

  // Init charges when screens load
  React.useEffect(() => {
    const op = operators.find(o => String(o.id) === operatorId);
    setCharges(screens.map(s => ({
      screenId: s.id, name: s.name, include: true,
      price: s.price ?? op?.pricePerScreen ?? "50.00",
      dueDate: defDueDate(), status: "pending", blockIfUnpaid: false,
    })));
  }, [screens, operatorId, operators]);

  // When operator changes reset manual price
  React.useEffect(() => {
    const op = operators.find(o => String(o.id) === operatorId);
    if (op) setManualPrice(op.monthlyAmount ?? "");
  }, [operatorId, operators]);

  function upd(id: number, patch: Partial<CCharge>) {
    setCharges(cs => cs.map(c => c.screenId === id ? { ...c, ...patch } : c));
  }

  const hasScreens = screens.length > 0;
  const selCharges = charges.filter(c => c.include);
  const planSlots = Array.from({ length: planMonths }, (_, i) => ({
    month: i + 1,
    dueDate: addMonthsStr(firstDue, i),
    refMonth: refMonFromDate(addMonthsStr(firstDue, i)),
  }));
  const totalPerMonth = hasScreens
    ? selCharges.reduce((s, c) => s + (parseFloat(c.price) || 0), 0)
    : (parseFloat(manualPrice) || 0);
  const grandTotal = totalPerMonth * planMonths;
  const totalInvoices = mode === "plan"
    ? planMonths * (hasScreens ? Math.max(selCharges.length, 1) : 1)
    : (hasScreens ? selCharges.length : 1);

  async function handleSubmit() {
    setError(""); setSubmitting(true);
    try {
      if (!operatorId) throw new Error("Selecione um cliente");
      const post = async (body: Record<string, unknown>) => {
        const r = await fetch(`/api/admin/operators/${operatorId}/payments`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error("Erro ao registrar cobrança");
      };
      const blockScreen = async (screenId: number) => {
        await fetch(`/api/admin/screens/${screenId}/block`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocked: true }),
        });
      };

      if (mode === "single") {
        if (hasScreens) {
          if (selCharges.length === 0) throw new Error("Selecione ao menos uma tela");
          for (const c of selCharges) {
            const body: Record<string, unknown> = {
              referenceMonth: refMonFromDate(c.dueDate), status: c.status,
              amount: c.price, screenId: c.screenId,
              dueDate: new Date(c.dueDate + "T12:00:00").toISOString(),
            };
            if (notes.trim()) body["notes"] = notes.trim();
            if (payType) body["paymentType"] = payType;
            await post(body);
            if (c.blockIfUnpaid && c.status !== "paid") await blockScreen(c.screenId);
          }
        } else {
          if (!(parseFloat(manualPrice) > 0)) throw new Error("Informe um valor maior que zero");
          const body: Record<string, unknown> = {
            referenceMonth: refMonFromDate(manualDueDate), status: manualStatus,
            amount: manualPrice, dueDate: new Date(manualDueDate + "T12:00:00").toISOString(),
          };
          if (notes.trim()) body["notes"] = notes.trim();
          if (payType) body["paymentType"] = payType;
          await post(body);
        }
      } else {
        if (totalPerMonth <= 0) throw new Error("Informe valores maiores que zero");
        for (const slot of planSlots) {
          if (hasScreens) {
            if (selCharges.length === 0) throw new Error("Selecione ao menos uma tela");
            for (const c of selCharges) {
              const body: Record<string, unknown> = {
                referenceMonth: slot.refMonth, status: "pending",
                amount: c.price, screenId: c.screenId,
                dueDate: new Date(slot.dueDate + "T12:00:00").toISOString(),
                notes: notes.trim() || `Plano ${planMonths}m — mês ${slot.month}/${planMonths}`,
              };
              if (payType) body["paymentType"] = payType;
              await post(body);
              if (c.blockIfUnpaid) await blockScreen(c.screenId);
            }
          } else {
            const body: Record<string, unknown> = {
              referenceMonth: slot.refMonth, status: "pending",
              amount: manualPrice, dueDate: new Date(slot.dueDate + "T12:00:00").toISOString(),
              notes: notes.trim() || `Plano ${planMonths}m — mês ${slot.month}/${planMonths}`,
            };
            if (payType) body["paymentType"] = payType;
            await post(body);
          }
        }
      }
      qc.invalidateQueries({ queryKey: ["admin-financial"] });
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!operatorId && !submitting &&
    (hasScreens ? selCharges.length > 0 : parseFloat(manualPrice) > 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4 text-primary" /> Cobranças
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="font-semibold text-lg">
              {mode === "plan" ? "Plano gerado com sucesso!" : "Cobrança registrada!"}
            </p>
            <p className="text-sm text-muted-foreground">
              {totalInvoices} fatura{totalInvoices !== 1 ? "s" : ""} criada{totalInvoices !== 1 ? "s" : ""}
              {mode === "plan" ? ` — total ${brl(grandTotal)}` : ""}
            </p>
            <Button onClick={onClose} className="mt-2">Fechar</Button>
          </div>
        ) : (
          <>
            {/* Mode toggle */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
              <button type="button" onClick={() => setMode("single")} className={cn(
                "px-4 py-1.5 rounded-md text-xs font-semibold transition-all",
                mode === "single" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              )}>
                <CreditCard className="w-3.5 h-3.5 inline mr-1.5" />Avulsa
              </button>
              <button type="button" onClick={() => setMode("plan")} className={cn(
                "px-4 py-1.5 rounded-md text-xs font-semibold transition-all",
                mode === "plan" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              )}>
                <CalendarRange className="w-3.5 h-3.5 inline mr-1.5" />Plano (1-12 meses)
              </button>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">

              {/* Cliente + forma de pagamento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Cliente *</label>
                  <Select value={operatorId} onValueChange={setOperatorId}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {operators.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Forma de Pagamento</label>
                  <Select value={payType || "__none__"} onValueChange={v => setPayType(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Não informado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não informado</SelectItem>
                      {PAY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Plano: período + 1º vencimento */}
              {mode === "plan" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Período (meses)</label>
                    <div className="grid grid-cols-6 gap-1">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                        <button key={n} type="button" onClick={() => setPlanMonths(n)} className={cn(
                          "rounded-lg border text-xs font-semibold py-2 transition-all",
                          planMonths === n ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted text-muted-foreground"
                        )}>{n}x</button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {planMonths === 1 ? "1 fatura por tela" : `${planMonths} faturas por tela (1/mês)`}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">1º Vencimento</label>
                    <Input type="date" value={firstDue} onChange={e => setFirstDue(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
              )}

              {/* Telas ou valor manual */}
              {operatorId && (
                <div>
                  {hasScreens ? (
                    <>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs text-muted-foreground">
                          Telas ({selCharges.length}/{screens.length})
                          {mode === "single"
                            ? ` — total ${brl(totalPerMonth)}`
                            : ` — ${brl(totalPerMonth)}/mês · total ${brl(grandTotal)}`}
                        </label>
                        <div className="flex gap-2">
                          <button type="button" className="text-[10px] text-primary hover:underline" onClick={() => setCharges(cs => cs.map(c => ({ ...c, include: true })))}>todas</button>
                          <button type="button" className="text-[10px] text-muted-foreground hover:underline" onClick={() => setCharges(cs => cs.map(c => ({ ...c, include: false })))}>nenhuma</button>
                        </div>
                      </div>
                      <div className="rounded-lg border overflow-hidden divide-y">
                        {charges.map(c => (
                          <div key={c.screenId} className={cn("flex flex-col gap-1.5 px-3 py-2", !c.include && "opacity-50")}>
                            <div className="flex items-center gap-2">
                              <input type="checkbox" checked={c.include} onChange={e => upd(c.screenId, { include: e.target.checked })} className="rounded shrink-0" />
                              <span className="text-xs font-medium flex-1 truncate">{c.name}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[10px] text-muted-foreground">R$</span>
                                <Input value={c.price} onChange={e => upd(c.screenId, { price: e.target.value })} disabled={!c.include} placeholder="0.00" className="h-7 text-xs w-[72px] font-mono" />
                                <span className="text-[10px] text-muted-foreground">/mês</span>
                              </div>
                              <button type="button" disabled={!c.include} onClick={() => upd(c.screenId, { blockIfUnpaid: !c.blockIfUnpaid })} title="Bloquear tela se não pagar" className={cn(
                                "h-7 px-2 rounded border text-[10px] font-medium flex items-center gap-1 shrink-0 transition-colors",
                                c.blockIfUnpaid ? "bg-red-500/10 border-red-500/40 text-red-600" : "border-input text-muted-foreground hover:bg-muted"
                              )}>
                                <Lock className="w-3 h-3" />{c.blockIfUnpaid ? "Bloqueia" : "Bloquear?"}
                              </button>
                            </div>
                            {mode === "single" && c.include && (
                              <div className="flex items-center gap-2 pl-5">
                                <Input type="date" value={c.dueDate} onChange={e => upd(c.screenId, { dueDate: e.target.value })} className="h-7 text-xs w-[132px]" />
                                <Select value={c.status} onValueChange={v => upd(c.screenId, { status: v })}>
                                  <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pendente</SelectItem>
                                    <SelectItem value="paid">Pago</SelectItem>
                                    <SelectItem value="overdue">Em atraso</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Valor (R$) <span className="text-yellow-500 text-[10px]">— cliente sem telas cadastradas</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">R$</span>
                          <Input value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder="0.00" className="h-8 text-sm w-32 font-mono" />
                          <span className="text-xs text-muted-foreground">/mês</span>
                        </div>
                      </div>
                      {mode === "single" && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Vencimento</label>
                            <Input type="date" value={manualDueDate} onChange={e => setManualDueDate(e.target.value)} className="h-8 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                            <Select value={manualStatus} onValueChange={setManualStatus}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pendente</SelectItem>
                                <SelectItem value="paid">Pago</SelectItem>
                                <SelectItem value="overdue">Em atraso</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Prévia do plano */}
              {mode === "plan" && totalPerMonth > 0 && operatorId && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    Prévia — {planMonths} fatura{planMonths !== 1 ? "s" : ""} por tela
                  </label>
                  <div className="rounded-lg border overflow-hidden divide-y text-xs">
                    <div className="flex gap-2 px-3 py-1.5 bg-muted/50 font-semibold text-muted-foreground">
                      <span className="w-14">Mês</span><span className="flex-1">Vencimento</span><span className="w-24 text-right">Total/mês</span>
                    </div>
                    {planSlots.map(slot => (
                      <div key={slot.month} className="flex gap-2 px-3 py-2">
                        <span className="w-14 font-mono font-bold text-primary">{slot.month}/{planMonths}</span>
                        <span className="flex-1 text-muted-foreground">
                          {new Date(slot.dueDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                        <span className="w-24 text-right font-mono font-semibold">{brl(totalPerMonth)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-3 py-2 bg-muted/30 font-bold">
                      <span>Total — {planMonths} {planMonths === 1 ? "mês" : "meses"}</span>
                      <span className="text-primary font-mono">{brl(grandTotal)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Observações */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Observações (opcional)</label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Plano anual — desconto 10%" className="h-8 text-sm" />
              </div>

              {error && <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={handleSubmit} disabled={!canSubmit} className="gap-1.5">
                {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {submitting ? "Gerando..." : mode === "plan"
                  ? `Gerar ${totalInvoices} fatura${totalInvoices !== 1 ? "s" : ""}`
                  : `Registrar ${totalInvoices} cobrança${totalInvoices !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </>
        )}
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
  const [perPage, setPerPage]       = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField]   = useState<SortField | null>(null);
  const [sortDir, setSortDir]       = useState<SortDir>("asc");
  const [cobrancaModal, setCobrancaModal] = useState(false);
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
          screenId: p.screenId ?? null,
          screenName: p.screenName,
          screenCnpj: (p as any).screenCnpj ?? null,
          screenCompanyName: (p as any).screenCompanyName ?? null,
          screenLocation: (p as any).screenLocation ?? null,
          dueDate: p.dueDate,
          amount: parseFloat(p.amount),
          status,
          paidAt: p.paidAt,
          referenceMonth: p.referenceMonth,
          notes: p.notes,
          paymentType: p.paymentType,
          boletoUrl: p.boletoUrl ?? null,
          installmentNumber: 0,
          totalInstallments: 0,
        });
      });
    });
    // ── Calcular número de parcelas por operador+tela ────────────────────────
    // Agrupa por operatorId + screenId, ordena por referenceMonth, atribui posição
    const groups = new Map<string, Invoice[]>();
    list.forEach(inv => {
      const key = `${inv.operatorId}::${inv.screenId ?? "all"}`;
      const g = groups.get(key) ?? [];
      g.push(inv);
      groups.set(key, g);
    });
    groups.forEach(grp => {
      grp.sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth));
      const total = grp.length;
      grp.forEach((inv, i) => {
        inv.installmentNumber = i + 1;
        inv.totalInstallments = total;
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

  // ── Filtered, sorted & paginated invoices ──────────────────────────────────
  const filteredInvoices = useMemo(() => {
    let list = allInvoices;
    if (tab === "open")       list = list.filter(i => i.status === "pending");
    else if (tab === "paid")  list = list.filter(i => i.status === "paid");
    else if (tab === "overdue")   list = list.filter(i => i.status === "overdue");
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
    if (sortField) {
      const dir = sortDir === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        switch (sortField) {
          case "id":          return dir * a.id.localeCompare(b.id);
          case "clientName":  return dir * a.clientName.localeCompare(b.clientName);
          case "screenName":  return dir * (a.screenName ?? "").localeCompare(b.screenName ?? "");
          case "dueDate":     return dir * ((a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
          case "amount":      return dir * (a.amount - b.amount);
          case "status": {
            const order: Record<string, number> = { overdue: 0, pending: 1, paid: 2, cancelled: 3 };
            return dir * ((order[a.status] ?? 9) - (order[b.status] ?? 9));
          }
          case "installment": return dir * (a.installmentNumber - b.installmentNumber);
          default: return 0;
        }
      });
    }
    return list;
  }, [allInvoices, tab, search, clientFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
    setPage(1);
  }

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

  function handleTabChange(t: TabFilter) { setTab(t); setPage(1); setSelectedIds(new Set()); }

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

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const targets = allInvoices.filter(inv => ids.includes(inv.id));
      await Promise.all(targets.map(inv =>
        fetch(`/api/admin/operators/${inv.operatorId}/payments/${inv.paymentId}`, {
          method: "DELETE", credentials: "include",
        })
      ));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-financial"] }); setSelectedIds(new Set()); },
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
          <Button size="sm" className="h-9 gap-2 text-sm" onClick={() => setCobrancaModal(true)}>
            <Plus className="w-4 h-4" /> Nova Cobrança
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
                      onChange={e => { setSearch(e.target.value); setPage(1); setSelectedIds(new Set()); }}
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
                  <Select value={clientFilter} onValueChange={v => { setClientFilter(v); setPage(1); setSelectedIds(new Set()); }}>
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
                  {/* Preferência de pagamento do cliente selecionado */}
                  {clientFilter !== "all" && (() => {
                    const op = operators.find(o => String(o.id) === clientFilter);
                    if (!op) return null;
                    return (
                      <div className="flex items-center gap-1.5 pl-2 border-l border-border">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">Forma:</span>
                        <Select
                          value={op.paymentMethod ?? "pix"}
                          onValueChange={async (v) => {
                            await fetch(`/api/admin/operators/${op.id}/payment-method`, {
                              method: "PATCH", credentials: "include",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ paymentMethod: v }),
                            });
                            qc.invalidateQueries({ queryKey: ["admin-financial"] });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs w-28 px-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="boleto">Boleto</SelectItem>
                            <SelectItem value="carteira">Carteira</SelectItem>
                            <SelectItem value="isento">Isento/Gratuito</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-[10px] text-muted-foreground">preferência</span>
                      </div>
                    );
                  })()}
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                    <Filter className="w-3 h-3" /> Filtros
                  </Button>
                  {/* ── Seletor de quantidade por página ── */}
                  <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-border">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">Exibir:</span>
                    <Select
                      value={String(perPage)}
                      onValueChange={v => { setPerPage(Number(v)); setPage(1); setSelectedIds(new Set()); }}
                    >
                      <SelectTrigger className="h-7 text-xs w-20 px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="999999">Todos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="bg-muted/30 border-y">
                      <th className="w-10 px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded cursor-pointer accent-primary"
                          title="Selecionar todos"
                          checked={pageInvs.length > 0 && pageInvs.every(i => selectedIds.has(i.id))}
                          onChange={e => {
                            if (e.target.checked) setSelectedIds(prev => { const s = new Set(prev); pageInvs.forEach(i => s.add(i.id)); return s; });
                            else setSelectedIds(prev => { const s = new Set(prev); pageInvs.forEach(i => s.delete(i.id)); return s; });
                          }}
                        />
                      </th>
                      <SortTh label="Fatura"     field="id"           sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="left" />
                      <SortTh label="Cliente"    field="clientName"   sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="left" />
                      <SortTh label="Tela"       field="screenName"   sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="left"   className="hidden lg:table-cell" />
                      <SortTh label="Vencimento" field="dueDate"      sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="left"   className="hidden md:table-cell" />
                      <SortTh label="Parcela"    field="installment"  sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="center" />
                      <SortTh label="Valor"      field="amount"       sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="right" />
                      <SortTh label="Status"     field="status"       sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="center" />
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageInvs.map(inv => {
                      const overdueDays = inv.status === "overdue" ? daysOverdue(inv.dueDate) : null;
                      const isOverdue   = inv.status === "overdue";
                      return (
                        <tr
                          key={inv.id}
                          className={cn(
                            "border-b transition-colors",
                            isOverdue
                              ? "bg-red-500/5 border-red-500/20 hover:bg-red-500/10"
                              : "hover:bg-muted/15",
                          )}
                        >
                          <td className="px-3 py-2.5 w-10 text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded cursor-pointer accent-primary"
                              checked={selectedIds.has(inv.id)}
                              onChange={e => setSelectedIds(prev => {
                                const s = new Set(prev);
                                if (e.target.checked) s.add(inv.id); else s.delete(inv.id);
                                return s;
                              })}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={cn("text-xs font-mono hover:underline cursor-pointer", isOverdue ? "text-red-400" : "text-primary")}>
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
                              <p className={cn("text-xs", isOverdue && "text-red-400 font-medium")}>{fmtDate(inv.dueDate)}</p>
                              {overdueDays !== null && (
                                <p className="text-[10px] text-red-400">{overdueDays}d em atraso</p>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={cn(
                              "text-xs font-mono tabular-nums px-2 py-0.5 rounded",
                              inv.totalInstallments > 1
                                ? "bg-muted/50 text-muted-foreground"
                                : "text-muted-foreground/50",
                            )}>
                              {inv.totalInstallments > 1
                                ? `${inv.installmentNumber}/${inv.totalInstallments}`
                                : "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={cn("text-xs font-semibold tabular-nums", isOverdue && "text-red-400")}>
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

            {/* ── Bulk action bar — aparece ao selecionar ≥1 fatura ── */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 border-t-2 border-destructive/40 bg-destructive/10 animate-in slide-in-from-bottom-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{selectedIds.size}</span>
                  </div>
                  <span className="text-xs font-semibold text-destructive">
                    {selectedIds.size} fatura{selectedIds.size !== 1 ? "s" : ""} selecionada{selectedIds.size !== 1 ? "s" : ""}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs gap-1.5 font-semibold"
                  disabled={bulkDeleteMut.isPending}
                  onClick={() => {
                    if (confirm(`Excluir ${selectedIds.size} fatura(s) permanentemente?\n\nEssa ação não pode ser desfeita.`))
                      bulkDeleteMut.mutate(Array.from(selectedIds));
                  }}
                >
                  {bulkDeleteMut.isPending
                    ? <RefreshCw className="w-3 h-3 animate-spin" />
                    : <Trash2 className="w-3 h-3" />}
                  Excluir {selectedIds.size} fatura{selectedIds.size !== 1 ? "s" : ""}
                </Button>
                <button
                  className="ml-auto text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Limpar seleção
                </button>
              </div>
            )}

            {/* Pagination */}
            {filteredInvoices.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/10 flex-wrap gap-2">
                <p className="text-[10px] text-muted-foreground">
                  {perPage === 999999
                    ? `Mostrando todos ${filteredInvoices.length} registros`
                    : `Mostrando ${Math.min((safePage - 1) * perPage + 1, filteredInvoices.length)} a ${Math.min(safePage * perPage, filteredInvoices.length)} de ${filteredInvoices.length} faturas`
                  }
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage <= 1 || perPage === 999999}
                    className="p-1 rounded border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  {perPage !== 999999 && Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(pg => (
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
                  {perPage !== 999999 && totalPages > 5 && (
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
                    disabled={safePage >= totalPages || perPage === 999999}
                    className="p-1 rounded border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
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
      <CobrancaModal operators={operators} open={cobrancaModal} onClose={() => setCobrancaModal(false)} />
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
                <label className="text-xs font-medium mb-1 flex items-center gap-1">
                  Forma de Pagamento
                  <span className="text-red-500">*</span>
                  {!markPaidType && <span className="text-[10px] text-red-400 font-normal ml-1">obrigatório</span>}
                </label>
                <Select value={markPaidType || ""} onValueChange={v => setMarkPaidType(v)}>
                  <SelectTrigger className={`h-8 text-sm ${!markPaidType ? "border-red-400" : ""}`}>
                    <SelectValue placeholder="Selecione a forma de pagamento..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                    <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                    <SelectItem value="wallet">Carteira</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setMarkingPaid(null)}>Cancelar</Button>
              <Button size="sm" onClick={() => markPaidMut.mutate(markingPaid!)}
                disabled={markPaidMut.isPending || !markPaidType}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirmar Pago
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
