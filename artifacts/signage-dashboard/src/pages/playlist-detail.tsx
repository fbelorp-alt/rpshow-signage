import { useState, useCallback } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetPlaylist,
  useListMedia,
  useAddPlaylistItem,
  useRemovePlaylistItem,
  useReorderPlaylistItems,
  useUpdatePlaylistItem,
  getGetPlaylistQueryKey,
  getListMediaQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft, Clock, Film, Image as ImageIcon, GripVertical,
  Trash2, Play, Search, Plus, CheckCircle2, Globe, Monitor,
  CloudSun, Rss as RssIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/objects/")) return `/api/storage${url}`;
  return url;
}

function typeLabel(type?: string | null) {
  const map: Record<string, string> = {
    image: "IMAGE", video: "VIDEO", web_channel: "WEB",
    clock: "CLOCK", weather: "CLIMA", rss: "RSS",
  };
  return map[type ?? ""] ?? (type?.toUpperCase() ?? "—");
}

function typeColor(type?: string | null) {
  if (type === "video") return "bg-purple-500/20 text-purple-400 border-purple-500/30";
  if (type === "web_channel") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (type === "clock") return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  if (type === "weather") return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
  if (type === "rss") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
}

function MediaThumb({ url, type, className }: { url?: string | null; type?: string | null; className?: string }) {
  if (type === "video") {
    return (
      <div className={cn("bg-black flex items-center justify-center", className)}>
        <Film className="w-1/3 h-1/3 text-purple-400/60" />
      </div>
    );
  }
  if (type === "web_channel") {
    return (
      <div className={cn("bg-blue-950/60 flex items-center justify-center", className)}>
        <Globe className="w-1/3 h-1/3 text-blue-400/70" />
      </div>
    );
  }
  if (type === "clock") {
    return (
      <div className={cn("bg-gray-900 flex items-center justify-center", className)}>
        <Monitor className="w-1/3 h-1/3 text-white/50" />
      </div>
    );
  }
  if (type === "weather") {
    return (
      <div className={cn("bg-sky-950/60 flex items-center justify-center", className)}>
        <CloudSun className="w-1/3 h-1/3 text-sky-400/70" />
      </div>
    );
  }
  if (type === "rss") {
    return (
      <div className={cn("bg-orange-950/40 flex items-center justify-center", className)}>
        <RssIcon className="w-1/3 h-1/3 text-orange-400/70" />
      </div>
    );
  }
  const resolved = resolveMediaUrl(url);
  if (resolved) {
    return <img src={resolved} alt="" className={cn("object-cover", className)} loading="lazy" />;
  }
  return (
    <div className={cn("bg-muted flex items-center justify-center", className)}>
      <ImageIcon className="w-1/3 h-1/3 text-muted-foreground/40" />
    </div>
  );
}

function PreviewContent({ item }: {
  item: { mediaUrl?: string | null; mediaType?: string | null; mediaName?: string | null; durationSeconds: number } | null;
}) {
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-white/20 w-full h-full">
        <Monitor className="w-14 h-14" />
        <p className="text-sm">Selecione um slide para visualizar</p>
      </div>
    );
  }
  if (item.mediaType === "video") {
    const src = resolveMediaUrl(item.mediaUrl);
    return src ? (
      <video
        key={src}
        src={src}
        className="w-full h-full object-contain"
        controls
        autoPlay
        muted
        loop
      />
    ) : (
      <div className="flex flex-col items-center gap-2 text-white/30">
        <Film className="w-12 h-12" />
        <span className="text-sm">Sem prévia de vídeo</span>
      </div>
    );
  }
  if (item.mediaType === "web_channel") {
    return (
      <iframe
        src={item.mediaUrl ?? ""}
        className="w-full h-full"
        style={{ border: "none" }}
        allow="autoplay; fullscreen"
        title={item.mediaName ?? ""}
      />
    );
  }
  if (item.mediaType === "clock") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-white w-full h-full bg-black">
        <div className="text-6xl font-bold font-mono tracking-widest">
          {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
        <div className="text-xl text-white/50">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        </div>
      </div>
    );
  }
  if (item.mediaType === "weather") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-white w-full h-full bg-gradient-to-b from-sky-900 to-blue-950">
        <div className="text-6xl">⛅</div>
        <div className="text-4xl font-bold">— °C</div>
        <div className="text-white/60 text-xl">{item.mediaUrl ?? "—"}</div>
      </div>
    );
  }
  if (item.mediaType === "rss") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-white w-full h-full bg-gray-900">
        <RssIcon className="w-12 h-12 text-orange-400" />
        <div className="text-white/60 text-sm max-w-xs text-center">{item.mediaUrl}</div>
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-black/80 border-t border-orange-400/50 flex items-center px-4 gap-3">
          <span className="text-xs font-bold bg-orange-500 text-black px-2 py-0.5">NOTÍCIAS</span>
          <span className="text-xs text-white/70 truncate">Ticker de notícias ativo ...</span>
        </div>
      </div>
    );
  }
  const src = resolveMediaUrl(item.mediaUrl);
  if (src) {
    return <img key={src} src={src} alt={item.mediaName ?? ""} className="w-full h-full object-contain" />;
  }
  return (
    <div className="flex flex-col items-center gap-2 text-white/30">
      <ImageIcon className="w-12 h-12" />
      <span className="text-sm">Sem prévia</span>
    </div>
  );
}

interface SortableItemProps {
  item: {
    id: number;
    mediaId: number;
    mediaName?: string | null;
    mediaUrl?: string | null;
    mediaType?: string | null;
    position: number;
    durationSeconds: number;
  };
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDurationChange: (val: number) => void;
}

function SortableItem({ item, index, isSelected, onSelect, onRemove, onDurationChange }: SortableItemProps) {
  const [editingDur, setEditingDur] = useState(false);
  const [draft, setDraft] = useState(String(item.durationSeconds));
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const commitDuration = () => {
    const v = parseInt(draft, 10);
    if (!isNaN(v) && v > 0) onDurationChange(v);
    setEditingDur(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-2 px-2 py-2 rounded cursor-pointer border transition-all select-none",
        isSelected
          ? "bg-primary/15 border-primary/40 shadow-sm"
          : "bg-transparent border-transparent hover:bg-white/5 hover:border-white/10"
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-0.5 cursor-grab active:cursor-grabbing text-white/20 hover:text-white/50 shrink-0"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      {/* Number */}
      <span className="text-xs font-mono text-white/30 w-5 text-right shrink-0">{index + 1}</span>

      {/* Thumbnail 16:9 */}
      <div className="w-16 h-9 rounded overflow-hidden shrink-0 border border-white/10 bg-black">
        <MediaThumb url={item.mediaUrl} type={item.mediaType} className="w-full h-full" />
      </div>

      {/* Name + type */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate text-white/90 leading-tight">{item.mediaName ?? "—"}</p>
        <span className={cn("text-[9px] font-bold px-1 py-px rounded border mt-0.5 inline-block", typeColor(item.mediaType))}>
          {typeLabel(item.mediaType)}
        </span>
      </div>

      {/* Duration — click to edit */}
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        {editingDur ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              type="number"
              min={1}
              className="w-12 h-6 text-xs text-right px-1 bg-white/10 border-white/20 text-white"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDuration}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitDuration();
                if (e.key === "Escape") setEditingDur(false);
              }}
            />
            <span className="text-[10px] text-white/40">s</span>
          </div>
        ) : (
          <button
            className="text-[10px] font-mono text-white/50 hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded transition-colors border border-transparent hover:border-white/20"
            onClick={() => { setEditingDur(true); setDraft(String(item.durationSeconds)); }}
            title="Editar duração"
          >
            {item.durationSeconds}s
          </button>
        )}
      </div>

      {/* DELETE button — always visible */}
      <button
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-400/40 transition-all"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        title="Remover da playlist"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function PlaylistDetail() {
  const [, params] = useRoute("/playlists/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [searchMedia, setSearchMedia] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>("all");
  const [optimisticItems, setOptimisticItems] = useState<typeof sortedItems | null>(null);

  const { data: playlist, isLoading: playlistLoading } = useGetPlaylist(id, {
    query: { enabled: !!id, queryKey: getGetPlaylistQueryKey(id) },
  });

  const { data: mediaItems, isLoading: mediaLoading } = useListMedia(
    {},
    { query: { enabled: !!id, queryKey: getListMediaQueryKey() } }
  );

  const addItem = useAddPlaylistItem();
  const removeItem = useRemovePlaylistItem();
  const reorderItems = useReorderPlaylistItems();
  const updateItem = useUpdatePlaylistItem();

  const sortedItems = [...(playlist?.items ?? [])].sort((a, b) => a.position - b.position);
  const displayItems = optimisticItems ?? sortedItems;
  const selectedItem = displayItems.find(i => i.id === selectedItemId) ?? displayItems[0] ?? null;

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

  const handleRemove = (itemId: number) => {
    removeItem.mutate(
      { id, itemId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) });
          if (selectedItemId === itemId) setSelectedItemId(null);
        },
        onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
      }
    );
  };

  const handleDurationChange = (itemId: number, durationSeconds: number) => {
    updateItem.mutate(
      { id, itemId, data: { durationSeconds } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) }),
        onError: () => toast({ title: "Erro ao atualizar duração", variant: "destructive" }),
      }
    );
  };

  const totalDuration = displayItems.reduce((s, i) => s + i.durationSeconds, 0);

  const filteredMedia = mediaItems?.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(searchMedia.toLowerCase());
    const matchType = mediaTypeFilter === "all" || m.type === mediaTypeFilter;
    return matchSearch && matchType;
  });

  const addedMediaIds = new Set(displayItems.map(i => i.mediaId));

  if (playlistLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[600px] w-full rounded-xl" />
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
    <div className="flex flex-col h-[calc(100vh-80px)] -mx-6 -mt-4 bg-[#0d0d10]">

      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/10 bg-[#16161a] shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8 hover:bg-white/10 text-white/70 hover:text-white">
            <Link href="/playlists"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">{playlist.name}</h1>
            <div className="flex items-center gap-2.5 text-[11px] text-white/40 mt-0.5">
              <span className="flex items-center gap-1">
                <Film className="w-3 h-3" />
                {displayItems.length} {displayItems.length === 1 ? "item" : "itens"}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(totalDuration)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Salvo automaticamente
          </span>
        </div>
      </div>

      {/* ── 3-PANEL EDITOR ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Slide list */}
        <div className="w-64 border-r border-white/8 bg-[#13131a] flex flex-col shrink-0">
          <div className="px-3 py-2 border-b border-white/8">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              Slides ({displayItems.length})
            </span>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {displayItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                    <Play className="w-5 h-5 text-white/20" />
                  </div>
                  <p className="text-xs text-white/30">
                    Clique em uma mídia na biblioteca para adicionar
                  </p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={displayItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    {displayItems.map((item, idx) => (
                      <SortableItem
                        key={item.id}
                        item={item}
                        index={idx}
                        isSelected={selectedItem?.id === item.id}
                        onSelect={() => setSelectedItemId(item.id)}
                        onRemove={() => handleRemove(item.id)}
                        onDurationChange={(val) => handleDurationChange(item.id, val)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </ScrollArea>

          {/* Left footer */}
          <div className="px-3 py-2.5 border-t border-white/8 bg-[#0d0d10]">
            <div className="text-[10px] text-white/25 text-center">
              Arraste para reordenar
            </div>
          </div>
        </div>

        {/* CENTER — 16:9 Preview */}
        <div className="flex-1 flex flex-col bg-[#0d0d10] overflow-hidden">
          {/* Preview area — enforces 16:9 */}
          <div className="flex-1 flex items-center justify-center overflow-hidden p-6">
            <div
              className="relative bg-black overflow-hidden shadow-2xl border border-white/10"
              style={{
                aspectRatio: "16 / 9",
                maxWidth: "100%",
                maxHeight: "100%",
                width: "min(100%, calc((100vh - 200px) * 16 / 9))",
              }}
            >
              <PreviewContent item={selectedItem} />

              {/* Bottom info bar */}
              {selectedItem && (
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                  <div>
                    <p className="text-white text-xs font-semibold truncate max-w-xs">
                      {selectedItem.mediaName}
                    </p>
                    <p className="text-white/50 text-[10px] mt-0.5">
                      {typeLabel(selectedItem.mediaType)} · {selectedItem.durationSeconds}s
                    </p>
                  </div>
                  <span className="text-white/40 text-[10px] font-mono bg-black/50 px-2 py-0.5 rounded">
                    {displayItems.findIndex(i => i.id === selectedItem.id) + 1} / {displayItems.length}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Resolution badge */}
          <div className="flex items-center justify-center pb-3">
            <span className="text-[10px] text-white/20 font-mono flex items-center gap-1.5">
              <Monitor className="w-3 h-3" />
              Preview 16:9 — Full HD 1920×1080
            </span>
          </div>
        </div>

        {/* RIGHT — Media library */}
        <div className="w-64 border-l border-white/8 bg-[#13131a] flex flex-col shrink-0">
          <div className="px-3 py-2.5 border-b border-white/8 shrink-0">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">
              Biblioteca de Mídias
            </span>
            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <Input
                placeholder="Buscar..."
                value={searchMedia}
                onChange={(e) => setSearchMedia(e.target.value)}
                className="pl-8 h-8 text-xs bg-white/8 border-white/10 text-white placeholder:text-white/30 focus:border-primary/50"
              />
            </div>
            {/* Type filter pills */}
            <div className="flex gap-1 flex-wrap">
              {["all", "image", "video", "web_channel"].map(t => (
                <button
                  key={t}
                  onClick={() => setMediaTypeFilter(t)}
                  className={cn(
                    "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border transition-all",
                    mediaTypeFilter === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white/60"
                  )}
                >
                  {t === "all" ? "Todos" : t === "image" ? "IMG" : t === "video" ? "VID" : "WEB"}
                </button>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1">
            {mediaLoading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="w-14 h-9 rounded shrink-0 bg-white/10" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-full bg-white/10" />
                      <Skeleton className="h-2.5 w-12 bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredMedia?.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-xs text-white/30">Nenhuma mídia encontrada</p>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {filteredMedia?.map((media) => {
                  const alreadyAdded = addedMediaIds.has(media.id);
                  return (
                    <div
                      key={media.id}
                      className={cn(
                        "group flex items-center gap-2 p-1.5 rounded border transition-all cursor-pointer",
                        alreadyAdded
                          ? "border-primary/20 bg-primary/8"
                          : "border-transparent hover:bg-white/8 hover:border-white/10"
                      )}
                      onClick={() => handleAdd(media.id, media.durationSeconds ?? 10)}
                    >
                      {/* 16:9 thumb */}
                      <div className="w-16 h-9 rounded overflow-hidden shrink-0 border border-white/10 bg-black">
                        <MediaThumb url={media.url} type={media.type} className="w-full h-full" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium truncate text-white/80 leading-tight">{media.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={cn("text-[8px] font-bold px-1 py-px rounded border", typeColor(media.type))}>
                            {typeLabel(media.type)}
                          </span>
                          {media.durationSeconds ? (
                            <span className="text-[10px] text-white/30">{media.durationSeconds}s</span>
                          ) : null}
                        </div>
                      </div>

                      {/* Add icon */}
                      <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                        {alreadyAdded ? (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        ) : (
                          <Plus className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Library footer */}
          <div className="px-3 py-2.5 border-t border-white/8 text-center bg-[#0d0d10]">
            <p className="text-[10px] text-white/25">
              {addedMediaIds.size} de {mediaItems?.length ?? 0} mídias na playlist
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
