import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Calendar, Download, Printer, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type ActivityRow = {
  id: number;
  userId: string | null;
  operatorName: string | null;
  action: string;
  entityType: string;
  entityName: string;
  entityId: number | null;
  details: string | null;
  createdAt: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function todayBRT() { return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); }
function sevenDaysBRT() { const d = new Date(); d.setDate(d.getDate() - 6); return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); }
function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700 border-emerald-200",
  update: "bg-blue-100 text-blue-700 border-blue-200",
  delete: "bg-red-100 text-red-700 border-red-200",
  publish: "bg-purple-100 text-purple-700 border-purple-200",
  login: "bg-amber-100 text-amber-700 border-amber-200",
};

function actionCls(action: string) {
  for (const [k, v] of Object.entries(ACTION_COLORS)) {
    if (action.toLowerCase().includes(k)) return v;
  }
  return "bg-gray-100 text-gray-600 border-gray-200";
}

function printReport(rows: ActivityRow[], from: string, to: string) {
  const logo = `${window.location.origin}/logo-rpshow.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const body = rows.map(r => `<tr><td class="mono">${fmtDate(r.createdAt)}</td><td>${r.operatorName ?? r.userId ?? "Sistema"}</td><td class="center">${r.action}</td><td>${r.entityType}</td><td>${r.entityName}</td><td>${r.details ?? "—"}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Atividade — RPShow</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#111}.hdr{display:flex;align-items:center;gap:20px;padding:20px 28px;border-bottom:3px solid #111}.hdr img{height:60px}.hdr h1{font-size:20px;font-weight:900}.hdr p{font-size:11px;color:#555}.hdr-r{margin-left:auto;text-align:right;font-size:10px;color:#666}.meta{padding:10px 28px;background:#f4f4f4;border-bottom:1px solid #ddd}.table-wrap{padding:20px 28px}table{width:100%;border-collapse:collapse;font-size:10px}thead tr{background:#111;color:#fff}th{padding:8px 10px;text-align:left;font-size:9px;text-transform:uppercase}tbody tr{border-bottom:1px solid #eee}tbody tr:nth-child(even){background:#f9f9f9}td{padding:5px 10px}td.mono{font-family:monospace;white-space:nowrap}td.center{text-align:center}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="hdr"><img src="${logo}"><div><h1>Relatório de Atividade</h1><p>Período: ${from} até ${to}</p></div><div class="hdr-r">Gerado em: ${now}<br><strong>${rows.length} registros</strong></div></div><div class="meta">Total de ações: <strong>${rows.length}</strong></div><div class="table-wrap"><table><thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Tipo</th><th>Nome</th><th>Detalhe</th></tr></thead><tbody>${body}</tbody></table></div></body></html>`;
  const w = window.open("", "_blank", "width=1200,height=800");
  if (!w) { alert("Permita popups para imprimir."); return; }
  w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600);
}

export default function ReportsAtividadeAdmin() {
  const [startDate, setStartDate] = useState(sevenDaysBRT);
  const [endDate,   setEndDate]   = useState(todayBRT);
  const [search,    setSearch]    = useState("");

  const { data = [], isLoading } = useQuery<ActivityRow[]>({
    queryKey: ["admin-report-atividade", startDate, endDate],
    queryFn: () => fetch(`/api/admin/reports/activity?from=${startDate}&to=${endDate}&limit=500`, { credentials: "include" }).then(r => r.json()),
  });

  const filtered = search
    ? data.filter(r => r.action.toLowerCase().includes(search.toLowerCase()) || r.entityName.toLowerCase().includes(search.toLowerCase()) || (r.operatorName ?? "").toLowerCase().includes(search.toLowerCase()))
    : data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Atividade</h1>
        <p className="text-muted-foreground text-sm mt-1">Auditoria de ações — quem fez o quê e quando.</p>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Período:</span>
          {[
            { label: "Hoje",    fn: () => { setStartDate(todayBRT()); setEndDate(todayBRT()); } },
            { label: "7 dias",  fn: () => { setStartDate(sevenDaysBRT()); setEndDate(todayBRT()); } },
            { label: "30 dias", fn: () => { const d = new Date(); d.setDate(d.getDate() - 29); setStartDate(d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })); setEndDate(todayBRT()); } },
          ].map(p => <Button key={p.label} variant="outline" size="sm" className="h-8 text-xs px-3" onClick={p.fn}>{p.label}</Button>)}
          <div className="flex items-center gap-1 border rounded-lg px-3 py-1.5 bg-background text-sm">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <Input type="date" className="h-6 border-none p-0 text-xs w-28 bg-transparent focus-visible:ring-0" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-muted-foreground text-xs">até</span>
            <Input type="date" className="h-6 border-none p-0 text-xs w-28 bg-transparent focus-visible:ring-0" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 bg-background flex-1 max-w-xs">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <input placeholder="Filtrar por ação, entidade ou usuário..." className="text-xs bg-transparent outline-none flex-1" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
              const h = ["Data/Hora", "Usuário", "Ação", "Tipo", "Nome", "Detalhe"];
              const b = filtered.map(r => [fmtDate(r.createdAt), r.operatorName ?? r.userId ?? "Sistema", r.action, r.entityType, r.entityName, r.details ?? ""]);
              downloadCsv([h, ...b].map(r => r.map(c => `"${c}"`).join(",")).join("\n"), `atividade_${startDate}_${endDate}.csv`);
            }}><Download className="w-3.5 h-3.5" /> CSV</Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => printReport(filtered, startDate, endDate)}><Printer className="w-3.5 h-3.5" /> Imprimir</Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Activity, label: "Total de Ações",    value: String(filtered.length) },
          { icon: Activity, label: "Usuários Distintos", value: String(new Set(filtered.map(r => r.userId)).size) },
          { icon: Activity, label: "Criações",           value: String(filtered.filter(r => r.action.toLowerCase().includes("creat") || r.action.toLowerCase().includes("adicion")).length) },
          { icon: Activity, label: "Exclusões",          value: String(filtered.filter(r => r.action.toLowerCase().includes("delet") || r.action.toLowerCase().includes("remov") || r.action.toLowerCase().includes("exclu")).length) },
        ].map(k => (
          <div key={k.label} className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><k.icon className="w-4 h-4 text-primary" /><p className="text-xs text-muted-foreground">{k.label}</p></div>
            {isLoading ? <Skeleton className="h-7 w-20" /> : <p className="text-2xl font-bold">{k.value}</p>}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações ({filtered.length})</span>
        </div>
        <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Nenhuma ação registrada no período.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr>
                  {["Data/Hora", "Usuário", "Ação", "Tipo", "Entidade", "Detalhe"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 font-mono text-[11px] whitespace-nowrap text-muted-foreground">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-2 font-medium">{r.operatorName ?? r.userId ?? "Sistema"}</td>
                    <td className="px-4 py-2"><Badge className={`${actionCls(r.action)} border text-[9px] h-4`}>{r.action}</Badge></td>
                    <td className="px-4 py-2 text-muted-foreground">{r.entityType}</td>
                    <td className="px-4 py-2 max-w-[180px] truncate">{r.entityName}</td>
                    <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate">{r.details ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
