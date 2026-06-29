import { useState, useMemo } from "react";
import {
  useGetReportSummary,
  useListPlayHistory,
  useGetReportPeriodSummary,
  useListScreens,
  useListPlaylists,
  useListMedia,
  useListSchedules,
} from "@workspace/api-client-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  PlayCircle, TrendingUp, Calendar, Clock, Monitor, Download,
  FileText, Table2, Wifi, WifiOff, ListVideo, Image as ImageIcon, Info,
  ChevronUp, ChevronDown, ChevronsUpDown, X, Printer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── helpers ────────────────────────────────────────────────────────────────

function todayBRT() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // "YYYY-MM-DD"
}

function sevenDaysAgoBRT() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDuration(seconds?: number | null) {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function fmtLastSeen(iso?: string | null) {
  if (!iso) return "Nunca conectada";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "Agora mesmo";
  if (mins < 60) return `Há ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Há ${hrs}h`;
  return `Há ${Math.floor(hrs / 24)} dias`;
}

function fmtTotalDuration(seconds: number) {
  if (!seconds) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtTableDatetime(iso: string) {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => p.find(x => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}:${g("second")}`;
}

function addSeconds(iso: string, secs: number | null | undefined) {
  return new Date(new Date(iso).getTime() + (secs ?? 0) * 1000).toISOString();
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    image: "Imagem", video: "Vídeo", web_channel: "Canal Web",
    rss: "RSS", weather: "Clima", clock: "Relógio",
  };
  return map[type] ?? type;
}

function typeColor(type: string) {
  const map: Record<string, string> = {
    image: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    video: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    web_channel: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    rss: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    weather: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    clock: "bg-green-500/10 text-green-400 border-green-500/20",
  };
  return map[type] ?? "bg-muted text-muted-foreground";
}

function StatCard({ label, value, icon: Icon, sub }: {
  label: string; value: number | string; icon: React.ElementType; sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className="text-3xl font-bold tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover shadow-md px-3 py-2 text-sm">
      <p className="font-medium">{label}</p>
      <p className="text-primary font-bold">{payload[0].value} exibições</p>
    </div>
  );
}

// ─── CSV export ─────────────────────────────────────────────────────────────

function exportDetailedCsv(items: any[], screenName: string, from: string, to: string) {
  const header = ["Media Name", "Screen Name", "Start Date", "End Date", "Duration (s)"];
  const rows = items.map((i) => [
    i.mediaName,
    i.screenName,
    fmtTableDatetime(i.playedAt),
    fmtTableDatetime(addSeconds(i.playedAt, i.durationSeconds)),
    i.durationSeconds ?? 0,
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  downloadCsv(csv, `detalhes_${screenName}_${from}_${to}.csv`);
}

function exportOverviewCsv(items: any[], screenName: string, from: string, to: string) {
  const header = ["Media Name", "Screen Name", "Start Date", "End Date", "Total Duration (s)", "Times", "Total Days"];
  const rows = items.map((i) => [
    i.mediaName,
    i.screenName ?? "Todas",
    i.firstPlayedAt ? fmtTableDatetime(i.firstPlayedAt) : "",
    i.lastPlayedAt ? fmtTableDatetime(i.lastPlayedAt) : "",
    i.totalSeconds ?? 0,
    i.playCount,
    i.distinctDays ?? 1,
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  downloadCsv(csv, `overview_${screenName}_${from}_${to}.csv`);
}

function downloadCsv(content: string, filename: string) {
  const bom = "\uFEFF"; // UTF-8 BOM for Excel
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function printDetailedReport(items: any[], screenName: string, from: string, to: string) {
  const logoUrl = `${window.location.origin}/logo.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const rows = items.map((i) => `
    <tr>
      <td>${i.mediaName ?? "—"}</td>
      <td>${i.screenName ?? "—"}</td>
      <td class="mono">${fmtTableDatetime(i.playedAt)}</td>
      <td class="mono">${fmtTableDatetime(addSeconds(i.playedAt, i.durationSeconds))}</td>
      <td class="mono center">${i.durationSeconds ?? 0}s</td>
    </tr>`).join("");

  const totalSeconds = items.reduce((a, i) => a + (i.durationSeconds ?? 0), 0);
  const totalH = Math.floor(totalSeconds / 3600);
  const totalM = Math.floor((totalSeconds % 3600) / 60);
  const totalS = totalSeconds % 60;
  const totalStr = totalH > 0 ? `${totalH}h ${totalM}m ${totalS}s` : totalM > 0 ? `${totalM}m ${totalS}s` : `${totalS}s`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório de Exibições — RPShow Signage-on</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; }

    /* ── HEADER ── */
    .header { display: flex; align-items: center; gap: 20px; padding: 20px 28px 16px; border-bottom: 3px solid #111; }
    .header img { height: 64px; width: auto; object-fit: contain; }
    .header-text { flex: 1; }
    .header-text h1 { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #111; }
    .header-text p { font-size: 12px; color: #555; margin-top: 2px; }
    .header-right { text-align: right; font-size: 10px; color: #666; line-height: 1.6; }
    .header-right strong { font-size: 13px; color: #111; display: block; }

    /* ── REPORT META ── */
    .meta { display: flex; gap: 32px; padding: 12px 28px; background: #f4f4f4; border-bottom: 1px solid #ddd; font-size: 11px; }
    .meta-item label { font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.8px; color: #888; display: block; margin-bottom: 2px; }
    .meta-item span { font-size: 13px; font-weight: 600; color: #111; }

    /* ── TABLE ── */
    .table-wrap { padding: 20px 28px; }
    .table-title { font-size: 13px; font-weight: 700; margin-bottom: 10px; color: #333; border-left: 4px solid #111; padding-left: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead tr { background: #111; color: #fff; }
    thead th { padding: 9px 12px; text-align: left; font-weight: 700; font-size: 10px; letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap; }
    tbody tr { border-bottom: 1px solid #e5e5e5; }
    tbody tr:nth-child(even) { background: #f9f9f9; }
    tbody tr:last-child { border-bottom: 2px solid #111; }
    td { padding: 7px 12px; vertical-align: middle; }
    td.mono { font-family: 'Courier New', monospace; font-size: 10.5px; white-space: nowrap; }
    td.center { text-align: center; }

    /* ── TOTALS ── */
    .totals { padding: 10px 28px; display: flex; gap: 32px; border-top: 1px solid #ccc; background: #f4f4f4; }
    .totals .t { font-size: 11px; }
    .totals .t label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #888; }
    .totals .t span { font-size: 14px; font-weight: 900; color: #111; display: block; }

    /* ── FOOTER ── */
    .footer { padding: 14px 28px 20px; font-size: 9px; color: #aaa; text-align: center; border-top: 1px solid #e0e0e0; margin-top: 10px; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>

  <div class="header">
    <img src="${logoUrl}" alt="RPShow" />
    <div class="header-text">
      <h1>RPShow Signage-on</h1>
      <p>Sistema de Sinalização Digital</p>
    </div>
    <div class="header-right">
      <strong>RELATÓRIO DE EXIBIÇÕES</strong>
      Gerado em: ${now}
    </div>
  </div>

  <div class="meta">
    <div class="meta-item">
      <label>Tela</label>
      <span>${screenName === "todas-telas" ? "Todas as telas" : screenName}</span>
    </div>
    <div class="meta-item">
      <label>Período</label>
      <span>${from} → ${to}</span>
    </div>
    <div class="meta-item">
      <label>Total de registros</label>
      <span>${items.length.toLocaleString("pt-BR")}</span>
    </div>
    <div class="meta-item">
      <label>Tempo total exibido</label>
      <span>${totalStr}</span>
    </div>
  </div>

  <div class="table-wrap">
    <div class="table-title">Detalhes de Exibição</div>
    <table>
      <thead>
        <tr>
          <th>Nome da Mídia</th>
          <th>Nome da Tela</th>
          <th>Início</th>
          <th>Fim</th>
          <th>Duração</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>

  <div class="totals">
    <div class="t"><label>Total de exibições</label><span>${items.length.toLocaleString("pt-BR")}</span></div>
    <div class="t"><label>Tempo total em exibição</label><span>${totalStr}</span></div>
  </div>

  <div class="footer">
    RPShow Signage-on · Relatório gerado automaticamente em ${now} · Todos os horários em BRT (Brasília)
  </div>

  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=1000,height=800");
  if (!win) { alert("Permita popups para imprimir o relatório."); return; }
  win.document.write(html);
  win.document.close();
}

function printOverviewReport(items: any[], screenName: string, from: string, to: string) {
  const logoUrl = `${window.location.origin}/logo.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const rows = items.map((i) => `
    <tr>
      <td>${i.mediaName ?? "—"}</td>
      <td>${i.screenName ?? "Todas"}</td>
      <td class="mono">${i.firstPlayedAt ? fmtTableDatetime(i.firstPlayedAt) : "—"}</td>
      <td class="mono">${i.lastPlayedAt ? fmtTableDatetime(i.lastPlayedAt) : "—"}</td>
      <td class="mono center">${(i.totalSeconds ?? 0).toLocaleString("pt-BR")}s</td>
      <td class="mono center">${(i.playCount ?? 0).toLocaleString("pt-BR")}</td>
      <td class="mono center">${i.distinctDays ?? 1}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório Overview — RPShow Signage-on</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; }
    .header { display: flex; align-items: center; gap: 20px; padding: 20px 28px 16px; border-bottom: 3px solid #111; }
    .header img { height: 64px; width: auto; object-fit: contain; }
    .header-text h1 { font-size: 22px; font-weight: 900; color: #111; }
    .header-text p { font-size: 12px; color: #555; margin-top: 2px; }
    .header-right { margin-left: auto; text-align: right; font-size: 10px; color: #666; line-height: 1.6; }
    .header-right strong { font-size: 13px; color: #111; display: block; }
    .meta { display: flex; gap: 32px; padding: 12px 28px; background: #f4f4f4; border-bottom: 1px solid #ddd; font-size: 11px; }
    .meta-item label { font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.8px; color: #888; display: block; margin-bottom: 2px; }
    .meta-item span { font-size: 13px; font-weight: 600; color: #111; }
    .table-wrap { padding: 20px 28px; }
    .table-title { font-size: 13px; font-weight: 700; margin-bottom: 10px; color: #333; border-left: 4px solid #111; padding-left: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead tr { background: #111; color: #fff; }
    thead th { padding: 9px 12px; text-align: left; font-weight: 700; font-size: 10px; letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap; }
    tbody tr { border-bottom: 1px solid #e5e5e5; }
    tbody tr:nth-child(even) { background: #f9f9f9; }
    tbody tr:last-child { border-bottom: 2px solid #111; }
    td { padding: 7px 12px; vertical-align: middle; }
    td.mono { font-family: 'Courier New', monospace; font-size: 10.5px; white-space: nowrap; }
    td.center { text-align: center; }
    .footer { padding: 14px 28px 20px; font-size: 9px; color: #aaa; text-align: center; border-top: 1px solid #e0e0e0; margin-top: 10px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="${logoUrl}" alt="RPShow" />
    <div class="header-text">
      <h1>RPShow Signage-on</h1>
      <p>Sistema de Sinalização Digital</p>
    </div>
    <div class="header-right">
      <strong>RELATÓRIO GERAL</strong>
      Gerado em: ${now}
    </div>
  </div>
  <div class="meta">
    <div class="meta-item"><label>Tela</label><span>${screenName === "todas-telas" ? "Todas as telas" : screenName}</span></div>
    <div class="meta-item"><label>Período</label><span>${from} → ${to}</span></div>
    <div class="meta-item"><label>Mídias distintas</label><span>${items.length.toLocaleString("pt-BR")}</span></div>
  </div>
  <div class="table-wrap">
    <div class="table-title">Resumo por Mídia</div>
    <table>
      <thead><tr>
        <th>Nome da Mídia</th><th>Tela</th><th>Primeira Exibição</th>
        <th>Última Exibição</th><th>Duração Total</th><th>Exibições</th><th>Dias</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="footer">RPShow Signage-on · Relatório gerado em ${now} · Horários em BRT (Brasília)</div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=1200,height=800");
  if (!win) { alert("Permita popups para imprimir o relatório."); return; }
  win.document.write(html);
  win.document.close();
}

// ─── Main page ───────────────────────────────────────────────────────────────

type Tab = "overview" | "details";
type OverviewSortKey = "mediaName" | "firstPlayedAt" | "lastPlayedAt" | "totalSeconds" | "playCount" | "distinctDays";

export default function Reports() {
  const [tab, setTab] = useState<Tab>("overview");
  const [screenId, setScreenId] = useState<string>("all");
  const [startDate, setStartDate] = useState(sevenDaysAgoBRT());
  const [endDate, setEndDate] = useState(todayBRT());
  const [overviewSort, setOverviewSort] = useState<{ key: OverviewSortKey; dir: "asc" | "desc" }>({ key: "playCount", dir: "desc" });

  const { data: screens } = useListScreens();
  const { data: playlists } = useListPlaylists();
  const { data: media } = useListMedia();
  const { data: schedules } = useListSchedules();
  const { data: summary, isLoading: loadingSummary } = useGetReportSummary();

  const queryParams = useMemo(() => ({
    screenId: screenId !== "all" ? Number(screenId) : undefined,
    startDate,
    endDate,
  }), [screenId, startDate, endDate]);

  const { data: detailed, isLoading: loadingDetailed } = useListPlayHistory({
    ...queryParams,
    limit: 500,
  });

  const { data: periodSummary, isLoading: loadingPeriod } = useGetReportPeriodSummary(queryParams);

  const chartData = summary?.playsByDay?.map((d) => ({
    date: d.date.slice(5).replace("-", "/"),
    count: d.count,
  })) ?? [];

  const selectedScreenName = screenId === "all"
    ? "todas-telas"
    : (screens?.find((s: any) => String(s.id) === screenId)?.name ?? screenId);

  // ── Derived stats ────────────────────────────────────────────────────────
  const totalMediaDuration = (media ?? []).reduce((a, m: any) => a + (m.durationSeconds ?? 0), 0);
  const onlineScreens = (screens ?? []).filter((s: any) => s.status === "online").length;

  // ── Overview sort ────────────────────────────────────────────────────────
  const sortedOverviewItems = useMemo(() => {
    const items = [...(periodSummary?.items ?? [])] as any[];
    const { key, dir } = overviewSort;
    items.sort((a, b) => {
      const av = a[key] ?? "";
      const bv = b[key] ?? "";
      const cmp = typeof av === "string" ? av.localeCompare(bv) : (av as number) - (bv as number);
      return dir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [periodSummary?.items, overviewSort]);

  const toggleSort = (key: OverviewSortKey) =>
    setOverviewSort(prev => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Histórico de exibição e status das suas telas
        </p>
      </div>

      {/* ── Status do Sistema ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Monitor className="w-4 h-4" /> Status do Sistema
        </h2>

        {/* Screen cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(screens ?? []).map((s: any) => {
            const isOnline = s.status === "online";
            const screenSchedules = (schedules ?? []).filter((sc: any) => sc.screenId === s.id);
            return (
              <Card key={s.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isOnline ? "bg-emerald-500/15" : "bg-muted"}`}>
                        <Monitor className={`w-4 h-4 ${isOnline ? "text-emerald-400" : "text-muted-foreground"}`} />
                      </div>
                      <span className="font-semibold text-sm truncate">{s.name}</span>
                    </div>
                    <Badge className={isOnline
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 border shrink-0 gap-1"
                      : "bg-muted text-muted-foreground border shrink-0 gap-1"
                    }>
                      {isOnline
                        ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />Online</>
                        : <><WifiOff className="w-2.5 h-2.5" />Offline</>
                      }
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Última conexão</span>
                      <span className="font-medium text-foreground">{fmtLastSeen(s.lastSeen)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Código</span>
                      <span className="font-mono font-medium text-foreground">{s.code}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Campanhas</span>
                      <span className="font-medium text-foreground">{screenSchedules.length} agendamento{screenSchedules.length !== 1 ? "s" : ""}</span>
                    </div>
                    {s.activePlaylistName && (
                      <div className="flex items-center justify-between">
                        <span>Playlist atual</span>
                        <span className="font-medium text-foreground truncate max-w-[140px]">{s.activePlaylistName}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Media library card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-4 h-4 text-blue-400" />
                </div>
                <span className="font-semibold text-sm">Biblioteca de Mídia</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Total de arquivos</span>
                  <span className="font-medium text-foreground">{(media ?? []).length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Playlists</span>
                  <span className="font-medium text-foreground">{(playlists ?? []).length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Duração total</span>
                  <span className="font-medium text-foreground">{fmtTotalDuration(totalMediaDuration)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Playlists summary */}
          {(playlists ?? []).length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                    <ListVideo className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="font-semibold text-sm">Playlists Ativas</span>
                </div>
                <div className="space-y-2">
                  {(playlists ?? []).slice(0, 4).map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate max-w-[140px]">{p.name}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">{p.itemCount} itens · {fmtTotalDuration(p.totalDurationSeconds)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Info banner when no plays yet */}
      {(summary?.totalPlays ?? 0) === 0 && !loadingSummary && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Aguardando dados do player</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              O histórico de exibições aparece aqui automaticamente quando o TV Player ({onlineScreens > 0 ? "já online ✓" : "offline"}) começa a reproduzir as mídias. Verifique se o app do player está aberto na tela.
            </p>
          </div>
        </div>
      )}

      {/* Overview stats (always visible) */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Hoje" value={summary?.playsToday ?? 0} icon={Clock} sub="exibições no dia" />
          <StatCard label="Esta Semana" value={summary?.playsThisWeek ?? 0} icon={Calendar} sub="exibições na semana" />
          <StatCard label="Este Mês" value={summary?.playsThisMonth ?? 0} icon={TrendingUp} sub="exibições no mês" />
          <StatCard label="Total Geral" value={summary?.totalPlays ?? 0} icon={PlayCircle} sub="desde o início" />
        </div>
      )}

      {/* 7-day chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Exibições — Últimos 7 dias</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSummary ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Period report ─────────────────────────────────────────────── */}
      <div className="space-y-0">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-primary" />
          Relatório por Período
        </h2>

        {/* ── Filter card ── */}
        <Card className="rounded-b-none border-b-0">
          <CardContent className="p-5 space-y-4">

            {/* Row: Screens */}
            <div className="flex items-start gap-6">
              <span className="w-28 text-sm font-medium text-muted-foreground pt-1.5 shrink-0">
                <span className="text-destructive mr-0.5">*</span> Telas
              </span>
              <div className="flex-1 space-y-2">
                <Select value="" onValueChange={(v) => setScreenId(v)}>
                  <SelectTrigger className="h-9 w-56">
                    <SelectValue placeholder="Selecionar tela" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-2">
                        <Monitor className="w-3.5 h-3.5" /> Todas as telas
                      </span>
                    </SelectItem>
                    {screens?.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        <span className="flex items-center gap-2">
                          <Monitor className="w-3.5 h-3.5" /> {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {screenId !== "all" && (
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs font-medium">
                      {screens?.find((s: any) => String(s.id) === screenId)?.name ?? screenId}
                      <button onClick={() => setScreenId("all")} className="hover:text-blue-200 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Row: Log type */}
            <div className="flex items-center gap-6">
              <span className="w-28 text-sm font-medium text-muted-foreground shrink-0">
                <span className="text-destructive mr-0.5">*</span> Tipo de Log
              </span>
              <div className="flex items-center gap-6">
                {(["overview", "details"] as Tab[]).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() => setTab(t)}
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer ${
                        tab === t ? "border-primary" : "border-muted-foreground/40"
                      }`}
                    >
                      {tab === t && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <span className="text-sm font-medium" onClick={() => setTab(t)}>
                      {t === "overview" ? "Overview" : "Details"}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Row: Date range */}
            <div className="flex items-center gap-6">
              <span className="w-28 text-sm font-medium text-muted-foreground shrink-0">
                <span className="text-destructive mr-0.5">*</span> Período
              </span>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  className="h-9 w-[150px]"
                  value={startDate}
                  max={endDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="text-muted-foreground">~</span>
                <Input
                  type="date"
                  className="h-9 w-[150px]"
                  value={endDate}
                  min={startDate}
                  max={todayBRT()}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Row: Action buttons */}
            <div className="flex items-center gap-3 pl-[calc(7rem+1.5rem)]">
              <Button size="sm" className="h-8 px-5 gap-1.5">
                <PlayCircle className="w-3.5 h-3.5" /> Pesquisar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-4 gap-1.5"
                onClick={() => {
                  if (tab === "overview" && periodSummary?.items) {
                    exportOverviewCsv(periodSummary.items, selectedScreenName, startDate, endDate);
                  } else if (detailed?.items) {
                    exportDetailedCsv(detailed.items, selectedScreenName, startDate, endDate);
                  }
                }}
              >
                <Download className="w-3.5 h-3.5" /> Exportar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-4 gap-1.5"
                onClick={() => {
                  if (tab === "overview" && periodSummary?.items) {
                    printOverviewReport(periodSummary.items, selectedScreenName, startDate, endDate);
                  } else if (detailed?.items) {
                    printDetailedReport(detailed.items, selectedScreenName, startDate, endDate);
                  }
                }}
                disabled={tab === "overview" ? !periodSummary?.items?.length : !detailed?.items?.length}
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Overview table ── */}
        {tab === "overview" && (
          <Card className="rounded-t-none border-t">
            <CardContent className="p-0">
              {loadingPeriod ? (
                <div className="p-4 space-y-2">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-12" />
                    </div>
                  ))}
                </div>
              ) : sortedOverviewItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <PlayCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="font-medium text-sm">Nenhuma exibição no período</p>
                  <p className="text-xs text-muted-foreground mt-1">Ajuste o período ou selecione outra tela.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                        {([
                          { label: "Nome da Mídia", key: "mediaName" as OverviewSortKey },
                          { label: "Nome da Tela", key: null },
                          { label: "Primeira Exibição", key: "firstPlayedAt" as OverviewSortKey },
                          { label: "Última Exibição", key: "lastPlayedAt" as OverviewSortKey },
                          { label: "Duração Total (s)", key: "totalSeconds" as OverviewSortKey },
                          { label: "Exibições", key: "playCount" as OverviewSortKey },
                          { label: "Dias", key: "distinctDays" as OverviewSortKey },
                        ] as { label: string; key: OverviewSortKey | null }[]).map(({ label, key }) => (
                          <th
                            key={label}
                            className={`px-4 py-3 text-left font-semibold whitespace-nowrap ${key ? "cursor-pointer hover:text-foreground select-none" : ""}`}
                            onClick={() => key && toggleSort(key)}
                          >
                            <span className="inline-flex items-center gap-1">
                              {label}
                              {key && (
                                overviewSort.key === key
                                  ? overviewSort.dir === "asc"
                                    ? <ChevronUp className="w-3 h-3 text-primary" />
                                    : <ChevronDown className="w-3 h-3 text-primary" />
                                  : <ChevronsUpDown className="w-3 h-3 opacity-30" />
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sortedOverviewItems.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-accent/20 transition-colors">
                          <td className="px-4 py-2.5 font-medium max-w-[200px] truncate" title={item.mediaName}>
                            {item.mediaName}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-[160px] truncate">
                            {item.screenName ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                            {item.firstPlayedAt ? fmtTableDatetime(item.firstPlayedAt) : "—"}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                            {item.lastPlayedAt ? fmtTableDatetime(item.lastPlayedAt) : "—"}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-xs">
                            {(item.totalSeconds ?? 0).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums font-semibold text-primary">
                            {(item.playCount ?? 0).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground">
                            {item.distinctDays ?? 1}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-2.5 border-t bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{sortedOverviewItems.length} item(s) · {(periodSummary?.totalPlays ?? 0).toLocaleString("pt-BR")} exibições totais</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Details table ── */}
        {tab === "details" && (
          <Card className="rounded-t-none border-t">
            <CardContent className="p-0">
              {loadingDetailed ? (
                <div className="p-4 space-y-2">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-36" />
                      <Skeleton className="h-4 w-36" /><Skeleton className="h-4 w-36" /><Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : (detailed?.items?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <PlayCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="font-medium text-sm">Nenhuma exibição no período</p>
                  <p className="text-xs text-muted-foreground mt-1">Ajuste o período ou selecione outra tela.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                          <th className="px-4 py-3 text-left font-semibold">Nome da Mídia</th>
                          <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Nome da Tela</th>
                          <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Início</th>
                          <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Fim</th>
                          <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Duração (s)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {detailed!.items!.map((item: any) => (
                          <tr key={item.id} className="hover:bg-accent/20 transition-colors">
                            <td className="px-4 py-2.5 font-medium max-w-[200px] truncate" title={item.mediaName}>
                              {item.mediaName}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-[160px] truncate">
                              {item.screenName}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                              {fmtTableDatetime(item.playedAt)}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                              {fmtTableDatetime(addSeconds(item.playedAt, item.durationSeconds))}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-xs">
                              {item.durationSeconds ?? 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-2.5 border-t bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Mostrando {detailed!.items!.length.toLocaleString("pt-BR")} de {(detailed?.total ?? 0).toLocaleString("pt-BR")} registros
                      {(detailed?.total ?? 0) > 500 && " · Exporte o CSV para ver todos"}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
