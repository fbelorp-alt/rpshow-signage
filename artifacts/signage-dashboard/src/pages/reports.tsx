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
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  PlayCircle, TrendingUp, Calendar, Clock, Monitor, Download,
  FileText, Wifi, WifiOff, ListVideo, Image as ImageIcon, Info,
  ChevronUp, ChevronDown, ChevronsUpDown, X, Printer,
  AlertTriangle, HelpCircle, ChevronRight, Megaphone, Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── helpers ────────────────────────────────────────────────────────────────
function todayBRT() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
function sevenDaysAgoBRT() {
  const d = new Date(); d.setDate(d.getDate() - 6);
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
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}
function fmtHoursMin(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return { h, m, label: h > 0 ? `${h.toLocaleString("pt-BR")} h ${m} min` : `${m} min` };
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

// ─── CSV / Print ─────────────────────────────────────────────────────────────
function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function exportOverviewCsv(items: any[], screenName: string, from: string, to: string) {
  const header = ["Media Name", "Screen Name", "Start Date", "End Date", "Total Duration (s)", "Times", "Total Days"];
  const rows = items.map(i => [i.mediaName, i.screenName ?? "Todas", i.firstPlayedAt ? fmtTableDatetime(i.firstPlayedAt) : "", i.lastPlayedAt ? fmtTableDatetime(i.lastPlayedAt) : "", i.totalSeconds ?? 0, i.playCount, i.distinctDays ?? 1]);
  downloadCsv([header, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n"), `overview_${screenName}_${from}_${to}.csv`);
}
function exportDetailedCsv(items: any[], screenName: string, from: string, to: string) {
  const header = ["Media Name", "Screen Name", "Start Date", "End Date", "Duration (s)"];
  const rows = items.map(i => [i.mediaName, i.screenName, fmtTableDatetime(i.playedAt), fmtTableDatetime(addSeconds(i.playedAt, i.durationSeconds)), i.durationSeconds ?? 0]);
  downloadCsv([header, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n"), `detalhes_${screenName}_${from}_${to}.csv`);
}
function printOverviewReport(items: any[], screenName: string, from: string, to: string) {
  const logoUrl = `${window.location.origin}/logo-rpshow.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const rows = items.map(i => `<tr><td>${i.mediaName??""}</td><td>${i.screenName??"Todas"}</td><td class="mono">${i.firstPlayedAt?fmtTableDatetime(i.firstPlayedAt):"—"}</td><td class="mono">${i.lastPlayedAt?fmtTableDatetime(i.lastPlayedAt):"—"}</td><td class="mono center">${(i.totalSeconds??0).toLocaleString("pt-BR")}s</td><td class="mono center">${(i.playCount??0).toLocaleString("pt-BR")}</td><td class="mono center">${i.distinctDays??1}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Relatório Overview — RPShow OnSign</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff}.header{display:flex;align-items:center;gap:20px;padding:20px 28px 16px;border-bottom:3px solid #111}.header img{height:64px;width:auto}.header-text h1{font-size:22px;font-weight:900;color:#111}.header-text p{font-size:12px;color:#555;margin-top:2px}.header-right{margin-left:auto;text-align:right;font-size:10px;color:#666;line-height:1.6}.header-right strong{font-size:13px;color:#111;display:block}.meta{display:flex;gap:32px;padding:12px 28px;background:#f4f4f4;border-bottom:1px solid #ddd;font-size:11px}.meta-item label{font-weight:700;text-transform:uppercase;font-size:9px;letter-spacing:.8px;color:#888;display:block;margin-bottom:2px}.meta-item span{font-size:13px;font-weight:600;color:#111}.table-wrap{padding:20px 28px}.table-title{font-size:13px;font-weight:700;margin-bottom:10px;color:#333;border-left:4px solid #111;padding-left:10px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#111;color:#fff}thead th{padding:9px 12px;text-align:left;font-weight:700;font-size:10px;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}tbody tr{border-bottom:1px solid #e5e5e5}tbody tr:nth-child(even){background:#f9f9f9}td{padding:7px 12px;vertical-align:middle}td.mono{font-family:monospace;font-size:10.5px;white-space:nowrap}td.center{text-align:center}.footer{padding:14px 28px 20px;font-size:9px;color:#aaa;text-align:center;border-top:1px solid #e0e0e0;margin-top:10px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:10mm}}</style></head><body><div class="header"><img src="${logoUrl}" alt="RPShow"/><div class="header-text"><h1>RPShow OnSign</h1><p>Sistema de Sinalização Digital</p></div><div class="header-right"><strong>RELATÓRIO GERAL</strong>Gerado em: ${now}</div></div><div class="meta"><div class="meta-item"><label>Tela</label><span>${screenName==="todas-telas"?"Todas as telas":screenName}</span></div><div class="meta-item"><label>Período</label><span>${from} → ${to}</span></div><div class="meta-item"><label>Mídias distintas</label><span>${items.length.toLocaleString("pt-BR")}</span></div></div><div class="table-wrap"><div class="table-title">Resumo por Mídia</div><table><thead><tr><th>Nome da Mídia</th><th>Tela</th><th>Primeira Exibição</th><th>Última Exibição</th><th>Duração Total</th><th>Exibições</th><th>Dias</th></tr></thead><tbody>${rows}</tbody></table></div><div class="footer">RPShow OnSign · Relatório gerado em ${now} · Horários em BRT (Brasília)</div><script>window.onload=()=>{window.print();}<\/script></body></html>`;
  const win = window.open("", "_blank", "width=1200,height=800");
  if (!win) { alert("Permita popups para imprimir."); return; }
  win.document.write(html); win.document.close();
}
function printDetailedReport(items: any[], screenName: string, from: string, to: string) {
  const logoUrl = `${window.location.origin}/logo-rpshow.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const totalSeconds = items.reduce((a, i) => a + (i.durationSeconds ?? 0), 0);
  const h = Math.floor(totalSeconds/3600), m = Math.floor((totalSeconds%3600)/60), s = totalSeconds%60;
  const totalStr = h>0?`${h}h ${m}m ${s}s`:m>0?`${m}m ${s}s`:`${s}s`;
  const rows = items.map(i => `<tr><td>${i.mediaName??""}</td><td>${i.screenName??""}</td><td class="mono">${fmtTableDatetime(i.playedAt)}</td><td class="mono">${fmtTableDatetime(addSeconds(i.playedAt,i.durationSeconds))}</td><td class="mono center">${i.durationSeconds??0}s</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Relatório de Exibições — RPShow OnSign</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff}.header{display:flex;align-items:center;gap:20px;padding:20px 28px 16px;border-bottom:3px solid #111}.header img{height:64px;width:auto}.header-text h1{font-size:22px;font-weight:900;color:#111}.header-text p{font-size:12px;color:#555;margin-top:2px}.header-right{margin-left:auto;text-align:right;font-size:10px;color:#666;line-height:1.6}.header-right strong{font-size:13px;color:#111;display:block}.meta{display:flex;gap:32px;padding:12px 28px;background:#f4f4f4;border-bottom:1px solid #ddd}.meta-item label{font-weight:700;text-transform:uppercase;font-size:9px;color:#888;display:block;margin-bottom:2px}.meta-item span{font-size:13px;font-weight:600;color:#111}.table-wrap{padding:20px 28px}.table-title{font-size:13px;font-weight:700;margin-bottom:10px;color:#333;border-left:4px solid #111;padding-left:10px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#111;color:#fff}thead th{padding:9px 12px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;white-space:nowrap}tbody tr{border-bottom:1px solid #e5e5e5}tbody tr:nth-child(even){background:#f9f9f9}td{padding:7px 12px;vertical-align:middle}td.mono{font-family:monospace;font-size:10.5px;white-space:nowrap}td.center{text-align:center}.totals{padding:10px 28px;display:flex;gap:32px;border-top:1px solid #ccc;background:#f4f4f4}.totals .t label{font-size:9px;font-weight:700;text-transform:uppercase;color:#888}.totals .t span{font-size:14px;font-weight:900;color:#111;display:block}.footer{padding:14px 28px 20px;font-size:9px;color:#aaa;text-align:center;border-top:1px solid #e0e0e0;margin-top:10px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:10mm}}</style></head><body><div class="header"><img src="${logoUrl}" alt="RPShow"/><div class="header-text"><h1>RPShow OnSign</h1><p>Sistema de Sinalização Digital</p></div><div class="header-right"><strong>RELATÓRIO DE EXIBIÇÕES</strong>Gerado em: ${now}</div></div><div class="meta"><div class="meta-item"><label>Tela</label><span>${screenName==="todas-telas"?"Todas as telas":screenName}</span></div><div class="meta-item"><label>Período</label><span>${from} → ${to}</span></div><div class="meta-item"><label>Total de registros</label><span>${items.length.toLocaleString("pt-BR")}</span></div><div class="meta-item"><label>Tempo total exibido</label><span>${totalStr}</span></div></div><div class="table-wrap"><div class="table-title">Detalhes de Exibição</div><table><thead><tr><th>Nome da Mídia</th><th>Nome da Tela</th><th>Início</th><th>Fim</th><th>Duração</th></tr></thead><tbody>${rows}</tbody></table></div><div class="totals"><div class="t"><label>Total de exibições</label><span>${items.length.toLocaleString("pt-BR")}</span></div><div class="t"><label>Tempo total em exibição</label><span>${totalStr}</span></div></div><div class="footer">RPShow OnSign · Relatório gerado em ${now} · Horários em BRT (Brasília)</div><script>window.onload=()=>{window.print();}<\/script></body></html>`;
  const win = window.open("", "_blank", "width=1000,height=800");
  if (!win) { alert("Permita popups para imprimir."); return; }
  win.document.write(html); win.document.close();
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover shadow-md px-3 py-2 text-sm">
      <p className="font-medium text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-bold" style={{ color: p.color }}>{p.name}: {p.value.toLocaleString("pt-BR")}</p>
      ))}
    </div>
  );
}

// ─── Donut label ─────────────────────────────────────────────────────────────
const DONUT_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899"];

type Tab = "overview" | "details";
type TimeTab = "dia" | "semana" | "mes";
type OverviewSortKey = "mediaName" | "firstPlayedAt" | "lastPlayedAt" | "totalSeconds" | "playCount" | "distinctDays";

type ByPlayerRow = {
  screenId: number; screenName: string; totalPlays: number; totalSeconds: number;
  distinctMedia: number; status: string; lastSeen: string | null;
  topContent: { mediaName: string; mediaType: string; playCount: number }[];
};
type ActivationRow = {
  screenId: number; screenName: string; status: string; lastSeen: string | null;
  connectionCount: number; onlineSeconds: number; offlineSeconds: number; uptimePct: number; periodSeconds: number;
};

function fmtUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 24) return `${Math.floor(h/24)}d ${h%24}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function Reports() {
  // Pre-populate from URL params (e.g. coming from Campanhas page)
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [tab, setTab]                 = useState<Tab>("overview");
  const [timeTab, setTimeTab]         = useState<TimeTab>("dia");
  const [screenId, setScreenId]       = useState<string>(urlParams.get("screenId") ?? "all");
  const [mediaNameFilter, setMediaNameFilter] = useState<string>("all");
  const [campaignGroupId, setCampaignGroupId] = useState<string>(urlParams.get("campaignGroupId") ?? "all");
  const [clientNameFilter, setClientNameFilter] = useState<string>(urlParams.get("clientName") ?? "all");
  const [startDate, setStartDate]     = useState(urlParams.get("from") ?? sevenDaysAgoBRT());
  const [endDate, setEndDate]         = useState(urlParams.get("to") ?? todayBRT());
  const [showDetailed, setShowDetailed] = useState(false);
  const [showByPlayer, setShowByPlayer] = useState(false);
  const [showActivation, setShowActivation] = useState(false);
  const [overviewSort, setOverviewSort] = useState<{ key: OverviewSortKey; dir: "asc" | "desc" }>({ key: "playCount", dir: "desc" });

  const { data: screens }       = useListScreens();
  const { data: playlists }     = useListPlaylists();
  const { data: media }         = useListMedia();
  const { data: schedules }     = useListSchedules();
  const { data: summary, isLoading: loadingSummary } = useGetReportSummary();

  const { data: monData } = useQuery({
    queryKey: ["monitoring-reports"],
    queryFn: async () => { const r = await fetch("/api/monitoring", { credentials: "include" }); return r.ok ? r.json() : null; },
    refetchInterval: 60_000,
  });

  const { data: campaignsList } = useQuery<any[]>({
    queryKey: ["reports-campaigns"],
    queryFn: async () => { const r = await fetch("/api/reports/campaigns", { credentials: "include" }); return r.ok ? r.json() : []; },
  });

  const { data: clientsList } = useQuery<string[]>({
    queryKey: ["reports-clients"],
    queryFn: async () => { const r = await fetch("/api/reports/clients", { credentials: "include" }); return r.ok ? r.json() : []; },
  });

  const { data: byPlayerData, isLoading: loadingByPlayer } = useQuery<ByPlayerRow[]>({
    queryKey: ["reports-by-player", startDate, endDate],
    queryFn: async () => {
      const p = new URLSearchParams({ startDate, endDate });
      const r = await fetch(`/api/reports/by-player?${p}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: showByPlayer,
  });

  const { data: activationData, isLoading: loadingActivation } = useQuery<ActivationRow[]>({
    queryKey: ["reports-activation", startDate, endDate],
    queryFn: async () => {
      const p = new URLSearchParams({ startDate, endDate });
      const r = await fetch(`/api/reports/activation?${p}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: showActivation,
  });

  const queryParams = useMemo(() => ({
    screenId: screenId !== "all" ? Number(screenId) : undefined,
    startDate, endDate,
    ...(campaignGroupId !== "all" ? { campaignGroupId } : {}),
    ...(clientNameFilter !== "all" ? { clientName: clientNameFilter } : {}),
  }), [screenId, startDate, endDate, campaignGroupId, clientNameFilter]);

  const { data: detailed, isLoading: loadingDetailed } = useListPlayHistory({ ...queryParams, limit: 500 });
  const { data: periodSummary, isLoading: loadingPeriod } = useGetReportPeriodSummary(queryParams);

  const selectedScreenName = screenId === "all" ? "todas-telas" : (screens?.find((s: any) => String(s.id) === screenId)?.name ?? screenId);

  // ── Derived numbers ──────────────────────────────────────────────────────
  const totalSeconds      = useMemo(() => (periodSummary?.items ?? []).reduce((a: number, i: any) => a + (i.totalSeconds ?? 0), 0), [periodSummary?.items]);
  const totalPlays        = periodSummary?.totalPlays ?? 0;
  const onlineCount       = (monData as any)?.summary?.onlineCount ?? (screens ?? []).filter((s: any) => s.status === "online").length;
  const offlineCount      = (monData as any)?.summary?.offlineCount ?? (screens ?? []).filter((s: any) => s.status === "offline").length;
  const alertCount        = (monData as any)?.summary?.neverCount ?? (screens ?? []).filter((s: any) => s.status === "unknown").length;
  const totalScreens      = (screens ?? []).length;
  const onlinePct         = totalScreens > 0 ? Math.round((onlineCount / totalScreens) * 100) : 0;
  const totalMedia        = (media ?? []).length;
  const totalPlaylists    = (playlists ?? []).length;

  const timeData = useMemo(() => {
    const days = summary?.playsByDay ?? [];
    if (timeTab === "dia") return days.map((d: any) => ({ label: d.date.slice(5).replace("-", "/"), value: d.count }));
    if (timeTab === "semana") {
      const map = new Map<string, number>();
      days.forEach((d: any) => {
        const dt = new Date(d.date);
        const mon = new Date(dt); mon.setDate(dt.getDate() - dt.getDay() + 1);
        const key = mon.toLocaleDateString("sv-SE").slice(5).replace("-", "/");
        map.set(key, (map.get(key) ?? 0) + d.count);
      });
      return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
    }
    const map = new Map<string, number>();
    days.forEach((d: any) => { const key = d.date.slice(0, 7); map.set(key, (map.get(key) ?? 0) + d.count); });
    return Array.from(map.entries()).map(([k, value]) => ({ label: k.slice(5), value }));
  }, [summary?.playsByDay, timeTab]);

  // Per-screen donut
  const screenDonut = useMemo(() => {
    const map = new Map<string, number>();
    (periodSummary?.items ?? []).forEach((i: any) => {
      const name = i.screenName ?? "Sem nome";
      map.set(name, (map.get(name) ?? 0) + (i.totalSeconds ?? 0));
    });
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, secs]) => ({ name, value: secs, pct: Math.round((secs / total) * 1000) / 10, label: fmtDuration(secs) }));
  }, [periodSummary?.items]);

  // Status donut
  const statusDonut = useMemo(() => [
    { name: "Online",  value: onlineCount,  color: "#10b981" },
    { name: "Offline", value: offlineCount, color: "#ef4444" },
    { name: "Alerta",  value: alertCount,   color: "#f59e0b" },
  ].filter(d => d.value > 0), [onlineCount, offlineCount, alertCount]);

  // Top 5 content
  const sortedItems = useMemo(() => {
    const items = [...(periodSummary?.items ?? [])] as any[];
    items.sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0));
    return items;
  }, [periodSummary?.items]);

  const top5 = sortedItems.slice(0, 5);
  const maxPlays = top5[0]?.playCount ?? 1;

  // Availability bar chart (per day from playsByDay)
  const availData = useMemo(() => {
    const days = (summary?.playsByDay ?? []) as any[];
    const total = onlineCount + offlineCount + alertCount;
    return days.slice(-7).map((d: any) => ({
      label: d.date.slice(5).replace("-", "/"),
      online: onlinePct,
      offline: total > 0 ? Math.round((offlineCount / (total || 1)) * 100) : 0,
    }));
  }, [summary?.playsByDay, onlinePct, offlineCount, onlineCount, alertCount]);

  // Alert types from screens
  const alertTypes = useMemo(() => {
    const offline = offlineCount;
    const never   = alertCount;
    const rows = [];
    if (offline > 0) rows.push({ tipo: "Dispositivo Offline", qty: offline, pct: totalScreens > 0 ? Math.round((offline / totalScreens) * 100) : 0, var: null });
    if (never > 0)   rows.push({ tipo: "Sem conexão registrada", qty: never, pct: totalScreens > 0 ? Math.round((never / totalScreens) * 100) : 0, var: null });
    return rows;
  }, [offlineCount, alertCount, totalScreens]);

  // Overview sort
  const sortedOverviewItems = useMemo(() => {
    const items = [...(periodSummary?.items ?? [])] as any[];
    const { key, dir } = overviewSort;
    items.sort((a, b) => {
      const av = a[key] ?? ""; const bv = b[key] ?? "";
      const cmp = typeof av === "string" ? av.localeCompare(bv) : (av as number) - (bv as number);
      return dir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [periodSummary?.items, overviewSort]);

  const toggleSort = (key: OverviewSortKey) =>
    setOverviewSort(prev => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));

  // ── Media name filter ─────────────────────────────────────────────────────
  const uniqueMediaNames = useMemo(() => {
    const names = new Set<string>();
    (periodSummary?.items ?? []).forEach((i: any) => { if (i.mediaName) names.add(i.mediaName); });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [periodSummary?.items]);

  const filteredOverviewItems = useMemo(() => {
    if (mediaNameFilter === "all") return sortedOverviewItems;
    return sortedOverviewItems.filter((i: any) => i.mediaName === mediaNameFilter);
  }, [sortedOverviewItems, mediaNameFilter]);

  const filteredDetailedItems = useMemo(() => {
    if (!detailed?.items) return [] as any[];
    if (mediaNameFilter === "all") return detailed.items as any[];
    return (detailed.items as any[]).filter(i => i.mediaName === mediaNameFilter);
  }, [detailed?.items, mediaNameFilter]);

  const filteredTotalPlays = useMemo(() =>
    filteredOverviewItems.reduce((a: number, i: any) => a + (i.playCount ?? 0), 0),
  [filteredOverviewItems]);

  const totalHoursDisplay = fmtHoursMin(totalSeconds);

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">

      <PageHeader
        icon={TrendingUp}
        title="Relatórios"
        description="Acompanhe o desempenho e o uso das suas telas e dispositivos."
      />

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick presets */}
          <span className="text-xs text-muted-foreground font-medium mr-1">Período:</span>
          {([
            { label: "Hoje",       fn: () => { setStartDate(todayBRT()); setEndDate(todayBRT()); } },
            { label: "7 dias",     fn: () => { setStartDate(sevenDaysAgoBRT()); setEndDate(todayBRT()); } },
            { label: "30 dias",    fn: () => {
                const d = new Date(); d.setDate(d.getDate() - 30);
                setStartDate(d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }));
                setEndDate(todayBRT());
              }
            },
            { label: "Este mês",   fn: () => {
                const now = new Date();
                const first = new Date(now.getFullYear(), now.getMonth(), 1);
                setStartDate(first.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }));
                setEndDate(todayBRT());
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
            <Input type="date" className="h-6 border-none p-0 text-xs w-28 bg-transparent focus-visible:ring-0" value={endDate} min={startDate} max={todayBRT()} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Screen filter */}
          <div className="flex items-center gap-2 min-w-0">
            <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Aparelho:</span>
            <Select value={screenId} onValueChange={setScreenId}>
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue placeholder="Todas as telas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as telas</SelectItem>
                {(screens ?? []).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Campaign filter */}
          {(campaignsList ?? []).length > 0 && (
            <div className="flex items-center gap-2 min-w-0">
              <Megaphone className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Campanha:</span>
              <Select value={campaignGroupId} onValueChange={v => { setCampaignGroupId(v); setClientNameFilter("all"); }}>
                <SelectTrigger className="h-8 text-xs w-52">
                  <SelectValue placeholder="Todas as campanhas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as campanhas</SelectItem>
                  {(campaignsList ?? []).map((c: any) => (
                    <SelectItem key={c.campaignGroupId ?? c.name} value={c.campaignGroupId ?? c.name}>
                      {c.name}{c.clientName ? ` — ${c.clientName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {campaignGroupId !== "all" && (
                <button onClick={() => setCampaignGroupId("all")} className="text-muted-foreground hover:text-foreground transition-colors" title="Limpar">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          {/* Client filter */}
          {(clientsList ?? []).length > 0 && (
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Cliente:</span>
              <Select value={clientNameFilter} onValueChange={v => { setClientNameFilter(v); setCampaignGroupId("all"); }}>
                <SelectTrigger className="h-8 text-xs w-40">
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {(clientsList ?? []).map((c: string) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clientNameFilter !== "all" && (
                <button onClick={() => setClientNameFilter("all")} className="text-muted-foreground hover:text-foreground transition-colors" title="Limpar">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          {/* Media filter */}
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Mídia:</span>
            <Select value={mediaNameFilter} onValueChange={setMediaNameFilter}>
              <SelectTrigger className="h-8 text-xs w-52">
                <SelectValue placeholder="Todas as mídias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as mídias</SelectItem>
                {uniqueMediaNames.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mediaNameFilter !== "all" && (
              <button
                onClick={() => setMediaNameFilter("all")}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Limpar filtro de mídia"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex-1" />
          <Button
            size="sm"
            className="h-8 gap-2 text-xs"
            onClick={() => {
              exportOverviewCsv(filteredOverviewItems, selectedScreenName, startDate, endDate);
            }}
          >
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* ── KPI bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Tempo Total */}
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Tempo Total de Exibição</p>
            {loadingPeriod ? <Skeleton className="h-8 w-28 mt-1" /> : (
              <p className="text-2xl font-black tabular-nums leading-tight">{totalHoursDisplay.label}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">no período selecionado</p>
          </div>
        </div>

        {/* Conteúdos */}
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
            <PlayCircle className="w-6 h-6 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Conteúdos Exibidos</p>
            {loadingPeriod ? <Skeleton className="h-8 w-20 mt-1" /> : (
              <p className="text-2xl font-black tabular-nums">{totalPlays.toLocaleString("pt-BR")}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">{sortedItems.length} mídias distintas</p>
          </div>
        </div>

        {/* Playlists */}
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <ListVideo className="w-6 h-6 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Playlists Cadastradas</p>
            <p className="text-2xl font-black tabular-nums">{totalPlaylists}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{totalMedia} mídias na biblioteca</p>
          </div>
        </div>

        {/* Dispositivos Online */}
        <div className={cn("border rounded-xl p-4 flex items-center gap-3", onlineCount > 0 ? "bg-emerald-500/8 border-emerald-500/20" : "bg-card")}>
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", onlineCount > 0 ? "bg-emerald-500/15" : "bg-muted")}>
            <Wifi className={cn("w-6 h-6", onlineCount > 0 ? "text-emerald-400" : "text-muted-foreground")} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Dispositivos Online</p>
            <p className={cn("text-2xl font-black tabular-nums", onlineCount > 0 ? "text-emerald-300" : "")}>{onlineCount}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{onlinePct}% do total ({totalScreens})</p>
          </div>
        </div>

        {/* Alertas */}
        <div className={cn("border rounded-xl p-4 flex items-center gap-3", (offlineCount + alertCount) > 0 ? "bg-amber-500/8 border-amber-500/20" : "bg-card")}>
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", (offlineCount + alertCount) > 0 ? "bg-amber-500/15" : "bg-muted")}>
            <AlertTriangle className={cn("w-6 h-6", (offlineCount + alertCount) > 0 ? "text-amber-400" : "text-muted-foreground")} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Dispositivos com Problema</p>
            <p className={cn("text-2xl font-black tabular-nums", (offlineCount + alertCount) > 0 ? "text-amber-300" : "")}>{offlineCount + alertCount}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{offlineCount} offline · {alertCount} nunca conectados</p>
          </div>
        </div>
      </div>

      {/* ── Row 1: Charts ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Line chart — Tempo de Exibição */}
        <Card className="lg:col-span-5">
          <CardHeader className="pb-2 flex-row items-start justify-between gap-2">
            <CardTitle className="text-base">Tempo de Exibição</CardTitle>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              {(["dia", "semana", "mes"] as TimeTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTimeTab(t)}
                  className={cn("px-2.5 py-1 text-[11px] font-medium rounded transition-colors capitalize",
                    timeTab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "dia" ? "Por dia" : t === "semana" ? "Por semana" : "Por mês"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {loadingSummary ? <Skeleton className="h-44 w-full" /> : (
              <ResponsiveContainer width="100%" height={176}>
                <AreaChart data={timeData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area dataKey="value" name="Exibições" stroke="hsl(var(--primary))" fill="url(#grad1)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Donut — por tela */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Exibições por Tela</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPeriod ? <Skeleton className="h-44 w-full" /> : screenDonut.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <PieChart width={120} height={120}>
                    <Pie data={screenDonut} cx={55} cy={55} innerRadius={36} outerRadius={55} dataKey="value" paddingAngle={2}>
                      {screenDonut.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[10px] text-muted-foreground leading-none">Total</p>
                    <p className="text-lg font-black">{fmtDuration(totalSeconds)}</p>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {screenDonut.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        <span className="truncate text-muted-foreground">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground">{d.label}</span>
                        <span className="font-bold w-10 text-right">{d.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column: Status donut + top playlists */}
        <div className="lg:col-span-3 space-y-4">
          {/* Status dos dispositivos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Status dos Dispositivos</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <PieChart width={90} height={90}>
                    <Pie data={statusDonut.length > 0 ? statusDonut : [{ name: "Sem dados", value: 1, color: "#334155" }]}
                      cx={40} cy={40} innerRadius={26} outerRadius={42} dataKey="value" paddingAngle={2}>
                      {(statusDonut.length > 0 ? statusDonut : [{ color: "#334155" }]).map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[8px] text-muted-foreground">Total</p>
                    <p className="text-sm font-black">{totalScreens}</p>
                  </div>
                </div>
                <div className="space-y-1 flex-1">
                  {[
                    { label: "Online",  value: onlineCount,  color: "#10b981" },
                    { label: "Offline", value: offlineCount, color: "#ef4444" },
                    { label: "Alerta",  value: alertCount,   color: "#f59e0b" },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                        <span className="text-muted-foreground">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span>{s.value}</span>
                        <span className="text-muted-foreground font-normal text-[10px]">
                          ({totalScreens > 0 ? Math.round((s.value / totalScreens) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Playlists/Mídias */}
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top 5 Conteúdos</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {loadingPeriod ? [1,2,3,4,5].map(i => <Skeleton key={i} className="h-7" />) : top5.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Sem dados no período</p>
              ) : top5.map((item: any, i: number) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-muted-foreground font-bold w-3">{i + 1}</span>
                      <span className="truncate font-medium">{item.mediaName}</span>
                    </div>
                    <span className="text-muted-foreground shrink-0 ml-2">{item.playCount} exib.</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.round((item.playCount / maxPlays) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Row 2: Content table + Availability ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Conteúdos Mais Exibidos */}
        <Card className="lg:col-span-5">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base">Conteúdos Mais Exibidos</CardTitle>
            <button onClick={() => setShowDetailed(true)} className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Ver todos os conteúdos <ChevronRight className="w-3 h-3" />
            </button>
          </CardHeader>
          <CardContent className="p-0">
            {loadingPeriod ? (
              <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10" />)}</div>
            ) : top5.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <PlayCircle className="w-8 h-8 opacity-20" />
                <p className="text-sm">Sem exibições no período</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-6">#</th>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Conteúdo</th>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Exibições</th>
                    <th className="px-4 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Tempo</th>
                  </tr>
                </thead>
                <tbody>
                  {top5.map((item: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs font-bold">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <span className="font-medium text-sm truncate max-w-[120px]">{item.mediaName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("text-[10px]", typeColor(item.mediaType ?? "image"))}>
                          {typeLabel(item.mediaType ?? "image")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-primary tabular-nums">{(item.playCount ?? 0).toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs hidden sm:table-cell">{fmtDuration(item.totalSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Relatório de Disponibilidade */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              Relatório de Disponibilidade
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Summary metrics */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Disponibilidade Média", value: `${onlinePct}%`, big: true },
                { label: "Dispositivos Online",   value: String(onlineCount) },
                { label: "Dispositivos Offline",  value: String(offlineCount) },
                { label: "Com Problemas",          value: String(alertCount) },
              ].map(m => (
                <div key={m.label} className={cn("rounded-xl p-3 bg-muted/30 border", m.big ? "col-span-2 bg-emerald-500/8 border-emerald-500/20" : "")}>
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  <p className={cn("font-black tabular-nums", m.big ? "text-2xl text-emerald-300" : "text-xl")}>{m.value}</p>
                </div>
              ))}
            </div>
            {/* Bar chart */}
            {availData.length > 0 && (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={availData} margin={{ top: 2, right: 2, left: -28, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v: any) => [`${v}%`]} />
                  <Bar dataKey="online" name="Online" fill="#10b981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <p className="text-[10px] text-muted-foreground text-center mt-2">Os dados são atualizados a cada 15 minutos.</p>
          </CardContent>
        </Card>

        {/* Relatório de Alertas */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base">Relatório de Alertas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo de Alerta</th>
                  <th className="px-4 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Qtd</th>
                  <th className="px-4 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">%</th>
                </tr>
              </thead>
              <tbody>
                {alertTypes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-1">
                        <Wifi className="w-6 h-6 text-emerald-400 opacity-50" />
                        <p>Sem alertas ativos</p>
                      </div>
                    </td>
                  </tr>
                ) : alertTypes.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/10">
                    <td className="px-4 py-2.5 font-medium">{row.tipo}</td>
                    <td className="px-4 py-2.5 text-center font-bold">{row.qty}</td>
                    <td className="px-4 py-2.5 text-center text-muted-foreground">{row.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {alertTypes.length > 0 && (
              <div className="px-4 py-2 border-t">
                <button className="text-xs text-primary hover:underline flex items-center gap-0.5">
                  Ver todas as alertas <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Por Player ─────────────────────────────────────────────────── */}
      <Card>
        <button
          onClick={() => setShowByPlayer(!showByPlayer)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-primary" />
            <span className="font-semibold">Exibições por Player</span>
            <span className="ml-2 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-primary/15 text-primary border border-primary/25">
              {byPlayerData ? `${byPlayerData.length} tela${byPlayerData.length !== 1 ? "s" : ""}` : "Ver relatório"}
            </span>
          </div>
          {showByPlayer ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {showByPlayer && (
          <div className="border-t">
            {loadingByPlayer ? (
              <div className="p-4 space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10" />)}</div>
            ) : !byPlayerData || byPlayerData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <Monitor className="w-8 h-8 opacity-20" />
                <p className="text-sm">Nenhuma exibição registrada no período selecionado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                      <th className="px-4 py-3 text-left font-semibold">Tela</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Exibições</th>
                      <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Tempo Total</th>
                      <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Mídias</th>
                      <th className="px-4 py-3 text-left font-semibold">Top Conteúdos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {byPlayerData.map((row) => (
                      <tr key={row.screenId} className="hover:bg-accent/20 transition-colors">
                        <td className="px-4 py-3 font-medium">{row.screenName}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                            row.status === "online" ? "bg-emerald-100 text-emerald-700" :
                            row.status === "offline" ? "bg-red-100 text-red-700" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {row.status === "online" ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                            {row.status === "online" ? "Online" : row.status === "offline" ? "Offline" : "Sem dados"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-primary tabular-nums">{row.totalPlays.toLocaleString("pt-BR")}</td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums">{fmtDuration(row.totalSeconds)}</td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums">{row.distinctMedia}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {row.topContent.map((c, i) => (
                              <span key={i} className={cn("text-[10px] px-1.5 py-0.5 rounded border truncate max-w-[140px]", typeColor(c.mediaType))}>
                                {c.mediaName} <span className="font-bold">×{c.playCount}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2.5 border-t bg-muted/10 text-xs text-muted-foreground">
                  {byPlayerData.length} tela(s) · {byPlayerData.reduce((a, r) => a + r.totalPlays, 0).toLocaleString("pt-BR")} exibições totais no período
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Ativação dos Players ─────────────────────────────────────────── */}
      <Card>
        <button
          onClick={() => setShowActivation(!showActivation)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-primary" />
            <span className="font-semibold">Ativação dos Players</span>
            <span className="ml-2 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-primary/15 text-primary border border-primary/25">
              {activationData ? `${activationData.length} tela${activationData.length !== 1 ? "s" : ""}` : "Ver relatório"}
            </span>
          </div>
          {showActivation ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {showActivation && (
          <div className="border-t">
            {loadingActivation ? (
              <div className="p-4 space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10" />)}</div>
            ) : !activationData || activationData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <WifiOff className="w-8 h-8 opacity-20" />
                <p className="text-sm">Nenhuma tela encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                      <th className="px-4 py-3 text-left font-semibold">Tela</th>
                      <th className="px-4 py-3 text-left font-semibold">Status atual</th>
                      <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Uptime %</th>
                      <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Online</th>
                      <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Offline</th>
                      <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Conexões</th>
                      <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Última vez visto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activationData.map((row) => (
                      <tr key={row.screenId} className="hover:bg-accent/20 transition-colors">
                        <td className="px-4 py-3 font-medium">{row.screenName}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                            row.status === "online" ? "bg-emerald-100 text-emerald-700" :
                            row.status === "offline" ? "bg-red-100 text-red-700" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {row.status === "online" ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                            {row.status === "online" ? "Online" : row.status === "offline" ? "Offline" : "Sem dados"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-20 h-2 rounded-full bg-border overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", row.uptimePct >= 80 ? "bg-emerald-500" : row.uptimePct >= 50 ? "bg-amber-500" : "bg-red-500")}
                                style={{ width: `${Math.min(100, row.uptimePct)}%` }}
                              />
                            </div>
                            <span className={cn("text-xs font-bold tabular-nums w-10 text-right", row.uptimePct >= 80 ? "text-emerald-600" : row.uptimePct >= 50 ? "text-amber-600" : "text-red-600")}>
                              {row.uptimePct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-emerald-600 font-semibold tabular-nums">{fmtUptime(row.onlineSeconds)}</td>
                        <td className="px-4 py-3 text-right text-xs text-red-500 tabular-nums">{fmtUptime(row.offlineSeconds)}</td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums">{row.connectionCount}</td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums whitespace-nowrap">{fmtLastSeen(row.lastSeen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2.5 border-t bg-muted/10 text-xs text-muted-foreground flex items-center justify-between">
                  <span>{activationData.length} tela(s)</span>
                  <span>Uptime médio: {activationData.length > 0 ? (activationData.reduce((a, r) => a + r.uptimePct, 0) / activationData.length).toFixed(1) : 0}%</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Detailed report (expandable) ────────────────────────────────── */}
      <Card>
        <button
          onClick={() => setShowDetailed(!showDetailed)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="font-semibold">Relatório Detalhado por Período</span>
            <span className="ml-2 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-primary/15 text-primary border border-primary/25">
              {filteredOverviewItems.length} mídias · {filteredTotalPlays.toLocaleString("pt-BR")} exibições
            </span>
            {mediaNameFilter !== "all" && (
              <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20 gap-1">
                Filtrado: {mediaNameFilter}
              </Badge>
            )}
          </div>
          {showDetailed ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {showDetailed && (
          <div className="border-t">
            {/* Controls */}
            <div className="flex items-center gap-3 px-5 py-3 flex-wrap bg-muted/10">
              <div className="flex items-center gap-2">
                {(["overview", "details"] as Tab[]).map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer select-none">
                    <div onClick={() => setTab(t)} className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer", tab === t ? "border-primary" : "border-muted-foreground/40")}>
                      {tab === t && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <span className="text-sm" onClick={() => setTab(t)}>{t === "overview" ? "Overview" : "Detalhado"}</span>
                  </label>
                ))}
              </div>
              <div className="flex-1" />
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                onClick={() => {
                  if (tab === "overview") exportOverviewCsv(filteredOverviewItems, selectedScreenName, startDate, endDate);
                  else exportDetailedCsv(filteredDetailedItems, selectedScreenName, startDate, endDate);
                }}
              ><Download className="w-3.5 h-3.5" /> CSV</Button>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                onClick={() => {
                  if (tab === "overview") printOverviewReport(filteredOverviewItems, selectedScreenName, startDate, endDate);
                  else printDetailedReport(filteredDetailedItems, selectedScreenName, startDate, endDate);
                }}
                disabled={tab === "overview" ? filteredOverviewItems.length === 0 : filteredDetailedItems.length === 0}
              ><Printer className="w-3.5 h-3.5" /> Imprimir</Button>
            </div>

            {/* Table */}
            {tab === "overview" ? (
              <div className="overflow-x-auto">
                {loadingPeriod ? (
                  <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8" />)}</div>
                ) : filteredOverviewItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <PlayCircle className="w-8 h-8 opacity-20" />
                    <p className="text-sm">{mediaNameFilter !== "all" ? `Nenhuma exibição de "${mediaNameFilter}" no período` : "Nenhuma exibição no período selecionado"}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                        {([
                          { label: "Nome da Mídia",     key: "mediaName" as OverviewSortKey },
                          { label: "Tela",              key: null },
                          { label: "Primeira Exibição", key: "firstPlayedAt" as OverviewSortKey },
                          { label: "Última Exibição",   key: "lastPlayedAt" as OverviewSortKey },
                          { label: "Duração Total (s)", key: "totalSeconds" as OverviewSortKey },
                          { label: "Exibições",         key: "playCount" as OverviewSortKey },
                          { label: "Dias",              key: "distinctDays" as OverviewSortKey },
                        ] as { label: string; key: OverviewSortKey | null }[]).map(({ label, key }) => (
                          <th key={label} className={cn("px-4 py-3 text-left font-semibold whitespace-nowrap", key ? "cursor-pointer hover:text-foreground select-none" : "")} onClick={() => key && toggleSort(key)}>
                            <span className="inline-flex items-center gap-1">
                              {label}
                              {key && (overviewSort.key === key ? (overviewSort.dir === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />) : <ChevronsUpDown className="w-3 h-3 opacity-30" />)}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredOverviewItems.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-accent/20 transition-colors">
                          <td className="px-4 py-2.5 font-medium max-w-[200px] truncate">{item.mediaName}</td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">{item.screenName ?? "—"}</td>
                          <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground whitespace-nowrap">{item.firstPlayedAt ? fmtTableDatetime(item.firstPlayedAt) : "—"}</td>
                          <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground whitespace-nowrap">{item.lastPlayedAt ? fmtTableDatetime(item.lastPlayedAt) : "—"}</td>
                          <td className="px-4 py-2.5 tabular-nums text-xs">{(item.totalSeconds ?? 0).toLocaleString("pt-BR")}</td>
                          <td className="px-4 py-2.5 tabular-nums font-semibold text-primary">{(item.playCount ?? 0).toLocaleString("pt-BR")}</td>
                          <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground">{item.distinctDays ?? 1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
                <div className="px-4 py-2.5 border-t bg-muted/10 text-xs text-muted-foreground flex items-center justify-between">
                  <span>{filteredOverviewItems.length} item(s) · {filteredTotalPlays.toLocaleString("pt-BR")} exibições{mediaNameFilter !== "all" ? " (filtrado)" : " totais"}</span>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {loadingDetailed ? (
                  <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8" />)}</div>
                ) : filteredDetailedItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <PlayCircle className="w-8 h-8 opacity-20" />
                    <p className="text-sm">{mediaNameFilter !== "all" ? `Nenhuma exibição de "${mediaNameFilter}" no período` : "Nenhuma exibição no período selecionado"}</p>
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
                        {filteredDetailedItems.map((item: any) => (
                          <tr key={item.id} className="hover:bg-accent/20 transition-colors">
                            <td className="px-4 py-2.5 font-medium max-w-[200px] truncate">{item.mediaName}</td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">{item.screenName}</td>
                            <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground whitespace-nowrap">{fmtTableDatetime(item.playedAt)}</td>
                            <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground whitespace-nowrap">{fmtTableDatetime(addSeconds(item.playedAt, item.durationSeconds))}</td>
                            <td className="px-4 py-2.5 tabular-nums text-xs">{item.durationSeconds ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                    <div className="px-4 py-2.5 border-t bg-muted/10 text-xs text-muted-foreground">
                      Mostrando {filteredDetailedItems.length.toLocaleString("pt-BR")}
                      {mediaNameFilter === "all" ? ` de ${(detailed?.total ?? 0).toLocaleString("pt-BR")} registros` : ` registro(s) (filtrado por mídia)`}
                      {mediaNameFilter === "all" && (detailed?.total ?? 0) > 500 && " · Exporte o CSV para ver todos"}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
