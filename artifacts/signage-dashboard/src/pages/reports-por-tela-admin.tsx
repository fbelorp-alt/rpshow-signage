import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Monitor, Play, Clock, Activity, Calendar, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type PlayerRow = {
  screenId: number | null;
  screenName: string;
  totalPlays: number;
  totalSeconds: number;
  distinctMedia: number;
  status: string;
  lastSeen: string | null;
  topContent: { mediaName: string; mediaType: string; playCount: number }[];
};

function fmtDate(iso: string | null) {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDur(s: number) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
function todayBRT() { return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); }
function monthStartBRT() { const d = new Date(); d.setDate(1); return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); }
function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function printReport(rows: PlayerRow[], from: string, to: string) {
  const logo = `${window.location.origin}/logo-rpshow.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const body = rows.map(r => `<tr><td>${r.screenName}</td><td class="center">${r.totalPlays.toLocaleString("pt-BR")}</td><td class="mono">${fmtDur(r.totalSeconds)}</td><td class="center">${r.distinctMedia}</td><td class="center">${r.status}</td><td class="mono">${fmtDate(r.lastSeen)}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Por Tela / Player — RPShow</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#111}.hdr{display:flex;align-items:center;gap:20px;padding:20px 28px;border-bottom:3px solid #111}.hdr img{height:60px}.hdr h1{font-size:20px;font-weight:900}.hdr p{font-size:11px;color:#555}.hdr-r{margin-left:auto;text-align:right;font-size:10px;color:#666}.meta{padding:10px 28px;background:#f4f4f4;border-bottom:1px solid #ddd}.table-wrap{padding:20px 28px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#111;color:#fff}th{padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase}tbody tr{border-bottom:1px solid #eee}tbody tr:nth-child(even){background:#f9f9f9}td{padding:6px 10px}td.mono{font-family:monospace;font-size:10.5px}td.center{text-align:center}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="hdr"><img src="${logo}"><div><h1>Relatório Por Tela / Player</h1><p>Período: ${from} até ${to}</p></div><div class="hdr-r">Gerado em: ${now}<br><strong>${rows.length} telas</strong></div></div><div class="meta">Telas com plays: <strong>${rows.filter(r => r.totalPlays > 0).length}</strong> | Média plays/tela: <strong>${rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.totalPlays, 0) / rows.length) : 0}</strong></div><div class="table-wrap"><table><thead><tr><th>Tela</th><th>Plays</th><th>Tempo Total</th><th>Mídias</th><th>Status</th><th>Última Atividade</th></tr></thead><tbody>${body}</tbody></table></div></body></html>`;
  const w = window.open("", "_blank", "width=1200,height=800");
  if (!w) { alert("Permita popups para imprimir."); return; }
  w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600);
}

export default function ReportsPorTelaAdmin() {
  const [startDate, setStartDate] = useState(monthStartBRT);
  const [endDate,   setEndDate]   = useState(todayBRT);

  const { data = [], isLoading } = useQuery<PlayerRow[]>({
    queryKey: ["admin-report-por-tela", startDate, endDate],
    queryFn: () => fetch(`/api/reports/by-player?startDate=${startDate}&endDate=${endDate}`, { credentials: "include" }).then(r => r.json()),
  });

  const comPlays   = data.filter(r => r.totalPlays > 0).length;
  const totalPlays = data.reduce((s, r) => s + r.totalPlays, 0);
  const mediaPlays = data.length > 0 ? Math.round(totalPlays / Math.max(1, data.length)) : 0;

  const kpis = [
    { icon: Monitor,  label: "Telas no Período",   value: String(data.length) },
    { icon: Play,     label: "Com Exibições",        value: String(comPlays) },
    { icon: Activity, label: "Total de Plays",       value: totalPlays.toLocaleString("pt-BR") },
    { icon: Clock,    label: "Média Plays / Tela",   value: String(mediaPlays) },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatório Por Tela / Player</h1>
        <p className="text-muted-foreground text-sm mt-1">Performance de cada player no período — quais estão ativos ou parados.</p>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Período:</span>
          {[
            { label: "7 dias",   fn: () => { const d = new Date(); d.setDate(d.getDate() - 6); setStartDate(d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })); setEndDate(todayBRT()); } },
            { label: "Este mês", fn: () => { setStartDate(monthStartBRT()); setEndDate(todayBRT()); } },
            { label: "30 dias",  fn: () => { const d = new Date(); d.setDate(d.getDate() - 29); setStartDate(d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })); setEndDate(todayBRT()); } },
          ].map(p => <Button key={p.label} variant="outline" size="sm" className="h-8 text-xs px-3" onClick={p.fn}>{p.label}</Button>)}
          <div className="flex items-center gap-1 border rounded-lg px-3 py-1.5 bg-background text-sm">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <Input type="date" className="h-6 border-none p-0 text-xs w-28 bg-transparent focus-visible:ring-0" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-muted-foreground text-xs">até</span>
            <Input type="date" className="h-6 border-none p-0 text-xs w-28 bg-transparent focus-visible:ring-0" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
              const h = ["Tela", "Plays", "Tempo Total", "Mídias Distintas", "Status", "Última Atividade"];
              const b = data.map(r => [r.screenName, String(r.totalPlays), fmtDur(r.totalSeconds), String(r.distinctMedia), r.status, fmtDate(r.lastSeen)]);
              downloadCsv([h, ...b].map(r => r.map(c => `"${c}"`).join(",")).join("\n"), `por_tela_${startDate}_${endDate}.csv`);
            }}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => printReport(data, startDate, endDate)}>
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><k.icon className="w-4 h-4 text-primary" /><p className="text-xs text-muted-foreground">{k.label}</p></div>
            {isLoading ? <Skeleton className="h-7 w-20" /> : <p className="text-2xl font-bold">{k.value}</p>}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Players ({data.length})</span>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : data.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Nenhuma tela com exibições no período.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr>
                  {["Tela", "Plays", "Tempo Total", "Mídias", "Status", "Última Atividade", "Top Conteúdo"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap">{r.screenName}</td>
                    <td className="px-4 py-2.5 font-bold text-primary tabular-nums">{r.totalPlays.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] whitespace-nowrap">{fmtDur(r.totalSeconds)}</td>
                    <td className="px-4 py-2.5 text-center">{r.distinctMedia}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={`text-[9px] h-4 ${r.status === "online" ? "border-emerald-500/50 text-emerald-600 bg-emerald-50" : "border-red-300 text-red-600 bg-red-50"}`}>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] whitespace-nowrap text-muted-foreground">{fmtDate(r.lastSeen)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground max-w-[200px]">{r.topContent.slice(0, 2).map(c => c.mediaName).join(", ") || "—"}</td>
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
