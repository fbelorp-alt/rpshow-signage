import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetPlaylist,
  useUpdatePlaylist,
  useListMedia,
  useAddPlaylistItem,
  useRemovePlaylistItem,
  useReorderPlaylistItems,
  useUpdatePlaylistItem,
  useListScreens,
  useUpdateScreen,
  useUpdateMedia,
  useCreateMedia,
  useCreateSchedule,
  getGetPlaylistQueryKey,
  getListMediaQueryKey,
  getListPlaylistsQueryKey,
  getListScreensQueryKey,
  getListSchedulesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft, Clock, Film, Image as ImageIcon, GripVertical, Trash2,
  Play, Search, Plus, Globe, Monitor, CloudSun, Rss as RssIcon,
  MonitorPlay, Pencil, ChevronLeft, ChevronRight,
  SlidersHorizontal, Save, X, CheckCircle2, Layers, CalendarDays, AppWindow,
  Youtube, Radio, Wifi, WifiOff, PlaySquare, Send, Type, Sun,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { VideoThumbnail } from "@/components/video-thumbnail";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CanvasEditor, parseCanvasData, serializeCanvasData, mediaToLayer,
  type CanvasData, type MediaItem as CanvasMediaItem,
} from "@/components/canvas-editor";
import { AppGallery } from "@/components/app-gallery";

// ─── BRT helpers ─────────────────────────────────────────────────────────────
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
function fromLocalDatetimeInput(local: string): string | undefined {
  if (!local) return undefined;
  const [datePart, timePart] = local.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour + 3, minute)).toISOString();
}
const DAYS_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ─── RSS properties inline editor ─────────────────────────────────────────────
function RssPropsPanel({ mediaId, currentUrl, currentMode, onSave }: {
  mediaId: number;
  currentUrl: string;
  currentMode: string;
  onSave: (url: string, mode: string) => void;
}) {
  const [url, setUrl] = useState(currentUrl);
  const [mode, setMode] = useState<"ticker" | "fullscreen">(currentMode === "fullscreen" ? "fullscreen" : "ticker");
  const changed = url !== currentUrl || mode !== currentMode;
  void mediaId;
  return (
    <div>
      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Feed RSS</p>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1">
          {(["ticker", "fullscreen"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={cn(
                "py-1.5 rounded text-[10px] font-bold border transition-all",
                mode === m
                  ? "bg-orange-500/20 border-orange-400/40 text-orange-300"
                  : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
              )}>
              {m === "ticker" ? "▬ Faixa" : "⬛ Tela cheia"}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-white/8 border border-white/15 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-orange-400/50"
        />
        {changed && (
          <button type="button" onClick={() => onSave(url, mode)}
            className="w-full py-1.5 rounded text-[10px] font-bold bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/40 text-orange-300 transition-all">
            Salvar alterações
          </button>
        )}
      </div>
    </div>
  );
}

// ─── URL / Name edit panel (YouTube, Pluto TV, Spotify, Web Channel) ─────────
function UrlPropsPanel({ mediaId, currentName, currentUrl, label, placeholder, onSave }: {
  mediaId: number;
  currentName: string;
  currentUrl: string;
  label: string;
  placeholder: string;
  onSave: (name: string, url: string) => void;
}) {
  const [name, setName] = useState(currentName);
  const [url, setUrl] = useState(currentUrl);
  void mediaId;
  const changed = name !== currentName || url !== currentUrl;
  return (
    <div>
      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">{label}</p>
      <div className="space-y-2">
        <div>
          <label className="text-[10px] text-white/40 mb-1 block">Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Record News"
            className="w-full bg-white/8 border border-white/15 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-blue-400/50"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/40 mb-1 block">Link</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-white/8 border border-white/15 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-blue-400/50 font-mono"
          />
        </div>
        {changed && (
          <button type="button" onClick={() => onSave(name, url)}
            className="w-full py-1.5 rounded text-[10px] font-bold bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 text-blue-300 transition-all">
            ✓ Salvar alterações
          </button>
        )}
      </div>
    </div>
  );
}

// ─── File metadata helpers ────────────────────────────────────────────────────
function parseFileMeta(metaJson?: string | null): { width?: number; height?: number; format?: string; fileSize?: number } | null {
  if (!metaJson) return null;
  try { return JSON.parse(metaJson); } catch { return null; }
}
function mimeToLabel(mime: string): string {
  const map: Record<string, string> = {
    "video/mp4": "MP4", "video/quicktime": "MOV", "video/x-msvideo": "AVI",
    "video/webm": "WEBM", "video/3gpp": "3GP", "image/jpeg": "JPG",
    "image/png": "PNG", "image/gif": "GIF", "image/webp": "WEBP",
  };
  return map[mime] ?? mime.split("/")[1]?.toUpperCase() ?? "?";
}
function extFromSrc(url?: string | null, name?: string | null): string {
  const src = name ?? url ?? "";
  const ext = src.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    mp4: "MP4", mov: "MOV", avi: "AVI", webm: "WEBM", "3gp": "3GP",
    jpg: "JPG", jpeg: "JPG", png: "PNG", gif: "GIF", webp: "WEBP", bmp: "BMP",
  };
  return map[ext] ?? (ext.toUpperCase() || "?");
}
function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Type helpers ─────────────────────────────────────────────────────────────
function typeLabel(type?: string | null) {
  const map: Record<string, string> = {
    image: "Imagem", video: "Vídeo", web_channel: "Webpage",
    clock: "Relógio", weather: "Clima", rss: "RSS", weather_forecast: "Previsão",
  };
  return map[type ?? ""] ?? (type?.toUpperCase() ?? "—");
}
function typeColor(type?: string | null) {
  if (type === "video") return "bg-purple-500/20 text-purple-300 border-purple-500/30";
  if (type === "web_channel") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  if (type === "clock") return "bg-slate-400/20 text-slate-300 border-slate-500/30";
  if (type === "weather") return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
  if (type === "weather_forecast") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
  if (type === "rss") return "bg-orange-500/20 text-orange-300 border-orange-500/30";
  if (type === "text") return "bg-purple-500/20 text-purple-300 border-purple-500/30";
  return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
}
function formatDur(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return m > 0 ? `${m}m${sec ? ` ${sec}s` : ""}` : `${sec}s`;
}

function resolveUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/objects/")) return `/api/storage${url}`;
  return url;
}

// ─── Thumb ───────────────────────────────────────────────────────────────────
function ytVideoId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function Thumb({ url, type, className }: { url?: string | null; type?: string | null; className?: string }) {
  if (type === "video") {
    const resolved = resolveUrl(url);
    if (resolved) return <VideoThumbnail url={resolved} className={className} />;
    return (
      <div className={cn("bg-[#1a1025] flex items-center justify-center", className)}>
        <Film className="w-1/3 h-1/3 text-purple-400/70" />
      </div>
    );
  }
  if (type === "youtube" || type === "youtube_playlist") {
    const vid = ytVideoId(url);
    if (vid) return <img src={`https://img.youtube.com/vi/${vid}/hqdefault.jpg`} alt="" className={cn("object-cover", className)} loading="lazy" />;
    return (
      <div className={cn("bg-[#1a0000] flex flex-col items-center justify-center gap-1", className)}>
        <Youtube className="w-1/3 h-1/3 text-red-500" />
        <span className="text-[9px] font-bold text-red-400/80 uppercase tracking-wide">{type === "youtube_playlist" ? "Playlist" : "YouTube"}</span>
      </div>
    );
  }
  if (type === "pluto_tv") return (
    <div className={cn("bg-[#0d0a2a] flex flex-col items-center justify-center gap-1", className)}>
      <Radio className="w-1/3 h-1/3 text-violet-400" />
      <span className="text-[9px] font-bold text-violet-300/80 uppercase tracking-wide">Pluto TV</span>
    </div>
  );
  if (type === "canva") return (
    <div className={cn("bg-[#1a0d2e] flex flex-col items-center justify-center gap-1", className)}>
      <span className="text-2xl font-black text-purple-400">C</span>
      <span className="text-[9px] font-bold text-purple-300/80 uppercase tracking-wide">Canva</span>
    </div>
  );
  if (type === "google_slides") return (
    <div className={cn("bg-[#001a0a] flex flex-col items-center justify-center gap-1", className)}>
      <span className="text-2xl font-black text-yellow-400">G</span>
      <span className="text-[9px] font-bold text-yellow-300/80 uppercase tracking-wide">Slides</span>
    </div>
  );
  if (type === "spotify") return (
    <div className={cn("bg-[#001a00] flex flex-col items-center justify-center gap-1", className)}>
      <span className="text-2xl text-green-400">♫</span>
      <span className="text-[9px] font-bold text-green-300/80 uppercase tracking-wide">Spotify</span>
    </div>
  );
  if (type === "instagram") return (
    <div className={cn("flex flex-col items-center justify-center gap-1", className)} style={{ background: "linear-gradient(135deg,#3b0a45,#7b0d3a,#c13584 100%)" }}>
      <span className="text-xl font-black text-pink-200">Ig</span>
      <span className="text-[9px] font-bold text-pink-200/80 uppercase tracking-wide">Instagram</span>
    </div>
  );
  if (type === "tiktok") return (
    <div className={cn("bg-[#0a0a0a] flex flex-col items-center justify-center gap-1", className)}>
      <span className="text-xl font-black text-white">TT</span>
      <span className="text-[9px] font-bold text-white/60 uppercase tracking-wide">TikTok</span>
    </div>
  );
  if (type === "web_channel") return (
    <div className={cn("bg-[#0a1525] flex items-center justify-center", className)}>
      <Globe className="w-1/3 h-1/3 text-blue-400/70" />
    </div>
  );
  if (type === "clock") return (
    <div className={cn("bg-[#111] flex items-center justify-center", className)}>
      <Clock className="w-1/3 h-1/3 text-white/50" />
    </div>
  );
  if (type === "date") return (
    <div className={cn("bg-[#0a1020] flex flex-col items-center justify-center gap-1", className)}>
      <CalendarDays className="w-1/3 h-1/3 text-blue-300/80" />
      <span className="text-[9px] font-bold text-blue-200/60 uppercase tracking-wide">Data</span>
    </div>
  );
  if (type === "weather") return (
    <div className={cn("bg-[#061525] flex items-center justify-center", className)}>
      <CloudSun className="w-1/3 h-1/3 text-sky-400/70" />
    </div>
  );
  if (type === "weather_forecast") return (
    <div className={cn("bg-[#1a1000] flex items-center justify-center", className)}>
      <CalendarDays className="w-1/3 h-1/3 text-amber-400/70" />
    </div>
  );
  if (type === "rss") return (
    <div className={cn("bg-[#1a0c00] flex items-center justify-center", className)}>
      <RssIcon className="w-1/3 h-1/3 text-orange-400/70" />
    </div>
  );
  if (type === "qr_code") return (
    <div className={cn("bg-[#0a0a0a] flex flex-col items-center justify-center gap-1", className)}>
      <span className="text-2xl text-white/80">▦</span>
      <span className="text-[9px] font-bold text-white/40 uppercase tracking-wide">QR Code</span>
    </div>
  );
  if (type === "text") return (
    <div className={cn("bg-[#130d2e] flex flex-col items-center justify-center gap-1", className)}>
      <span className="text-2xl font-black text-purple-300">T</span>
      <span className="text-[9px] font-bold text-purple-300/60 uppercase tracking-wide">Texto</span>
    </div>
  );
  const src = resolveUrl(url);
  if (src) return <img src={src} alt="" className={cn("object-cover", className)} loading="lazy" />;
  return (
    <div className={cn("bg-[#111] flex items-center justify-center", className)}>
      <ImageIcon className="w-1/3 h-1/3 text-white/20" />
    </div>
  );
}

// ─── Preview center ───────────────────────────────────────────────────────────
function PreviewContent({ item }: { item: { mediaUrl?: string | null; mediaType?: string | null; mediaName?: string | null; durationSeconds: number } | null }) {
  if (!item) return (
    <div className="flex flex-col items-center justify-center gap-3 text-white/20 w-full h-full">
      <Monitor className="w-14 h-14" />
      <p className="text-sm">Selecione um slide</p>
    </div>
  );
  if (item.mediaType === "video") {
    const src = resolveUrl(item.mediaUrl);
    return src ? (
      <video key={src} src={src} className="w-full h-full object-contain" controls autoPlay muted loop />
    ) : (
      <div className="flex flex-col items-center gap-2 text-white/30"><Film className="w-16 h-16" /><span>Sem prévia</span></div>
    );
  }
  if (item.mediaType === "web_channel") return (
    <iframe src={item.mediaUrl ?? ""} className="w-full h-full" style={{ border: "none" }} allow="autoplay; fullscreen" title={item.mediaName ?? ""} />
  );
  if (item.mediaType === "youtube" || item.mediaType === "youtube_playlist") {
    const videoId = ytVideoId(item.mediaUrl);
    const thumbUrl = videoId
      ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      : null;
    const isPlaylist = item.mediaType === "youtube_playlist";
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
        {thumbUrl && (
          <img
            src={thumbUrl}
            alt={item.mediaName ?? "YouTube"}
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div className="relative flex flex-col items-center gap-4 z-10">
          <a
            href={item.mediaUrl ?? "https://youtube.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 shadow-2xl transition-colors"
          >
            <span className="text-4xl text-white ml-1">▶</span>
          </a>
          <div className="text-center px-4">
            <p className="text-white font-semibold text-base drop-shadow">{item.mediaName ?? "YouTube"}</p>
            <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded mt-1 inline-block">
              {isPlaylist ? "PLAYLIST" : "YOUTUBE"}
            </span>
          </div>
          <a
            href={item.mediaUrl ?? "https://youtube.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/60 hover:text-white underline underline-offset-2 transition-colors"
          >
            Abrir no YouTube ↗
          </a>
        </div>
      </div>
    );
  }
  if (item.mediaType === "pluto_tv") {
    return (
      <div className="flex flex-col items-center justify-center gap-5 w-full h-full bg-gradient-to-b from-[#00233a] to-[#001520] relative">
        <div className="absolute inset-0 opacity-5 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,white_2px,white_3px)]" />
        <div className="relative flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-[#00b4d8]/20 border border-[#00b4d8]/40 flex items-center justify-center">
            <span className="text-4xl font-bold text-[#00b4d8]">Pℓ</span>
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-lg">{item.mediaName ?? "Pluto TV"}</p>
            <p className="text-white/40 text-xs mt-1 max-w-[240px] truncate">{item.mediaUrl}</p>
          </div>
          <a
            href={item.mediaUrl ?? "https://pluto.tv"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#00b4d8] hover:bg-[#00c8f0] text-black font-bold text-sm transition-colors"
          >
            <span>▶</span> Abrir Canal
          </a>
          <p className="text-white/25 text-[10px]">Pluto TV bloqueia embed direto — abre em nova aba</p>
        </div>
      </div>
    );
  }
  if (item.mediaType === "spotify") {
    const rawUrl = item.mediaUrl ?? "";
    const embedSrc = rawUrl.replace("open.spotify.com/", "open.spotify.com/embed/").split("?")[0];
    return (
      <iframe
        key={embedSrc}
        src={embedSrc}
        className="w-full h-full"
        style={{ border: "none" }}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        title={item.mediaName ?? "Spotify"}
      />
    );
  }
  if (item.mediaType === "clock") return (
    <div className="flex flex-col items-center justify-center gap-3 text-white w-full h-full bg-black">
      <div className="text-7xl font-bold font-mono tracking-widest">
        {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" })}
      </div>
      <div className="text-2xl text-white/50 capitalize">
        {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" })}
      </div>
    </div>
  );
  if (item.mediaType === "weather") return (
    <div className="flex flex-col items-center justify-center gap-3 text-white w-full h-full bg-gradient-to-b from-sky-900 to-blue-950">
      <div className="text-8xl">⛅</div>
      <div className="text-5xl font-bold">— °C</div>
      <div className="text-white/60 text-2xl">{item.mediaUrl ?? "—"}</div>
    </div>
  );
  if (item.mediaType === "weather_forecast") {
    const meta = (item as any).mediaMetaJson as Record<string, any> | null;
    const days = meta?.days ?? 5;
    const city = item.mediaUrl ?? "—";
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-white w-full h-full bg-gradient-to-b from-amber-950 to-orange-950 p-6">
        <div className="text-white/50 text-sm uppercase tracking-widest">Previsão do Tempo</div>
        <div className="text-white text-2xl font-semibold">{city}</div>
        <div className="flex gap-3">
          {Array.from({ length: days }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 bg-white/10 rounded-xl px-3 py-2 min-w-[52px]">
              <div className="text-[10px] text-white/50 uppercase">
                {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][(new Date().getDay() + i) % 7]}
              </div>
              <div className="text-xl">⛅</div>
              <div className="text-xs font-bold">—°</div>
              <div className="text-[9px] text-white/40">—°</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (item.mediaType === "rss") return (
    <div className="flex flex-col items-center justify-center gap-3 text-white w-full h-full bg-gray-900">
      <RssIcon className="w-16 h-16 text-orange-400" />
      <div className="text-white/60 text-sm max-w-xs text-center">{item.mediaUrl}</div>
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-black/80 border-t border-orange-400/50 flex items-center px-4 gap-3">
        <span className="text-xs font-bold bg-orange-500 text-black px-2 py-0.5">NOTÍCIAS</span>
        <span className="text-sm text-white/70 truncate">Ticker de notícias ativo …</span>
      </div>
    </div>
  );
  const src = resolveUrl(item.mediaUrl);
  if (src) return <img key={src} src={src} alt={item.mediaName ?? ""} className="w-full h-full object-contain" />;
  return (
    <div className="flex flex-col items-center gap-2 text-white/30"><ImageIcon className="w-12 h-12" /><span>Sem prévia</span></div>
  );
}

// ─── Sortable slide item ──────────────────────────────────────────────────────
interface SlideItemProps {
  item: { id: number; mediaId: number; mediaName?: string | null; mediaUrl?: string | null; mediaType?: string | null; position: number; durationSeconds: number };
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  selectMode?: boolean;
  isChecked?: boolean;
  onCheck?: () => void;
}
function SlideItem({ item, index, isSelected, onSelect, onRemove, selectMode, isChecked, onCheck }: SlideItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...(selectMode ? {} : listeners)}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      onClick={selectMode ? onCheck : onSelect}
      className={cn(
        "group relative flex items-center gap-0 select-none transition-all",
        selectMode ? "cursor-pointer" : isDragging ? "cursor-grabbing" : "cursor-grab",
        selectMode && isChecked ? "bg-blue-500/15" : isSelected ? "bg-[#1a3a6a]" : "hover:bg-white/5"
      )}
    >
      {/* Blue left accent on selected */}
      {!selectMode && isSelected && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-400" />}

      {/* Checkbox (select mode) or Drag affordance */}
      {selectMode ? (
        <div className="w-8 flex items-center justify-center shrink-0 self-stretch">
          <div
            className={cn(
              "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
              isChecked ? "bg-blue-500 border-blue-500" : "border-white/30 bg-white/5"
            )}
          >
            {isChecked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
        </div>
      ) : (
        <div className="w-5 flex items-center justify-center shrink-0 self-stretch text-white/45 group-hover:text-white/80 transition-colors">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}

      {/* Index number */}
      <div className="w-6 text-center shrink-0">
        <span className={cn("text-[11px] font-bold tabular-nums", isSelected ? "text-blue-300" : "text-white/30")}>{index + 1}</span>
      </div>

      {/* Thumbnail 16:9 */}
      <div className="w-[68px] h-[40px] shrink-0 overflow-hidden border border-white/10">
        <Thumb url={item.mediaUrl} type={item.mediaType} className="w-full h-full" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 px-2 py-2">
        <p className="text-[11px] font-medium truncate text-white/85 leading-tight">{item.mediaName ?? "—"}</p>
        <p className="text-[10px] text-white/35 mt-0.5">Exibir 1 vez(es)</p>
      </div>

      {/* Delete (hidden in select mode) */}
      {!selectMode && (
        <button
          className="shrink-0 w-7 self-stretch flex items-center justify-center text-red-400/40 hover:text-red-300 hover:bg-red-500/15 transition-all border-l border-white/8"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Remover slide"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PlaylistDetail() {
  const [, params] = useRoute("/playlists/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [searchMedia, setSearchMedia] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>("all");
  const [optimisticItems, setOptimisticItems] = useState<typeof sortedItems | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<string>("all");
  const [pickerMulti, setPickerMulti] = useState(false);
  const [pickerSelected, setPickerSelected] = useState<Set<number>>(new Set());
  const [editingName, setEditingName] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedSlideIds, setSelectedSlideIds] = useState<Set<number>>(new Set());
  const [nameInput, setNameInput] = useState("");

  // ── Editor mode: "slides" | "canvas" ──
  const [editorMode, setEditorMode] = useState<"slides" | "canvas">("slides");

  // ── Canvas state (lazy-initialized from layoutJson when switching modes) ──
  const [canvasData, setCanvasData] = useState<CanvasData>({ version: 2, layers: [] });
  const canvasDirty = useRef(false);
  const [canvasPickerOpen, setCanvasPickerOpen] = useState(false);
  const [canvasPickerSearch, setCanvasPickerSearch] = useState("");

  // Apply dialog ──
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyScreenId, setApplyScreenId] = useState<string>("");
  const [applyName, setApplyName] = useState("");

  const { data: screens } = useListScreens();
  const updateScreen = useUpdateScreen();
  const updateMedia = useUpdateMedia();
  const createSchedule = useCreateSchedule();

  const { data: playlist, isLoading: playlistLoading } = useGetPlaylist(id, {
    query: { enabled: !!id, queryKey: getGetPlaylistQueryKey(id) },
  });
  const { data: mediaItems, isLoading: mediaLoading } = useListMedia(
    {}, { query: { enabled: !!id, queryKey: getListMediaQueryKey() } }
  );

  const addItem = useAddPlaylistItem();
  const removeItem = useRemovePlaylistItem();
  const reorderItems = useReorderPlaylistItems();
  const updateItem = useUpdatePlaylistItem();
  const updatePlaylist = useUpdatePlaylist();

  const sortedItems = [...(playlist?.items ?? [])].sort((a, b) => a.position - b.position);
  const displayItems = optimisticItems ?? sortedItems;
  const selectedItem = displayItems.find(i => i.id === selectedItemId) ?? displayItems[0] ?? null;
  const totalDuration = displayItems.reduce((s, i) => s + i.durationSeconds, 0);

  // Sync canvas data from layoutJson when playlist loads or mode switches to canvas
  useEffect(() => {
    if (editorMode === "canvas" && playlist) {
      setCanvasData(parseCanvasData(playlist.layoutJson));
      canvasDirty.current = false;
    }
  }, [editorMode, playlist]);

  // Auto-save canvas data to layoutJson with debounce
  const saveCanvasTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCanvasChange = useCallback((data: CanvasData) => {
    setCanvasData(data);
    canvasDirty.current = true;
    if (saveCanvasTimeout.current) clearTimeout(saveCanvasTimeout.current);
    saveCanvasTimeout.current = setTimeout(() => {
      updatePlaylist.mutate(
        { id, data: { layoutJson: serializeCanvasData(data) } },
        { onSuccess: () => { canvasDirty.current = false; queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) }); } }
      );
    }, 800);
  }, [id, updatePlaylist, queryClient]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = displayItems.findIndex(i => i.id === active.id);
    const newIdx = displayItems.findIndex(i => i.id === over.id);
    const reordered = arrayMove(displayItems, oldIdx, newIdx);
    setOptimisticItems(reordered);
    reorderItems.mutate(
      { id, data: { items: reordered.map((item, pos) => ({ itemId: item.id, position: pos })) } },
      {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) }); setOptimisticItems(null); },
        onError: () => { setOptimisticItems(null); toast({ title: "Erro ao reordenar", variant: "destructive" }); },
      }
    );
  }, [displayItems, id, reorderItems, queryClient, toast]);

  const handleAdd = (mediaId: number, durationSeconds: number) => {
    const nextPos = displayItems.length > 0 ? Math.max(...displayItems.map(i => i.position)) + 1 : 0;
    addItem.mutate(
      { id, data: { mediaId, durationSeconds, position: nextPos } },
      {
        onSuccess: (newItem) => {
          queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) });
          setSelectedItemId(newItem.id);
        },
        onError: () => toast({ title: "Erro ao adicionar", variant: "destructive" }),
      }
    );
  };

  const handleAddMultiple = async () => {
    const mediaList = (filteredMedia ?? []).filter(m => pickerSelected.has(m.id));
    let basePos = displayItems.length > 0 ? Math.max(...displayItems.map(i => i.position)) + 1 : 0;
    for (const media of mediaList) {
      await new Promise<void>((resolve) => {
        addItem.mutate(
          { id, data: { mediaId: media.id, durationSeconds: media.durationSeconds ?? 10, position: basePos } },
          { onSuccess: () => resolve(), onError: () => resolve() }
        );
        basePos++;
      });
    }
    queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) });
    setPickerOpen(false);
    setPickerSelected(new Set());
    setPickerMulti(false);
    setSearchMedia("");
  };

  const handleRemove = (itemId: number) => {
    removeItem.mutate(
      { id, itemId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) });
          if (selectedItemId === itemId) setSelectedItemId(null);
          toast({ title: "Slide removido", description: "O arquivo continua na biblioteca." });
        },
        onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
      }
    );
  };

  const handleRemoveSelected = async () => {
    const ids = Array.from(selectedSlideIds);
    for (const itemId of ids) {
      await new Promise<void>((resolve) => {
        removeItem.mutate(
          { id, itemId },
          { onSuccess: () => resolve(), onError: () => resolve() }
        );
      });
    }
    queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) });
    setSelectedSlideIds(new Set());
    setSelectMode(false);
    toast({ title: `${ids.length} slide${ids.length !== 1 ? "s" : ""} removido${ids.length !== 1 ? "s" : ""}` });
  };

  const toggleSlideCheck = (itemId: number) => {
    setSelectedSlideIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleDurationChange = (itemId: number, durationSeconds: number) => {
    updateItem.mutate(
      { id, itemId, data: { durationSeconds } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) }) }
    );
  };

  const handleMove = useCallback((itemId: number, direction: -1 | 1) => {
    const idx = displayItems.findIndex(i => i.id === itemId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= displayItems.length) return;
    const reordered = arrayMove(displayItems, idx, newIdx);
    setOptimisticItems(reordered);
    reorderItems.mutate(
      { id, data: { items: reordered.map((item, pos) => ({ itemId: item.id, position: pos })) } },
      {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) }); setOptimisticItems(null); },
        onError: () => { setOptimisticItems(null); toast({ title: "Erro ao reordenar", variant: "destructive" }); },
      }
    );
  }, [displayItems, id, reorderItems, queryClient, toast]);

  const handleApply = () => {
    if (!applyScreenId) return;
    const s = screens?.find((s: any) => String(s.id) === applyScreenId);
    createSchedule.mutate(
      { data: { playlistId: id, screenId: Number(applyScreenId), active: true, startTime: "00:00", endTime: "23:59", daysOfWeek: "0,1,2,3,4,5,6" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListScreensQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
          setApplyOpen(false); setApplyScreenId(""); setApplyName("");
          toast({ title: `"${playlist?.name}" publicada em ${s?.name ?? "—"}!` });
        },
        onError: () => toast({ title: "Erro ao publicar", variant: "destructive" }),
      }
    );
  };

  const handleSaveName = () => {
    const name = nameInput.trim();
    if (!name || name === playlist?.name) { setEditingName(false); return; }
    updatePlaylist.mutate(
      { id, data: { name } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
          setEditingName(false);
          toast({ title: "Nome atualizado" });
        },
        onError: () => toast({ title: "Erro ao renomear", variant: "destructive" }),
      }
    );
  };

  const addedIds = new Set(displayItems.map(i => i.mediaId));

  const addedCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of displayItems) {
      counts.set(item.mediaId, (counts.get(item.mediaId) ?? 0) + 1);
    }
    return counts;
  }, [displayItems]);

  const filteredMedia = mediaItems?.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(searchMedia.toLowerCase());
    const matchType = mediaTypeFilter === "all" || m.type === mediaTypeFilter;
    const matchPicker = !pickerOpen || pickerType === "all" || m.type === pickerType;
    return matchSearch && matchType && matchPicker;
  });

  const selectedIdx = displayItems.findIndex(i => i.id === selectedItem?.id);
  const goNext = () => displayItems[selectedIdx + 1] && setSelectedItemId(displayItems[selectedIdx + 1].id);
  const goPrev = () => displayItems[selectedIdx - 1] && setSelectedItemId(displayItems[selectedIdx - 1].id);

  // ── widget dialog state ──────────────────────────────────────────────────────
  const createMedia = useCreateMedia();
  const [appsGalleryOpen, setAppsGalleryOpen] = useState(false);
  const [urlAppDialog, setUrlAppDialog] = useState<{ type: string; label: string; placeholder: string; defaultDuration: number } | null>(null);
  const [urlAppForm, setUrlAppForm] = useState({ name: "", url: "", duration: "30" });
  const [weatherDialogOpen, setWeatherDialogOpen] = useState(false);
  const [weatherForm, setWeatherForm] = useState({ name: "", city: "", durationSeconds: "20" });
  const [forecastDialogOpen, setForecastDialogOpen] = useState(false);
  const [forecastForm, setForecastForm] = useState({ name: "", city: "", days: "5", durationSeconds: "30" });
  const [rssDialogOpen, setRssDialogOpen] = useState(false);
  const [rssForm, setRssForm] = useState({ name: "", feedUrl: "https://g1.globo.com/rss/g1/", displayMode: "ticker" as "ticker" | "fullscreen" });
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [textForm, setTextForm] = useState({
    name: "", content: "SEU TEXTO AQUI", size: 80, font: "Impact, 'Arial Black', sans-serif",
    color: "#ffffff", bold: true, italic: false, uppercase: false, align: "center" as "left" | "center" | "right",
    effect: "shadow" as string, shadowColor: "#000000", strokeColor: "#000000", gradientTo: "#ffcc00",
    bg: "#000000", bgOpacity: 0, duration: "15",
    animation: "none" as string, animSpeed: 5,
  });

  // ── quick-add widget helpers (clock, weather, rss — stored in media table) ──
  const handleAddWidget = (type: "clock" | "weather" | "weather_forecast" | "rss") => {
    if (type === "clock") {
      createMedia.mutate(
        { data: { name: "Relógio Digital", type: "clock", url: "clock://local", durationSeconds: 30 } },
        {
          onSuccess: (newMedia) => {
            queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
            handleAdd(newMedia.id, newMedia.durationSeconds ?? 30);
            toast({ title: "Relógio adicionado!" });
          },
          onError: () => toast({ title: "Erro ao adicionar relógio", variant: "destructive" }),
        }
      );
    } else if (type === "weather") {
      setWeatherDialogOpen(true);
    } else if (type === "weather_forecast") {
      setForecastDialogOpen(true);
    } else if (type === "rss") {
      setRssDialogOpen(true);
    }
  };

  const APP_URL_INFO: Record<string, { label: string; placeholder: string; defaultDuration: number }> = {
    canva: { label: "Canva", placeholder: "https://www.canva.com/design/...", defaultDuration: 30 },
    google_slides: { label: "Google Slides", placeholder: "https://docs.google.com/presentation/...", defaultDuration: 30 },
    youtube_playlist: { label: "YouTube Playlist", placeholder: "https://www.youtube.com/playlist?list=...", defaultDuration: 0 },
    spotify: { label: "Spotify", placeholder: "https://open.spotify.com/...", defaultDuration: 0 },
    instagram: { label: "Instagram", placeholder: "https://www.instagram.com/...", defaultDuration: 30 },
    tiktok: { label: "TikTok", placeholder: "https://www.tiktok.com/...", defaultDuration: 15 },
    youtube: { label: "YouTube", placeholder: "https://www.youtube.com/watch?v=...", defaultDuration: 0 },
    pluto_tv: { label: "Pluto TV", placeholder: "https://pluto.tv/", defaultDuration: 0 },
    web_channel: { label: "Página Web", placeholder: "https://...", defaultDuration: 30 },
    qr_code: { label: "QR Code", placeholder: "https://...", defaultDuration: 30 },
  };

  const handleSelectAppForPlaylist = (appId: string) => {
    setAppsGalleryOpen(false);
    if (appId === "clock") {
      createMedia.mutate(
        { data: { name: "Relógio Digital", type: "clock", url: "clock://local", durationSeconds: 30 } },
        {
          onSuccess: (newMedia) => {
            queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
            handleAdd(newMedia.id, newMedia.durationSeconds ?? 30);
            toast({ title: "Relógio adicionado!" });
          },
          onError: () => toast({ title: "Erro ao adicionar relógio", variant: "destructive" }),
        }
      );
    } else if (appId === "date") {
      createMedia.mutate(
        { data: { name: "Widget de Data", type: "date", url: "date://local", durationSeconds: 30 } },
        {
          onSuccess: (newMedia) => {
            queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
            handleAdd(newMedia.id, newMedia.durationSeconds ?? 30);
            toast({ title: "Widget de data adicionado!" });
          },
          onError: () => toast({ title: "Erro ao adicionar data", variant: "destructive" }),
        }
      );
    } else if (appId === "text") {
      setTextDialogOpen(true);
    } else if (appId === "rss") {
      setRssDialogOpen(true);
    } else if (appId === "weather") {
      setWeatherDialogOpen(true);
    } else if (appId === "weather_forecast") {
      setForecastDialogOpen(true);
    } else {
      const info = APP_URL_INFO[appId];
      if (info) {
        setUrlAppForm({ name: "", url: "", duration: String(info.defaultDuration) });
        setUrlAppDialog({ type: appId, label: info.label, placeholder: info.placeholder, defaultDuration: info.defaultDuration });
      }
    }
  };

  const handleSaveUrlApp = () => {
    if (!urlAppDialog) return;
    const url = urlAppForm.url.trim();
    const name = urlAppForm.name.trim() || urlAppDialog.label;
    const dur = parseInt(urlAppForm.duration) || urlAppDialog.defaultDuration;
    const type = urlAppDialog.type;
    const metaJson = type === "qr_code" ? JSON.stringify({ label: name }) : undefined;
    if (!url) { toast({ title: "Digite a URL", variant: "destructive" }); return; }
    createMedia.mutate(
      { data: { name, type: type as Parameters<typeof createMedia.mutate>[0]["data"]["type"], url, durationSeconds: dur, ...(metaJson ? { metaJson } : {}) } },
      {
        onSuccess: (newMedia) => {
          queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
          handleAdd(newMedia.id, newMedia.durationSeconds ?? dur);
          setUrlAppDialog(null);
          setUrlAppForm({ name: "", url: "", duration: "30" });
          toast({ title: `${urlAppDialog.label} adicionado!` });
        },
        onError: () => toast({ title: "Erro ao adicionar", variant: "destructive" }),
      }
    );
  };

  const handleSaveText = () => {
    const content = textForm.content.trim();
    if (!content) { toast({ title: "Digite o conteúdo do texto", variant: "destructive" }); return; }
    const dur = parseInt(textForm.duration) || 15;
    const name = textForm.name.trim() || content.slice(0, 30);
    const metaJson = JSON.stringify({
      textContent: content,
      textSize: textForm.size,
      textFont: textForm.font,
      textColor: textForm.color,
      textBold: textForm.bold,
      textItalic: textForm.italic,
      textUppercase: textForm.uppercase,
      textAlign: textForm.align,
      textEffect: textForm.effect,
      textShadowColor: textForm.shadowColor,
      textStrokeColor: textForm.strokeColor,
      textGradientTo: textForm.gradientTo,
      textBg: textForm.bg,
      textBgOpacity: textForm.bgOpacity,
      textAnimation: textForm.animation,
      textAnimationSpeed: textForm.animSpeed,
    });
    createMedia.mutate(
      { data: { name, type: "text", url: "text://local", durationSeconds: dur, metaJson } },
      {
        onSuccess: (newMedia) => {
          queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
          handleAdd(newMedia.id, newMedia.durationSeconds ?? dur);
          setTextDialogOpen(false);
          setTextForm({ name: "", content: "SEU TEXTO AQUI", size: 80, font: "Impact, 'Arial Black', sans-serif", color: "#ffffff", bold: true, italic: false, uppercase: false, align: "center", effect: "shadow", shadowColor: "#000000", strokeColor: "#000000", gradientTo: "#ffcc00", bg: "#000000", bgOpacity: 0, duration: "15", animation: "none", animSpeed: 5 });
          toast({ title: "Texto adicionado!" });
        },
        onError: () => toast({ title: "Erro ao adicionar texto", variant: "destructive" }),
      }
    );
  };

  const handleSaveWeather = () => {
    const city = weatherForm.city.trim();
    const name = weatherForm.name.trim() || city;
    if (!city) { toast({ title: "Digite o nome da cidade", variant: "destructive" }); return; }
    const dur = parseInt(weatherForm.durationSeconds) || 20;
    createMedia.mutate(
      { data: { name: name || city, type: "weather", url: city, durationSeconds: dur } },
      {
        onSuccess: (newMedia) => {
          queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
          handleAdd(newMedia.id, newMedia.durationSeconds ?? dur);
          setWeatherDialogOpen(false);
          setWeatherForm({ name: "", city: "", durationSeconds: "20" });
          toast({ title: "Widget de clima adicionado!" });
        },
        onError: () => toast({ title: "Erro ao adicionar clima", variant: "destructive" }),
      }
    );
  };

  const handleSaveForecast = () => {
    const city = forecastForm.city.trim();
    const name = forecastForm.name.trim() || `Previsão ${city}`;
    if (!city) { toast({ title: "Digite o nome da cidade", variant: "destructive" }); return; }
    const dur = parseInt(forecastForm.durationSeconds) || 30;
    const days = Math.min(Math.max(parseInt(forecastForm.days) || 5, 3), 7);
    createMedia.mutate(
      { data: { name, type: "weather_forecast", url: city, durationSeconds: dur, metaJson: JSON.stringify({ days }) } },
      {
        onSuccess: (newMedia) => {
          queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
          handleAdd(newMedia.id, newMedia.durationSeconds ?? dur);
          setForecastDialogOpen(false);
          setForecastForm({ name: "", city: "", days: "5", durationSeconds: "30" });
          toast({ title: "Previsão do tempo adicionada!" });
        },
        onError: () => toast({ title: "Erro ao adicionar previsão", variant: "destructive" }),
      }
    );
  };

  const handleSaveRss = () => {
    const feedUrl = rssForm.feedUrl.trim();
    const name = rssForm.name.trim();
    if (!name || !feedUrl) { toast({ title: "Preencha nome e URL do feed", variant: "destructive" }); return; }
    createMedia.mutate(
      { data: { name, type: "rss", url: feedUrl, durationSeconds: 0, metaJson: JSON.stringify({ feedUrl, displayMode: rssForm.displayMode }) } },
      {
        onSuccess: (newMedia) => {
          queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
          handleAdd(newMedia.id, newMedia.durationSeconds ?? 15);
          setRssDialogOpen(false);
          setRssForm({ name: "", feedUrl: "https://g1.globo.com/rss/g1/", displayMode: "ticker" });
          toast({ title: "Ticker RSS adicionado!" });
        },
        onError: () => toast({ title: "Erro ao adicionar RSS", variant: "destructive" }),
      }
    );
  };

  if (playlistLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-80px)] -mx-6 -mt-4 bg-[#0a0c12] items-center justify-center gap-4">
        <Skeleton className="h-8 w-64 bg-white/10" />
        <Skeleton className="h-[500px] w-full bg-white/5 rounded-none" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold">Playlist não encontrada</h2>
        <Button asChild className="mt-4" variant="outline"><Link href="/playlists">Voltar</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#0a0c12]">

      {/* ═══════════════════════════════════════════════════════
          TOP TOOLBAR
      ═══════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-0 border-b border-white/10 bg-[#12141c] shrink-0 h-12">

        {/* Breadcrumb / Name edit */}
        <div className="flex items-center gap-2 px-3 border-r border-white/10 h-full min-w-0 shrink-0">
          <Link href="/playlists">
            <button className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          {editingName ? (
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="text-sm font-semibold text-white bg-white/10 border border-white/20 rounded px-2 py-0.5 outline-none focus:border-blue-400/60 max-w-[180px]"
            />
          ) : (
            <button
              className="flex items-center gap-1.5 group"
              onClick={() => { setNameInput(playlist.name); setEditingName(true); }}
              title="Editar nome"
            >
              <span className="text-sm font-semibold text-white truncate max-w-[160px]">{playlist.name}</span>
              <Pencil className="w-3 h-3 text-white/25 group-hover:text-white/60 transition-colors shrink-0" />
            </button>
          )}
        </div>

        {/* ── Media type quick-add buttons ── */}
        <div className="flex items-center gap-0 px-2 border-r border-white/10 h-full overflow-x-auto scrollbar-none">
          {[
            { label: "Imagem", icon: ImageIcon, type: "image", color: "text-emerald-400" },
            { label: "Vídeo", icon: Film, type: "video", color: "text-purple-400" },
          ].map(({ label, icon: Icon, type, color }) => (
            <button
              key={type}
              className="flex flex-col items-center justify-center gap-0.5 px-3 h-full text-white/50 hover:text-white hover:bg-white/8 transition-colors group shrink-0"
              onClick={() => { setPickerType(type); setSearchMedia(""); setPickerOpen(true); }}
              title={`Adicionar ${label}`}
            >
              <Icon className={cn("w-4 h-4 transition-colors group-hover:text-current", color, "opacity-70 group-hover:opacity-100")} />
              <span className="text-[10px] font-medium leading-none whitespace-nowrap">{label}</span>
            </button>
          ))}
          <button
            className="flex flex-col items-center justify-center gap-0.5 px-3 h-full text-white/50 hover:text-white hover:bg-white/8 transition-colors group shrink-0"
            onClick={() => setAppsGalleryOpen(true)}
            title="Galeria de Aplicativos e Widgets"
          >
            <AppWindow className="w-4 h-4 text-violet-400 opacity-70 group-hover:opacity-100 transition-colors" />
            <span className="text-[10px] font-medium leading-none whitespace-nowrap">Aplicativos</span>
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-white/10 mx-1 shrink-0" />

          {/* YouTube shortcut */}
          <button
            className="flex flex-col items-center justify-center gap-0.5 px-3 h-full text-white/50 hover:text-white hover:bg-white/8 transition-colors group shrink-0"
            onClick={() => setUrlAppDialog({ type: "youtube", ...APP_URL_INFO.youtube })}
            title="Adicionar YouTube"
          >
            <Youtube className="w-4 h-4 text-red-400 opacity-70 group-hover:opacity-100 transition-colors" />
            <span className="text-[10px] font-medium leading-none whitespace-nowrap">YouTube</span>
          </button>

          {/* Site/URL shortcut */}
          <button
            className="flex flex-col items-center justify-center gap-0.5 px-3 h-full text-white/50 hover:text-white hover:bg-white/8 transition-colors group shrink-0"
            onClick={() => setUrlAppDialog({ type: "web_channel", ...APP_URL_INFO.web_channel })}
            title="Adicionar Site / URL"
          >
            <Globe className="w-4 h-4 text-blue-400 opacity-70 group-hover:opacity-100 transition-colors" />
            <span className="text-[10px] font-medium leading-none whitespace-nowrap">Site / URL</span>
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-white/10 mx-1 shrink-0" />

          {/* Texto */}
          <button
            className="flex flex-col items-center justify-center gap-0.5 px-3 h-full text-white/50 hover:text-white hover:bg-white/8 transition-colors group shrink-0"
            onClick={() => handleSelectAppForPlaylist("text")}
            title="Adicionar Texto"
          >
            <Type className="w-4 h-4 text-yellow-400 opacity-70 group-hover:opacity-100 transition-colors" />
            <span className="text-[10px] font-medium leading-none whitespace-nowrap">Texto</span>
          </button>

          {/* Relógio */}
          <button
            className="flex flex-col items-center justify-center gap-0.5 px-3 h-full text-white/50 hover:text-white hover:bg-white/8 transition-colors group shrink-0"
            onClick={() => handleSelectAppForPlaylist("clock")}
            title="Adicionar Relógio"
          >
            <Clock className="w-4 h-4 text-slate-300 opacity-70 group-hover:opacity-100 transition-colors" />
            <span className="text-[10px] font-medium leading-none whitespace-nowrap">Relógio</span>
          </button>

          {/* Clima */}
          <button
            className="flex flex-col items-center justify-center gap-0.5 px-3 h-full text-white/50 hover:text-white hover:bg-white/8 transition-colors group shrink-0"
            onClick={() => handleSelectAppForPlaylist("weather")}
            title="Adicionar Clima"
          >
            <CloudSun className="w-4 h-4 text-cyan-400 opacity-70 group-hover:opacity-100 transition-colors" />
            <span className="text-[10px] font-medium leading-none whitespace-nowrap">Clima</span>
          </button>

          {/* Previsão */}
          <button
            className="flex flex-col items-center justify-center gap-0.5 px-3 h-full text-white/50 hover:text-white hover:bg-white/8 transition-colors group shrink-0"
            onClick={() => handleSelectAppForPlaylist("weather_forecast")}
            title="Adicionar Previsão do Tempo"
          >
            <Sun className="w-4 h-4 text-amber-400 opacity-70 group-hover:opacity-100 transition-colors" />
            <span className="text-[10px] font-medium leading-none whitespace-nowrap">Previsão</span>
          </button>

          {/* RSS */}
          <button
            className="flex flex-col items-center justify-center gap-0.5 px-3 h-full text-white/50 hover:text-white hover:bg-white/8 transition-colors group shrink-0"
            onClick={() => handleSelectAppForPlaylist("rss")}
            title="Adicionar Ticker RSS"
          >
            <RssIcon className="w-4 h-4 text-orange-400 opacity-70 group-hover:opacity-100 transition-colors" />
            <span className="text-[10px] font-medium leading-none whitespace-nowrap">RSS</span>
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Mode toggle */}
        <div className="flex items-center px-3 border-l border-white/10 h-full shrink-0">
          <div className="flex items-center bg-white/6 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setEditorMode("slides")}
              className={cn(
                "flex items-center gap-1.5 px-3 h-6 rounded-md text-xs font-semibold transition-all",
                editorMode === "slides"
                  ? "bg-white/15 text-white shadow"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              <Play className="w-3 h-3" /> Slides
            </button>
            <button
              onClick={() => setEditorMode("canvas")}
              className={cn(
                "flex items-center gap-1.5 px-3 h-6 rounded-md text-xs font-semibold transition-all",
                editorMode === "canvas"
                  ? "bg-blue-500/80 text-white shadow"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              <Layers className="w-3 h-3" /> Canvas
            </button>
          </div>
        </div>

        {/* Duration display */}
        {editorMode === "slides" && (
          <div className="flex items-center gap-1.5 px-3 border-l border-white/10 h-full text-white/40 text-xs shrink-0">
            <Play className="w-3 h-3" />
            <span>{displayItems.length} slides</span>
            <span className="text-white/20">·</span>
            <span>{formatDur(totalDuration)} total</span>
          </div>
        )}
        {editorMode === "canvas" && (
          <div className="flex items-center gap-1.5 px-3 border-l border-white/10 h-full text-white/40 text-xs shrink-0">
            <Layers className="w-3 h-3" />
            <span>{canvasData.layers.length} camadas</span>
          </div>
        )}

        {/* Saved indicator */}
        <div className="flex items-center gap-1.5 px-3 border-l border-white/10 h-full text-white/30 text-xs shrink-0">
          <Save className="w-3 h-3" />
          <span>Salvo</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 px-3 border-l border-white/10 h-full shrink-0">
          <Button
            size="sm" variant="outline"
            className="h-7 px-3 text-xs gap-1.5 border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white"
            onClick={() => setApplyOpen(true)}
          >
            <MonitorPlay className="w-3.5 h-3.5" />
            Publicar
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          CANVAS MODE
      ═══════════════════════════════════════════════════════ */}
      {editorMode === "canvas" && (
        <CanvasEditor
          data={canvasData}
          onChange={handleCanvasChange}
          onAddMedia={() => { setCanvasPickerSearch(""); setCanvasPickerOpen(true); }}
        />
      )}

      {/* ═══════════════════════════════════════════════════════
          THREE-PANEL BODY (slides mode)
      ═══════════════════════════════════════════════════════ */}
      {editorMode === "slides" && <div className="flex flex-1 overflow-hidden">

        {/* ─── LEFT: Slide list ──────────────────────────────────── */}
        <div className="w-[260px] border-r border-white/8 bg-[#0e1018] flex flex-col shrink-0">

          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/8 bg-[#111320]">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              Slides
            </span>
            <div className="flex items-center gap-1">
              <button
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/30 hover:text-white transition-colors disabled:opacity-30"
                onClick={goPrev} disabled={selectedIdx <= 0}
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="text-[10px] text-white/25 tabular-nums min-w-[28px] text-center">
                {selectedIdx >= 0 ? `${selectedIdx + 1}/${displayItems.length}` : `0/${displayItems.length}`}
              </span>
              <button
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/30 hover:text-white transition-colors disabled:opacity-30"
                onClick={goNext} disabled={selectedIdx >= displayItems.length - 1}
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Incompatibility warning: streaming mixed with anything */}
          {(() => {
            const STREAMING = new Set(["youtube", "youtube_playlist", "pluto_tv", "spotify"]);
            const hasStreaming = displayItems.some(i => STREAMING.has(i.mediaType ?? ""));
            const hasRegular   = displayItems.some(i => !STREAMING.has(i.mediaType ?? ""));
            const distinctStreamingTypes = new Set(
              displayItems.filter(i => STREAMING.has(i.mediaType ?? "")).map(i => i.mediaType)
            );
            const hasMixedStreaming = distinctStreamingTypes.size > 1;
            if (!hasStreaming || (!hasRegular && !hasMixedStreaming)) return null;
            return (
              <div className="mx-2 mb-1 px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] leading-snug flex gap-2 items-start">
                <span className="text-base leading-none mt-0.5">⚠</span>
                <div>
                  <p className="font-bold mb-0.5">Tipos incompatíveis na playlist</p>
                  <p className="text-amber-300/70">
                    {hasMixedStreaming && !hasRegular
                      ? "YouTube, Pluto TV e Spotify são transmissões independentes e não podem ser misturadas entre si. Cada tipo de streaming precisa de uma playlist exclusiva."
                      : "YouTube / Pluto TV / Spotify são transmissões contínuas. Misturar com imagens ou vídeos vai interromper a transmissão a cada ciclo. Recomendamos playlists separadas."
                    }
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Slide list header with select toggle */}
          {displayItems.length > 0 && (
            <div className="flex items-center justify-between px-2 py-1 border-b border-white/6 shrink-0">
              <span className="text-[10px] text-white/30 font-mono">{displayItems.length} slide{displayItems.length !== 1 ? "s" : ""}</span>
              <button
                onClick={() => { setSelectMode(v => !v); setSelectedSlideIds(new Set()); }}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${selectMode ? "text-blue-300 bg-blue-500/15" : "text-white/35 hover:text-white/60"}`}
              >
                {selectMode ? "Cancelar" : "Selecionar"}
              </button>
            </div>
          )}

          {/* Slide list */}
          <ScrollArea className="flex-1">
            {displayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-3 text-center gap-3">
                <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center">
                  <Play className="w-5 h-5 text-white/20" />
                </div>
                <p className="text-xs text-white/25">Nenhum slide</p>
                <button
                  onClick={() => { setPickerType("all"); setSearchMedia(""); setPickerOpen(true); }}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Adicionar mídia
                </button>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={displayItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  {displayItems.map((item, idx) => (
                    <SlideItem
                      key={item.id}
                      item={item}
                      index={idx}
                      isSelected={selectedItem?.id === item.id}
                      onSelect={() => setSelectedItemId(item.id)}
                      onRemove={() => handleRemove(item.id)}
                      selectMode={selectMode}
                      isChecked={selectedSlideIds.has(item.id)}
                      onCheck={() => toggleSlideCheck(item.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </ScrollArea>

          {/* Bulk delete bar */}
          {selectMode && selectedSlideIds.size > 0 && (
            <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-red-500/10 border-t border-red-500/20">
              <span className="text-xs text-red-300">{selectedSlideIds.size} selecionado{selectedSlideIds.size !== 1 ? "s" : ""}</span>
              <button
                onClick={handleRemoveSelected}
                className="text-xs font-semibold text-red-300 hover:text-red-200 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Excluir selecionados
              </button>
            </div>
          )}

        </div>

        {/* ─── CENTER: Preview ───────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-[#0a0c12] overflow-hidden">

          {/* Zoom bar */}
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/6 bg-[#0d0f18] shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/25 font-mono">1920×1080</span>
              <span className="text-white/15 text-[10px]">|</span>
              <span className="text-[10px] text-white/25">16:9</span>
            </div>
            <div className="flex items-center gap-1.5">
              {selectedItem && (
                <span className="text-[10px] text-white/30 font-medium">
                  {typeLabel(selectedItem.mediaType)} · {selectedItem.durationSeconds}s
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-white/25">100%</span>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 flex items-center justify-center overflow-hidden p-8"
            style={{ background: "repeating-conic-gradient(#141620 0% 25%, #0d0f18 0% 50%) 0 0 / 20px 20px" }}>
            <div
              className="relative bg-black shadow-2xl overflow-hidden"
              style={{
                aspectRatio: "16/9",
                maxWidth: "100%",
                maxHeight: "100%",
                width: "min(100%, calc((100vh - 240px) * 16/9))",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 25px 60px rgba(0,0,0,0.8)",
              }}
            >
              <PreviewContent item={selectedItem} />

              {/* Bottom overlay */}
              {selectedItem && (
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2.5 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
                  <div>
                    <p className="text-white text-sm font-semibold truncate max-w-xs">{selectedItem.mediaName}</p>
                    <p className="text-white/45 text-xs mt-0.5">{typeLabel(selectedItem.mediaType)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/30 text-xs font-mono bg-black/60 px-2 py-0.5 rounded">
                      {selectedIdx + 1} / {displayItems.length}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation arrows under preview */}
          <div className="flex items-center justify-center gap-4 py-2.5 border-t border-white/6 bg-[#0d0f18] shrink-0">
            <button
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
              onClick={goPrev} disabled={selectedIdx <= 0}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <div className="flex gap-1">
              {displayItems.map((_, i) => (
                <button
                  key={i}
                  onClick={() => displayItems[i] && setSelectedItemId(displayItems[i].id)}
                  className={cn(
                    "rounded-full transition-all",
                    i === selectedIdx
                      ? "w-4 h-1.5 bg-blue-400"
                      : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
                  )}
                />
              ))}
            </div>
            <button
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
              onClick={goNext} disabled={selectedIdx >= displayItems.length - 1}
            >
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── RIGHT: Properties panel ───────────────────────────── */}
        <div className="w-[280px] border-l border-white/8 bg-[#0e1018] flex flex-col shrink-0">

          {/* Header */}
          <div className="h-10 flex items-center gap-1.5 px-4 border-b border-white/8 bg-[#111320] shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-white/40" />
            <span className="text-xs font-semibold text-white/70">Propriedades</span>
          </div>

          <div className="flex-1 overflow-auto flex flex-col">

              {/* ─── Per-item properties ──────────────────────────── */}
              {!selectedItem ? (
                <div className="flex flex-col items-center justify-center flex-1 text-center gap-3 px-6">
                  <SlidersHorizontal className="w-8 h-8 text-white/15" />
                  <p className="text-xs text-white/30">Selecione um slide para ver as propriedades</p>
                </div>
              ) : (
                <div className="p-4 space-y-5">

                  {/* Media info */}
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Mídia</p>
                    <div className="rounded-lg overflow-hidden border border-white/10 bg-black mb-2"
                      style={{ aspectRatio: "16/9" }}>
                      <Thumb url={selectedItem.mediaUrl} type={selectedItem.mediaType} className="w-full h-full" />
                    </div>
                    <p className="text-xs font-semibold text-white truncate">{selectedItem.mediaName}</p>
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border mt-1 inline-block", typeColor(selectedItem.mediaType))}>
                      {typeLabel(selectedItem.mediaType)}
                    </span>
                  </div>

                  {/* File info — always shown for video/image */}
                  {(selectedItem.mediaType === "video" || selectedItem.mediaType === "image") && (() => {
                    const meta = parseFileMeta((selectedItem as any).mediaMetaJson);
                    const isIdeal = !!(meta?.width && meta.width === 1920 && meta.height === 1080);
                    const notIdeal = !!(meta?.width && meta.height && !isIdeal);
                    // Format: prefer metaJson mime → filename extension → generic type label
                    const fmtLabel = meta?.format
                      ? mimeToLabel(meta.format)
                      : extFromSrc(selectedItem.mediaUrl, selectedItem.mediaName);
                    return (
                      <div>
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Arquivo</p>
                        <div className="rounded-lg bg-white/4 border border-white/8 p-2.5 space-y-1.5 text-[10px]">
                          {/* Tipo */}
                          <div className="flex items-center justify-between">
                            <span className="text-white/40">Tipo</span>
                            <span className="text-white/60">{selectedItem.mediaType === "video" ? "Vídeo" : "Imagem"}</span>
                          </div>
                          {/* Format */}
                          <div className="flex items-center justify-between">
                            <span className="text-white/40">Formato</span>
                            <span className="font-mono text-white font-bold text-[11px]">{fmtLabel}</span>
                          </div>
                          {/* Resolution */}
                          <div className="flex items-center justify-between">
                            <span className="text-white/40">Resolução</span>
                            {meta?.width && meta.height ? (
                              <span className={`font-mono font-bold ${isIdeal ? "text-green-400" : "text-amber-400"}`}>
                                {meta.width}×{meta.height}
                              </span>
                            ) : (
                              <span className="font-mono text-white/30 italic text-[9px]">não detectada</span>
                            )}
                          </div>
                          {/* File size */}
                          {meta?.fileSize ? (
                            <div className="flex items-center justify-between">
                              <span className="text-white/40">Tamanho</span>
                              <span className="font-mono text-white/60">{formatBytes(meta.fileSize)}</span>
                            </div>
                          ) : null}
                          {/* Resolution status */}
                          {notIdeal && (
                            <div className="mt-1 p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] leading-snug">
                              ⚠ Resolução diferente de 1920×1080. Pode aparecer distorcido na TV.
                            </div>
                          )}
                          {isIdeal && (
                            <div className="mt-1 p-1.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 text-[9px]">
                              ✓ Resolução ideal para TV Full HD
                            </div>
                          )}
                          {!meta?.width && !meta?.height && (
                            <div className="mt-1 p-1.5 rounded bg-white/5 border border-white/8 text-white/30 text-[9px]">
                              Reenvie o arquivo para detectar resolução automaticamente.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* RSS-specific fields */}
                  {selectedItem.mediaType === "rss" && (() => {
                    const meta = (selectedItem as any).mediaMetaJson as Record<string, unknown> | null;
                    const currentUrl = (meta?.feedUrl as string) ?? selectedItem.mediaUrl ?? "";
                    const currentMode = (meta?.displayMode as string) ?? "ticker";
                    return (
                      <RssPropsPanel
                        mediaId={selectedItem.mediaId}
                        currentUrl={currentUrl}
                        currentMode={currentMode}
                        onSave={(url, mode) => {
                          updateMedia.mutate({ id: selectedItem.mediaId, data: {
                            metaJson: JSON.stringify({ feedUrl: url, displayMode: mode }),
                          }});
                        }}
                      />
                    );
                  })()}

                  {/* URL edit — YouTube, Pluto TV, Spotify, Web Channel */}
                  {(["youtube","youtube_playlist","pluto_tv","spotify","web_channel"] as const).includes(selectedItem.mediaType as any) && (
                    <UrlPropsPanel
                      key={selectedItem.mediaId}
                      mediaId={selectedItem.mediaId}
                      currentName={selectedItem.mediaName ?? ""}
                      currentUrl={selectedItem.mediaUrl ?? ""}
                      label={
                        selectedItem.mediaType === "youtube" ? "Canal / Vídeo YouTube" :
                        selectedItem.mediaType === "youtube_playlist" ? "Playlist YouTube" :
                        selectedItem.mediaType === "pluto_tv" ? "Canal Pluto TV" :
                        selectedItem.mediaType === "spotify" ? "Spotify" :
                        "Página Web"
                      }
                      placeholder={
                        selectedItem.mediaType === "spotify"
                          ? "https://open.spotify.com/..."
                          : selectedItem.mediaType === "web_channel"
                          ? "https://..."
                          : "https://www.youtube.com/watch?v=..."
                      }
                      onSave={(name, url) => {
                        updateMedia.mutate({ id: selectedItem.mediaId, data: { name, url } });
                      }}
                    />
                  )}

                  {/* Object Fit */}
                  {(selectedItem.mediaType === "image" || selectedItem.mediaType === "video") && (
                    <div>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Encaixe na tela</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([
                          { value: "contain", label: "Ajustar", desc: "Sem corte" },
                          { value: "cover",   label: "Preencher", desc: "Recorta bordas" },
                          { value: "fill",    label: "Esticar", desc: "Distorce" },
                        ] as const).map(({ value, label, desc }) => {
                          const current = (selectedItem as any).objectFit ?? "contain";
                          const active = current === value;
                          return (
                            <button
                              key={value}
                              onClick={() => updateItem.mutate({
                                id: selectedItem.playlistId,
                                itemId: selectedItem.id,
                                data: { objectFit: value },
                              })}
                              className={`flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg border text-center transition-all ${
                                active
                                  ? "border-blue-500 bg-blue-500/15 text-blue-300"
                                  : "border-white/10 bg-white/3 text-white/40 hover:border-white/20 hover:text-white/60"
                              }`}
                            >
                              <span className="text-[10px] font-bold leading-none">{label}</span>
                              <span className="text-[9px] leading-none opacity-60">{desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Duration — hidden for video (video uses its natural playback duration) */}
                  {selectedItem.mediaType !== "video" && (
                    <div>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Duração</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="range" min={1} max={120}
                          value={selectedItem.durationSeconds}
                          onChange={(e) => handleDurationChange(selectedItem.id, Number(e.target.value))}
                          className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer"
                          style={{ accentColor: "#3b82f6" }}
                        />
                        <div className="flex items-center gap-1">
                          <Input
                            type="number" min={1} max={300}
                            value={selectedItem.durationSeconds}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v) && v > 0) handleDurationChange(selectedItem.id, v);
                            }}
                            className="w-14 h-7 text-xs text-right px-1 bg-white/8 border-white/15 text-white"
                          />
                          <span className="text-xs text-white/40">s</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-white/25 mt-1">
                        Duração total: {formatDur(totalDuration)}
                      </p>
                    </div>
                  )}

                  {/* Position */}
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Posição na playlist</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-white/30">Slide</p>
                        <div className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white tabular-nums">
                          {selectedIdx + 1} de {displayItems.length}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-white/30">Tempo de entrada</p>
                        <div className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white tabular-nums">
                          {formatDur(displayItems.slice(0, selectedIdx).reduce((s, i) => s + i.durationSeconds, 0))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => handleRemove(selectedItem.id)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-red-400/70 hover:text-red-300 bg-red-500/8 hover:bg-red-500/15 border border-red-500/20 hover:border-red-400/30 py-2 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remover slide
                  </button>
                </div>
              )}
          </div>
        </div>
      </div>}

      {/* ════ DIALOG: Canvas — Selecionar Mídia ════ */}
      {canvasPickerOpen && (
        <Dialog open onOpenChange={(o) => { setCanvasPickerOpen(o); if (!o) setCanvasPickerSearch(""); }}>
          <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0 bg-[#0e1018] border-white/10">
            <DialogHeader className="px-4 pt-4 pb-3 border-b border-white/8 shrink-0">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  Adicionar ao Canvas
                </DialogTitle>
                <button onClick={() => setCanvasPickerOpen(false)} className="text-white/40 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <Input
                  placeholder="Buscar por nome…"
                  value={canvasPickerSearch}
                  onChange={(e) => setCanvasPickerSearch(e.target.value)}
                  autoFocus
                  className="pl-9 h-9 text-sm bg-white/6 border-white/10 text-white placeholder:text-white/30 focus:border-blue-500/50"
                />
              </div>
            </DialogHeader>
            <ScrollArea className="flex-1">
              <div className="p-4 grid grid-cols-3 gap-3">
                {(mediaItems ?? [])
                  .filter((m) => m.name.toLowerCase().includes(canvasPickerSearch.toLowerCase()))
                  .map((media) => (
                    <button
                      key={media.id}
                      onClick={() => {
                        const newLayer = mediaToLayer(
                          { id: media.id, name: media.name, type: media.type, url: media.url, durationSeconds: media.durationSeconds } as CanvasMediaItem,
                          canvasData.layers.length
                        );
                        handleCanvasChange({ ...canvasData, layers: [...canvasData.layers, newLayer] });
                        setCanvasPickerOpen(false);
                      }}
                      className="group relative text-left rounded-lg border border-white/8 hover:border-blue-500/50 bg-white/3 hover:bg-blue-500/8 transition-all overflow-hidden"
                    >
                      <div className="w-full bg-black" style={{ aspectRatio: "16/9" }}>
                        <Thumb url={media.url} type={media.type} className="w-full h-full" />
                      </div>
                      <div className="p-2">
                        <p className="text-[11px] font-medium truncate leading-tight text-white/80 group-hover:text-white transition-colors">
                          {media.name}
                        </p>
                        <span className={cn("text-[9px] font-bold px-1 py-0.5 rounded border mt-1 inline-block", typeColor(media.type))}>
                          {typeLabel(media.type)}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* ════ DIALOG: Selecionar Mídia ════ */}
      {pickerOpen && <Dialog open onOpenChange={(o) => { setPickerOpen(o); if (!o) { setSearchMedia(""); setPickerMulti(false); setPickerSelected(new Set()); } }}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0 bg-[#0e1018] border-white/10">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-white/8 shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm font-semibold text-white flex items-center gap-2">
                {pickerType === "image" && <ImageIcon className="w-4 h-4 text-emerald-400" />}
                {pickerType === "video" && <Film className="w-4 h-4 text-purple-400" />}
                {pickerType === "web_channel" && <Globe className="w-4 h-4 text-blue-400" />}
                Selecionar {pickerType === "image" ? "Imagem" : pickerType === "video" ? "Vídeo" : "Webpage"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPickerMulti(v => !v); setPickerSelected(new Set()); }}
                  title={pickerMulti ? "Modo seleção múltipla ativado" : "Ativar seleção múltipla"}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                    pickerMulti
                      ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                      : "bg-white/5 text-white/40 border-white/10 hover:text-white/70 hover:border-white/20"
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  Múltiplos
                </button>
                <button onClick={() => setPickerOpen(false)} className="text-white/40 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Search */}
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <Input
                placeholder="Buscar por nome…"
                value={searchMedia}
                onChange={(e) => setSearchMedia(e.target.value)}
                autoFocus
                className="pl-9 h-9 text-sm bg-white/6 border-white/10 text-white placeholder:text-white/30 focus:border-blue-500/50"
              />
            </div>
          </DialogHeader>

          {/* Grid */}
          <ScrollArea className="flex-1">
            {mediaLoading ? (
              <div className="p-4 grid grid-cols-3 gap-3">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="w-full aspect-video rounded bg-white/8" />
                    <Skeleton className="h-3 w-3/4 bg-white/8" />
                  </div>
                ))}
              </div>
            ) : filteredMedia?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <Search className="w-8 h-8 text-white/15" />
                <p className="text-sm text-white/30">Nenhuma mídia encontrada</p>
                <p className="text-xs text-white/20">Faça upload na Biblioteca e volte aqui</p>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-3 gap-3">
                {filteredMedia?.map((media) => {
                  const isSelected = pickerSelected.has(media.id);
                  const inPlaylistCount = addedCounts.get(media.id) ?? 0;
                  return (
                    <button
                      key={media.id}
                      onClick={() => {
                        if (pickerMulti) {
                          setPickerSelected(prev => {
                            const next = new Set(prev);
                            if (next.has(media.id)) next.delete(media.id);
                            else next.add(media.id);
                            return next;
                          });
                        } else {
                          handleAdd(media.id, media.durationSeconds ?? 10);
                          // keep picker open so user can add the same item again
                        }
                      }}
                      className={`group relative text-left rounded-lg border transition-all overflow-hidden ${
                        isSelected
                          ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/40"
                          : inPlaylistCount > 0
                            ? "border-emerald-500/40 bg-emerald-500/5 hover:border-blue-500/50 hover:bg-blue-500/8"
                            : "border-white/8 hover:border-blue-500/50 bg-white/3 hover:bg-blue-500/8"
                      }`}
                    >
                      {/* Already-in-playlist badge */}
                      {inPlaylistCount > 0 && !pickerMulti && (
                        <div className="absolute top-1.5 left-1.5 z-10">
                          <span className="inline-flex items-center gap-0.5 bg-emerald-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                            {inPlaylistCount}×
                          </span>
                        </div>
                      )}
                      {/* Checkmark overlay in multi mode */}
                      {pickerMulti && (
                        <div className={`absolute top-1.5 right-1.5 z-10 transition-all ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}>
                          <div className={`rounded-full p-0.5 ${isSelected ? "bg-blue-500 text-white" : "bg-black/60 text-white/60"}`}>
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        </div>
                      )}
                      <div className="w-full bg-black" style={{ aspectRatio: "16/9" }}>
                        <Thumb url={media.url} type={media.type} className="w-full h-full" />
                      </div>
                      <div className="p-2">
                        <p className={`text-[11px] font-medium truncate leading-tight transition-colors ${isSelected ? "text-white" : "text-white/80 group-hover:text-white"}`}>
                          {media.name}
                        </p>
                        {media.durationSeconds ? (
                          <p className="text-[10px] text-white/30 mt-0.5">{media.durationSeconds}s</p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Multi-select footer */}
          {pickerMulti && (
            <div className="shrink-0 px-4 py-3 border-t border-white/8 flex items-center justify-between gap-3">
              <p className="text-xs text-white/40">
                {pickerSelected.size === 0
                  ? "Clique nos itens para selecionar"
                  : `${pickerSelected.size} item${pickerSelected.size !== 1 ? "s" : ""} selecionado${pickerSelected.size !== 1 ? "s" : ""}`}
              </p>
              <div className="flex items-center gap-2">
                {pickerSelected.size > 0 && (
                  <button
                    onClick={() => setPickerSelected(new Set())}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    Limpar
                  </button>
                )}
                <Button
                  size="sm"
                  disabled={pickerSelected.size === 0 || addItem.isPending}
                  onClick={handleAddMultiple}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar {pickerSelected.size > 0 ? pickerSelected.size : ""} {pickerSelected.size === 1 ? "item" : "itens"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>}

      {/* ════ DIALOG: Clima ════ */}
      <Dialog open={weatherDialogOpen} onOpenChange={setWeatherDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudSun className="w-4 h-4 text-sky-400" /> Adicionar Widget de Clima
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Cidade</Label>
              <Input
                placeholder="Ex: Ribeirão Preto, São Paulo, Curitiba..."
                value={weatherForm.city}
                onChange={(e) => setWeatherForm(f => ({ ...f, city: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleSaveWeather()}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">Temperatura atual + condição + vento (Open-Meteo, sem chave de API).</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do slide <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                placeholder={weatherForm.city || "Ex: Clima Ribeirão Preto"}
                value={weatherForm.name}
                onChange={(e) => setWeatherForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duração (segundos)</Label>
              <Input type="number" min={5} placeholder="20" value={weatherForm.durationSeconds}
                onChange={(e) => setWeatherForm(f => ({ ...f, durationSeconds: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setWeatherDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveWeather} disabled={createMedia.isPending}>
              {createMedia.isPending ? "Adicionando…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════ DIALOG: Previsão do Tempo ════ */}
      <Dialog open={forecastDialogOpen} onOpenChange={setForecastDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-amber-400" /> Previsão do Tempo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Cidade</Label>
              <Input
                placeholder="Ex: Ribeirão Preto, São Paulo, Curitiba..."
                value={forecastForm.city}
                onChange={(e) => setForecastForm(f => ({ ...f, city: e.target.value }))}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">Previsão de máxima/mínima por dia (Open-Meteo, sem chave de API).</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do slide <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                placeholder={forecastForm.city ? `Previsão ${forecastForm.city}` : "Ex: Previsão Ribeirão Preto"}
                value={forecastForm.name}
                onChange={(e) => setForecastForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Dias a exibir</Label>
                <div className="flex gap-1">
                  {[3, 5, 7].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setForecastForm(f => ({ ...f, days: String(d) }))}
                      className={cn(
                        "flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors",
                        forecastForm.days === String(d)
                          ? "bg-amber-500 text-black border-amber-400"
                          : "bg-background text-muted-foreground border-border hover:border-amber-400/50"
                      )}
                    >{d} dias</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Duração (segundos)</Label>
                <Input type="number" min={5} placeholder="30" value={forecastForm.durationSeconds}
                  onChange={(e) => setForecastForm(f => ({ ...f, durationSeconds: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setForecastDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveForecast} disabled={createMedia.isPending} className="gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              {createMedia.isPending ? "Adicionando…" : "Adicionar Previsão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════ DIALOG: RSS ════ */}
      <Dialog open={rssDialogOpen} onOpenChange={setRssDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RssIcon className="w-4 h-4 text-orange-400" /> Adicionar Feed RSS
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input placeholder="Ex: G1 Notícias" value={rssForm.name}
                onChange={(e) => setRssForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">URL do Feed RSS</Label>
              <Input placeholder="https://..." value={rssForm.feedUrl}
                onChange={(e) => setRssForm(f => ({ ...f, feedUrl: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Modo de exibição</Label>
              <div className="flex gap-2">
                {(["ticker", "fullscreen"] as const).map(mode => (
                  <button key={mode} type="button"
                    onClick={() => setRssForm(f => ({ ...f, displayMode: mode }))}
                    className={cn(
                      "flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors",
                      rssForm.displayMode === mode
                        ? "bg-orange-500 text-black border-orange-400"
                        : "bg-background text-muted-foreground border-border hover:border-orange-400/50"
                    )}
                  >{mode === "ticker" ? "Faixa inferior (ticker)" : "Tela cheia"}</button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRssDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveRss} disabled={createMedia.isPending}>
              {createMedia.isPending ? "Adicionando…" : "Adicionar RSS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════ DIALOG: Publicar em Tela ════ */}
      <Dialog open={applyOpen} onOpenChange={(open) => { if (!open) { setApplyOpen(false); setApplyScreenId(""); } }}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4" /> Publicar na Tela
            </DialogTitle>
            <DialogDescription>
              Selecione a tela para exibir <strong>{playlist?.name}</strong>. O conteúdo vai rodar 24h por dia, todos os dias.
            </DialogDescription>
          </DialogHeader>

          <div className="py-1">
            {!(screens as any[])?.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhuma tela cadastrada. Adicione uma tela em <strong>Minhas Telas</strong>.
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="px-3 py-2 w-8"></th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome da Tela</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Resolução</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Playlist Atual</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Local</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(screens as any[]).map((s: any) => {
                      const isOnline = s.status === "online";
                      const isSelected = applyScreenId === String(s.id);
                      const activePl = s.activePlaylistName as string | null | undefined;
                      const sResolution = s.resolution as string | null | undefined;
                      return (
                        <tr
                          key={s.id}
                          className={`border-b last:border-0 cursor-pointer transition-colors ${isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/30"}`}
                          onClick={() => setApplyScreenId(String(s.id))}
                        >
                          <td className="px-3 py-3 text-center">
                            <div className={`w-4 h-4 rounded-full border-2 mx-auto flex items-center justify-center ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Monitor className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium">{s.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {isOnline ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                <Wifi className="w-3 h-3" /> Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                                <WifiOff className="w-3 h-3" /> Offline
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center hidden sm:table-cell">
                            <span className="text-xs font-mono text-muted-foreground">
                              {sResolution
                                ? sResolution.replace(/(\d+(\.\d+)?)/g, (m: string) => String(Math.round(Number(m))))
                                : "—"}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {activePl ? (
                              <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full max-w-[140px] truncate">
                                <PlaySquare className="w-3 h-3 shrink-0" />
                                <span className="truncate">{activePl}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50 italic">Nenhuma</span>
                            )}
                          </td>
                          <td className="px-3 py-3 hidden md:table-cell">
                            <span className="text-xs text-muted-foreground">{s.location ?? "—"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setApplyOpen(false); setApplyScreenId(""); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleApply}
              disabled={!applyScreenId}
              className="gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppGallery open={appsGalleryOpen} onOpenChange={setAppsGalleryOpen} onSelectApp={handleSelectAppForPlaylist} />

      {/* ── Text Widget Dialog ── */}
      <Dialog open={textDialogOpen} onOpenChange={(o) => { if (!o) setTextDialogOpen(false); }}>
        <DialogContent className="bg-[#0e1018] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Texto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Preview */}
            <div
              className="w-full h-24 rounded-lg flex items-center justify-center overflow-hidden"
              style={{
                background: textForm.bgOpacity > 0
                  ? `rgba(${parseInt(textForm.bg.slice(1,3),16)},${parseInt(textForm.bg.slice(3,5),16)},${parseInt(textForm.bg.slice(5,7),16)},${textForm.bgOpacity/100})`
                  : "#111",
              }}
            >
              <span style={{
                fontFamily: textForm.font,
                fontSize: Math.min(textForm.size, 48),
                fontWeight: textForm.bold ? "bold" : "normal",
                fontStyle: textForm.italic ? "italic" : "normal",
                textTransform: textForm.uppercase ? "uppercase" : "none",
                textAlign: textForm.align,
                color: ["rainbow","fire","ice","gold","chrome","gradient","led"].includes(textForm.effect) ? "transparent" : textForm.color,
                background: textForm.effect === "gradient" ? `linear-gradient(135deg,${textForm.color},${textForm.gradientTo})` :
                  textForm.effect === "rainbow" ? "linear-gradient(to right,#f00,#f80,#ff0,#0c4,#08f,#c0f)" :
                  textForm.effect === "fire" ? "linear-gradient(to top,#c00,#f40,#f90,#fee)" :
                  textForm.effect === "ice" ? "linear-gradient(to bottom,#fff,#aef,#09c,#036)" :
                  textForm.effect === "gold" ? "linear-gradient(to bottom,#ffe066,#ffd700,#c80,#ffd700)" :
                  textForm.effect === "chrome" ? "linear-gradient(to bottom,#fff,#ccc,#888,#eee,#777,#fff)" :
                  textForm.effect === "led" ? `linear-gradient(to bottom,#fff,${textForm.color},${textForm.shadowColor})` : "none",
                WebkitBackgroundClip: ["rainbow","fire","ice","gold","chrome","gradient","led"].includes(textForm.effect) ? "text" : undefined,
                backgroundClip: ["rainbow","fire","ice","gold","chrome","gradient","led"].includes(textForm.effect) ? "text" : undefined,
                WebkitTextFillColor: ["rainbow","fire","ice","gold","chrome","gradient","led"].includes(textForm.effect) ? "transparent" : undefined,
                textShadow: textForm.effect === "shadow" ? `3px 3px 6px ${textForm.shadowColor}` :
                  textForm.effect === "glow" ? `0 0 10px ${textForm.shadowColor},0 0 30px ${textForm.shadowColor}` : "none",
                WebkitTextStroke: textForm.effect === "outline" ? `2px ${textForm.strokeColor}` : undefined,
              }}>
                {textForm.content || "Seu texto"}
              </span>
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <Label className="text-xs">Texto</Label>
              <textarea
                rows={3}
                value={textForm.content}
                onChange={(e) => setTextForm(f => ({ ...f, content: e.target.value }))}
                className="w-full bg-[#1a1f2e] border border-white/15 text-white text-sm rounded px-3 py-2 resize-none focus:outline-none focus:border-blue-400/50"
                placeholder="Digite o texto a exibir na tela..."
                autoFocus
              />
            </div>

            {/* Font + Size */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fonte</Label>
                <select
                  value={textForm.font}
                  onChange={(e) => setTextForm(f => ({ ...f, font: e.target.value }))}
                  className="w-full bg-[#1a1f2e] border border-white/15 text-white text-xs rounded px-2 py-2 focus:outline-none"
                  style={{ fontFamily: textForm.font }}
                >
                  {[
                    { label: "Impact", value: "Impact, 'Arial Black', sans-serif" },
                    { label: "Arial", value: "Arial, sans-serif" },
                    { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
                    { label: "Georgia", value: "Georgia, serif" },
                    { label: "Times New Roman", value: "'Times New Roman', serif" },
                    { label: "Courier New", value: "'Courier New', monospace" },
                    { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
                    { label: "Tahoma", value: "Tahoma, sans-serif" },
                    { label: "Comic Sans", value: "'Comic Sans MS', cursive" },
                  ].map(f => <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tamanho: {textForm.size}px</Label>
                <input type="range" min={16} max={300} step={4}
                  value={textForm.size}
                  onChange={(e) => setTextForm(f => ({ ...f, size: Number(e.target.value) }))}
                  className="w-full h-2 cursor-pointer" style={{ accentColor: "#7c3aed" }}
                />
              </div>
            </div>

            {/* Style toggles */}
            <div className="space-y-1.5">
              <Label className="text-xs">Estilo & Alinhamento</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: "bold", label: "N" as const, title: "Negrito" },
                  { key: "italic", label: "I" as const, title: "Itálico" },
                  { key: "uppercase", label: "AA" as const, title: "MAIÚSCULAS" },
                ].map(({ key, label, title }) => (
                  <button key={key} title={title}
                    onClick={() => setTextForm(f => ({ ...f, [key]: !f[key as keyof typeof f] }))}
                    className={`px-3 py-1 rounded border text-xs font-bold transition-all ${(textForm as any)[key] ? "bg-purple-500/25 border-purple-400/50 text-purple-300" : "bg-white/5 border-white/10 text-white/40"}`}
                  >{label}</button>
                ))}
                <div className="w-px bg-white/10 mx-1" />
                {(["left","center","right"] as const).map(a => (
                  <button key={a}
                    onClick={() => setTextForm(f => ({ ...f, align: a }))}
                    className={`px-3 py-1 rounded border text-xs transition-all ${textForm.align === a ? "bg-purple-500/25 border-purple-400/50 text-purple-300" : "bg-white/5 border-white/10 text-white/40"}`}
                  >{a === "left" ? "◀" : a === "center" ? "≡" : "▶"}</button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <Label className="text-xs">Cor do texto</Label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {["#ffffff","#000000","#f87171","#fb923c","#facc15","#4ade80","#22d3ee","#60a5fa","#a78bfa","#f472b6","#ff6600","#00ffcc"].map(c => (
                  <button key={c} onClick={() => setTextForm(f => ({ ...f, color: c }))}
                    style={{ background: c, width: 20, height: 20, borderRadius: 3, border: textForm.color === c ? "2px solid #7c3aed" : "1px solid rgba(255,255,255,0.15)" }}
                  />
                ))}
                <input type="color" value={textForm.color}
                  onChange={(e) => setTextForm(f => ({ ...f, color: e.target.value }))}
                  className="w-5 h-5 rounded cursor-pointer border border-white/10 bg-transparent"
                />
              </div>
            </div>

            {/* Effect */}
            <div className="space-y-1.5">
              <Label className="text-xs">Efeito</Label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { value: "none", label: "Normal", emoji: "A" },
                  { value: "shadow", label: "Sombra", emoji: "🌑" },
                  { value: "outline", label: "Contorno", emoji: "◻" },
                  { value: "glow", label: "Brilho", emoji: "✨" },
                  { value: "gradient", label: "Degradê", emoji: "🎨" },
                  { value: "led", label: "LED", emoji: "💡" },
                  { value: "rainbow", label: "Arco-íris", emoji: "🌈" },
                  { value: "fire", label: "Fogo", emoji: "🔥" },
                  { value: "ice", label: "Gelo", emoji: "❄️" },
                  { value: "gold", label: "Dourado", emoji: "🥇" },
                  { value: "chrome", label: "Cromado", emoji: "🪞" },
                ].map(ef => (
                  <button key={ef.value} onClick={() => setTextForm(f => ({ ...f, effect: ef.value }))}
                    className={`flex flex-col items-center gap-0.5 py-1.5 rounded border text-center transition-all text-[10px] ${textForm.effect === ef.value ? "bg-purple-500/20 border-purple-400/50 text-purple-300" : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"}`}
                  >
                    <span className="text-sm leading-none">{ef.emoji}</span>
                    <span className="leading-none">{ef.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Effect color params */}
            {(textForm.effect === "shadow" || textForm.effect === "glow" || textForm.effect === "led") && (
              <div className="space-y-1.5">
                <Label className="text-xs">{textForm.effect === "shadow" ? "Cor da sombra" : "Cor do brilho"}</Label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["#000000","#ffffff","#f87171","#fb923c","#facc15","#4ade80","#22d3ee","#60a5fa","#a78bfa"].map(c => (
                    <button key={c} onClick={() => setTextForm(f => ({ ...f, shadowColor: c }))}
                      style={{ background: c, width: 20, height: 20, borderRadius: 3, border: textForm.shadowColor === c ? "2px solid #7c3aed" : "1px solid rgba(255,255,255,0.15)" }}
                    />
                  ))}
                  <input type="color" value={textForm.shadowColor}
                    onChange={(e) => setTextForm(f => ({ ...f, shadowColor: e.target.value }))}
                    className="w-5 h-5 rounded cursor-pointer border border-white/10 bg-transparent"
                  />
                </div>
              </div>
            )}
            {textForm.effect === "outline" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Cor do contorno</Label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["#000000","#ffffff","#f87171","#fb923c","#facc15","#4ade80","#22d3ee","#60a5fa","#a78bfa"].map(c => (
                    <button key={c} onClick={() => setTextForm(f => ({ ...f, strokeColor: c }))}
                      style={{ background: c, width: 20, height: 20, borderRadius: 3, border: textForm.strokeColor === c ? "2px solid #7c3aed" : "1px solid rgba(255,255,255,0.15)" }}
                    />
                  ))}
                  <input type="color" value={textForm.strokeColor}
                    onChange={(e) => setTextForm(f => ({ ...f, strokeColor: e.target.value }))}
                    className="w-5 h-5 rounded cursor-pointer border border-white/10 bg-transparent"
                  />
                </div>
              </div>
            )}
            {textForm.effect === "gradient" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Segunda cor do degradê</Label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["#ffcc00","#ff6600","#ff0080","#00ffcc","#0088ff","#aa00ff","#ffffff","#000000"].map(c => (
                    <button key={c} onClick={() => setTextForm(f => ({ ...f, gradientTo: c }))}
                      style={{ background: c, width: 20, height: 20, borderRadius: 3, border: textForm.gradientTo === c ? "2px solid #7c3aed" : "1px solid rgba(255,255,255,0.15)" }}
                    />
                  ))}
                  <input type="color" value={textForm.gradientTo}
                    onChange={(e) => setTextForm(f => ({ ...f, gradientTo: e.target.value }))}
                    className="w-5 h-5 rounded cursor-pointer border border-white/10 bg-transparent"
                  />
                </div>
              </div>
            )}

            {/* Background */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cor do fundo</Label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["#000000","#ffffff","#1a1a2e","#0d1b2a","#1b1b2f","#2d1b69"].map(c => (
                    <button key={c} onClick={() => setTextForm(f => ({ ...f, bg: c }))}
                      style={{ background: c, width: 20, height: 20, borderRadius: 3, border: textForm.bg === c ? "2px solid #7c3aed" : "1px solid rgba(255,255,255,0.15)" }}
                    />
                  ))}
                  <input type="color" value={textForm.bg}
                    onChange={(e) => setTextForm(f => ({ ...f, bg: e.target.value }))}
                    className="w-5 h-5 rounded cursor-pointer border border-white/10 bg-transparent"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Opacidade do fundo: {textForm.bgOpacity}%</Label>
                <input type="range" min={0} max={100} step={5}
                  value={textForm.bgOpacity}
                  onChange={(e) => setTextForm(f => ({ ...f, bgOpacity: Number(e.target.value) }))}
                  className="w-full h-2 cursor-pointer" style={{ accentColor: "#7c3aed" }}
                />
              </div>
            </div>

            {/* Animation */}
            <div className="space-y-2 rounded-lg border border-white/10 bg-white/3 p-3">
              <Label className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Animação (movimento)</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { id: "none",          label: "Estático",       icon: "■" },
                  { id: "scroll_left",   label: "← Esquerda",    icon: "←" },
                  { id: "scroll_right",  label: "Direita →",     icon: "→" },
                  { id: "scroll_up",     label: "↑ Subir",       icon: "↑" },
                  { id: "scroll_down",   label: "↓ Descer",      icon: "↓" },
                  { id: "blink",         label: "Piscar",         icon: "✦" },
                ] as const).map(a => (
                  <button key={a.id} onClick={() => setTextForm(f => ({ ...f, animation: a.id }))}
                    className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded text-xs font-medium transition-all ${textForm.animation === a.id ? "bg-purple-600 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
                  >
                    <span className="text-base leading-none">{a.icon}</span>
                    <span className="text-[10px]">{a.label}</span>
                  </button>
                ))}
              </div>
              {textForm.animation !== "none" && (
                <div className="space-y-1">
                  <Label className="text-xs text-white/70">Velocidade: {["","Lenta","","Moderada","","Média","","Rápida","","Muito rápida",""][textForm.animSpeed] ?? textForm.animSpeed}</Label>
                  <input type="range" min={1} max={10} step={1}
                    value={textForm.animSpeed}
                    onChange={(e) => setTextForm(f => ({ ...f, animSpeed: Number(e.target.value) }))}
                    className="w-full h-2 cursor-pointer" style={{ accentColor: "#7c3aed" }}
                  />
                  <div className="flex justify-between text-[9px] text-white/30">
                    <span>1 - Lenta</span><span>10 - Rápida</span>
                  </div>
                </div>
              )}
            </div>

            {/* Duration + Name */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Duração (segundos)</Label>
                <Input type="number" min={3}
                  value={textForm.duration}
                  onChange={(e) => setTextForm(f => ({ ...f, duration: e.target.value }))}
                  className="h-9 bg-[#1a1f2e] border-white/15 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome <span className="text-white/40">(opcional)</span></Label>
                <Input
                  placeholder={textForm.content.slice(0, 20) || "Texto"}
                  value={textForm.name}
                  onChange={(e) => setTextForm(f => ({ ...f, name: e.target.value }))}
                  className="h-9 bg-[#1a1f2e] border-white/15 text-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTextDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveText} disabled={createMedia.isPending} className="gap-1.5 bg-purple-600 hover:bg-purple-700">
              {createMedia.isPending ? "Adicionando…" : "Adicionar à playlist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── URL App Dialog ── */}
      {urlAppDialog && (
        <Dialog open={!!urlAppDialog} onOpenChange={(o) => { if (!o) { setUrlAppDialog(null); setUrlAppForm({ name: "", url: "", duration: "30" }); } }}>
          <DialogContent className="bg-[#0e1018] border-white/10 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar {urlAppDialog.label}</DialogTitle>
            </DialogHeader>

            {/* Existing items of same type — reusar sem criar novo */}
            {(mediaItems ?? []).filter(m => m.type === urlAppDialog.type).length > 0 && (
              <div className="pb-3 border-b border-white/10 space-y-2">
                <p className="text-xs text-white/50 font-medium">Já cadastrados — clique para usar direto:</p>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {(mediaItems ?? []).filter(m => m.type === urlAppDialog.type).map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        handleAdd(item.id, item.durationSeconds ?? urlAppDialog.defaultDuration);
                        setUrlAppDialog(null);
                        setUrlAppForm({ name: "", url: "", duration: "30" });
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 text-left text-sm transition-all"
                    >
                      <span className="truncate text-white/80">{item.name}</span>
                      <span className="text-xs text-emerald-400 shrink-0 ml-2 font-medium">Usar →</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/30 text-center">— ou crie um novo abaixo —</p>
              </div>
            )}

            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">URL</Label>
                <Input
                  placeholder={urlAppDialog.placeholder}
                  value={urlAppForm.url}
                  onChange={(e) => setUrlAppForm(f => ({ ...f, url: e.target.value }))}
                  className="h-9 bg-[#1a1f2e] border-white/15 text-white"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome <span className="text-white/40">(opcional)</span></Label>
                <Input
                  placeholder={urlAppDialog.label}
                  value={urlAppForm.name}
                  onChange={(e) => setUrlAppForm(f => ({ ...f, name: e.target.value }))}
                  className="h-9 bg-[#1a1f2e] border-white/15 text-white"
                />
              </div>
              {urlAppDialog.defaultDuration > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Duração (segundos)</Label>
                  <Input
                    type="number" min={5}
                    value={urlAppForm.duration}
                    onChange={(e) => setUrlAppForm(f => ({ ...f, duration: e.target.value }))}
                    className="h-9 bg-[#1a1f2e] border-white/15 text-white"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setUrlAppDialog(null)}>Cancelar</Button>
              <Button size="sm" onClick={handleSaveUrlApp} disabled={createMedia.isPending}>
                Adicionar à playlist
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
