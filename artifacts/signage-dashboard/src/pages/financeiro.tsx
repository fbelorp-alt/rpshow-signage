import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import {
  CheckCircle2, Clock, XCircle, CreditCard, Mail, AlertCircle,
  TrendingUp, CalendarClock, BadgeAlert, RefreshCw, Monitor,
  MapPin, Wifi, WifiOff, Monitor as MonitorIcon, FileText, Download,
  Wallet, Gift,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

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
  screenCnpj: string | null;
  screenCompanyName: string | null;
  screenLocation: string | null;
  referenceMonth: string;
  status: string;
  amount: string;
  notes: string | null;
  paidAt: string | null;
  dueDate: string | null;
  paymentType: string | null;
  boletoUrl: string | null;
};

type BillingData = {
  operatorName: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  paymentMethod: string;
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

const FULL_MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
function monthLabelFull(ym: string) {
  const [y, m] = ym.split("-");
  return `${FULL_MONTHS[parseInt(m!) - 1] ?? m} / ${y}`;
}

function valorPorExtenso(v: number): string {
  const units = ["","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
  const tens  = ["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
  const hunds = ["","cem","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];
  function below1000(n: number): string {
    if (n === 0) return "";
    if (n === 100) return "cem";
    const h = Math.floor(n / 100);
    const r = n % 100;
    const hs = h ? hunds[h]! : "";
    const rs = r < 20 ? (units[r] ?? "") : (tens[Math.floor(r/10)]! + (r%10 ? " e " + (units[r%10] ?? "") : ""));
    return hs && rs ? hs + " e " + rs : hs || rs;
  }
  const reais = Math.floor(v);
  const cents = Math.round((v - reais) * 100);
  const rs = reais === 0 ? "" : below1000(reais) + (reais === 1 ? " real" : " reais");
  const cs = cents === 0 ? "" : below1000(cents) + (cents === 1 ? " centavo" : " centavos");
  if (!rs && !cs) return "zero reais";
  return rs && cs ? rs + " e " + cs : rs || cs;
}

function openPaymentReceipt(p: Payment, operatorName: string) {
  const logoUrl = `${window.location.origin}/logo-onsign.png`;
  const statusLabel = { paid: "PAGO", pending: "PENDENTE", overdue: "VENCIDO" }[p.status] ?? p.status.toUpperCase();
  const statusClass = { paid: "status-paid", pending: "status-pending", overdue: "status-overdue" }[p.status] ?? "status-pending";
  const emitidoEm = new Date().toLocaleDateString("pt-BR");
  const amt = parseAmt(p.amount);
  const amtFmt = amt.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const extenso = valorPorExtenso(amt);
  const venc = p.dueDate ? new Date(p.dueDate).toLocaleDateString("pt-BR") : "—";
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Fatura — ${monthLabelFull(p.referenceMonth)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;padding:32px;color:#1a1a2e}
.page{background:#fff;max-width:780px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:28px}
.topbar{height:4px;background:#79B4B0;border-radius:4px;margin-bottom:24px}
.header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px}
.brand-name{font-size:17px;font-weight:900;color:#1a1a2e}
.brand-detail{font-size:10px;color:#aaa;margin-top:3px;line-height:1.7}
.doc-block{text-align:right}
.doc-num{font-size:18px;font-weight:900;color:#1a1a2e}
.doc-label{font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}
.doc-date{font-size:10px;color:#aaa;margin-top:4px}
.status-badge{display:inline-block;border:1.5px solid;padding:3px 12px;border-radius:20px;font-size:9px;font-weight:800;margin-top:6px;letter-spacing:.3px}
.status-pending{border-color:#f59e0b;color:#f59e0b}
.status-paid{border-color:#10b981;color:#10b981}
.status-overdue{border-color:#ef4444;color:#ef4444}
.box{border:1.5px solid #ddd;border-radius:10px;padding:16px 20px;margin-bottom:16px}
.box-title{font-size:11px;font-weight:800;color:#1a1a2e;margin-bottom:12px}
.box-title span{color:#79B4B0}
.cadastro-row{display:grid;grid-template-columns:1fr 150px;gap:16px;margin-bottom:16px}
.cadastro-box{border:1.5px solid #ddd;border-radius:10px;padding:14px 18px}
.cadastro-box.right{text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.field label{font-size:8.5px;color:#bbb;text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:2px}
.field span{font-size:12px;font-weight:700;color:#1a1a2e}
.date-val{font-size:13px;font-weight:800;color:#1a1a2e;line-height:1.4}
.two-col{display:grid;grid-template-columns:1fr 180px;gap:16px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}
thead th{padding:6px 0;text-align:left;font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#aaa;border-bottom:1.5px solid #ddd}
thead th:last-child{text-align:right}
tbody td{padding:9px 0;border-bottom:1px solid #f4f4f4;color:#1a1a2e;vertical-align:top}
tbody td:last-child{text-align:right;font-weight:700;white-space:nowrap}
.row-sub{font-size:10px;color:#aaa;display:block;margin-top:2px;font-weight:400}
.total-row td{font-weight:800;font-size:13px;border-top:1.5px solid #ddd;border-bottom:none;padding-top:12px;color:#1a1a2e}
.total-row td:last-child{color:#79B4B0}
.extenso-row td{font-size:10px;color:#aaa;padding-top:4px;border-bottom:none;font-style:italic}
.pix-box{border:1.5px solid #ddd;border-radius:10px;padding:16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px}
.pix-title{font-size:10px;font-weight:800;color:#1a1a2e;text-transform:uppercase;letter-spacing:.5px}
.pix-key-main{font-size:13px;font-weight:900;color:#1a1a2e}
.pix-key-sub{font-size:9.5px;color:#aaa;line-height:1.7}
.footer{display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:14px;border-top:1px solid #eee}
.footer-brand{font-size:11px;font-weight:700;color:#79B4B0}
.footer-text{font-size:9px;color:#bbb;text-align:right;line-height:1.7}
.btn-wrap{text-align:center;margin-top:22px}
.print-btn{display:inline-flex;align-items:center;gap:8px;border:1.5px solid #79B4B0;color:#79B4B0;background:#fff;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}
.print-btn:hover{background:#f0f7f7}
@media print{body{background:#fff;padding:0}.page{box-shadow:none;padding:16px}.btn-wrap{display:none}}
</style>
</head>
<body>
<div class="page">
  <div class="topbar"></div>
  <div class="header">
    <div style="display:flex;align-items:center;gap:14px">
      <img src="${logoUrl}" alt="RPShow OnSign" style="height:48px;width:auto;object-fit:contain" onerror="this.style.display='none'"/>
      <div>
        <div class="brand-name">RPShow OnSign</div>
        <div class="brand-detail">CNPJ 43.738.727/0001-83 · Ribeirão Preto – SP<br/>rpshow.com.br · (16) 98220-8695</div>
      </div>
    </div>
    <div class="doc-block">
      <div class="doc-label">Fatura</div>
      <div class="doc-num">#FAT-${new Date().getFullYear()}-${String(p.id).padStart(4,"0")}</div>
      <div class="doc-date">Emitida em ${emitidoEm}</div>
      <span class="status-badge ${statusClass}">${statusLabel}</span>
    </div>
  </div>

  <div class="cadastro-row">
    <div class="cadastro-box">
      <div class="box-title">Cadastro do Assinante</div>
      <div class="field-grid">
        <div class="field"><label>Nome</label><span>${operatorName}</span></div>
        <div class="field"><label>Tela</label><span>${p.screenName ?? "Todas as telas"}</span></div>
        <div class="field"><label>Mês de Referência</label><span>${monthLabelFull(p.referenceMonth)}</span></div>
        <div class="field"><label>Vencimento</label><span>${venc}</span></div>
        ${p.paidAt ? `<div class="field"><label>Pago em</label><span>${new Date(p.paidAt).toLocaleDateString("pt-BR")}</span></div>` : ""}
        ${p.notes ? `<div class="field" style="grid-column:span 2"><label>Obs.</label><span>${p.notes}</span></div>` : ""}
      </div>
    </div>
    <div class="cadastro-box right">
      <div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:.5px">Vencimento</div>
      <div class="date-val">${venc}</div>
      <div style="font-size:9px;color:#aaa;margin-top:8px;text-transform:uppercase;letter-spacing:.5px">Valor</div>
      <div class="date-val" style="color:#79B4B0;font-size:20px">R$ ${amtFmt}</div>
    </div>
  </div>

  ${(p.screenCnpj || p.screenCompanyName || p.screenName) ? `
  <div class="box">
    <div class="box-title">Local / Estabelecimento <span>(da Tela)</span></div>
    <div class="field-grid">
      ${p.screenCompanyName ? `<div class="field"><label>Empresa</label><span>${p.screenCompanyName}</span></div>` : ""}
      ${p.screenCnpj ? `<div class="field"><label>CNPJ do Local</label><span>${p.screenCnpj}</span></div>` : ""}
      ${p.screenName ? `<div class="field"><label>Tela</label><span>${p.screenName}</span></div>` : ""}
      ${p.screenLocation ? `<div class="field"><label>Endereço</label><span>${p.screenLocation}</span></div>` : ""}
    </div>
  </div>` : ""}

  <div class="two-col">
    <div class="box" style="margin-bottom:0">
      <div class="box-title">Descrição da Fatura</div>
      <table>
        <thead><tr><th>Serviço</th><th>Valor (R$)</th></tr></thead>
        <tbody>
          <tr>
            <td>
              Sinalização Digital
              ${p.screenName ? `<span class="row-sub">Tela: ${p.screenName}${p.screenCompanyName ? " · " + p.screenCompanyName : ""}</span>` : ""}
            </td>
            <td>${amtFmt}</td>
          </tr>
          <tr class="total-row"><td>TOTAL DA FATURA</td><td>R$ ${amtFmt}</td></tr>
          <tr class="extenso-row"><td colspan="2">${extenso.charAt(0).toUpperCase() + extenso.slice(1)}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="pix-box">
      <div class="pix-title">Pague com PIX</div>
      <div style="font-size:9px;color:#aaa">Transferência instantânea</div>
      <svg viewBox="0 0 90 90" width="96" height="96" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin:4px 0">
        <rect x="4" y="4" width="26" height="26" rx="2" fill="#1a1a2e"/><rect x="7" y="7" width="20" height="20" rx="1" fill="white"/><rect x="10" y="10" width="14" height="14" rx="1" fill="#1a1a2e"/>
        <rect x="60" y="4" width="26" height="26" rx="2" fill="#1a1a2e"/><rect x="63" y="7" width="20" height="20" rx="1" fill="white"/><rect x="66" y="10" width="14" height="14" rx="1" fill="#1a1a2e"/>
        <rect x="4" y="60" width="26" height="26" rx="2" fill="#1a1a2e"/><rect x="7" y="63" width="20" height="20" rx="1" fill="white"/><rect x="10" y="66" width="14" height="14" rx="1" fill="#1a1a2e"/>
        <rect x="35" y="4" width="5" height="5" fill="#1a1a2e"/><rect x="45" y="4" width="5" height="5" fill="#1a1a2e"/>
        <rect x="35" y="14" width="5" height="5" fill="#1a1a2e"/><rect x="50" y="14" width="5" height="5" fill="#1a1a2e"/>
        <rect x="40" y="24" width="5" height="5" fill="#1a1a2e"/>
        <rect x="35" y="35" width="5" height="5" fill="#1a1a2e"/><rect x="45" y="35" width="5" height="5" fill="#1a1a2e"/><rect x="55" y="35" width="5" height="5" fill="#1a1a2e"/>
        <rect x="35" y="45" width="5" height="5" fill="#1a1a2e"/><rect x="50" y="45" width="5" height="5" fill="#1a1a2e"/>
        <rect x="40" y="55" width="5" height="5" fill="#1a1a2e"/><rect x="55" y="55" width="5" height="5" fill="#1a1a2e"/>
        <rect x="60" y="35" width="5" height="5" fill="#1a1a2e"/><rect x="70" y="45" width="5" height="5" fill="#1a1a2e"/><rect x="75" y="35" width="5" height="5" fill="#1a1a2e"/>
        <rect x="65" y="60" width="5" height="5" fill="#1a1a2e"/><rect x="75" y="65" width="5" height="5" fill="#1a1a2e"/><rect x="65" y="75" width="5" height="5" fill="#1a1a2e"/><rect x="75" y="75" width="5" height="5" fill="#1a1a2e"/>
        <rect x="4" y="35" width="5" height="5" fill="#1a1a2e"/><rect x="14" y="35" width="5" height="5" fill="#1a1a2e"/><rect x="24" y="35" width="5" height="5" fill="#1a1a2e"/>
        <rect x="4" y="45" width="5" height="5" fill="#1a1a2e"/><rect x="19" y="45" width="5" height="5" fill="#1a1a2e"/><rect x="29" y="45" width="5" height="5" fill="#1a1a2e"/>
        <rect x="9" y="55" width="5" height="5" fill="#1a1a2e"/><rect x="24" y="55" width="5" height="5" fill="#1a1a2e"/>
      </svg>
      <div class="pix-key-main">claudio@rpshow.com.br</div>
      <div class="pix-key-sub">Banco Cora · Ag. 0001 · C/C 4660759-7</div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-brand">RPShow OnSign</div>
    <div class="footer-text">Comprovante de prestação de serviços de sinalização digital.<br/>Dúvidas: (16) 98220-8695 · rpshow.com.br</div>
  </div>
  <div class="btn-wrap">
    <button class="print-btn" onclick="window.print()">🖨 Imprimir / Salvar PDF</button>
  </div>
</div>
</body>
</html>`;
  const w = window.open("", "_blank", "width=880,height=820");
  if (w) { w.document.write(html); w.document.close(); }
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

  const operatorName = data?.operatorName ?? "";
  const status = data?.subscriptionStatus ?? "trial";
  const paymentMethod = data?.paymentMethod ?? "pix";
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

      <PageHeader
        icon={CreditCard}
        title="Financeiro"
        description="Sua assinatura, telas contratadas e histórico de pagamentos"
        actions={
          <button onClick={() => refetch()} className="p-1.5 rounded-lg border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

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
                {paymentMethod === "pix" && (
                  <button
                    onClick={() => openPaymentReceipt(p, operatorName)}
                    className="ml-1 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="Ver Fatura PIX"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                )}
                {paymentMethod === "boleto" && p.boletoUrl && (
                  <a
                    href={p.boletoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground inline-flex"
                    title="Baixar Boleto"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
                {paymentMethod === "boleto" && !p.boletoUrl && (
                  <span className="ml-1 p-1.5 text-muted-foreground/40 cursor-default" title="Boleto ainda não disponível">
                    <Download className="w-3.5 h-3.5" />
                  </span>
                )}
                {paymentMethod === "carteira" && (
                  <span className="ml-1 p-1.5 text-muted-foreground/40" title="Cobrança em carteira">
                    <Wallet className="w-3.5 h-3.5" />
                  </span>
                )}
                {paymentMethod === "isento" && (
                  <span className="ml-1 p-1.5 text-emerald-400/60" title="Isento / Gratuito">
                    <Gift className="w-3.5 h-3.5" />
                  </span>
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
          <a href="mailto:contato@rpshow.com.br" className="text-sm text-blue-500 hover:text-blue-600 transition-colors">
            contato@rpshow.com.br
          </a>
        </div>
      </div>
    </div>
  );
}
