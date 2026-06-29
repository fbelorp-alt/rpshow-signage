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
  ChevronUp, ChevronDown, ChevronsUpDown,
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

type ViewMode = "list" | "grid";
type TypeFilter = "all" | "image" | "video" | "web_channel" | "rss" | "weather" | "clock" | "unused";
type SortKey = "name" | "type" | "durationSeconds" | "createdAt";
type SortDir = "asc" | "desc";

interface MediaItem {
  id: number;
  name: string;
  type: string;
  url: string;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  createdAt: string;
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

function MediaThumb({ url, type, className }: { url: string; type: string; className?: string }) {
  if (type === "video") {
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
    return new Promise<{ width?: number; height?: number; format: string; fileSize: number }>((resolve) => {
      const video = document.createElement("video");
      const url = URL.createObjectURL(blob);
      video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve({ width: video.videoWidth, height: video.videoHeight, format, fileSize }); };
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

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [webChannelOpen, setWebChannelOpen] = useState(false);
  const [webChannelForm, setWebChannelForm] = useState({ name: "", url: "", durationSeconds: "0" });
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
    queryFn: () => fetch("/api/media/usage").then((r) => r.json()),
    staleTime: 30_000,
  });
  const usedIds = new Set(usageData?.usedMediaIds ?? []);

  const filtered = media?.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (typeFilter === "unused") return matchesSearch && !usedIds.has(item.id);
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
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

  const counts = {
    all: media?.length ?? 0,
    image: media?.filter((m) => m.type === "image").length ?? 0,
    video: media?.filter((m) => m.type === "video").length ?? 0,
    web_channel: media?.filter((m) => m.type === "web_channel").length ?? 0,
    clock: media?.filter((m) => m.type === "clock").length ?? 0,
    weather: media?.filter((m) => m.type === "weather").length ?? 0,
    rss: media?.filter((m) => m.type === "rss").length ?? 0,
    unused: unusedCount,
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
    { label: "Relógio", value: "clock", icon: <Clock className="w-4 h-4" />, count: counts.clock },
    { label: "Clima", value: "weather", icon: <Cloud className="w-4 h-4" />, count: counts.weather },
    { label: "Ticker RSS", value: "rss", icon: <Rss className="w-4 h-4" />, count: counts.rss },
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
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-card shrink-0 flex-wrap">
          <ObjectUploader
            maxNumberOfFiles={20}
            maxFileSize={104857600}
            onGetUploadParameters={async (file) => {
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
              return { method: "PUT" as const, url: res.uploadURL };
            }}
            onComplete={(result) => {
              result.successful?.forEach((file) => {
                const objectPath = objectPathMap.current.get(file.id);
                if (!objectPath) return;
                const isVideo = file.type?.startsWith("video/") ?? false;
                const metadata = metadataMap.current.get(file.id);
                createMedia.mutate(
                  {
                    data: {
                      name: file.name,
                      type: isVideo ? "video" : "image",
                      url: objectPath,
                      durationSeconds: isVideo ? undefined : 10,
                      metaJson: metadata ? JSON.stringify(metadata) : undefined,
                    },
                  },
                  {
                    onSuccess: () =>
                      queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() }),
                  }
                );
              });
              if ((result.successful?.length ?? 0) > 0) {
                toast({ title: `${result.successful?.length} arquivo(s) enviado(s) com sucesso` });
              }
            }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Enviar Mídia
            </span>
          </ObjectUploader>

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

          <div className="ml-auto flex items-center gap-1">
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
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left font-semibold w-8">
                    <input type="checkbox" className="rounded opacity-60" readOnly />
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
                  <tr key={item.id} className="group hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2">
                      <input type="checkbox" className="rounded opacity-40" readOnly />
                    </td>

                    {/* Name + thumbnail */}
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded overflow-hidden border bg-muted shrink-0 flex items-center justify-center">
                          <MediaThumb url={item.url} type={item.type} className="w-full h-full" />
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
                              className="font-medium truncate max-w-xs"
                              title={item.name}
                            >
                              {item.name}
                            </span>
                            {usageData && !usedIds.has(item.id) && (
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
                      <Badge variant="outline" className="text-[10px] uppercase px-1.5 py-0 font-medium">
                        {item.type}
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

                    {/* Actions — visible on hover */}
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
          ) : (
            /* ─── GRID VIEW ─── */
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {sorted?.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-lg border bg-card overflow-hidden hover:shadow-md transition-all"
                >
                  <div className="aspect-square bg-muted overflow-hidden">
                    <MediaThumb url={item.url} type={item.type} className="w-full h-full" />
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs gap-1 w-full"
                      onClick={() => setPreviewItem(item as MediaItem)}
                    >
                      <Eye className="w-3 h-3" /> Ver
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs gap-1 w-full"
                      onClick={() => setRenamingId(item.id)}
                    >
                      <Pencil className="w-3 h-3" /> Renomear
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs gap-1 w-full"
                      onClick={() => handleDelete(item.id, item.name)}
                    >
                      <Trash2 className="w-3 h-3" /> Deletar
                    </Button>
                  </div>

                  <Badge className="absolute top-1.5 left-1.5 text-[9px] px-1 py-0 h-4 uppercase bg-black/60 border-0 text-white">
                    {item.type}
                  </Badge>

                  {usageData && !usedIds.has(item.id) && (
                    <div className="absolute top-1.5 right-1.5">
                      <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded-full bg-amber-500/80 text-white">
                        <AlertTriangle className="w-2 h-2" />
                        Não usada
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
                      <p className="text-xs font-medium truncate" title={item.name}>
                        {item.name}
                      </p>
                    )}
                    {(() => {
                      const meta = parseFileMeta(item.metaJson);
                      if (!meta?.width || !meta?.height) return null;
                      const isIdeal = meta.width === 1920 && meta.height === 1080;
                      return (
                        <p className={`text-[9px] font-mono mt-0.5 ${isIdeal ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                          {meta.width}×{meta.height}{meta.format ? ` · ${mimeToLabel(meta.format)}` : ""}
                        </p>
                      );
                    })()}
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <CalendarDays className="w-2.5 h-2.5 shrink-0" />
                      {formatDate(item.createdAt)}
                    </p>
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
            {previewItem?.type === "web_channel" ? (
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
    </div>
  );
}
