import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Calendar, Monitor, Film, Clock, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type PlayItem = {
  id: number;
  screenName: string;
  screenCode: string;
  mediaName: string;
  mediaType: string;
  clientName: string | null;
  playedAt: string;
  durationSeconds: number | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDur(s: number | null) {
  if (!s) return "—";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
function todayBRT() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
function monthStartBRT() {
  const d = new Date(); d.setDate(1);
  return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function printReport(rows: PlayItem[], from: string, to: string) {
  const logo = `${window.location.origin}/logo-rpshow.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const body = rows.map(r => `<tr><td>${fmtDate(r.playedAt)}</td><td>${r.mediaName}</td><td>${r.mediaType}</td><td>${r.screenName}</td><td>${r.clientName ?? "—"}</td><td class="mono">${fmtDur(r.durationSeconds)}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório de Exibições — RPShow</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#111}.hdr{display:flex;align-items:center;gap:20px;padding:20px 28px;border-bottom:3px solid #111}.hdr img{height:60px}.hdr h1{font-size:20px;font-weight:900}.hdr p{font-size:11px;color:#555}.hdr-r{margin-left:auto;text-align:right;font-size:10px;color:#666}.meta{padding:10px 28px;background:#f4f4f4;border-bottom:1px solid #ddd;font-size:11px}.table-wrap{padding:20px 28px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#111;color:#fff}th{padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase}tbody tr{border-bottom:1px solid #eee}tbody tr:nth-child(even){background:#f9f9f9}td{padding:6px 10px}.mono{font-family:monospace}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="hdr"><img src="${logo}"><div><h1>Relatório de Exibições</h1><p>Período: ${from} até ${to}</p></div><div class="hdr-r">Gerado em: ${now}<br><strong>${rows.length} registros</strong></div></div><div class="meta">Total de exibições: <strong>${rows.length}</strong> &nbsp;|&nbsp; Telas distintas: <strong>${new Set(rows.map(r => r.screenName)).size}</strong> &nbsp;|&nbsp; Mídias distintas: <strong>${new Set(rows.map(r => r.mediaName)).size}</strong></div><div class="table-wrap"><table><thead><tr><th>Data/Hora</th><th>Mídia</th><th>Tipo</th><th>Tela</th><th>Cliente</th><th>Duração</th></tr></thead><tbody>${body}</tbody></table></div></body></html>`;
  const w = window.open("", "_blank", "width=1200,height=800");
  if (!w) { alert("Permita popups para imprimir."); return; }
  w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600);
}

export default function ReportsExibicoesAdmin() {
  const [startDate, setStartDate] = useState(monthStartBRT);
  const [endDate,   setEndDate]   = useState(todayBRT);
  const [search,    setSearch]    = useState("");

  const { data, isLoading } = useQuery<{ items: PlayItem[]; total: number }>({
    queryKey: ["admin-report-exibicoes", startDate, endDate],
    queryFn: () => fetch(`/api/reports/plays?startDate=${startDate}&endDate=${endDate}&limit=500`, { credentials: "include" }).then(r => r.json()),
  });

  const all = data?.items ?? [];
  const filtered = useMemo(() => {
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter(r => r.mediaName.toLowerCase().includes(q) || r.screenName.toLowerCase().includes(q) || (r.clientName ?? "").toLowerCase().includes(q));
  }, [all, search]);

  const totalSec = filtered.reduce((s, r) => s + (r.durationSeconds ?? 0), 0);
  const distinctScreens = new Set(filtered.map(r => r.screenName)).size;
  const distinctMedia   = new Set(filtered.map(r => r.mediaName)).size;

  const kpis = [
    { icon: Play,    label: "Total de Exibições",  value: filtered.length.toLocaleString("pt-BR") },
    { icon: Clock,   label: "Tempo Total",          value: totalSec > 3600 ? `${Math.round(totalSec / 3600)}h` : `${Math.round(totalSec / 60)}m` },
    { icon: Monitor, label: "Telas Distintas",      value: String(distinctScreens) },
    { icon: Film,    label: "Mídias Distintas",     value: String(distinctMedia) },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatório de Exibições</h1>
        <p className="text-muted-foreground text-sm mt-1">Log detalhado de tudo que rodou no período, pronto para impressão.</p>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Período:</span>
          {[
            { label: "Hoje",        fn: () => { setStartDate(todayBRT()); setEndDate(todayBRT()); } },
            { label: "7 dias",      fn: () => { const d = new Date(); d.setDate(d.getDate() - 6); setStartDate(d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })); setEndDate(todayBRT()); } },
            { label: "Este mês",    fn: () => { setStartDate(monthStartBRT()); setEndDate(todayBRT()); } },
            { label: "30 dias",     fn: () => { const d = new Date(); d.setDate(d.getDate() - 29); setStartDate(d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })); setEndDate(todayBRT()); } },
          ].map(p => <Button key={p.label} variant="outline" size="sm" className="h-8 text-xs px-3" onClick={p.fn}>{p.label}</Button>)}
          <div className="flex items-center gap-1 border rounded-lg px-3 py-1.5 bg-background text-sm">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <Input type="date" className="h-6 border-none p-0 text-xs w-28 bg-transparent focus-visible:ring-0" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-muted-foreground text-xs">até</span>
            <Input type="date" className="h-6 border-none p-0 text-xs w-28 bg-transparent focus-visible:ring-0" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Input placeholder="Buscar mídia, tela ou cliente..." className="h-8 text-xs max-w-xs" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
              const h = ["Data/Hora", "Mídia", "Tipo", "Tela", "Cliente", "Duração"];
              const b = filtered.map(r => [fmtDate(r.playedAt), r.mediaName, r.mediaType, r.screenName, r.clientName ?? "", fmtDur(r.durationSeconds)]);
              downloadCsv([h, ...b].map(r => r.map(c => `"${c}"`).join(",")).join("\n"), `exibicoes_${startDate}_${endDate}.csv`);
            }}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => printReport(filtered, startDate, endDate)}>
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <k.icon className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </div>
            {isLoading ? <Skeleton className="h-7 w-20" /> : <p className="text-2xl font-bold">{k.value}</p>}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exibições ({filtered.length})</span>
          {data?.total && data.total > 500 && <span className="text-[10px] text-amber-500">Mostrando 500 de {data.total} registros</span>}
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Nenhuma exibição no período selecionado.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr>
                  {["Data/Hora", "Mídia", "Tipo", "Tela", "Cliente", "Duração"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 whitespace-nowrap font-mono text-[11px]">{fmtDate(r.playedAt)}</td>
                    <td className="px-4 py-2 max-w-[200px] truncate font-medium">{r.mediaName}</td>
                    <td className="px-4 py-2"><Badge variant="outline" className="text-[9px] h-4">{r.mediaType}</Badge></td>
                    <td className="px-4 py-2 whitespace-nowrap">{r.screenName}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.clientName ?? "—"}</td>
                    <td className="px-4 py-2 whitespace-nowrap font-mono text-[11px]">{fmtDur(r.durationSeconds)}</td>
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
