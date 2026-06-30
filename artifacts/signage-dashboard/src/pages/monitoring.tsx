import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wifi, WifiOff, Clock, Monitor, MapPin, Loader2, RefreshCw, Image as ImageIcon, X, Play } from "lucide-react";
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
  lastPlay: LastPlay | null;
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

function mediaTypeLabel(type: string): string {
  const map: Record<string, string> = {
    image: "Imagem", video: "Vídeo", rss: "RSS", clock: "Relógio",
    weather: "Clima", web_channel: "Web",
  };
  return map[type] ?? type;
}

function StatusBadge({ status }: { status: ScreenMonitor["status"] }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide",
      status === "online" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
        : status === "offline" ? "bg-red-500/15 text-red-400 border-red-500/25"
          : "bg-white/5 text-white/30 border-white/10"
    )}>
      <span className={cn(
        "w-1.5 h-1.5 rounded-full",
        status === "online" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse"
          : status === "offline" ? "bg-red-400"
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0e1018] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-3">
            <StatusBadge status={screen.status} />
            <h3 className="text-sm font-bold text-white">{screen.name}</h3>
            {screen.location && <span className="text-xs text-white/40">{screen.location}</span>}
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
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
              {screen.resolution && <span>📐 {screen.resolution}</span>}
              <span>🕐 Último contato: {timeAgo(screen.lastSeen)}</span>
              {screen.code && <span>🔑 {screen.code}</span>}
            </div>
          </div>

          {/* Play log */}
          <div className="p-4">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Histórico de Exibição (últimos 50)</p>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-white/30" />
              </div>
            ) : !plays?.length ? (
              <p className="text-center text-white/20 text-xs py-6">Nenhuma exibição registrada.</p>
            ) : (
              <div className="space-y-1">
                {plays.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/2 hover:bg-white/4 transition-colors">
                    <Play className="w-3 h-3 text-white/20 flex-shrink-0" />
                    <span className="text-sm text-white flex-1 truncate">{p.mediaName}</span>
                    <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{mediaTypeLabel(p.mediaType)}</span>
                    {p.durationSeconds && <span className="text-[10px] text-white/30 font-mono">{p.durationSeconds}s</span>}
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
      {/* Screenshot area — 16:9 */}
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
        {/* Status overlay badge */}
        <div className="absolute top-2 left-2">
          <StatusBadge status={screen.status} />
        </div>
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="text-[11px] font-bold text-white bg-black/60 px-3 py-1.5 rounded-full border border-white/20">
            Ver detalhes
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-white leading-tight truncate">{screen.name}</h3>
          {screen.resolution && (
            <span className="text-[9px] font-mono text-white/30 flex-shrink-0 mt-0.5">{screen.resolution}</span>
          )}
        </div>

        {screen.location && (
          <div className="flex items-center gap-1 text-[10px] text-white/40">
            <MapPin className="w-2.5 h-2.5" />
            <span className="truncate">{screen.location}</span>
          </div>
        )}

        {screen.lastPlay && (
          <div className="flex items-center gap-1.5 text-[10px] text-white/50 truncate">
            <Play className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">{screen.lastPlay.mediaName}</span>
            <span className="text-white/25 flex-shrink-0">·</span>
            <span className="text-white/25 flex-shrink-0 font-mono">{timeAgo(screen.lastPlay.playedAt)}</span>
          </div>
        )}

        <div className="flex items-center gap-1 text-[10px] text-white/25 font-mono">
          <Clock className="w-2.5 h-2.5" />
          {timeAgo(screen.lastSeen)}
        </div>
      </div>
    </button>
  );
}

export default function MonitoringPage() {
  const [selected, setSelected] = useState<ScreenMonitor | null>(null);
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");

  const { data: screens = [], isLoading, dataUpdatedAt, refetch, isRefetching } = useQuery<ScreenMonitor[]>({
    queryKey: ["monitoring"],
    queryFn: () => apiFetch("/monitoring"),
    refetchInterval: 30_000,
  });

  const filtered = screens.filter((s) =>
    filter === "all" ? true : filter === "online" ? s.status === "online" : s.status !== "online"
  );

  const onlineCount = screens.filter((s) => s.status === "online").length;
  const offlineCount = screens.filter((s) => s.status === "offline").length;
  const neverCount = screens.filter((s) => s.status === "never").length;

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

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

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Online", count: onlineCount, color: "text-emerald-400", bg: "bg-emerald-500/8 border-emerald-500/15", filter: "online" as const },
          { label: "Offline", count: offlineCount, color: "text-red-400", bg: "bg-red-500/8 border-red-500/15", filter: "offline" as const },
          { label: "Nunca vistos", count: neverCount, color: "text-white/30", bg: "bg-white/3 border-white/8", filter: "offline" as const },
        ].map((item) => (
          <div key={item.label} className={cn("rounded-xl border p-4 text-center", item.bg)}>
            <p className={cn("text-2xl font-extrabold", item.color)}>{item.count}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

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

      {/* Auto-refresh notice */}
      <p className="text-center text-[10px] text-white/20 font-mono">
        Atualização automática a cada 30 segundos · Telas offline após 2 min sem sinal
      </p>

      {/* Detail modal */}
      {selected && <PlaysModal screen={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
