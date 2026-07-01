import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wifi, WifiOff, Clock, Monitor, MapPin, Loader2, RefreshCw,
  X, Play, BarChart2, Timer, Tv2, TrendingUp, Radio, Film,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LastPlay {
  mediaName: string;
  mediaType: string;
  playedAt: string;
}

interface ScreenMonitor {
  id: number;
  name: string;
  code: string;
  location: string | null;
  status: "online" | "offline" | "never";
  lastSeen: string | null;
  resolution: string | null;
  lastScreenshot: string | null;
  playsToday: number;
  durationTodaySec: number;
  lastPlay: LastPlay | null;
}

interface Summary {
  totalScreens: number;
  onlineCount: number;
  offlineCount: number;
  neverCount: number;
  totalPlaysToday: number;
  totalDurationTodayMin: number;
  topMedia: string | null;
  topMediaCount: number;
}

interface MonitoringResponse {
  screens: ScreenMonitor[];
  summary: Summary;
}

interface PlayEntry {
  id: number;
  mediaName: string;
  mediaType: string;
  durationSeconds: number | null;
  playedAt: string;
}

async function apiFetch(path: string) {
  const res = await fetch(`/api${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function resolveScreenshotUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/objects/")) return `/api/storage${path}`;
  return path;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

function mediaTypeLabel(type: string): string {
  const map: Record<string, string> = {
    image: "Imagem", video: "Vídeo", rss: "RSS", clock: "Relógio",
    weather: "Clima", web_channel: "Web", youtube: "YouTube",
    instagram: "Instagram", facebook: "Facebook",
  };
  return map[type] ?? type;
}

function mediaTypeIcon(type: string) {
  if (type === "video" || type === "youtube") return <Film className="w-2.5 h-2.5" />;
  if (type === "rss") return <Radio className="w-2.5 h-2.5" />;
  return <Play className="w-2.5 h-2.5" />;
}

function StatusBadge({ status }: { status: ScreenMonitor["status"] }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide",
      status === "online"
        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
        : status === "offline"
          ? "bg-red-500/15 text-red-400 border-red-500/25"
          : "bg-white/5 text-white/30 border-white/10"
    )}>
      <span className={cn(
        "w-1.5 h-1.5 rounded-full",
        status === "online"
          ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse"
          : status === "offline"
            ? "bg-red-400"
            : "bg-white/20"
      )} />
      {status === "online" ? "Online" : status === "offline" ? "Offline" : "Nunca visto"}
    </span>
  );
}

function ScreenshotPlaceholder({ name }: { name: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-white/3">
      <Monitor className="w-8 h-8 text-white/15" />
      <span className="text-[10px] text-white/20 font-mono">Sem preview</span>
    </div>
  );
}

function PlaysModal({ screen, onClose }: { screen: ScreenMonitor; onClose: () => void }) {
  const { data: plays, isLoading } = useQuery<PlayEntry[]>({
    queryKey: ["monitoring-plays", screen.id],
    queryFn: () => apiFetch(`/monitoring/${screen.id}/plays`),
  });

  const imgUrl = resolveScreenshotUrl(screen.lastScreenshot);
  const onlineRatio = screen.status === "online" ? 100 : screen.lastPlay ? 60 : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0e1018] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <StatusBadge status={screen.status} />
            <h3 className="text-sm font-bold text-white truncate">{screen.name}</h3>
            {screen.location && (
              <span className="flex items-center gap-1 text-xs text-white/40">
                <MapPin className="w-3 h-3" />{screen.location}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors flex-shrink-0 ml-3">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* KPIs row */}
          <div className="grid grid-cols-4 gap-px bg-white/5 border-b border-white/8">
            {[
              { label: "Código", value: screen.code ?? "—", icon: <Tv2 className="w-3 h-3" /> },
              { label: "Resolução", value: screen.resolution ? screen.resolution.replace(/(\d+\.\d+)/g, (n) => String(Math.round(Number(n)))) : "—", icon: <Monitor className="w-3 h-3" /> },
              { label: "Exibições hoje", value: String(screen.playsToday), icon: <BarChart2 className="w-3 h-3" /> },
              { label: "Tempo ativo hoje", value: screen.durationTodaySec > 0 ? formatDuration(screen.durationTodaySec) : "—", icon: <Timer className="w-3 h-3" /> },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-[#0e1018] px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1 text-white/30 mb-1">{kpi.icon}<span className="text-[9px] uppercase tracking-wider">{kpi.label}</span></div>
                <p className="text-sm font-bold text-white font-mono">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Screenshot */}
          <div className="p-4 border-b border-white/5">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Preview da Tela</p>
            <div className="aspect-video rounded-lg overflow-hidden bg-black/40 border border-white/8">
              {imgUrl ? (
                <img src={imgUrl} alt="preview" className="w-full h-full object-contain" />
              ) : (
                <ScreenshotPlaceholder name={screen.name} />
              )}
            </div>
            <div className="flex gap-4 mt-2 text-[10px] text-white/30 font-mono">
              <span>🕐 Último contato: {timeAgo(screen.lastSeen)}</span>
              {screen.lastPlay && <span>▶ Última mídia: {timeAgo(screen.lastPlay.playedAt)}</span>}
            </div>
          </div>

          {/* Last play highlight */}
          {screen.lastPlay && (
            <div className="px-4 pt-3 pb-0">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Exibindo / Última mídia</p>
              <div className="flex items-center gap-3 bg-white/4 border border-white/8 rounded-lg px-3 py-2.5">
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", screen.status === "online" ? "bg-emerald-400 animate-pulse" : "bg-white/20")} />
                <span className="text-sm text-white font-medium flex-1 truncate">{screen.lastPlay.mediaName}</span>
                <span className="text-[10px] bg-white/8 text-white/50 px-2 py-0.5 rounded">{mediaTypeLabel(screen.lastPlay.mediaType)}</span>
                <span className="text-[10px] text-white/30 font-mono flex-shrink-0">{timeAgo(screen.lastPlay.playedAt)}</span>
              </div>
            </div>
          )}

          {/* Play log */}
          <div className="p-4">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">
              Histórico de Exibição (últimos 50)
            </p>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-white/30" />
              </div>
            ) : !plays?.length ? (
              <p className="text-center text-white/20 text-xs py-6">Nenhuma exibição registrada.</p>
            ) : (
              <div className="space-y-1">
                {plays.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/2 hover:bg-white/4 transition-colors"
                  >
                    {mediaTypeIcon(p.mediaType)}
                    <span className="text-sm text-white flex-1 truncate">{p.mediaName}</span>
                    <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{mediaTypeLabel(p.mediaType)}</span>
                    {p.durationSeconds != null && (
                      <span className="text-[10px] text-white/30 font-mono">{p.durationSeconds}s</span>
                    )}
                    <span className="text-[10px] text-white/25 font-mono flex-shrink-0">{timeAgo(p.playedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScreenCard({ screen, onClick }: { screen: ScreenMonitor; onClick: () => void }) {
  const imgUrl = resolveScreenshotUrl(screen.lastScreenshot);

  return (
    <button
      onClick={onClick}
      className="group text-left bg-[#0e1018] border border-white/8 rounded-xl overflow-hidden hover:border-white/20 hover:shadow-xl hover:shadow-black/40 transition-all"
    >
      {/* Screenshot — 16:9 */}
      <div className="relative aspect-video bg-black/40 overflow-hidden">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={screen.name}
            className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <ScreenshotPlaceholder name={screen.name} />
        )}
        <div className="absolute top-2 left-2">
          <StatusBadge status={screen.status} />
        </div>
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="text-[11px] font-bold text-white bg-black/60 px-3 py-1.5 rounded-full border border-white/20">
            Ver detalhes
          </span>
        </div>
        {/* Plays today badge */}
        {screen.playsToday > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm text-[10px] font-bold text-white px-2 py-0.5 rounded-full border border-white/10">
            <BarChart2 className="w-2.5 h-2.5 text-blue-400" />
            {screen.playsToday} hoje
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        {/* Name + resolution */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-white leading-tight truncate">{screen.name}</h3>
          {screen.resolution && (
            <span className="text-[9px] font-mono text-white/30 flex-shrink-0 mt-0.5 bg-white/5 px-1.5 py-0.5 rounded">
              {screen.resolution.replace(/(\d+\.\d+)/g, (n) => String(Math.round(Number(n))))}
            </span>
          )}
        </div>

        {/* Location */}
        {screen.location && (
          <div className="flex items-center gap-1 text-[10px] text-white/40">
            <MapPin className="w-2.5 h-2.5" />
            <span className="truncate">{screen.location}</span>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-1">
          <div className="flex items-center gap-1.5 bg-white/3 rounded px-2 py-1">
            <BarChart2 className="w-3 h-3 text-blue-400/70 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] text-white/30 leading-none">Exibições hoje</p>
              <p className="text-[11px] font-bold text-white font-mono leading-tight">{screen.playsToday}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-white/3 rounded px-2 py-1">
            <Timer className="w-3 h-3 text-violet-400/70 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] text-white/30 leading-none">Tempo ativo</p>
              <p className="text-[11px] font-bold text-white font-mono leading-tight">
                {screen.durationTodaySec > 0 ? formatDuration(screen.durationTodaySec) : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Last play */}
        {screen.lastPlay && (
          <div className="flex items-center gap-1.5 text-[10px] text-white/50 bg-white/2 rounded px-2 py-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", screen.status === "online" ? "bg-emerald-400 animate-pulse" : "bg-white/20")} />
            <span className="truncate flex-1">{screen.lastPlay.mediaName}</span>
            <span className="text-white/25 flex-shrink-0 font-mono">{timeAgo(screen.lastPlay.playedAt)}</span>
          </div>
        )}

        {/* Last seen */}
        <div className="flex items-center justify-between text-[9px] text-white/20 font-mono pt-0.5">
          <span className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            Último contato: {timeAgo(screen.lastSeen)}
          </span>
          {screen.code && <span className="text-white/15">{screen.code}</span>}
        </div>
      </div>
    </button>
  );
}

export default function MonitoringPage() {
  const [selected, setSelected] = useState<ScreenMonitor | null>(null);
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");

  const {
    data,
    isLoading,
    dataUpdatedAt,
    refetch,
    isRefetching,
  } = useQuery<MonitoringResponse>({
    queryKey: ["monitoring"],
    queryFn: () => apiFetch("/monitoring"),
    refetchInterval: 30_000,
  });

  const screens = data?.screens ?? [];
  const summary = data?.summary;

  const filtered = screens.filter((s) =>
    filter === "all" ? true : filter === "online" ? s.status === "online" : s.status !== "online"
  );

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  const onlinePct = summary && summary.totalScreens > 0
    ? Math.round((summary.onlineCount / summary.totalScreens) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/8 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter uppercase">Monitoramento</h1>
          <p className="text-muted-foreground font-mono text-xs mt-1 tracking-widest uppercase">Status em Tempo Real</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] font-mono text-white/25">Atualizado às {lastUpdated}</span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all"
          >
            <RefreshCw className={cn("w-3 h-3", isRefetching && "animate-spin")} />
            Atualizar
          </button>
        </div>
      </div>

      {/* KPI cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Online */}
          <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-xl p-4 text-center">
            <Wifi className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-emerald-400">{summary.onlineCount}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Online</p>
          </div>

          {/* Offline */}
          <div className="bg-red-500/8 border border-red-500/15 rounded-xl p-4 text-center">
            <WifiOff className="w-4 h-4 text-red-400 mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-red-400">{summary.offlineCount}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Offline</p>
          </div>

          {/* Disponibilidade */}
          <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-center">
            <TrendingUp className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-blue-400">{onlinePct}%</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Disponível</p>
          </div>

          {/* Exibições hoje */}
          <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-center">
            <BarChart2 className="w-4 h-4 text-violet-400 mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-white">{summary.totalPlaysToday.toLocaleString("pt-BR")}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Exibições hoje</p>
          </div>

          {/* Tempo total */}
          <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-center">
            <Timer className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-white">{summary.totalDurationTodayMin}<span className="text-sm font-normal text-white/40 ml-0.5">min</span></p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Minutos exibidos</p>
          </div>

          {/* Nunca vistos */}
          <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-center">
            <Monitor className="w-4 h-4 text-white/20 mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-white/30">{summary.neverCount}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Nunca vistos</p>
          </div>
        </div>
      )}

      {/* Top media banner */}
      {summary?.topMedia && summary.totalPlaysToday > 0 && (
        <div className="flex items-center gap-3 bg-white/3 border border-white/8 rounded-xl px-4 py-3">
          <div className="w-7 h-7 bg-violet-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Film className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Mídia mais exibida hoje</p>
            <p className="text-sm font-semibold text-white truncate">{summary.topMedia}</p>
          </div>
          <span className="flex-shrink-0 text-xs font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-full">
            {summary.topMediaCount}× exibições
          </span>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-white/8">
        {(["all", "online", "offline"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-2 text-xs font-semibold border-b-2 transition-all",
              filter === f
                ? "border-primary text-white"
                : "border-transparent text-white/40 hover:text-white/60"
            )}
          >
            {f === "all" ? "Todas" : f === "online" ? "Online" : "Offline / Nunca"}
            {f === "all" && screens.length > 0 && (
              <span className="ml-1.5 text-[9px] bg-white/10 px-1.5 py-0.5 rounded-full">{screens.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-white/30" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <Monitor className="w-10 h-10 text-white/10 mx-auto" />
          <p className="text-white/30 text-sm">Nenhuma tela encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((screen) => (
            <ScreenCard key={screen.id} screen={screen} onClick={() => setSelected(screen)} />
          ))}
        </div>
      )}

      {/* Footer notice */}
      <p className="text-center text-[10px] text-white/20 font-mono">
        Atualização automática a cada 30 segundos · Telas offline após 2 min sem sinal
      </p>

      {/* Detail modal */}
      {selected && <PlaysModal screen={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
