import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Film, Play, Clock, BarChart2, Calendar, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

type MediaRow = {
  mediaName: string;
  mediaType: string;
  screenName: string;
  playCount: number;
  totalSeconds: number;
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
};

type SummaryItem = {
  mediaName: string;
  mediaType: string;
  playCount: number;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
function fmtDur(s: number) {
  if (!s) return "—";
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

function printReport(topItems: SummaryItem[], from: string, to: string) {
  const logo = `${window.location.origin}/logo-rpshow.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const total = topItems.reduce((s, r) => s + r.playCount, 0);
  const body = topItems.map((r, i) => `<tr><td class="center">${i + 1}º</td><td>${r.mediaName}</td><td class="center">${r.mediaType}</td><td class="center">${r.playCount.toLocaleString("pt-BR")}</td><td class="center">${total > 0 ? ((r.playCount / total) * 100).toFixed(1) : 0}%</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Top Mídias — RPShow</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#111}.hdr{display:flex;align-items:center;gap:20px;padding:20px 28px;border-bottom:3px solid #111}.hdr img{height:60px}.hdr h1{font-size:20px;font-weight:900}.hdr p{font-size:11px;color:#555}.hdr-r{margin-left:auto;text-align:right;font-size:10px;color:#666}.meta{padding:10px 28px;background:#f4f4f4;border-bottom:1px solid #ddd}.table-wrap{padding:20px 28px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#111;color:#fff}th{padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase}tbody tr{border-bottom:1px solid #eee}tbody tr:nth-child(even){background:#f9f9f9}td{padding:6px 10px}td.center{text-align:center}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="hdr"><img src="${logo}"><div><h1>Relatório Top Mídias</h1><p>Período: ${from} até ${to}</p></div><div class="hdr-r">Gerado em: ${now}<br><strong>${topItems.length} mídias</strong></div></div><div class="meta">Total de exibições: <strong>${total.toLocaleString("pt-BR")}</strong></div><div class="table-wrap"><table><thead><tr><th>#</th><th>Mídia</th><th>Tipo</th><th>Plays</th><th>% Total</th></tr></thead><tbody>${body}</tbody></table></div></body></html>`;
  const w = window.open("", "_blank", "width=1200,height=800");
  if (!w) { alert("Permita popups para imprimir."); return; }
  w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600);
}

export default function ReportsTopMidiasAdmin() {
  const [startDate, setStartDate] = useState(monthStartBRT);
  const [endDate,   setEndDate]   = useState(todayBRT);

  const { data: summary, isLoading } = useQuery<{ items: MediaRow[]; totalPlays: number }>({
    queryKey: ["admin-report-top-midias", startDate, endDate],
    queryFn: () => fetch(`/api/reports/period-summary?startDate=${startDate}&endDate=${endDate}`, { credentials: "include" }).then(r => r.json()),
  });

  // Aggregate by mediaName (period-summary groups by name+type+screen)
  const grouped = new Map<string, SummaryItem>();
  for (const r of summary?.items ?? []) {
    const key = `${r.mediaName}__${r.mediaType}`;
    if (!grouped.has(key)) grouped.set(key, { mediaName: r.mediaName, mediaType: r.mediaType, playCount: 0 });
    grouped.get(key)!.playCount += r.playCount;
  }
  const topItems = [...grouped.values()].sort((a, b) => b.playCount - a.playCount).slice(0, 20);
  const top10 = topItems.slice(0, 10);
  const total = summary?.totalPlays ?? 0;

  const kpis = [
    { icon: Play,     label: "Total de Plays",      value: total.toLocaleString("pt-BR") },
    { icon: Film,     label: "Mídias Distintas",     value: String(topItems.length) },
    { icon: BarChart2, label: "Top Mídia Plays",     value: top10[0]?.playCount.toLocaleString("pt-BR") ?? "—" },
    { icon: Clock,    label: "% Top 3 do Total",     value: total > 0 ? `${((top10.slice(0, 3).reduce((s, r) => s + r.playCount, 0) / total) * 100).toFixed(0)}%` : "—" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Top Mídias</h1>
        <p className="text-muted-foreground text-sm mt-1">Ranking de conteúdo mais exibido no período.</p>
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
              const h = ["#", "Mídia", "Tipo", "Plays", "% Total"];
              const b = topItems.map((r, i) => [String(i + 1), r.mediaName, r.mediaType, String(r.playCount), total > 0 ? ((r.playCount / total) * 100).toFixed(1) + "%" : "0%"]);
              downloadCsv([h, ...b].map(r => r.map(c => `"${c}"`).join(",")).join("\n"), `top_midias_${startDate}_${endDate}.csv`);
            }}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => printReport(topItems, startDate, endDate)}>
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

      {/* Bar chart top 10 */}
      {!isLoading && top10.length > 0 && (
        <div className="bg-card border rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3 text-foreground">Top 10 por Exibições</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={top10.map(r => ({ name: r.mediaName.slice(0, 20), plays: r.playCount }))} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border,#e5e7eb)" />
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [v.toLocaleString("pt-BR"), "plays"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="plays" fill="#79B4B0" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ranking ({topItems.length})</span>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : topItems.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Nenhuma exibição no período.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr>
                  {["#", "Mídia", "Tipo", "Plays", "% Total", "Barra"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topItems.map((r, i) => {
                  const pct = total > 0 ? (r.playCount / total) * 100 : 0;
                  return (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-muted-foreground w-10">{i + 1}º</td>
                      <td className="px-4 py-2.5 font-medium max-w-[200px] truncate">{r.mediaName}</td>
                      <td className="px-4 py-2.5"><Badge variant="outline" className="text-[9px] h-4">{r.mediaType}</Badge></td>
                      <td className="px-4 py-2.5 font-bold tabular-nums text-primary">{r.playCount.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{pct.toFixed(1)}%</td>
                      <td className="px-4 py-2.5 w-32">
                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
