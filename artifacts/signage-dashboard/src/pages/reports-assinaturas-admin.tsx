import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Users, Clock, AlertTriangle, Download, Printer, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Operator = {
  id: number;
  name: string;
  email: string | null;
  username: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  trialDays: number | null;
  pricePerScreen: string;
  monthlyAmount: string;
  screenCount: number;
  createdAt: string;
  payments: { paidAt: string | null; status: string; referenceMonth: string; amount: string }[];
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active:           { label: "Ativo",     cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  trial:            { label: "Trial",     cls: "bg-amber-100 text-amber-700 border-amber-200" },
  pending_approval: { label: "Pendente",  cls: "bg-orange-100 text-orange-700 border-orange-200" },
  suspended:        { label: "Suspenso",  cls: "bg-red-100 text-red-700 border-red-200" },
  cancelled:        { label: "Cancelado", cls: "bg-gray-100 text-gray-600 border-gray-200" },
};
function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
function daysLeft(iso: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}
function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function printReport(rows: Operator[]) {
  const logo = `${window.location.origin}/logo-rpshow.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const mrr = rows.filter(r => r.subscriptionStatus === "active").reduce((s, r) => s + parseFloat(r.monthlyAmount || "0"), 0);
  const body = rows.map(r => {
    const lastPay = r.payments.filter(p => p.paidAt).sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))[0];
    return `<tr><td>${r.name}</td><td class="center">${STATUS_META[r.subscriptionStatus]?.label ?? r.subscriptionStatus}</td><td class="center">${r.screenCount}</td><td class="mono">${brl(parseFloat(r.pricePerScreen))}</td><td class="mono">${brl(parseFloat(r.monthlyAmount))}</td><td class="mono">${fmtDate(r.trialEndsAt)}</td><td class="mono">${fmtDate(lastPay?.paidAt ?? null)}</td></tr>`;
  }).join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Assinaturas — RPShow</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#111}.hdr{display:flex;align-items:center;gap:20px;padding:20px 28px;border-bottom:3px solid #111}.hdr img{height:60px}.hdr h1{font-size:20px;font-weight:900}.hdr p{font-size:11px;color:#555}.hdr-r{margin-left:auto;text-align:right;font-size:10px;color:#666}.meta{padding:10px 28px;background:#f4f4f4;border-bottom:1px solid #ddd}.table-wrap{padding:20px 28px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#111;color:#fff}th{padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase}tbody tr{border-bottom:1px solid #eee}tbody tr:nth-child(even){background:#f9f9f9}td{padding:6px 10px}td.mono{font-family:monospace;font-size:10.5px}td.center{text-align:center}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="hdr"><img src="${logo}"><div><h1>Relatório de Assinaturas</h1><p>Gerado em: ${now}</p></div><div class="hdr-r">MRR: <strong>${brl(mrr)}</strong></div></div><div class="meta">Clientes: <strong>${rows.length}</strong> | Ativos: <strong>${rows.filter(r => r.subscriptionStatus === "active").length}</strong> | Trial: <strong>${rows.filter(r => r.subscriptionStatus === "trial").length}</strong></div><div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Status</th><th>Telas</th><th>Preço/Tela</th><th>Mensalidade</th><th>Trial Vence</th><th>Último Pagamento</th></tr></thead><tbody>${body}</tbody></table></div></body></html>`;
  const w = window.open("", "_blank", "width=1200,height=800");
  if (!w) { alert("Permita popups para imprimir."); return; }
  w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600);
}

export default function ReportsAssinaturasAdmin() {
  const [filter, setFilter] = useState("all");

  const { data: operators = [], isLoading } = useQuery<Operator[]>({
    queryKey: ["admin-report-assinaturas"],
    queryFn: () => fetch("/api/admin/operators", { credentials: "include" }).then(r => r.json()),
  });

  const filtered = useMemo(() => {
    if (filter === "all") return operators;
    return operators.filter(o => o.subscriptionStatus === filter);
  }, [operators, filter]);

  const mrr          = operators.filter(o => o.subscriptionStatus === "active").reduce((s, o) => s + parseFloat(o.monthlyAmount || "0"), 0);
  const trialsEndSoon = operators.filter(o => { const d = daysLeft(o.trialEndsAt); return o.subscriptionStatus === "trial" && d !== null && d >= 0 && d <= 7; }).length;
  const suspensos    = operators.filter(o => o.subscriptionStatus === "suspended").length;
  const pendentes    = operators.filter(o => o.subscriptionStatus === "pending_approval").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Assinaturas</h1>
        <p className="text-muted-foreground text-sm mt-1">MRR, trials, inadimplência e retenção de clientes.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: DollarSign,   label: "MRR Estimado",      value: brl(mrr),            color: "text-emerald-600" },
          { icon: Clock,        label: "Trials Vencendo ≤7d", value: String(trialsEndSoon), color: trialsEndSoon > 0 ? "text-amber-500" : "" },
          { icon: AlertTriangle, label: "Suspensos",          value: String(suspensos),   color: suspensos > 0 ? "text-red-500" : "" },
          { icon: Users,        label: "Pendentes Aprovação", value: String(pendentes),   color: pendentes > 0 ? "text-orange-500" : "" },
        ].map(k => (
          <div key={k.label} className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><k.icon className={`w-4 h-4 ${k.color || "text-primary"}`} /><p className="text-xs text-muted-foreground">{k.label}</p></div>
            {isLoading ? <Skeleton className="h-7 w-20" /> : <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>}
          </div>
        ))}
      </div>

      {/* Filters + actions */}
      <div className="bg-card border rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">Filtrar:</span>
        {[["all", "Todos"], ["active", "Ativos"], ["trial", "Trial"], ["pending_approval", "Pendentes"], ["suspended", "Suspensos"]].map(([v, l]) => (
          <Button key={v} variant={filter === v ? "default" : "outline"} size="sm" className="h-8 text-xs px-3" onClick={() => setFilter(v)}>{l}</Button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
            const h = ["Cliente", "Status", "Telas", "Preço/Tela", "Mensalidade", "Trial Vence", "Criado em"];
            const b = filtered.map(o => [o.name, STATUS_META[o.subscriptionStatus]?.label ?? o.subscriptionStatus, String(o.screenCount), o.pricePerScreen, o.monthlyAmount, fmtDate(o.trialEndsAt), fmtDate(o.createdAt)]);
            downloadCsv([h, ...b].map(r => r.map(c => `"${c}"`).join(",")).join("\n"), "assinaturas.csv");
          }}><Download className="w-3.5 h-3.5" /> CSV</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => printReport(filtered)}><Printer className="w-3.5 h-3.5" /> Imprimir</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clientes ({filtered.length})</span>
        </div>
        <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Nenhum cliente com esse status.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr>
                  {["Cliente", "Status", "Telas", "Preço/Tela", "Mensalidade", "Trial Vence", "Último Pag.", "Criado em"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(o => {
                  const lastPay = o.payments.filter(p => p.paidAt).sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))[0];
                  const dl = daysLeft(o.trialEndsAt);
                  const sm = STATUS_META[o.subscriptionStatus] ?? { label: o.subscriptionStatus, cls: "" };
                  return (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{o.name}</p>
                        <p className="text-[10px] text-muted-foreground">@{o.username}</p>
                      </td>
                      <td className="px-4 py-2.5"><Badge className={`${sm.cls} border text-[9px] h-4`}>{sm.label}</Badge></td>
                      <td className="px-4 py-2.5 text-center font-bold">{o.screenCount}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">{brl(parseFloat(o.pricePerScreen))}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-primary">{brl(parseFloat(o.monthlyAmount))}</td>
                      <td className="px-4 py-2.5">
                        {o.trialEndsAt ? (
                          <span className={dl !== null && dl <= 7 && dl >= 0 ? "text-amber-500 font-semibold" : "text-muted-foreground"}>
                            {fmtDate(o.trialEndsAt)}{dl !== null && dl >= 0 && dl <= 7 ? ` (${dl}d)` : ""}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{fmtDate(lastPay?.paidAt ?? null)}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{fmtDate(o.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {/* MRR footer */}
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t bg-muted/30 flex items-center gap-6 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" />MRR (ativos visíveis):</span>
            <span className="font-bold text-emerald-600 text-base">{brl(filtered.filter(o => o.subscriptionStatus === "active").reduce((s, o) => s + parseFloat(o.monthlyAmount || "0"), 0))}</span>
          </div>
        )}
      </div>
    </div>
  );
}
