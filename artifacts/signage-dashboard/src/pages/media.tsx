import { useState, useRef, useMemo } from "react";
import {
  useListMedia,
  useCreateMedia,
  useDeleteMedia,
  useUpdateMedia,
  useRequestUploadUrl,
  getListMediaQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Image as ImageIcon, Film, Search, Upload, Trash2, Pencil,
  Eye, LayoutGrid, List, Check, X, FolderOpen, ChevronRight, Tv, Plus,
  Clock, Cloud, Rss, AlertTriangle, CalendarDays,
  ChevronUp, ChevronDown, ChevronsUpDown, Tag, Youtube, Radio, Clapperboard,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ObjectUploader } from "@workspace/object-storage-web";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";
import { VideoThumbnail } from "@/components/video-thumbnail";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type ViewMode = "list" | "grid";
// Tipos que são widgets de playlist — não aparecem na biblioteca, só no editor de playlist
const WIDGET_TYPES = new Set(["rss", "clock", "weather", "weather_forecast", "date", "qr_code", "text"]);

type TypeFilter = "all" | "image" | "video" | "web_channel" | "youtube" | "youtube_playlist" | "canva" | "google_slides" | "draft" | "unused" | "no_name";
type SortKey = "name" | "type" | "durationSeconds" | "createdAt";
type SortDir = "asc" | "desc";

interface MediaItem {
  id: number;
  name: string;
  type: string;
  url: string;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  metaJson?: string | null;
  createdAt: string;
}

/** Mesmo nome+tipo = duplicata de biblioteca (upload / mídia edit). */
function findLibraryDuplicate(
  items: MediaItem[] | undefined,
  name: string,
  type: string,
) {
  const nameKey = name.trim();
  return (items ?? []).find((m) => {
    if (m.type === "draft" || m.type !== type) return false;
    return (m.name || "").trim() === nameKey;
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function resolveMediaUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/objects/")) return `/api/storage${url}`;
  return url;
}

function MediaThumb({ url, type, thumbnailUrl, className }: { url: string; type: string; thumbnailUrl?: string | null; className?: string }) {
  if (type === "video") {
    if (thumbnailUrl) {
      return <img src={thumbnailUrl} alt="" className={cn("object-cover", className)} loading="lazy" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />;
    }
    const resolved = resolveMediaUrl(url);
    return <VideoThumbnail url={resolved} className={className} />;
  }
  if (type === "web_channel") {
    return (
      <div className={cn("bg-blue-950/60 flex items-center justify-center", className)}>
        <Tv className="w-1/3 h-1/3 min-w-3 min-h-3 text-blue-400/70" />
      </div>
    );
  }
  if (type === "youtube") {
    const match = url.match(/\/embed\/([A-Za-z0-9_-]{11})/);
    const videoId = match?.[1];
    if (videoId) {
      return (
        <div className={cn("relative overflow-hidden", className)}>
          <img
            src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Youtube className="w-1/4 h-1/4 min-w-4 min-h-4 text-red-500 drop-shadow" />
          </div>
        </div>
      );
    }
    return (
      <div className={cn("bg-red-950/60 flex items-center justify-center", className)}>
        <Youtube className="w-1/3 h-1/3 min-w-3 min-h-3 text-red-400/70" />
      </div>
    );
  }
  if (type === "pluto_tv") {
    return (
      <div className={cn("bg-[#0d1b2a] flex flex-col items-center justify-center gap-0.5", className)}>
        <Radio className="w-1/3 h-1/3 min-w-3 min-h-3 text-cyan-400/70" />
      </div>
    );
  }
  if (type === "canva") {
    return (
      <div className={cn("bg-[#7D2AE7]/20 flex items-center justify-center", className)}>
        <span className="text-purple-400 font-black" style={{ fontSize: "clamp(12px, 30%, 36px)" }}>C</span>
      </div>
    );
  }
  if (type === "google_slides") {
    return (
      <div className={cn("bg-[#FBBC05]/15 flex items-center justify-center", className)}>
        <span className="text-yellow-400 font-black" style={{ fontSize: "clamp(10px, 26%, 32px)" }}>GS</span>
      </div>
    );
  }
  if (type === "youtube_playlist") {
    return (
      <div className={cn("bg-red-950/60 flex items-center justify-center gap-1", className)}>
        <Youtube className="w-1/4 h-1/4 min-w-3 min-h-3 text-red-400/70" />
      </div>
    );
  }
  if (type === "spotify") {
    return (
      <div className={cn("bg-[#1DB954]/15 flex items-center justify-center", className)}>
        <span className="text-green-400" style={{ fontSize: "clamp(14px, 34%, 40px)" }}>♫</span>
      </div>
    );
  }
  if (type === "instagram") {
    return (
      <div className={cn("flex items-center justify-center", className)} style={{ background: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" }}>
        <span className="text-white font-bold" style={{ fontSize: "clamp(10px, 22%, 26px)" }}>Ig</span>
      </div>
    );
  }
  if (type === "tiktok") {
    return (
      <div className={cn("bg-black flex items-center justify-center", className)}>
        <span className="text-white font-bold" style={{ fontSize: "clamp(10px, 22%, 26px)" }}>TT</span>
      </div>
    );
  }
  if (type === "date") {
    return (
      <div className={cn("bg-[#1e3a5f] flex flex-col items-center justify-center gap-1", className)}>
        <CalendarDays className="w-1/3 h-1/3 min-w-3 min-h-3 text-blue-300/80" />
      </div>
    );
  }
  if (type === "qr_code") {
    return (
      <div className={cn("bg-black flex items-center justify-center", className)}>
        <span className="text-white/70 font-mono font-bold" style={{ fontSize: "clamp(14px, 36%, 44px)" }}>▦</span>
      </div>
    );
  }
  if (type === "clock") {
    return (
      <div className={cn("bg-gray-900 flex flex-col items-center justify-center gap-1", className)}>
        <Clock className="w-1/3 h-1/3 min-w-3 min-h-3 text-white/60" />
      </div>
    );
  }
  if (type === "weather") {
    return (
      <div className={cn("bg-sky-950/60 flex items-center justify-center", className)}>
        <Cloud className="w-1/3 h-1/3 min-w-3 min-h-3 text-sky-400/70" />
      </div>
    );
  }
  if (type === "rss") {
    return (
      <div className={cn("bg-orange-950/40 flex items-center justify-center", className)}>
        <Rss className="w-1/3 h-1/3 min-w-3 min-h-3 text-orange-400/70" />
      </div>
    );
  }
  return (
    <img
      src={resolveMediaUrl(url)}
      alt=""
      className={cn("object-cover", className)}
      loading="lazy"
    />
  );
}

// ─── File metadata helpers ────────────────────────────────────────────────────
async function extractFileMetadata(file: { data?: Blob | File; type?: string; size?: number }) {
  const format = file.type ?? "";
  const fileSize = file.size ?? 0;
  const blob = file.data;
  if (!blob) return { format, fileSize };
  if (format.startsWith("image/")) {
    return new Promise<{ width?: number; height?: number; format: string; fileSize: number }>((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight, format, fileSize }); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve({ format, fileSize }); };
      img.src = url;
    });
  }
  if (format.startsWith("video/")) {
    return new Promise<{ width?: number; height?: number; duration?: number; format: string; fileSize: number }>((resolve) => {
      const video = document.createElement("video");
      const url = URL.createObjectURL(blob);
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: isFinite(video.duration) ? Math.round(video.duration) : undefined,
          format,
          fileSize,
        });
      };
      video.onerror = () => { URL.revokeObjectURL(url); resolve({ format, fileSize }); };
      video.src = url;
    });
  }
  return { format, fileSize };
}

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

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isGenericFilename(name: string): boolean {
  // WhatsApp: IMG-20240628-WA0023.jpg, VID-..., PTT-..., AUD-...
  if (/^(IMG|VID|PTT|AUD|DOC)-\d{6,8}-WA\d+/i.test(name)) return true;
  // UUID
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(name)) return true;
  // Pure timestamp filenames: 1748903774689.mp4, 20240628_123456.jpg
  if (/^\d{8,}[_.-]?\d*\.[a-z0-9]+$/i.test(name)) return true;
  // WhatsApp web uploads like "WhatsApp Image 2024-06-28 at 10.30.jpg"
  if (/^WhatsApp\s+(Image|Video|Audio)/i.test(name)) return true;
  // Names with no letters at all (pure numbers/symbols)
  if (/^[^a-zA-ZÀ-ú]+$/.test(name.replace(/\.[^.]+$/, ""))) return true;
  return false;
}

function RenameInput({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(initialValue);
  return (
    <div className="flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
      <Input
        autoFocus
        className="h-6 text-xs px-1.5 py-0 w-40"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(val);
          if (e.key === "Escape") onCancel();
        }}
      />
      <button onClick={() => onSave(val)} className="p-0.5 text-primary hover:text-primary/80">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={onCancel} className="p-0.5 text-muted-foreground hover:text-foreground">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function MediaLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [datePeriod, setDatePeriod] = useState<"all" | "today" | "week" | "month" | "year">("all");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // Clear selection when filter or search changes
  const prevFilterRef = useRef(typeFilter);
  if (prevFilterRef.current !== typeFilter) {
    prevFilterRef.current = typeFilter;
    if (selectedIds.size > 0) setSelectedIds(new Set());
  }
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [webChannelOpen, setWebChannelOpen] = useState(false);
  const [webChannelForm, setWebChannelForm] = useState({ name: "", url: "", durationSeconds: "0" });
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [youtubeForm, setYoutubeForm] = useState({ name: "", rawUrl: "", durationSeconds: "0" });
  const [youtubeEditId, setYoutubeEditId] = useState<number | null>(null);
  const [ytPlaylistOpen, setYtPlaylistOpen] = useState(false);
  const [ytPlaylistForm, setYtPlaylistForm] = useState({ name: "", rawUrl: "", durationSeconds: "0" });
  const [ytPlaylistEditId, setYtPlaylistEditId] = useState<number | null>(null);
  const [canvaOpen, setCanvaOpen] = useState(false);
  const [canvaForm, setCanvaForm] = useState({ name: "", url: "", durationSeconds: "0" });
  const [googleSlidesOpen, setGoogleSlidesOpen] = useState(false);
  const [googleSlidesForm, setGoogleSlidesForm] = useState({ name: "", rawInput: "", durationSeconds: "0" });
  const [dateOpen, setDateOpen] = useState(false);
  const [dateForm, setDateForm] = useState({ name: "Data de Hoje", durationSeconds: "30" });
  const [qrCodeOpen, setQrCodeOpen] = useState(false);
  const [qrCodeForm, setQrCodeForm] = useState({ name: "", url: "", label: "", durationSeconds: "30" });
  const [clockOpen, setClockOpen] = useState(false);
  const [clockForm, setClockForm] = useState({ name: "Relógio Digital", durationSeconds: "30" });

  const [rssOpen, setRssOpen] = useState(false);
  const [rssForm, setRssForm] = useState({ name: "", feedUrl: "", durationSeconds: "0", displayMode: "ticker" as "ticker" | "fullscreen" });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const objectPathMap = useRef(new Map<string, string>());
  const metadataMap = useRef(new Map<string, { width?: number; height?: number; format: string; fileSize: number }>());

  const { data: media, isLoading } = useListMedia();
  const createMedia = useCreateMedia();
  const deleteMedia = useDeleteMedia();
  const updateMedia = useUpdateMedia();
  const requestUploadUrl = useRequestUploadUrl();

  const { data: usageData } = useQuery<{ usedMediaIds: number[] }>({
    queryKey: ["media-usage"],
    queryFn: () => fetch("/api/media/usage", { credentials: "include" }).then((r) => r.json()),
    staleTime: 30_000,
  });
  const usedIds = new Set(usageData?.usedMediaIds ?? []);

  const { data: storageStats } = useQuery<{ count: number; totalBytes: number; quotaGb: number; quotaBytes: number; pct: number; nearLimit: boolean; overLimit: boolean }>({
    queryKey: ["media-storage-stats"],
    queryFn: () => fetch("/api/media/storage-stats", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });
  const storageUsedGB = storageStats ? (storageStats.totalBytes / (1024 ** 3)).toFixed(2) : "0.00";
  const storageQuotaGb = storageStats?.quotaGb ?? 5;
  const storagePct = storageStats?.pct ?? 0;
  const showStorageWarning = storageStats?.nearLimit ?? false;
  const overLimit = storageStats?.overLimit ?? false;

  const filtered = media?.filter((item) => {
    // Widgets de playlist nunca aparecem na biblioteca
    if (WIDGET_TYPES.has(item.type)) return false;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (typeFilter === "unused") return matchesSearch && !usedIds.has(item.id);
    if (typeFilter === "no_name") return matchesSearch && isGenericFilename(item.name);
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    if (!matchesSearch || !matchesType) return false;
    if (datePeriod !== "all" && item.createdAt) {
      const created = new Date(item.createdAt);
      const now = new Date();
      if (datePeriod === "today") {
        return created.toDateString() === now.toDateString();
      } else if (datePeriod === "week") {
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
        return created >= weekAgo;
      } else if (datePeriod === "month") {
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      } else if (datePeriod === "year") {
        return created.getFullYear() === now.getFullYear();
      }
    }
    return true;
  });

  const sorted = useMemo(() => {
    if (!filtered) return undefined;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name")            cmp = a.name.localeCompare(b.name, "pt-BR");
      else if (sortKey === "type")       cmp = (a.type ?? "").localeCompare(b.type ?? "");
      else if (sortKey === "durationSeconds") cmp = (a.durationSeconds ?? 0) - (b.durationSeconds ?? 0);
      else if (sortKey === "createdAt")  cmp = new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir]);

  const unusedCount = media?.filter((m) => !usedIds.has(m.id)).length ?? 0;
  const noNameCount = media?.filter((m) => isGenericFilename(m.name)).length ?? 0;

  const counts = {
    all: media?.length ?? 0,
    image: media?.filter((m) => m.type === "image").length ?? 0,
    video: media?.filter((m) => m.type === "video").length ?? 0,
    web_channel: media?.filter((m) => m.type === "web_channel").length ?? 0,
    youtube: media?.filter((m) => m.type === "youtube").length ?? 0,
    youtube_playlist: media?.filter((m) => m.type === "youtube_playlist").length ?? 0,
    canva: media?.filter((m) => m.type === "canva").length ?? 0,
    google_slides: media?.filter((m) => m.type === "google_slides").length ?? 0,
    date: media?.filter((m) => m.type === "date").length ?? 0,
    qr_code: media?.filter((m) => m.type === "qr_code").length ?? 0,
    clock: media?.filter((m) => m.type === "clock").length ?? 0,
    weather: media?.filter((m) => m.type === "weather").length ?? 0,
    rss: media?.filter((m) => m.type === "rss").length ?? 0,
    draft: media?.filter((m) => m.type === "draft").length ?? 0,
    unused: unusedCount,
    no_name: noNameCount,
  };

  const handleAddWebChannel = () => {
    const url = webChannelForm.url.trim();
    const name = webChannelForm.name.trim();
    if (!name || !url) { toast({ title: "Preencha nome e URL", variant: "destructive" }); return; }
    const dur = parseInt(webChannelForm.durationSeconds) || 0;
    createMedia.mutate(
      { data: { name, type: "web_channel", url, durationSeconds: dur || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
          setWebChannelOpen(false);
          setWebChannelForm({ name: "", url: "", durationSeconds: "0" });
          toast({ title: "Canal web adicionado!" });
        },
        onError: () => toast({ title: "Erro ao adicionar canal", variant: "destructive" }),
      }
    );
  };

  function parseYouTubeId(input: string): string | null {
    const patterns = [
      /[?&]v=([A-Za-z0-9_-]{11})/,
      /youtu\.be\/([A-Za-z0-9_-]{11})/,
      /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
      /youtube\.com\/live\/([A-Za-z0-9_-]{11})/,
      /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
    ];
    for (const p of patterns) {
      const m = input.match(p);
      if (m) return m[1];
    }
    if (/^[A-Za-z0-9_-]{11}$/.test(input.trim())) return input.trim();
    return null;
  }

  const handleAddYoutube = () => {
    const raw = youtubeForm.rawUrl.trim();
    const name = youtubeForm.name.trim();
    if (!name || !raw) { toast({ title: "Preencha nome e URL do vídeo", variant: "destructive" }); return; }
    const videoId = parseYouTubeId(raw);
    if (!videoId) { toast({ title: "URL do YouTube inválida", description: "Cole o link do vídeo (youtube.com/watch?v=... ou youtu.be/...)", variant: "destructive" }); return; }
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&rel=0`;
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    const dur = parseInt(youtubeForm.durationSeconds) || 0;
    const closeYt = () => { setYoutubeOpen(false); setYoutubeEditId(null); setYoutubeForm({ name: "", rawUrl: "", durationSeconds: "0" }); };
    if (youtubeEditId) {
      updateMedia.mutate(
        { id: youtubeEditId, data: { name, url: embedUrl, thumbnailUrl, durationSeconds: dur || undefined } },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() }); closeYt(); toast({ title: "YouTube atualizado!" }); },
          onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }) }
      );
    } else {
      createMedia.mutate(
        { data: { name, type: "youtube", url: embedUrl, thumbnailUrl, durationSeconds: dur || undefined } },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() }); closeYt(); toast({ title: "Vídeo do YouTube adicionado!" }); },
          onError: () => toast({ title: "Erro ao adicionar vídeo", variant: "destructive" }) }
      );
    }
  };

  // ── Canva ──────────────────────────────────────────────────────────────────
  const handleAddCanva = () => {
    const raw = canvaForm.url.trim();
    const name = canvaForm.name.trim();
    if (!name || !raw) { toast({ title: "Preencha nome e URL", variant: "destructive" }); return; }
    if (!raw.includes("canva.com/design")) { toast({ title: "URL inválida", description: "Use o link de visualização do Canva (canva.com/design/...)", variant: "destructive" }); return; }
    const url = raw.replace(/\/(edit|share|view)(\?.*)?$/, "/view");
    const dur = parseInt(canvaForm.durationSeconds) || 0;
    createMedia.mutate(
      { data: { name, type: "canva", url, durationSeconds: dur || undefined } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() }); setCanvaOpen(false); setCanvaForm({ name: "", url: "", durationSeconds: "0" }); toast({ title: "Design Canva adicionado!" }); }, onError: () => toast({ title: "Erro ao adicionar", variant: "destructive" }) }
    );
  };

  // ── Google Slides ──────────────────────────────────────────────────────────
  const handleAddGoogleSlides = () => {
    const raw = googleSlidesForm.rawInput.trim();
    const name = googleSlidesForm.name.trim();
    if (!name || !raw) { toast({ title: "Preencha nome e URL/código", variant: "destructive" }); return; }
    const srcMatch = raw.match(/src="([^"]+)"/);
    const url = srcMatch ? srcMatch[1] : raw;
    if (!url.includes("docs.google.com/presentation")) { toast({ title: "URL inválida", description: "Use o link do Google Slides publicado na web", variant: "destructive" }); return; }
    const dur = parseInt(googleSlidesForm.durationSeconds) || 0;
    createMedia.mutate(
      { data: { name, type: "google_slides", url, durationSeconds: dur || undefined } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() }); setGoogleSlidesOpen(false); setGoogleSlidesForm({ name: "", rawInput: "", durationSeconds: "0" }); toast({ title: "Apresentação adicionada!" }); }, onError: () => toast({ title: "Erro ao adicionar", variant: "destructive" }) }
    );
  };

  // ── YouTube Playlist ───────────────────────────────────────────────────────
  const handleAddYtPlaylist = () => {
    const raw = ytPlaylistForm.rawUrl.trim();
    const name = ytPlaylistForm.name.trim();
    if (!name || !raw) { toast({ title: "Preencha nome e URL", variant: "destructive" }); return; }
    const listMatch = raw.match(/[?&]list=([A-Za-z0-9_-]+)/);
    if (!listMatch) { toast({ title: "URL inválida", description: "URL deve conter um ID de playlist (list=...)", variant: "destructive" }); return; }
    const listId = listMatch[1];
    const url = `https://www.youtube.com/embed/videoseries?list=${listId}&autoplay=1&mute=1&loop=1`;
    const dur = parseInt(ytPlaylistForm.durationSeconds) || 0;
    const closeYtPl = () => { setYtPlaylistOpen(false); setYtPlaylistEditId(null); setYtPlaylistForm({ name: "", rawUrl: "", durationSeconds: "0" }); };
    if (ytPlaylistEditId) {
      updateMedia.mutate(
        { id: ytPlaylistEditId, data: { name, url, durationSeconds: dur || undefined } },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() }); closeYtPl(); toast({ title: "Playlist atualizada!" }); },
          onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }) }
      );
    } else {
      createMedia.mutate(
        { data: { name, type: "youtube_playlist", url, durationSeconds: dur || undefined } },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() }); closeYtPl(); toast({ title: "Playlist adicionada!" }); }, onError: () => toast({ title: "Erro ao adicionar", variant: "destructive" }) }
      );
    }
  };

  // ── Date widget ────────────────────────────────────────────────────────────
  const handleAddDate = () => {
    const name = dateForm.name.trim() || "Data de Hoje";
    const dur = parseInt(dateForm.durationSeconds) || 30;
    createMedia.mutate(
      { data: { name, type: "date", url: "date://local", durationSeconds: dur } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() }); setDateOpen(false); setDateForm({ name: "Data de Hoje", durationSeconds: "30" }); toast({ title: "Widget de Data adicionado!" }); }, onError: () => toast({ title: "Erro ao adicionar", variant: "destructive" }) }
    );
  };

  // ── QR Code widget ─────────────────────────────────────────────────────────
  const handleAddQRCode = () => {
    const url = qrCodeForm.url.trim();
    const name = qrCodeForm.name.trim();
    if (!name || !url) { toast({ title: "Preencha nome e URL", variant: "destructive" }); return; }
    if (!url.startsWith("http")) { toast({ title: "URL inválida", description: "A URL deve começar com http:// ou https://", variant: "destructive" }); return; }
    const dur = parseInt(qrCodeForm.durationSeconds) || 30;
    const meta = qrCodeForm.label.trim() ? JSON.stringify({ label: qrCodeForm.label.trim() }) : undefined;
    createMedia.mutate(
      { data: { name, type: "qr_code", url, durationSeconds: dur, metaJson: meta } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() }); setQrCodeOpen(false); setQrCodeForm({ name: "", url: "", label: "", durationSeconds: "30" }); toast({ title: "QR Code adicionado!" }); }, onError: () => toast({ title: "Erro ao adicionar", variant: "destructive" }) }
    );
  };

  const handleAddClock = () => {
    const name = clockForm.name.trim() || "Relógio Digital";
    const dur = parseInt(clockForm.durationSeconds) || 30;
    createMedia.mutate(
      { data: { name, type: "clock", url: "clock://local", durationSeconds: dur } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
          setClockOpen(false);
          setClockForm({ name: "Relógio Digital", durationSeconds: "30" });
          toast({ title: "Relógio adicionado!" });
        },
        onError: () => toast({ title: "Erro ao adicionar relógio", variant: "destructive" }),
      }
    );
  };


  const handleAddRss = () => {
    const feedUrl = rssForm.feedUrl.trim();
    const name = rssForm.name.trim();
    if (!name || !feedUrl) { toast({ title: "Preencha nome e URL do feed", variant: "destructive" }); return; }
    const dur = parseInt(rssForm.durationSeconds) || 0;
    createMedia.mutate(
      { data: { name, type: "rss", url: feedUrl, durationSeconds: dur || undefined, metaJson: JSON.stringify({ feedUrl, displayMode: rssForm.displayMode }) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
          setRssOpen(false);
          setRssForm({ name: "", feedUrl: "", durationSeconds: "0", displayMode: "ticker" });
          toast({ title: "Ticker RSS adicionado!" });
        },
        onError: () => toast({ title: "Erro ao adicionar RSS", variant: "destructive" }),
      }
    );
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allVisibleIds = sorted?.map((i) => i.id) ?? [];
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && allVisibleIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleIds));
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!confirm(`Deletar ${count} arquivo${count !== 1 ? "s" : ""} selecionado${count !== 1 ? "s" : ""}? Esta ação não pode ser desfeita.`)) return;
    try {
      await Promise.all([...selectedIds].map((id) => deleteMedia.mutateAsync({ id })));
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
      toast({ title: `${count} arquivo${count !== 1 ? "s" : ""} deletado${count !== 1 ? "s" : ""}` });
    } catch {
      toast({ title: "Erro ao deletar arquivos", variant: "destructive" });
    }
  };

  const pexelsKey = (name: string): string | null => {
    const v = name.match(/^pexels-video-(\d+)/);
    if (v) return `video:${v[1]}`;
    const p = name.match(/^pexels-(\d+)-/);
    if (p) return `photo:${p[1]}`;
    return null;
  };

  const pexelsDuplicateIds = (() => {
    const groups = new Map<string, { id: number; createdAt: string | Date | null }[]>();
    for (const item of media ?? []) {
      const key = pexelsKey(item.name);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ id: item.id, createdAt: item.createdAt ?? null });
    }
    const toDelete: number[] = [];
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) => a.id - b.id);
      toDelete.push(...sorted.slice(1).map(x => x.id));
    }
    return toDelete;
  })();

  // Duplicatas gerais (upload + mídia edit): mesmo nome+tipo em image/video — mantém o mais antigo (menor id)
  const libraryDuplicateIds = (() => {
    const groups = new Map<string, number[]>();
    for (const item of media ?? []) {
      if (item.type !== "image" && item.type !== "video") continue;
      const key = `${item.type}|${(item.name || "").trim()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item.id);
    }
    const toDelete: number[] = [];
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      const sorted = [...ids].sort((a, b) => a - b);
      toDelete.push(...sorted.slice(1));
    }
    return toDelete;
  })();

  const handleCleanLibraryDuplicates = async () => {
    const ids = Array.from(new Set([...libraryDuplicateIds, ...pexelsDuplicateIds]));
    const n = ids.length;
    if (!n) return;
    if (!confirm(`Vai apagar ${n} cópia${n !== 1 ? "s" : ""} duplicada${n !== 1 ? "s" : ""} (mesmo nome/tamanho ou Pexels). Mantém 1 de cada. Continuar?`)) return;
    try {
      await Promise.all(ids.map((id) => deleteMedia.mutateAsync({ id })));
      await queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
      await queryClient.invalidateQueries({ queryKey: ["media-storage-stats"] });
      toast({ title: `${n} duplicata${n !== 1 ? "s" : ""} removida${n !== 1 ? "s" : ""} com sucesso` });
    } catch {
      toast({ title: "Erro ao limpar duplicatas", variant: "destructive" });
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Deletar "${name}"? Ela será removida de todas as playlists.`)) {
      deleteMedia.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
            toast({ title: "Mídia deletada" });
          },
          onError: () => toast({ title: "Erro ao deletar", variant: "destructive" }),
        }
      );
    }
  };

  const handleRename = (id: number, name: string) => {
    if (!name.trim()) { setRenamingId(null); return; }
    updateMedia.mutate(
      { id, data: { name: name.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
          setRenamingId(null);
          toast({ title: "Renomeado com sucesso" });
        },
        onError: () => toast({ title: "Erro ao renomear", variant: "destructive" }),
      }
    );
  };

  const sidebarItems: { label: string; value: TypeFilter; icon: React.ReactNode; count: number; warn?: boolean }[] = [
    { label: "Todas", value: "all", icon: <FolderOpen className="w-4 h-4" />, count: counts.all },
    { label: "Imagens", value: "image", icon: <ImageIcon className="w-4 h-4" />, count: counts.image },
    { label: "Vídeos", value: "video", icon: <Film className="w-4 h-4" />, count: counts.video },
    { label: "Canais Web", value: "web_channel", icon: <Tv className="w-4 h-4" />, count: counts.web_channel },
    { label: "YouTube", value: "youtube", icon: <Youtube className="w-4 h-4" />, count: counts.youtube },
    { label: "YT Playlist", value: "youtube_playlist", icon: <Youtube className="w-4 h-4" />, count: counts.youtube_playlist },
    { label: "Canva", value: "canva", icon: <span className="text-purple-400 font-bold text-xs">C</span>, count: counts.canva },
    { label: "Google Slides", value: "google_slides", icon: <span className="text-yellow-400 font-bold text-xs">G</span>, count: counts.google_slides },
    { label: "Projetos", value: "draft", icon: <Clapperboard className="w-4 h-4" />, count: counts.draft },
    { label: "Sem nome", value: "no_name", icon: <Tag className="w-4 h-4" />, count: counts.no_name, warn: true },
    { label: "Não usadas", value: "unused", icon: <AlertTriangle className="w-4 h-4" />, count: counts.unused, warn: true },
  ];

  return (
    <div className="flex h-[calc(100vh-80px)] -mx-6 -mt-4 overflow-hidden">
      {/* ── LEFT SIDEBAR ── */}
      <div className="w-48 border-r bg-muted/20 flex flex-col shrink-0">
        <div className="px-3 py-3 border-b">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Meu Conteúdo
          </p>
        </div>
        <div className="p-2 space-y-0.5">
          {sidebarItems.map((item) => (
            <button
              key={item.value}
              onClick={() => setTypeFilter(item.value)}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors text-left",
                typeFilter === item.value
                  ? item.warn ? "bg-amber-500/80 text-white" : "bg-primary text-primary-foreground"
                  : item.warn && item.count > 0
                    ? "text-amber-400 hover:bg-amber-500/10"
                    : "text-foreground hover:bg-accent"
              )}
            >
              <span className="flex items-center gap-2 truncate">
                {item.icon}
                {item.label}
              </span>
              <span className={cn(
                "text-[10px] font-medium rounded-full px-1.5 py-0.5 min-w-[20px] text-center",
                typeFilter === item.value
                  ? "bg-white/20 text-white"
                  : item.warn && item.count > 0
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-muted text-muted-foreground"
              )}>
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 pt-3 pb-3 border-b shrink-0">
          {[
            { icon: FolderOpen, label: "Total",   value: counts.all,                                bg: "bg-primary/10",  iconColor: "text-primary"    },
            { icon: Film,       label: "Vídeos",  value: counts.video,                             bg: "bg-sky-100",     iconColor: "text-sky-600"    },
            { icon: ImageIcon,  label: "Imagens", value: counts.image,                             bg: "bg-violet-100",  iconColor: "text-violet-600" },
            { icon: Tv,         label: "Outros",  value: counts.all - counts.video - counts.image, bg: "bg-amber-100",   iconColor: "text-amber-600"  },
          ].map(({ icon: Icon, label, value, bg, iconColor }) => (
            <div key={label} className="rounded-2xl p-4 flex items-center justify-between gap-4 border border-border bg-card shadow-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-1 text-muted-foreground">{label}</p>
                <p className="text-3xl font-black tabular-nums tracking-tight text-foreground">{value}</p>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                <Icon className={`w-6 h-6 ${iconColor}`} />
              </div>
            </div>
          ))}
        </div>
        {/* Storage usage bar — always visible */}
        <div className={cn(
          "mx-4 mt-3 rounded-xl border px-4 py-3",
          overLimit ? "border-red-500/40 bg-red-50 dark:bg-red-950/20" :
          showStorageWarning ? "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20" :
          "border-border bg-muted/30"
        )}>
          <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              {overLimit ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> :
               showStorageWarning ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> : null}
              Armazenamento
            </span>
            <span className={cn(
              "text-xs font-bold tabular-nums",
              overLimit ? "text-red-600" : showStorageWarning ? "text-amber-600" : "text-foreground"
            )}>
              {storageUsedGB} GB de {storageQuotaGb} GB ({storagePct}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                overLimit ? "bg-red-500" : showStorageWarning ? "bg-amber-500" : "bg-primary"
              )}
              style={{ width: `${Math.min(100, storagePct)}%` }}
            />
          </div>
          {(showStorageWarning || overLimit) && (
            <p className={cn("text-[11px] mt-1.5", overLimit ? "text-red-600" : "text-amber-600")}>
              {overLimit
                ? "Limite atingido! Exclua mídias antigas para continuar fazendo uploads."
                : `Atenção: você já usou ${storagePct}% do seu limite. Considere excluir arquivos não utilizados.`}
            </p>
          )}
        </div>
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-card shrink-0 flex-wrap">
          <ObjectUploader
            maxNumberOfFiles={20}
            maxFileSize={62914560}
            onGetUploadParameters={async (file) => {
              const isVideo = file.type?.startsWith("video/") ?? false;
              const mediaType = isVideo ? "video" : "image";
              const duplicate = findLibraryDuplicate(media as MediaItem[] | undefined, file.name, mediaType);
              if (duplicate) {
                const err = new Error(`"${file.name}" já existe na biblioteca — upload bloqueado`);
                toast({
                  title: `"${file.name}" já existe na biblioteca`,
                  description: "Upload bloqueado. Apague a cópia antiga ou renomeie o arquivo.",
                  variant: "destructive",
                });
                throw err;
              }
              const [res, metadata] = await Promise.all([
                requestUploadUrl.mutateAsync({
                  data: {
                    name: file.name,
                    size: file.size ?? 0,
                    contentType: file.type ?? "application/octet-stream",
                  },
                }),
                extractFileMetadata(file as any),
              ]);
              objectPathMap.current.set(file.id, res.objectPath);
              metadataMap.current.set(file.id, metadata);
              const contentType = file.type ?? "application/octet-stream";
              return {
                method: "PUT" as const,
                url: res.uploadURL,
                headers: { "Content-Type": contentType },
              };
            }}
            onError={(file, error) => {
              const msg = error?.message ?? "Erro desconhecido. Tente novamente.";
              if (/já existe|bloqueado/i.test(msg)) return; // toast já mostrado no bloqueio
              toast({
                title: `Falha ao enviar${file ? ` "${file.name}"` : ""}`,
                description: msg,
                variant: "destructive",
              });
            }}
            onComplete={async (result) => {
              const successful = result.successful ?? [];
              if (successful.length === 0) return;
              let saved = 0;
              let blocked = 0;
              await Promise.all(
                successful.map(async (file) => {
                  const objectPath = objectPathMap.current.get(file.id);
                  if (!objectPath) return;
                  const isVideo = file.type?.startsWith("video/") ?? false;
                  const metadata = metadataMap.current.get(file.id);
                  const videoDuration = isVideo ? ((metadata as any)?.duration as number | undefined) : undefined;
                  try {
                    await createMedia.mutateAsync({
                      data: {
                        name: file.name,
                        type: isVideo ? "video" : "image",
                        url: objectPath,
                        durationSeconds: isVideo ? (videoDuration ?? 10) : 10,
                        metaJson: metadata ? JSON.stringify(metadata) : undefined,
                      },
                    });
                    saved += 1;
                  } catch (e: any) {
                    const status = e?.status ?? e?.response?.status;
                    const code = e?.data?.code ?? e?.data?.error;
                    if (status === 409 || code === "MEDIA_DUPLICATE" || code === "duplicate") {
                      blocked += 1;
                    } else {
                      throw e;
                    }
                  }
                })
              );
              queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
              queryClient.invalidateQueries({ queryKey: ["media-storage-stats"] });
              if (saved) toast({ title: `${saved} arquivo(s) enviado(s) com sucesso` });
              if (blocked) {
                toast({
                  title: `${blocked} arquivo(s) já existiam — não foram duplicados`,
                  variant: "destructive",
                });
              }
            }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Enviar Mídia
            </span>
          </ObjectUploader>

          {(libraryDuplicateIds.length > 0 || pexelsDuplicateIds.length > 0) && (
            <>
              <div className="h-5 w-px bg-border hidden sm:block" />
              <button
                onClick={handleCleanLibraryDuplicates}
                disabled={deleteMedia.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              >
                🧹 Limpar duplicatas ({Array.from(new Set([...libraryDuplicateIds, ...pexelsDuplicateIds])).length})
              </button>
            </>
          )}

          <div className="h-5 w-px bg-border hidden sm:block" />

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Select value={datePeriod} onValueChange={(v) => setDatePeriod(v as typeof datePeriod)}>
              <SelectTrigger className="h-8 text-xs min-w-[140px]">
                <CalendarDays className="w-3.5 h-3.5 mr-1 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os períodos</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Últimos 7 dias</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
                <SelectItem value="year">Este ano</SelectItem>
              </SelectContent>
            </Select>

            <div className="h-5 w-px bg-border" />

            <Select
              value={`${sortKey}:${sortDir}`}
              onValueChange={(v) => {
                const [k, d] = v.split(":") as [SortKey, SortDir];
                setSortKey(k);
                setSortDir(d);
              }}
            >
              <SelectTrigger className="h-8 text-xs min-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt:desc">Mais recente primeiro</SelectItem>
                <SelectItem value="createdAt:asc">Mais antigo primeiro</SelectItem>
                <SelectItem value="name:asc">Nome A → Z</SelectItem>
                <SelectItem value="name:desc">Nome Z → A</SelectItem>
                <SelectItem value="type:asc">Tipo</SelectItem>
                <SelectItem value="durationSeconds:desc">Duração (maior)</SelectItem>
              </SelectContent>
            </Select>

            <div className="h-5 w-px bg-border" />

            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
              title="Lista"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("grid")}
              title="Grade"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border-b shrink-0">
            <span className="text-sm font-medium text-primary">
              {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
            </span>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs gap-1.5"
              onClick={handleBulkDelete}
              disabled={deleteMedia.isPending}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir selecionados
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs ml-auto"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Cancelar seleção
            </Button>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-4 px-2 py-2.5">
                  <Skeleton className="w-10 h-10 rounded shrink-0" />
                  <Skeleton className="h-4 flex-1 max-w-xs" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          ) : sorted?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-16">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <ImageIcon className="w-6 h-6 text-muted-foreground opacity-40" />
              </div>
              <h3 className="font-medium">Nenhuma mídia encontrada</h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                {searchQuery
                  ? "Tente outro termo de busca."
                  : "Clique em Enviar Mídia para começar."}
              </p>
            </div>
          ) : viewMode === "list" ? (
            /* ─── LIST VIEW ─── */
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left font-semibold w-8">
                    <input
                      type="checkbox"
                      className="rounded cursor-pointer"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  {(["name", "type", "durationSeconds", "createdAt"] as SortKey[]).map((key) => {
                    const labels: Record<SortKey, string> = { name: "Nome da Mídia", type: "Tipo", durationSeconds: "Duração", createdAt: "Criado em" };
                    const widths: Record<SortKey, string> = { name: "", type: "w-24", durationSeconds: "w-24", createdAt: "w-44" };
                    const active = sortKey === key;
                    return (
                      <th key={key} className={cn("px-4 py-2.5 text-left font-semibold cursor-pointer select-none group/th", widths[key])} onClick={() => toggleSort(key)}>
                        <span className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                          {labels[key]}
                          {active
                            ? sortDir === "asc"
                              ? <ChevronUp className="w-3 h-3 text-primary" />
                              : <ChevronDown className="w-3 h-3 text-primary" />
                            : <ChevronsUpDown className="w-3 h-3 opacity-0 group-hover/th:opacity-50" />
                          }
                        </span>
                      </th>
                    );
                  })}
                  <th className="px-4 py-2.5 text-right font-semibold w-40">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted?.map((item) => (
                  <tr key={item.id} className={cn("group hover:bg-accent/20 transition-colors", selectedIds.has(item.id) && "bg-primary/5")}>
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        className="rounded cursor-pointer"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>

                    {/* Name + thumbnail */}
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded overflow-hidden border bg-muted shrink-0 flex items-center justify-center">
                          {item.type === "draft"
                            ? <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-900/40 to-amber-700/20"><Clapperboard className="w-5 h-5 text-amber-400" /></div>
                            : <MediaThumb url={item.url} type={item.type} thumbnailUrl={item.thumbnailUrl} className="w-full h-full" />
                          }
                        </div>
                        {renamingId === item.id ? (
                          <RenameInput
                            initialValue={item.name}
                            onSave={(v) => handleRename(item.id, v)}
                            onCancel={() => setRenamingId(null)}
                          />
                        ) : (
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="font-medium truncate max-w-xs cursor-pointer hover:text-primary hover:underline transition-colors"
                              title="Clique para renomear"
                              onClick={() => setRenamingId(item.id)}
                            >
                              {item.name}
                            </span>
                            {isGenericFilename(item.name) && (
                              <span
                                className="shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 cursor-pointer hover:bg-orange-500/25 transition-colors"
                                title="Nome de arquivo genérico detectado — clique para renomear"
                                onClick={() => setRenamingId(item.id)}
                              >
                                <Tag className="w-2.5 h-2.5" />
                                Renomear
                              </span>
                            )}
                            {usageData && !usedIds.has(item.id) && item.type !== "draft" && (
                              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Não usada
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={`text-[10px] uppercase px-1.5 py-0 font-medium ${item.type === "draft" ? "border-amber-500/50 text-amber-400" : ""}`}>
                        {item.type === "draft" ? "Projeto" : item.type}
                      </Badge>
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-2 text-muted-foreground text-xs tabular-nums">
                      {item.durationSeconds ? `${item.durationSeconds}s` : "—"}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-2 text-muted-foreground text-xs tabular-nums">
                      {formatDate(item.createdAt)}
                    </td>

                    {/* Actions — always visible */}
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        {(() => {
                          try {
                            const m = item.metaJson ? JSON.parse(item.metaJson) : null;
                            if (m?._type === "banner-editor-v3") {
                              return (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs gap-1 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                  onClick={() => { window.location.href = `/banner-editor?edit=${item.id}`; }}
                                >
                                  <Pencil className="w-3 h-3" />
                                  Editar
                                </Button>
                              );
                            }
                          } catch { /* ignore */ }
                          return null;
                        })()}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => setRenamingId(item.id)}
                        >
                          <Pencil className="w-3 h-3" />
                          Renomear
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 hover:bg-accent"
                          onClick={() => setPreviewItem(item as MediaItem)}
                        >
                          <Eye className="w-3 h-3" />
                          Ver
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(item.id, item.name)}
                        >
                          <Trash2 className="w-3 h-3" />
                          Deletar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            /* ─── GRID VIEW ─── */
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {sorted?.map((item) => (
                <div
                  key={item.id}
                  className={cn("group relative rounded-lg border bg-card overflow-hidden hover:shadow-md transition-all", selectedIds.has(item.id) && "ring-2 ring-primary")}
                >
                  {/* Checkbox (top-left, always visible when selected, visible on hover otherwise) */}
                  <div
                    className={cn(
                      "absolute top-1.5 left-1.5 z-20 transition-opacity",
                      selectedIds.has(item.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                    onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                  >
                    <input
                      type="checkbox"
                      className="rounded cursor-pointer w-4 h-4 accent-primary shadow"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </div>

                  <div className="aspect-square bg-muted overflow-hidden">
                    {item.type === "draft" ? (() => {
                      let sceneCount = 0;
                      let projectName = "";
                      try {
                        const m = item.metaJson ? JSON.parse(item.metaJson) : null;
                        if (m?._type === "banner-editor-v3") {
                          sceneCount = m.scenes?.length ?? 0;
                          projectName = m.project?.name ?? "";
                        }
                      } catch { /* ignore */ }
                      return (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-amber-900/40 to-amber-700/20 cursor-pointer"
                          onClick={() => { window.location.href = `/banner-editor?edit=${item.id}`; }}>
                          <Clapperboard className="w-10 h-10 text-amber-400" />
                          {sceneCount > 0 && (
                            <span className="text-[10px] font-medium text-amber-300 bg-amber-900/60 px-2 py-0.5 rounded-full">
                              {sceneCount} {sceneCount === 1 ? "cena" : "cenas"}
                            </span>
                          )}
                          {projectName && (
                            <span className="text-[9px] text-amber-400/70 text-center px-2 truncate max-w-full">{projectName}</span>
                          )}
                        </div>
                      );
                    })() : (
                      <MediaThumb url={item.url} type={item.type} thumbnailUrl={item.thumbnailUrl} className="w-full h-full" />
                    )}
                  </div>

                  {/* Hover overlay — dim only */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  <Badge className={`absolute top-1.5 left-1.5 text-[9px] px-1 py-0 h-4 uppercase border-0 text-white ${item.type === "draft" ? "bg-amber-600/90" : "bg-black/60"}`}>
                    {item.type === "draft" ? "Projeto" : item.type}
                  </Badge>

                  {usageData && !usedIds.has(item.id) && (
                    <div className="absolute top-1.5 right-1.5">
                      <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded-full bg-amber-500/80 text-white">
                        <AlertTriangle className="w-2 h-2" />
                        Não usada
                      </span>
                    </div>
                  )}

                  {isGenericFilename(item.name) && renamingId !== item.id && (
                    <div
                      className="absolute top-1.5 right-1.5 z-10 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setRenamingId(item.id); }}
                      title="Nome genérico — clique para renomear"
                    >
                      <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/85 text-white font-medium">
                        <Tag className="w-2 h-2" />
                        Renomear
                      </span>
                    </div>
                  )}

                  <div className="px-2 py-1.5 border-t">
                    {renamingId === item.id ? (
                      <RenameInput
                        initialValue={item.name}
                        onSave={(v) => handleRename(item.id, v)}
                        onCancel={() => setRenamingId(null)}
                      />
                    ) : (
                      <p
                        className="text-xs font-medium truncate cursor-pointer hover:text-primary transition-colors"
                        title="Clique para renomear"
                        onClick={() => setRenamingId(item.id)}
                      >
                        {item.name}
                      </p>
                    )}
                    {(() => {
                      const meta = parseFileMeta(item.metaJson);
                      const hasRes = !!(meta?.width && meta?.height);
                      const hasSize = !!(meta?.fileSize && meta.fileSize > 0);
                      if (!hasRes && !hasSize) return null;
                      const isIdeal = hasRes && meta!.width === 1920 && meta!.height === 1080;
                      return (
                        <p className={`text-[9px] font-mono mt-0.5 ${hasRes ? (isIdeal ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400") : "text-muted-foreground"}`}>
                          {hasRes && `${meta!.width}×${meta!.height}`}
                          {hasRes && meta?.format ? ` · ${mimeToLabel(meta.format)}` : ""}
                          {hasSize ? `${hasRes ? " · " : ""}${formatBytes(meta!.fileSize!)}` : ""}
                        </p>
                      );
                    })()}
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <CalendarDays className="w-2.5 h-2.5 shrink-0" />
                      {formatDate(item.createdAt)}
                    </p>
                    {/* ── Ações sempre visíveis ── */}
                    <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-border/50">
                      {(() => {
                        try {
                          const m = item.metaJson ? JSON.parse(item.metaJson) : null;
                          if (m?._type === "banner-editor-v3") {
                            return (
                              <button
                                title="Editar no Mídia Edit"
                                className="flex-1 flex items-center justify-center gap-1 h-6 rounded text-[10px] font-medium text-amber-400 hover:bg-amber-500/15 transition-colors"
                                onClick={() => { window.location.href = `/banner-editor?edit=${item.id}`; }}
                              >
                                <Pencil className="w-3 h-3" /> Editar
                              </button>
                            );
                          }
                        } catch { /* ignore */ }
                        return null;
                      })()}
                      <button
                        title="Visualizar"
                        className="flex-1 flex items-center justify-center gap-1 h-6 rounded text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        onClick={() => setPreviewItem(item as MediaItem)}
                      >
                        <Eye className="w-3 h-3" /> Ver
                      </button>
                      <button
                        title="Renomear"
                        className="flex-1 flex items-center justify-center gap-1 h-6 rounded text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                        onClick={() => setRenamingId(item.id)}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        title="Deletar"
                        className="flex-1 flex items-center justify-center gap-1 h-6 rounded text-[10px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => handleDelete(item.id, item.name)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && (sorted?.length ?? 0) > 0 && (
          <div className="px-4 py-2 border-t bg-muted/20 flex items-center justify-between shrink-0 text-xs text-muted-foreground">
            <span>
              {sorted?.length} arquivo{(sorted?.length ?? 0) !== 1 ? "s" : ""}
              {typeFilter !== "all" ? ` · filtro: ${typeFilter}` : ""}
            </span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* ── PREVIEW DIALOG ── */}
      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-sm font-semibold truncate pr-8">
              {previewItem?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-black flex items-center justify-center" style={{ minHeight: 360 }}>
            {(previewItem?.type === "web_channel" || previewItem?.type === "youtube" || previewItem?.type === "pluto_tv"
              || previewItem?.type === "canva" || previewItem?.type === "google_slides" || previewItem?.type === "youtube_playlist"
              || previewItem?.type === "spotify" || previewItem?.type === "instagram" || previewItem?.type === "tiktok") ? (
              <iframe
                src={previewItem.url}
                className="w-full"
                style={{ height: "65vh", border: "none" }}
                allow="autoplay; fullscreen"
                title={previewItem.name}
              />
            ) : previewItem?.type === "video" ? (
              <video
                src={resolveMediaUrl(previewItem.url)}
                controls
                autoPlay
                muted
                className="max-w-full max-h-[65vh] object-contain"
              />
            ) : previewItem ? (
              <img
                src={resolveMediaUrl(previewItem.url)}
                alt={previewItem.name}
                className="max-w-full max-h-[65vh] object-contain"
              />
            ) : null}
          </div>
          <div className="px-4 py-2.5 border-t flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px] uppercase">{previewItem?.type}</Badge>
            {previewItem?.durationSeconds && <span>{previewItem.durationSeconds}s</span>}
            {previewItem?.createdAt && <span>· {formatDate(previewItem.createdAt)}</span>}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CLOCK DIALOG ── */}
      <Dialog open={clockOpen} onOpenChange={setClockOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4" /> Adicionar Relógio Digital
            </DialogTitle>
            <DialogDescription>
              Exibe um relógio digital em tela cheia com data e hora atualizados em tempo real.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="clk-name">Nome</Label>
              <Input
                id="clk-name"
                placeholder="Relógio Digital"
                value={clockForm.name}
                onChange={(e) => setClockForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clk-dur">Duração (segundos)</Label>
              <Input
                id="clk-dur"
                type="number"
                min={5}
                placeholder="30"
                value={clockForm.durationSeconds}
                onChange={(e) => setClockForm((f) => ({ ...f, durationSeconds: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClockOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddClock} disabled={createMedia.isPending} className="gap-2">
              <Plus className="w-3.5 h-3.5" />
              {createMedia.isPending ? "Adicionando..." : "Adicionar Relógio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ── RSS DIALOG ── */}
      <Dialog open={rssOpen} onOpenChange={setRssOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rss className="w-4 h-4" /> Adicionar Feed RSS
            </DialogTitle>
            <DialogDescription>
              Exibe manchetes de notícias como faixa rolante ou em tela cheia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rss-name">Nome</Label>
              <Input
                id="rss-name"
                placeholder="Ex: G1 Notícias"
                value={rssForm.name}
                onChange={(e) => setRssForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Modo de exibição</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["ticker", "fullscreen"] as const).map((mode) => (
                  <button key={mode} type="button"
                    onClick={() => setRssForm((f) => ({ ...f, displayMode: mode }))}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-lg border text-xs font-medium transition-all",
                      rssForm.displayMode === mode
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                    )}>
                    {mode === "ticker" ? "▬ Faixa rolante" : "⬛ Tela cheia"}
                    <span className="text-[10px] font-normal opacity-70">
                      {mode === "ticker" ? "Sobrepõe todos os slides" : "Slide dedicado com manchetes"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rss-url">URL do Feed RSS</Label>
              <Input
                id="rss-url"
                placeholder="https://g1.globo.com/dynamo/brasil/rss2.xml"
                value={rssForm.feedUrl}
                onChange={(e) => setRssForm((f) => ({ ...f, feedUrl: e.target.value }))}
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {[
                  { label: "G1 Brasil", url: "https://g1.globo.com/dynamo/brasil/rss2.xml" },
                  { label: "BBC Brasil", url: "https://feeds.bbci.co.uk/portuguese/rss.xml" },
                  { label: "Ag. Brasil", url: "https://agenciabrasil.ebc.com.br/rss/ultimas-noticias/feed.xml" },
                  { label: "UOL", url: "https://rss.uol.com.br/feed/noticias.xml" },
                ].map(({ label, url }) => (
                  <button key={label} type="button"
                    onClick={() => setRssForm((f) => ({ ...f, feedUrl: url, name: f.name || label }))}
                    className="px-2 py-0.5 text-[10px] rounded bg-muted hover:bg-accent border border-border transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRssOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddRss} disabled={createMedia.isPending} className="gap-2">
              <Plus className="w-3.5 h-3.5" />
              {createMedia.isPending ? "Adicionando..." : "Adicionar RSS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CANAL WEB DIALOG ── */}
      <Dialog open={webChannelOpen} onOpenChange={setWebChannelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tv className="w-4 h-4" /> Adicionar Canal Web
            </DialogTitle>
            <DialogDescription>
              Cole a URL de incorporação do YouTube, Pluto TV ou qualquer site. O player abrirá em tela cheia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="wc-name">Nome</Label>
              <Input
                id="wc-name"
                placeholder="Ex: ESPN ao vivo, Pluto TV Esportes..."
                value={webChannelForm.name}
                onChange={(e) => setWebChannelForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wc-url">URL</Label>
              <Input
                id="wc-url"
                placeholder="https://www.youtube.com/embed/VIDEO_ID?autoplay=1"
                value={webChannelForm.url}
                onChange={(e) => setWebChannelForm((f) => ({ ...f, url: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Para YouTube: use <code className="bg-muted px-1 rounded">youtube.com/embed/ID</code> com <code className="bg-muted px-1 rounded">?autoplay=1</code>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wc-dur">Duração (segundos)</Label>
              <Input
                id="wc-dur"
                type="number"
                min={0}
                placeholder="0"
                value={webChannelForm.durationSeconds}
                onChange={(e) => setWebChannelForm((f) => ({ ...f, durationSeconds: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                0 = fica para sempre neste canal (ideal para transmissões ao vivo)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWebChannelOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddWebChannel} disabled={createMedia.isPending} className="gap-2">
              <Plus className="w-3.5 h-3.5" />
              {createMedia.isPending ? "Adicionando..." : "Adicionar Canal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── YOUTUBE DIALOG ── */}
      <Dialog open={youtubeOpen} onOpenChange={(v) => { setYoutubeOpen(v); if (!v) { setYoutubeEditId(null); setYoutubeForm({ name: "", rawUrl: "", durationSeconds: "0" }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Youtube className="w-4 h-4 text-red-500" /> {youtubeEditId ? "Editar Vídeo do YouTube" : "Adicionar Vídeo do YouTube"}
            </DialogTitle>
            <DialogDescription>
              Cole o link do vídeo. O player vai tocar em modo silencioso e em loop automaticamente.
            </DialogDescription>
          </DialogHeader>

          {/* Existing YouTube items */}
          {!youtubeEditId && (media ?? []).filter(m => m.type === "youtube").length > 0 && (
            <div className="pb-1 border-b border-white/10 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Já cadastrados — clique para editar:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {(media ?? []).filter(m => m.type === "youtube").map(item => {
                  const vid = item.url.match(/\/embed\/([A-Za-z0-9_-]{11})/)?.[1] ?? null;
                  return (
                    <button key={item.id} onClick={() => { setYoutubeEditId(item.id); setYoutubeForm({ name: item.name, rawUrl: vid ? `https://youtu.be/${vid}` : item.url, durationSeconds: String(item.durationSeconds ?? 0) }); }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/30 text-left text-sm transition-all">
                      <span className="truncate text-white/80">{item.name}</span>
                      <span className="text-xs text-amber-400 shrink-0 ml-2 font-medium">Editar →</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-white/30 text-center">— ou adicione novo abaixo —</p>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="yt-name">Nome</Label>
              <Input
                id="yt-name"
                placeholder="Ex: Vídeo institucional, Promoção do dia..."
                value={youtubeForm.name}
                onChange={(e) => setYoutubeForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="yt-url">Link do YouTube</Label>
              <Input
                id="yt-url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeForm.rawUrl}
                onChange={(e) => setYoutubeForm((f) => ({ ...f, rawUrl: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Aceita links do tipo <code className="bg-muted px-1 rounded">youtube.com/watch?v=ID</code> ou <code className="bg-muted px-1 rounded">youtu.be/ID</code>
              </p>
              {youtubeForm.rawUrl && (() => {
                const patterns = [
                  /[?&]v=([A-Za-z0-9_-]{11})/,
                  /youtu\.be\/([A-Za-z0-9_-]{11})/,
                  /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
                  /youtube\.com\/live\/([A-Za-z0-9_-]{11})/,
                  /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
                ];
                let vid: string | null = null;
                for (const p of patterns) { const m = youtubeForm.rawUrl.match(p); if (m) { vid = m[1]; break; } }
                if (!vid && /^[A-Za-z0-9_-]{11}$/.test(youtubeForm.rawUrl.trim())) vid = youtubeForm.rawUrl.trim();
                return vid ? (
                  <div className="flex items-center gap-2 mt-1">
                    <img src={`https://img.youtube.com/vi/${vid}/default.jpg`} alt="" className="w-16 h-12 object-cover rounded border border-white/10" />
                    <span className="text-xs text-emerald-400">✓ Vídeo detectado</span>
                  </div>
                ) : (
                  <p className="text-xs text-amber-400 mt-1">⚠ Link não reconhecido — verifique a URL</p>
                );
              })()}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="yt-dur">Duração na playlist (segundos)</Label>
              <Input
                id="yt-dur"
                type="number"
                min={0}
                placeholder="0"
                value={youtubeForm.durationSeconds}
                onChange={(e) => setYoutubeForm((f) => ({ ...f, durationSeconds: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                0 = toca indefinidamente (ideal para vídeos longos ou loops)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setYoutubeOpen(false); setYoutubeEditId(null); setYoutubeForm({ name: "", rawUrl: "", durationSeconds: "0" }); }}>Cancelar</Button>
            <Button onClick={handleAddYoutube} disabled={createMedia.isPending || updateMedia.isPending} className="gap-2 bg-red-600 hover:bg-red-700 text-white border-0">
              <Youtube className="w-3.5 h-3.5" />
              {(createMedia.isPending || updateMedia.isPending) ? "Salvando..." : youtubeEditId ? "Salvar alterações" : "Adicionar YouTube"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CANVA DIALOG ─────────────────────────────────────────────────── */}
      <Dialog open={canvaOpen} onOpenChange={setCanvaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#7D2AE7] flex items-center justify-center text-white font-black text-sm">C</span>
              Canva
            </DialogTitle>
            <DialogDescription>Exiba um design do Canva em tela cheia.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-purple-950/30 border border-purple-500/20 rounded-lg p-3 text-xs text-purple-300 space-y-1">
              <p className="font-semibold">Como obter o link:</p>
              <p>1. No Canva, abra seu design</p>
              <p>2. Clique em <strong>Compartilhar → Link público</strong></p>
              <p>3. Ative "Qualquer pessoa com o link" e copie a URL</p>
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input placeholder="Ex: Banner Promo Julho" value={canvaForm.name} onChange={(e) => setCanvaForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>URL do design Canva</Label>
              <Input placeholder="https://www.canva.com/design/DAF.../view" value={canvaForm.url} onChange={(e) => setCanvaForm((f) => ({ ...f, url: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Duração (segundos)</Label>
              <Input type="number" min={5} placeholder="30" value={canvaForm.durationSeconds} onChange={(e) => setCanvaForm((f) => ({ ...f, durationSeconds: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCanvaOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddCanva} disabled={createMedia.isPending} className="gap-2 bg-[#7D2AE7] hover:bg-purple-700 text-white border-0">
              {createMedia.isPending ? "Adicionando..." : "Adicionar Canva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── GOOGLE SLIDES DIALOG ─────────────────────────────────────────── */}
      <Dialog open={googleSlidesOpen} onOpenChange={setGoogleSlidesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#FBBC05] flex items-center justify-center text-gray-800 font-black text-sm">GS</span>
              Google Slides
            </DialogTitle>
            <DialogDescription>Exiba uma apresentação que atualiza automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-950/30 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-300 space-y-1">
              <p className="font-semibold">Como obter o link:</p>
              <p>1. No Google Slides, clique em <strong>Arquivo → Publicar na web</strong></p>
              <p>2. Selecione a aba <strong>Incorporar</strong></p>
              <p>3. Configure o avanço automático e copie o código ou a URL</p>
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input placeholder="Ex: Cardápio do Dia" value={googleSlidesForm.name} onChange={(e) => setGoogleSlidesForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>URL ou código &lt;iframe&gt;</Label>
              <Input placeholder="https://docs.google.com/presentation/d/..." value={googleSlidesForm.rawInput} onChange={(e) => setGoogleSlidesForm((f) => ({ ...f, rawInput: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Pode colar a URL ou o código iframe completo</p>
            </div>
            <div className="space-y-1.5">
              <Label>Duração total (segundos)</Label>
              <Input type="number" min={5} placeholder="60" value={googleSlidesForm.durationSeconds} onChange={(e) => setGoogleSlidesForm((f) => ({ ...f, durationSeconds: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoogleSlidesOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddGoogleSlides} disabled={createMedia.isPending} className="gap-2 bg-[#FBBC05] hover:bg-yellow-400 text-gray-800 border-0">
              {createMedia.isPending ? "Adicionando..." : "Adicionar Google Slides"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── YOUTUBE PLAYLIST DIALOG ──────────────────────────────────────── */}
      <Dialog open={ytPlaylistOpen} onOpenChange={(v) => { setYtPlaylistOpen(v); if (!v) { setYtPlaylistEditId(null); setYtPlaylistForm({ name: "", rawUrl: "", durationSeconds: "0" }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center text-white text-xs font-bold">▶≡</span>
              {ytPlaylistEditId ? "Editar YouTube Playlist" : "YouTube Playlist"}
            </DialogTitle>
            <DialogDescription>Reproduza uma playlist inteira em sequência automática.</DialogDescription>
          </DialogHeader>

          {/* Existing YT Playlist items */}
          {!ytPlaylistEditId && (media ?? []).filter(m => m.type === "youtube_playlist").length > 0 && (
            <div className="pb-1 border-b border-white/10 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Já cadastradas — clique para editar:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {(media ?? []).filter(m => m.type === "youtube_playlist").map(item => {
                  const listId = item.url.match(/list=([A-Za-z0-9_-]+)/)?.[1] ?? null;
                  return (
                    <button key={item.id} onClick={() => { setYtPlaylistEditId(item.id); setYtPlaylistForm({ name: item.name, rawUrl: listId ? `https://www.youtube.com/playlist?list=${listId}` : item.url, durationSeconds: String(item.durationSeconds ?? 0) }); }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/30 text-left text-sm transition-all">
                      <span className="truncate text-white/80">{item.name}</span>
                      <span className="text-xs text-amber-400 shrink-0 ml-2 font-medium">Editar →</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-white/30 text-center">— ou adicione nova abaixo —</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="bg-red-950/30 border border-red-500/20 rounded-lg p-3 text-xs text-red-300 space-y-1">
              <p className="font-semibold">Como obter o link:</p>
              <p>1. Abra a playlist no YouTube</p>
              <p>2. Copie a URL da barra de endereços</p>
              <p className="font-mono bg-black/30 px-2 py-1 rounded">youtube.com/playlist?list=PL...</p>
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input placeholder="Ex: Vídeos da Empresa" value={ytPlaylistForm.name} onChange={(e) => setYtPlaylistForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>URL da Playlist</Label>
              <Input placeholder="https://www.youtube.com/playlist?list=PL..." value={ytPlaylistForm.rawUrl} onChange={(e) => setYtPlaylistForm((f) => ({ ...f, rawUrl: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Duração por ciclo (segundos)</Label>
              <Input type="number" min={0} placeholder="0" value={ytPlaylistForm.durationSeconds} onChange={(e) => setYtPlaylistForm((f) => ({ ...f, durationSeconds: e.target.value }))} />
              <p className="text-xs text-muted-foreground">0 = roda a playlist inteira indefinidamente</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setYtPlaylistOpen(false); setYtPlaylistEditId(null); setYtPlaylistForm({ name: "", rawUrl: "", durationSeconds: "0" }); }}>Cancelar</Button>
            <Button onClick={handleAddYtPlaylist} disabled={createMedia.isPending || updateMedia.isPending} className="gap-2 bg-red-600 hover:bg-red-700 text-white border-0">
              {(createMedia.isPending || updateMedia.isPending) ? "Salvando..." : ytPlaylistEditId ? "Salvar alterações" : "Adicionar Playlist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DATE WIDGET DIALOG ───────────────────────────────────────────── */}
      <Dialog open={dateOpen} onOpenChange={setDateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#1e3a5f] flex items-center justify-center text-blue-300 text-base">📅</span>
              Widget de Data
            </DialogTitle>
            <DialogDescription>Exibe a data atual em destaque — dia da semana, dia, mês e ano.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-950/30 border border-blue-500/20 rounded-lg p-4 text-center">
              <p className="text-blue-300/70 text-xs mb-1">Prévia na TV</p>
              <p className="text-blue-200 text-sm font-medium capitalize">Segunda-feira</p>
              <p className="text-white font-bold text-4xl">30</p>
              <p className="text-blue-200 text-sm capitalize">Junho 2025</p>
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input placeholder="Data de Hoje" value={dateForm.name} onChange={(e) => setDateForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Duração (segundos)</Label>
              <Input type="number" min={5} placeholder="30" value={dateForm.durationSeconds} onChange={(e) => setDateForm((f) => ({ ...f, durationSeconds: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDateOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddDate} disabled={createMedia.isPending} className="gap-2 bg-[#1e3a5f] hover:bg-blue-900 text-white border-0">
              <CalendarDays className="w-3.5 h-3.5" />
              {createMedia.isPending ? "Adicionando..." : "Adicionar Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── QR CODE WIDGET DIALOG ────────────────────────────────────────── */}
      <Dialog open={qrCodeOpen} onOpenChange={setQrCodeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-black border border-white/20 flex items-center justify-center text-white/70 font-mono font-bold">▦</span>
              QR Code
            </DialogTitle>
            <DialogDescription>Gera um QR Code a partir de qualquer URL para exibir na tela.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input placeholder="Ex: QR do Cardápio" value={qrCodeForm.name} onChange={(e) => setQrCodeForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>URL do QR Code</Label>
              <Input placeholder="https://seu-site.com.br/cardapio" value={qrCodeForm.url} onChange={(e) => setQrCodeForm((f) => ({ ...f, url: e.target.value }))} />
              <p className="text-xs text-muted-foreground">O QR Code gerado na TV vai abrir essa URL</p>
            </div>
            <div className="space-y-1.5">
              <Label>Legenda <span className="text-muted-foreground">(opcional)</span></Label>
              <Input placeholder="Ex: Escaneie para ver o cardápio" value={qrCodeForm.label} onChange={(e) => setQrCodeForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Duração (segundos)</Label>
              <Input type="number" min={5} placeholder="30" value={qrCodeForm.durationSeconds} onChange={(e) => setQrCodeForm((f) => ({ ...f, durationSeconds: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrCodeOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddQRCode} disabled={createMedia.isPending} className="gap-2 bg-black border border-white/20 hover:bg-white/10 text-white">
              {createMedia.isPending ? "Adicionando..." : "Adicionar QR Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
