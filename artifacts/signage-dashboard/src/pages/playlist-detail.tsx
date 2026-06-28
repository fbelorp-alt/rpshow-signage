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
  Trash2, Play, Search, Check, Plus, Pencil, X, ChevronRight,
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

function MediaThumb({ url, type, className }: { url?: string | null; type?: string | null; className?: string }) {
  if (type === "video") {
    return (
      <div className={cn("bg-black/80 flex items-center justify-center", className)}>
        <Film className="w-1/3 h-1/3 text-white/40" />
      </div>
    );
  }
  if (type === "web_channel") {
    return (
      <div className={cn("bg-blue-950/60 flex items-center justify-center", className)}>
        <Play className="w-1/3 h-1/3 text-blue-400/70" />
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(item.durationSeconds));
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const commitDuration = () => {
    const v = parseInt(draft, 10);
    if (!isNaN(v) && v > 0) onDurationChange(v);
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer border transition-all",
        isSelected
          ? "bg-primary/10 border-primary/30"
          : "bg-card border-transparent hover:bg-accent/40 hover:border-border"
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      {/* Index */}
      <span className="text-xs font-mono text-muted-foreground/60 w-4 text-right shrink-0">
        {index + 1}
      </span>

      {/* Thumbnail */}
      <div className="w-14 h-10 rounded overflow-hidden flex-shrink-0 border">
        <MediaThumb url={item.mediaUrl} type={item.mediaType} className="w-full h-full" />
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate leading-tight">{item.mediaName ?? "—"}</p>
        <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{item.mediaType ?? "—"}</p>
      </div>

      {/* Duration */}
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              type="number"
              className="w-14 h-6 text-xs text-right px-1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDuration}
              onKeyDown={(e) => { if (e.key === "Enter") commitDuration(); if (e.key === "Escape") setEditing(false); }}
            />
            <span className="text-[10px] text-muted-foreground">s</span>
          </div>
        ) : (
          <button
            className="text-xs font-mono bg-muted border px-1.5 py-0.5 rounded hover:bg-primary/10 hover:border-primary/30 transition-colors"
            onClick={() => { setEditing(true); setDraft(String(item.durationSeconds)); }}
            title="Clique para editar duração"
          >
            {item.durationSeconds}s
          </button>
        )}
      </div>

      {/* Remove */}
      <button
        className="shrink-0 p-1 text-muted-foreground/30 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
      >
        <Trash2 className="w-3.5 h-3.5" />
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
      {
        id,
        data: {
          items: reordered.map((item, pos) => ({ itemId: item.id, position: pos })),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) });
          setOptimisticItems(null);
        },
        onError: () => {
          setOptimisticItems(null);
          toast({ title: "Erro ao reordenar", variant: "destructive" });
        },
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
          toast({ title: "Mídia adicionada" });
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
          toast({ title: "Item removido" });
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

  const filteredMedia = mediaItems?.filter(m =>
    m.name.toLowerCase().includes(searchMedia.toLowerCase()) &&
    (!playlist?.clientId || !m.clientId || m.clientId === playlist.clientId)
  );

  const addedMediaIds = new Set(displayItems.map(i => i.mediaId));

  if (playlistLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-[600px] w-full" />
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
    <div className="flex flex-col h-[calc(100vh-80px)] gap-0 -mx-6 -mt-4">
      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2 h-8 w-8">
            <Link href="/playlists"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-base font-bold leading-tight">{playlist.name}</h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <Film className="w-3 h-3" /> {displayItems.length} {displayItems.length === 1 ? "item" : "itens"}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {formatDuration(totalDuration)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Salvo automaticamente
          </Badge>
        </div>
      </div>

      {/* ── 3-PANEL LAYOUT ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT PANEL — Slide list */}
        <div className="w-60 border-r bg-muted/20 flex flex-col shrink-0">
          <div className="px-3 py-2.5 border-b bg-card flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Slides ({displayItems.length})
            </span>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {displayItems.length === 0 ? (
                <div className="text-center py-8 px-3">
                  <Play className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Selecione mídias da biblioteca →
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
        </div>

        {/* CENTER PANEL — Preview */}
        <div className="flex-1 flex flex-col bg-black overflow-hidden">
          {selectedItem ? (
            <div className="flex-1 flex items-center justify-center relative">
              {selectedItem.mediaType === "video" ? (
                <video
                  key={selectedItem.mediaUrl ?? ""}
                  src={resolveMediaUrl(selectedItem.mediaUrl) ?? ""}
                  className="max-w-full max-h-full object-contain"
                  controls
                  autoPlay
                  muted
                  loop
                />
              ) : selectedItem.mediaType === "web_channel" ? (
                <iframe
                  src={selectedItem.mediaUrl ?? ""}
                  className="w-full h-full"
                  style={{ border: "none" }}
                  allow="autoplay; fullscreen"
                  title={selectedItem.mediaName ?? ""}
                />
              ) : resolveMediaUrl(selectedItem.mediaUrl) ? (
                <img
                  key={selectedItem.mediaUrl}
                  src={resolveMediaUrl(selectedItem.mediaUrl)}
                  alt={selectedItem.mediaName ?? ""}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-muted-foreground/30 flex flex-col items-center gap-2">
                  <ImageIcon className="w-12 h-12" />
                  <span className="text-sm">Sem prévia disponível</span>
                </div>
              )}

              {/* Overlay info */}
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-none">
                <div className="bg-black/60 backdrop-blur-sm rounded px-2 py-1">
                  <p className="text-white text-xs font-medium truncate max-w-xs">
                    {selectedItem.mediaName}
                  </p>
                  <p className="text-white/60 text-[10px]">
                    {selectedItem.mediaType?.toUpperCase()} · {selectedItem.durationSeconds}s
                  </p>
                </div>
                <div className="bg-black/60 backdrop-blur-sm rounded px-2 py-1 text-white/60 text-[10px]">
                  {displayItems.findIndex(i => i.id === selectedItem.id) + 1} / {displayItems.length}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-white/20 gap-3">
              <Play className="w-16 h-16" />
              <p className="text-sm">Selecione um slide para visualizar</p>
            </div>
          )}
        </div>

        {/* RIGHT PANEL — Media library */}
        <div className="w-64 border-l bg-card flex flex-col shrink-0">
          <div className="px-3 py-2.5 border-b flex flex-col gap-2 shrink-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Biblioteca de Mídias
            </span>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchMedia}
                onChange={(e) => setSearchMedia(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {mediaLoading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="w-10 h-10 rounded shrink-0" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredMedia?.length === 0 ? (
              <div className="text-center py-8 px-3">
                <p className="text-xs text-muted-foreground">Nenhuma mídia encontrada</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredMedia?.map((media) => {
                  const alreadyAdded = addedMediaIds.has(media.id);
                  return (
                    <div
                      key={media.id}
                      className={cn(
                        "group flex items-center gap-2 p-1.5 rounded-lg border transition-all",
                        alreadyAdded
                          ? "border-primary/20 bg-primary/5"
                          : "border-transparent hover:bg-accent/40 hover:border-border cursor-pointer"
                      )}
                      onClick={() => !alreadyAdded && handleAdd(media.id, media.durationSeconds ?? 10)}
                    >
                      {/* Thumb */}
                      <div className="w-10 h-10 rounded overflow-hidden shrink-0 border bg-muted">
                        <MediaThumb url={media.url} type={media.type} className="w-full h-full" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate leading-tight">{media.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 uppercase">
                            {media.type}
                          </Badge>
                          {media.durationSeconds && (
                            <span className="text-[10px] text-muted-foreground">{media.durationSeconds}s</span>
                          )}
                        </div>
                      </div>

                      {/* Action icon */}
                      <div className="shrink-0">
                        {alreadyAdded ? (
                          <Check className="w-4 h-4 text-primary" />
                        ) : (
                          <Plus className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Library footer */}
          <div className="px-3 py-2 border-t text-center">
            <p className="text-[10px] text-muted-foreground">
              Clique em uma mídia para adicionar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
