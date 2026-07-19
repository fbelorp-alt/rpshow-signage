import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Monitor, Wifi, WifiOff, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type Screen = {
  id: number;
  name: string;
  status: string;
  lastSeen: string | null;
  location: string | null;
};

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function printReport(rows: { local: string; total: number; online: number; offline: number }[]) {
  const logo = `${window.location.origin}/logo-rpshow.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const total = rows.reduce((s, r) => s + r.total, 0);
  const body = rows.map(r => `<tr><td>${r.local}</td><td class="center">${r.total}</td><td class="center" style="color:#16a34a">${r.online}</td><td class="center" style="color:#ef4444">${r.offline}</td><td class="center">${r.total > 0 ? Math.round((r.online / r.total) * 100) : 0}%</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório por Local — RPShow</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#111}.hdr{display:flex;align-items:center;gap:20px;padding:20px 28px;border-bottom:3px solid #111}.hdr img{height:60px}.hdr h1{font-size:20px;font-weight:900}.hdr p{font-size:11px;color:#555}.hdr-r{margin-left:auto;text-align:right;font-size:10px;color:#666}.meta{padding:10px 28px;background:#f4f4f4;border-bottom:1px solid #ddd}.table-wrap{padding:20px 28px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#111;color:#fff}th{padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase}tbody tr{border-bottom:1px solid #eee}tbody tr:nth-child(even){background:#f9f9f9}td{padding:6px 10px}td.center{text-align:center}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="hdr"><img src="${logo}"><div><h1>Relatório por Local</h1><p>Gerado em: ${now}</p></div><div class="hdr-r"><strong>${total} telas</strong> em <strong>${rows.length} locais</strong></div></div><div class="meta">Locais cadastrados: <strong>${rows.length}</strong></div><div class="table-wrap"><table><thead><tr><th>Local</th><th>Total Telas</th><th>Online</th><th>Offline</th><th>% Online</th></tr></thead><tbody>${body}</tbody></table></div></body></html>`;
  const w = window.open("", "_blank", "width=1200,height=800");
  if (!w) { alert("Permita popups para imprimir."); return; }
  w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600);
}

export default function ReportsLocaisAdmin() {
  const { data: monitoring, isLoading } = useQuery<{ screens: Screen[] }>({
    queryKey: ["admin-report-locais"],
    queryFn: () => fetch("/api/monitoring", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60_000,
  });

  const screens: Screen[] = monitoring?.screens ?? [];

  const byLocal = useMemo(() => {
    const map = new Map<string, { total: number; online: number; offline: number; screens: Screen[] }>();
    for (const s of screens) {
      const local = (s.location ?? "Sem local").split(/[-–,]/)[0].trim() || "Sem local";
      if (!map.has(local)) map.set(local, { total: 0, online: 0, offline: 0, screens: [] });
      const slot = map.get(local)!;
      slot.total++;
      slot.screens.push(s);
      if (s.status === "online") slot.online++;
      else slot.offline++;
    }
    return [...map.entries()]
      .map(([local, v]) => ({ local, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [screens]);

  const totalLocais = byLocal.length;
  const locaisOnline = byLocal.filter(r => r.offline === 0).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locais</h1>
          <p className="text-muted-foreground text-sm mt-1">Performance por praça / ponto de exibição.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
            const h = ["Local", "Total Telas", "Online", "Offline", "% Online"];
            const b = byLocal.map(r => [r.local, String(r.total), String(r.online), String(r.offline), `${r.total > 0 ? Math.round((r.online / r.total) * 100) : 0}%`]);
            downloadCsv([h, ...b].map(r => r.map(c => `"${c}"`).join(",")).join("\n"), `locais_${new Date().toISOString().slice(0, 10)}.csv`);
          }}><Download className="w-3.5 h-3.5" /> CSV</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => printReport(byLocal)}><Printer className="w-3.5 h-3.5" /> Imprimir</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: MapPin,   label: "Locais Distintos",    value: String(totalLocais) },
          { icon: Monitor,  label: "Total de Telas",      value: String(screens.length) },
          { icon: Wifi,     label: "Locais 100% Online",  value: String(locaisOnline) },
          { icon: WifiOff,  label: "Locais com Offline",  value: String(byLocal.filter(r => r.offline > 0).length) },
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
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Locais ({byLocal.length})</span>
        </div>
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : byLocal.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Nenhuma tela com localização cadastrada.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr>
                  {["Local", "Total", "Online", "Offline", "% Online", "Telas"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {byLocal.map(r => {
                  const pct = r.total > 0 ? Math.round((r.online / r.total) * 100) : 0;
                  return (
                    <tr key={r.local} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium flex items-center gap-2"><MapPin className="w-3 h-3 text-primary shrink-0" />{r.local}</td>
                      <td className="px-4 py-2.5 font-bold tabular-nums text-center">{r.total}</td>
                      <td className="px-4 py-2.5 text-center"><span className="font-semibold text-emerald-600">{r.online}</span></td>
                      <td className="px-4 py-2.5 text-center"><span className={r.offline > 0 ? "font-semibold text-red-500" : "text-muted-foreground"}>{r.offline}</span></td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] w-8 tabular-nums">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-[240px]">
                        <div className="flex flex-wrap gap-1">
                          {r.screens.slice(0, 3).map(s => (
                            <Badge key={s.id} variant="outline" className={`text-[9px] h-4 ${s.status === "online" ? "border-emerald-300 text-emerald-600" : "border-red-300 text-red-500"}`}>{s.name.slice(0, 14)}</Badge>
                          ))}
                          {r.screens.length > 3 && <Badge variant="outline" className="text-[9px] h-4">+{r.screens.length - 3}</Badge>}
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
