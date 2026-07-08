import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign, CheckCircle2, Clock, AlertCircle, Download, Printer, Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Payment = {
  id: number;
  operatorId: number;
  screenId: number | null;
  screenName: string | null;
  referenceMonth: string;
  status: string;
  amount: string;
  paidAt: string | null;
  dueDate: string | null;
};

type Operator = {
  id: number;
  name: string;
  email: string | null;
  payments: Payment[];
};

type Row = {
  operatorId: number;
  clientName: string;
  clientEmail: string | null;
  screenName: string | null;
  referenceMonth: string;
  dueDate: string | null;
  amount: number;
  status: "paid" | "pending" | "overdue" | "cancelled";
  paidAt: string | null;
};

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
function todayBRT() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  paid:      { label: "Pago",      cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  pending:   { label: "Pendente",  cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  overdue:   { label: "Vencido",   cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
};

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportFinanceiroCsv(rows: Row[], from: string, to: string) {
  const header = ["Cliente", "Tela", "Mês Referência", "Vencimento", "Valor", "Status", "Pago em"];
  const body = rows.map(r => [r.clientName, r.screenName ?? "Todas as telas", r.referenceMonth, fmtDate(r.dueDate), r.amount.toFixed(2), STATUS_META[r.status]?.label ?? r.status, fmtDate(r.paidAt)]);
  downloadCsv([header, ...body].map(r => r.map(c => `"${c}"`).join(",")).join("\n"), `relatorio_financeiro_${from}_${to}.csv`);
}

function printFinanceiroReport(rows: Row[], from: string, to: string) {
  const logoUrl = `${window.location.origin}/logo-rpshow.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const totalPago = rows.filter(r => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const totalPend = rows.filter(r => r.status === "pending").reduce((s, r) => s + r.amount, 0);
  const totalVenc = rows.filter(r => r.status === "overdue").reduce((s, r) => s + r.amount, 0);
  const rowsHtml = rows.map(r => `<tr><td>${r.clientName}</td><td>${r.screenName ?? "Todas as telas"}</td><td class="center">${r.referenceMonth}</td><td class="mono">${fmtDate(r.dueDate)}</td><td class="mono">${brl(r.amount)}</td><td class="center">${STATUS_META[r.status]?.label ?? r.status}</td><td class="mono">${fmtDate(r.paidAt)}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Relatório Financeiro — RPShow OnSign</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff}.header{display:flex;align-items:center;gap:20px;padding:20px 28px 16px;border-bottom:3px solid #111}.header img{height:64px;width:auto}.header-text h1{font-size:22px;font-weight:900;color:#111}.header-text p{font-size:12px;color:#555;margin-top:2px}.header-right{margin-left:auto;text-align:right;font-size:10px;color:#666;line-height:1.6}.header-right strong{font-size:13px;color:#111;display:block}.meta{display:flex;gap:32px;padding:12px 28px;background:#f4f4f4;border-bottom:1px solid #ddd;font-size:11px}.meta-item label{font-weight:700;text-transform:uppercase;font-size:9px;letter-spacing:.8px;color:#888;display:block;margin-bottom:2px}.meta-item span{font-size:13px;font-weight:600;color:#111}.table-wrap{padding:20px 28px}.table-title{font-size:13px;font-weight:700;margin-bottom:10px;color:#333;border-left:4px solid #111;padding-left:10px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#111;color:#fff}thead th{padding:9px 12px;text-align:left;font-weight:700;font-size:10px;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}tbody tr{border-bottom:1px solid #e5e5e5}tbody tr:nth-child(even){background:#f9f9f9}td{padding:7px 12px;vertical-align:middle}td.mono{font-family:monospace;font-size:10.5px;white-space:nowrap}td.center{text-align:center}.totals{padding:10px 28px;display:flex;gap:32px;border-top:1px solid #ccc;background:#f4f4f4}.totals .t label{font-size:9px;font-weight:700;text-transform:uppercase;color:#888}.totals .t span{font-size:14px;font-weight:900;color:#111;display:block}.footer{padding:14px 28px 20px;font-size:9px;color:#aaa;text-align:center;border-top:1px solid #e0e0e0;margin-top:10px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:10mm}}</style></head><body><div class="header"><img src="${logoUrl}" alt="RPShow"/><div class="header-text"><h1>RPShow OnSign</h1><p>Sistema de Sinalização Digital</p></div><div class="header-right"><strong>RELATÓRIO FINANCEIRO</strong>Gerado em: ${now}</div></div><div class="meta"><div class="meta-item"><label>Período</label><span>${from} → ${to}</span></div><div class="meta-item"><label>Faturas</label><span>${rows.length}</span></div><div class="meta-item"><label>Total recebido</label><span>${brl(totalPago)}</span></div><div class="meta-item"><label>Pendente</label><span>${brl(totalPend)}</span></div><div class="meta-item"><label>Vencido</label><span>${brl(totalVenc)}</span></div></div><div class="table-wrap"><div class="table-title">Faturas no Período</div><table><thead><tr><th>Cliente</th><th>Tela</th><th>Mês Ref.</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Pago em</th></tr></thead><tbody>${rowsHtml}</tbody></table></div><div class="totals"><div class="t"><label>Total recebido</label><span>${brl(totalPago)}</span></div><div class="t"><label>Pendente</label><span>${brl(totalPend)}</span></div><div class="t"><label>Vencido</label><span>${brl(totalVenc)}</span></div></div><div class="footer">RPShow OnSign · Relatório gerado em ${now} · Horários em BRT (Brasília)</div><script>window.onload=()=>{window.print();}<\/script></body></html>`;
  const win = window.open("", "_blank", "width=1200,height=800");
  if (!win) { alert("Permita popups para imprimir."); return; }
  win.document.write(html); win.document.close();
}

export default function ReportsFinanceiroAdmin() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 3);
    return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  });

  const { data: operators = [], isLoading } = useQuery<Operator[]>({
    queryKey: ["admin-report-financeiro"],
    queryFn: () => fetch("/api/admin/financial", { credentials: "include" }).then(r => r.json()),
  });

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    for (const op of operators) {
      for (const p of op.payments) {
        let status: Row["status"] = "pending";
        if (p.status === "paid") status = "paid";
        else if (p.status === "cancelled") status = "cancelled";
        else if (p.status === "overdue") status = "overdue";
        else if (p.dueDate && new Date(p.dueDate) < new Date()) status = "overdue";
        list.push({
          operatorId: op.id,
          clientName: op.name,
          clientEmail: op.email,
          screenName: p.screenName,
          referenceMonth: p.referenceMonth,
          dueDate: p.dueDate,
          amount: parseFloat(p.amount),
          status,
          paidAt: p.paidAt,
        });
      }
    }
    return list;
  }, [operators]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (r.dueDate) {
        const d = new Date(r.dueDate).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
        if (d < startDate || d > endDate) return false;
      }
      return true;
    }).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  }, [rows, statusFilter, startDate, endDate]);

  const totalPago = filtered.filter(r => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const totalPend = filtered.filter(r => r.status === "pending").reduce((s, r) => s + r.amount, 0);
  const totalVenc = filtered.filter(r => r.status === "overdue").reduce((s, r) => s + r.amount, 0);
  const ticketMedio = filtered.length > 0 ? (totalPago + totalPend + totalVenc) / filtered.length : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatório Financeiro</h1>
        <p className="text-muted-foreground text-sm mt-1">Faturas de todos os clientes por período, pronto para impressão.</p>
      </div>

      <div className="bg-card border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium mr-1">Período:</span>
          {([
            { label: "Este mês", fn: () => {
                const d = new Date(); d.setDate(1);
                setStartDate(d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }));
                const e = new Date(); e.setMonth(e.getMonth() + 1); e.setDate(0);
                setEndDate(e.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }));
              }
            },
            { label: "Próx. 3 meses", fn: () => {
                setStartDate(todayBRT());
                const e = new Date(); e.setMonth(e.getMonth() + 3);
                setEndDate(e.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }));
              }
            },
            { label: "Este ano", fn: () => {
                const now = new Date();
                setStartDate(new Date(now.getFullYear(), 0, 1).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }));
                setEndDate(new Date(now.getFullYear(), 11, 31).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }));
              }
            },
          ] as { label: string; fn: () => void }[]).map(p => (
            <Button key={p.label} variant="outline" size="sm" className="h-8 text-xs px-3" onClick={p.fn}>
              {p.label}
            </Button>
          ))}
          <div className="flex items-center gap-1 border rounded-lg px-3 py-1.5 bg-background text-sm ml-1">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <Input type="date" className="h-6 border-none p-0 text-xs w-28 bg-transparent focus-visible:ring-0" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-muted-foreground text-xs">até</span>
            <Input type="date" className="h-6 border-none p-0 text-xs w-28 bg-transparent focus-visible:ring-0" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="overdue">Vencido</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="h-8 gap-2 text-xs" onClick={() => printFinanceiroReport(filtered, startDate, endDate)}>
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </Button>
          <Button size="sm" className="h-8 gap-2 text-xs" onClick={() => exportFinanceiroCsv(filtered, startDate, endDate)}>
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Recebido</p>
            {isLoading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl font-black tabular-nums">{brl(totalPago)}</p>}
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Pendente</p>
            {isLoading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl font-black tabular-nums">{brl(totalPend)}</p>}
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Vencido</p>
            {isLoading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl font-black tabular-nums">{brl(totalVenc)}</p>}
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Ticket Médio</p>
            {isLoading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl font-black tabular-nums">{brl(ticketMedio)}</p>}
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Tela</th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Mês Ref.</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Vencimento</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Valor</th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Pago em</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-3 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">Nenhuma fatura no período selecionado</td></tr>
              ) : filtered.map((r, i) => {
                const meta = STATUS_META[r.status] ?? { label: r.status, cls: "" };
                return (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-medium">{r.clientName}</p>
                      {r.clientEmail && <p className="text-[11px] text-muted-foreground">{r.clientEmail}</p>}
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">{r.screenName ?? "Todas as telas"}</td>
                    <td className="px-3 py-2.5 hidden md:table-cell text-center text-xs text-muted-foreground">{r.referenceMonth}</td>
                    <td className="px-3 py-2.5 text-xs">{fmtDate(r.dueDate)}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums">{brl(r.amount)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell text-right text-xs text-muted-foreground">{fmtDate(r.paidAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
