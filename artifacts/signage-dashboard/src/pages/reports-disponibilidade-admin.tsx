import { useQuery } from "@tanstack/react-query";
import { Wifi, WifiOff, AlertTriangle, Monitor, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Screen = {
  id: number;
  name: string;
  status: string;
  lastSeen: string | null;
  location: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function offlineHours(iso: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}
function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function printReport(screens: Screen[]) {
  const logo = `${window.location.origin}/logo-rpshow.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const online  = screens.filter(s => s.status === "online").length;
  const offline = screens.filter(s => s.status !== "online").length;
  const pct = screens.length > 0 ? ((online / screens.length) * 100).toFixed(1) : "0";
  const body = screens.map(s => {
    const hrs = offlineHours(s.lastSeen);
    const statusLabel = s.status === "online" ? "Online" : s.lastSeen ? `Offline ${hrs === Infinity ? "" : `(${Math.round(hrs)}h)`}` : "Nunca conectou";
    return `<tr><td>${s.name}</td><td class="center">${statusLabel}</td><td class="mono">${fmtDate(s.lastSeen)}</td><td>${s.location ?? "—"}</td></tr>`;
  }).join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Disponibilidade — RPShow</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#111}.hdr{display:flex;align-items:center;gap:20px;padding:20px 28px;border-bottom:3px solid #111}.hdr img{height:60px}.hdr h1{font-size:20px;font-weight:900}.hdr p{font-size:11px;color:#555}.hdr-r{margin-left:auto;text-align:right;font-size:10px;color:#666}.meta{padding:10px 28px;background:#f4f4f4;border-bottom:1px solid #ddd}.table-wrap{padding:20px 28px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#111;color:#fff}th{padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase}tbody tr{border-bottom:1px solid #eee}tbody tr:nth-child(even){background:#f9f9f9}td{padding:6px 10px}td.mono{font-family:monospace;font-size:10.5px}td.center{text-align:center}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="hdr"><img src="${logo}"><div><h1>Relatório de Disponibilidade</h1><p>Gerado em: ${now}</p></div><div class="hdr-r">Online: <strong>${online}</strong> / Offline: <strong>${offline}</strong><br><strong>${pct}% disponíveis</strong></div></div><div class="meta">Total de telas: <strong>${screens.length}</strong></div><div class="table-wrap"><table><thead><tr><th>Tela</th><th>Status</th><th>Última Atividade</th><th>Local</th></tr></thead><tbody>${body}</tbody></table></div></body></html>`;
  const w = window.open("", "_blank", "width=1200,height=800");
  if (!w) { alert("Permita popups para imprimir."); return; }
  w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600);
}

export default function ReportsDisponibilidadeAdmin() {
  const { data: monitoring, isLoading } = useQuery<{ screens: Screen[]; summary: { totalScreens: number } }>({
    queryKey: ["admin-report-disponibilidade"],
    queryFn: () => fetch("/api/monitoring", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30_000,
  });

  const screens: Screen[] = monitoring?.screens ?? [];
  const online   = screens.filter(s => s.status === "online").length;
  const offline2h = screens.filter(s => s.status !== "online" && offlineHours(s.lastSeen) > 2).length;
  const never    = screens.filter(s => !s.lastSeen).length;
  const pctOnline = screens.length > 0 ? Math.round((online / screens.length) * 100) : 0;

  const kpis = [
    { icon: Monitor,      label: "Total de Telas",    value: String(screens.length), color: "" },
    { icon: Wifi,         label: "Online Agora",       value: `${online} (${pctOnline}%)`, color: "text-emerald-600" },
    { icon: WifiOff,      label: "Offline > 2h",       value: String(offline2h), color: "text-red-500" },
    { icon: AlertTriangle, label: "Nunca Conectou",    value: String(never), color: "text-amber-500" },
  ];

  const sorted = [...screens].sort((a, b) => {
    if (a.status === "online" && b.status !== "online") return -1;
    if (a.status !== "online" && b.status === "online") return 1;
    return (b.lastSeen ?? "").localeCompare(a.lastSeen ?? "");
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Disponibilidade</h1>
          <p className="text-muted-foreground text-sm mt-1">Status online/offline de todas as telas — atualiza a cada 30s.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
            const h = ["Tela", "Status", "Última Atividade", "Local"];
            const b = sorted.map(s => [s.name, s.status, fmtDate(s.lastSeen), s.location ?? ""]);
            downloadCsv([h, ...b].map(r => r.map(c => `"${c}"`).join(",")).join("\n"), `disponibilidade_${new Date().toISOString().slice(0, 10)}.csv`);
          }}><Download className="w-3.5 h-3.5" /> CSV</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => printReport(sorted)}><Printer className="w-3.5 h-3.5" /> Imprimir</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><k.icon className={`w-4 h-4 ${k.color || "text-primary"}`} /><p className="text-xs text-muted-foreground">{k.label}</p></div>
            {isLoading ? <Skeleton className="h-7 w-20" /> : <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telas ({screens.length})</span>
        </div>
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : sorted.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Nenhuma tela cadastrada.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr>
                  {["Status", "Tela", "Última Atividade", "Offline Há", "Local"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map(s => {
                  const hrs  = offlineHours(s.lastSeen);
                  const isOnline = s.status === "online";
                  const isNever  = !s.lastSeen;
                  const isLong   = !isOnline && hrs > 2;
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        {isOnline ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px]"><Wifi className="w-2.5 h-2.5 mr-1" />Online</Badge>
                        ) : isNever ? (
                          <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-[9px]">Nunca conectou</Badge>
                        ) : isLong ? (
                          <Badge className="bg-red-100 text-red-700 border-red-200 text-[9px]"><WifiOff className="w-2.5 h-2.5 mr-1" />Offline</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px]">Offline</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{s.name}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{fmtDate(s.lastSeen)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {isOnline ? <span className="text-emerald-600">—</span> : isNever ? <span className="text-muted-foreground">—</span> : <span className={isLong ? "text-red-500 font-semibold" : "text-muted-foreground"}>{Math.round(hrs)}h</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{s.location ?? "—"}</td>
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
