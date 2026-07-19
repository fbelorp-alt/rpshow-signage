import { useQuery } from "@tanstack/react-query";
import { HardDrive, AlertTriangle, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StorageRow = {
  operatorId: number;
  operatorName: string;
  username: string;
  usedBytes: number;
  quotaGb: number;
  fileCount: number;
  pct: number;
};

function fmtGb(bytes: number) {
  return (bytes / 1024 / 1024 / 1024).toFixed(2);
}
function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function printReport(rows: StorageRow[]) {
  const logo = `${window.location.origin}/logo-rpshow.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const near = rows.filter(r => r.pct >= 80).length;
  const over  = rows.filter(r => r.pct >= 100).length;
  const body = rows.map(r => `<tr><td>${r.operatorName}</td><td>@${r.username}</td><td class="center">${r.fileCount}</td><td class="mono">${fmtGb(r.usedBytes)} GB</td><td class="mono">${r.quotaGb} GB</td><td class="center ${r.pct >= 100 ? "red" : r.pct >= 80 ? "amber" : ""}">${r.pct}%</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Armazenamento — RPShow</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#111}.hdr{display:flex;align-items:center;gap:20px;padding:20px 28px;border-bottom:3px solid #111}.hdr img{height:60px}.hdr h1{font-size:20px;font-weight:900}.hdr p{font-size:11px;color:#555}.hdr-r{margin-left:auto;text-align:right;font-size:10px;color:#666}.meta{padding:10px 28px;background:#f4f4f4;border-bottom:1px solid #ddd}.table-wrap{padding:20px 28px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#111;color:#fff}th{padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase}tbody tr{border-bottom:1px solid #eee}tbody tr:nth-child(even){background:#f9f9f9}td{padding:6px 10px}td.mono{font-family:monospace}td.center{text-align:center}td.red{color:#ef4444;font-weight:700}td.amber{color:#f59e0b;font-weight:700}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="hdr"><img src="${logo}"><div><h1>Relatório de Armazenamento</h1><p>Gerado em: ${now}</p></div><div class="hdr-r">≥80%: <strong>${near}</strong> | ≥100%: <strong>${over}</strong></div></div><div class="meta">Clientes: <strong>${rows.length}</strong></div><div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Usuário</th><th>Arquivos</th><th>Usado</th><th>Quota</th><th>%</th></tr></thead><tbody>${body}</tbody></table></div></body></html>`;
  const w = window.open("", "_blank", "width=1200,height=800");
  if (!w) { alert("Permita popups para imprimir."); return; }
  w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600);
}

export default function ReportsArmazenamentoAdmin() {
  const { data = [], isLoading } = useQuery<StorageRow[]>({
    queryKey: ["admin-report-armazenamento"],
    queryFn: () => fetch("/api/admin/reports/storage-by-client", { credentials: "include" }).then(r => r.json()),
  });

  const sorted = [...data].sort((a, b) => b.pct - a.pct);
  const near80  = sorted.filter(r => r.pct >= 80 && r.pct < 100).length;
  const over100 = sorted.filter(r => r.pct >= 100).length;
  const totalFiles = sorted.reduce((s, r) => s + r.fileCount, 0);
  const totalUsed  = sorted.reduce((s, r) => s + r.usedBytes, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Armazenamento</h1>
          <p className="text-muted-foreground text-sm mt-1">Uso de armazenamento por cliente — identify oportunidades de upsell ou limpeza.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
            const h = ["Cliente", "Usuário", "Arquivos", "Usado (GB)", "Quota (GB)", "%"];
            const b = sorted.map(r => [r.operatorName, r.username, String(r.fileCount), fmtGb(r.usedBytes), String(r.quotaGb), `${r.pct}%`]);
            downloadCsv([h, ...b].map(r => r.map(c => `"${c}"`).join(",")).join("\n"), "armazenamento.csv");
          }}><Download className="w-3.5 h-3.5" /> CSV</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => printReport(sorted)}><Printer className="w-3.5 h-3.5" /> Imprimir</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: HardDrive,     label: "Clientes",         value: String(data.length), color: "" },
          { icon: HardDrive,     label: "Total de Arquivos", value: totalFiles.toLocaleString("pt-BR"), color: "" },
          { icon: AlertTriangle, label: "Uso ≥ 80%",        value: String(near80),  color: near80 > 0  ? "text-amber-500" : "" },
          { icon: AlertTriangle, label: "Limite Atingido",   value: String(over100), color: over100 > 0 ? "text-red-500" : "" },
        ].map(k => (
          <div key={k.label} className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><k.icon className={`w-4 h-4 ${k.color || "text-primary"}`} /><p className="text-xs text-muted-foreground">{k.label}</p></div>
            {isLoading ? <Skeleton className="h-7 w-20" /> : <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>}
          </div>
        ))}
      </div>

      {/* Total bar */}
      {!isLoading && data.length > 0 && (
        <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
          <HardDrive className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Total usado por todos os clientes</span>
              <span className="font-semibold">{fmtGb(totalUsed)} GB</span>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (totalUsed / (data.reduce((s, r) => s + r.quotaGb, 0) * 1024 * 1024 * 1024)) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clientes ({sorted.length}) — ordenado por uso</span>
        </div>
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : sorted.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Nenhum cliente com dados de armazenamento.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr>
                  {["Cliente", "Arquivos", "Usado", "Quota", "Ocupação"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map(r => {
                  const isOver  = r.pct >= 100;
                  const isNear  = r.pct >= 80;
                  return (
                    <tr key={r.operatorId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{r.operatorName}</p>
                        <p className="text-[10px] text-muted-foreground">@{r.username}</p>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">{r.fileCount.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">{fmtGb(r.usedBytes)} GB</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{r.quotaGb} GB</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden min-w-[80px]">
                            <div
                              className={cn("h-full rounded-full", isOver ? "bg-red-500" : isNear ? "bg-amber-500" : "bg-primary")}
                              style={{ width: `${Math.min(100, r.pct)}%` }}
                            />
                          </div>
                          <span className={cn("text-[11px] font-semibold tabular-nums w-10", isOver ? "text-red-500" : isNear ? "text-amber-500" : "text-muted-foreground")}>
                            {r.pct}%
                          </span>
                          {isOver  && <Badge className="bg-red-100 text-red-700 border-red-200 text-[9px] h-4">Cheio</Badge>}
                          {isNear && !isOver && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] h-4">≥80%</Badge>}
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
