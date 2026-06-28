import { useState, useCallback } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetPlaylist,
  useListMedia,
  useAddPlaylistItem,
  useRemovePlaylistItem,
  useReorderPlaylistItems,
  useUpdatePlaylistItem,
  useListScreens,
  useCreateSchedule,
  getGetPlaylistQueryKey,
  getListMediaQueryKey,
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
  CalendarClock, MonitorPlay, Pencil, ChevronLeft, ChevronRight,
  SlidersHorizontal, Save, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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

// ─── Type helpers ─────────────────────────────────────────────────────────────
function typeLabel(type?: string | null) {
  const map: Record<string, string> = {
    image: "Imagem", video: "Vídeo", web_channel: "Webpage",
    clock: "Relógio", weather: "Clima", rss: "RSS",
  };
  return map[type ?? ""] ?? (type?.toUpperCase() ?? "—");
}
function typeColor(type?: string | null) {
  if (type === "video") return "bg-purple-500/20 text-purple-300 border-purple-500/30";
  if (type === "web_channel") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  if (type === "clock") return "bg-slate-400/20 text-slate-300 border-slate-500/30";
  if (type === "weather") return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
  if (type === "rss") return "bg-orange-500/20 text-orange-300 border-orange-500/30";
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
function Thumb({ url, type, className }: { url?: string | null; type?: string | null; className?: string }) {
  if (type === "video") return (
    <div className={cn("bg-[#1a1025] flex items-center justify-center", className)}>
      <Film className="w-1/3 h-1/3 text-purple-400/70" />
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
  if (type === "weather") return (
    <div className={cn("bg-[#061525] flex items-center justify-center", className)}>
      <CloudSun className="w-1/3 h-1/3 text-sky-400/70" />
    </div>
  );
  if (type === "rss") return (
    <div className={cn("bg-[#1a0c00] flex items-center justify-center", className)}>
      <RssIcon className="w-1/3 h-1/3 text-orange-400/70" />
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
  onDurationChange: (v: number) => void;
}
function SlideItem({ item, index, isSelected, onSelect, onRemove, onDurationChange }: SlideItemProps) {
  const [editDur, setEditDur] = useState(false);
  const [draft, setDraft] = useState(String(item.durationSeconds));
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const commit = () => {
    const v = parseInt(draft, 10);
    if (!isNaN(v) && v > 0) onDurationChange(v);
    setEditDur(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      onClick={onSelect}
      className={cn(
        "group relative flex items-center gap-0 cursor-pointer transition-all select-none",
        isSelected ? "bg-[#1a3a6a]" : "hover:bg-white/5"
      )}
    >
      {/* Blue left accent on selected */}
      {isSelected && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-400" />}

      {/* Index number */}
      <div className="w-8 text-center shrink-0">
        <span className={cn("text-xs font-bold tabular-nums", isSelected ? "text-blue-300" : "text-white/30")}>{index + 1}</span>
      </div>

      {/* Thumbnail 16:9 */}
      <div className="w-[72px] h-[40px] shrink-0 overflow-hidden border border-white/10">
        <Thumb url={item.mediaUrl} type={item.mediaType} className="w-full h-full" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 px-2 py-2">
        <p className="text-[11px] font-medium truncate text-white/85 leading-tight">{item.mediaName ?? "—"}</p>
        <p className="text-[10px] text-white/35 mt-0.5">
          Exibir 1 vez(es)
        </p>
      </div>

      {/* Duration badge — click to edit */}
      <div className="shrink-0 pr-2" onClick={(e) => e.stopPropagation()}>
        {editDur ? (
          <div className="flex items-center gap-0.5">
            <Input
              autoFocus type="number" min={1}
              className="w-10 h-5 text-[10px] text-right px-1 py-0 bg-white/15 border-white/25 text-white rounded-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditDur(false); }}
            />
            <span className="text-[9px] text-white/40">s</span>
          </div>
        ) : (
          <button
            className="text-[10px] font-mono text-white/40 hover:text-white hover:bg-white/15 px-1.5 py-0.5 rounded transition-colors"
            onClick={() => { setEditDur(true); setDraft(String(item.durationSeconds)); }}
          >
            {item.durationSeconds}s
          </button>
        )}
      </div>

      {/* Drag handle (shows on hover) */}
      <button
        {...attributes} {...listeners}
        className="shrink-0 mr-1 p-0.5 cursor-grab active:cursor-grabbing text-white/15 hover:text-white/40 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <GripVertical className="w-3 h-3" />
      </button>

      {/* Delete — always visible */}
      <button
        className="shrink-0 mr-1.5 w-5 h-5 flex items-center justify-center rounded text-red-400/50 hover:text-red-300 hover:bg-red-500/20 transition-all"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        title="Remover slide"
      >
        <Trash2 className="w-3 h-3" />
      </button>
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

  // ── Apply dialog ──
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyScreenId, setApplyScreenId] = useState<string>("");
  const [applyName, setApplyName] = useState("");

  // ── Schedule dialog ──
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedScreenId, setSchedScreenId] = useState<string>("");
  const [schedName, setSchedName] = useState("");
  const [schedMode, setSchedMode] = useState<"promo" | "recurring">("promo");
  const [schedStartAt, setSchedStartAt] = useState("");
  const [schedEndAt, setSchedEndAt] = useState("");
  const [schedStartTime, setSchedStartTime] = useState("08:00");
  const [schedEndTime, setSchedEndTime] = useState("22:00");
  const [schedDays, setSchedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const { data: screens } = useListScreens();
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

  const sortedItems = [...(playlist?.items ?? [])].sort((a, b) => a.position - b.position);
  const displayItems = optimisticItems ?? sortedItems;
  const selectedItem = displayItems.find(i => i.id === selectedItemId) ?? displayItems[0] ?? null;
  const totalDuration = displayItems.reduce((s, i) => s + i.durationSeconds, 0);

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
          toast({ title: "Slide removido", description: "O arquivo continua na biblioteca." });
        },
        onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
      }
    );
  };

  const handleDurationChange = (itemId: number, durationSeconds: number) => {
    updateItem.mutate(
      { id, itemId, data: { durationSeconds } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) }) }
    );
  };

  const handleApply = () => {
    if (!applyScreenId) return;
    const name = applyName.trim() || (playlist?.name ?? "Programação Principal");
    createSchedule.mutate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { data: { screenId: Number(applyScreenId), playlistId: id, name, active: true } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          setApplyOpen(false); setApplyScreenId(""); setApplyName("");
          const s = screens?.find((s: any) => String(s.id) === applyScreenId);
          toast({ title: "✅ Playlist aplicada!", description: `"${name}" vai rodar em ${s?.name ?? "—"}.` });
        },
        onError: () => toast({ title: "Erro ao aplicar", variant: "destructive" }),
      }
    );
  };

  const handleSchedule = () => {
    if (!schedScreenId || !schedName.trim()) return;
    const payload: Record<string, unknown> = {
      screenId: Number(schedScreenId), playlistId: id, name: schedName.trim(), active: true,
    };
    if (schedMode === "promo") {
      if (schedStartAt) payload.startAt = fromLocalDatetimeInput(schedStartAt);
      if (schedEndAt) payload.endAt = fromLocalDatetimeInput(schedEndAt);
    } else {
      payload.startTime = schedStartTime; payload.endTime = schedEndTime;
      payload.daysOfWeek = schedDays.join(",");
    }
    createSchedule.mutate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { data: payload as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          setSchedOpen(false); setSchedName(""); setSchedScreenId("");
          toast({ title: "✅ Agendado!", description: `"${schedName}" programado.` });
        },
        onError: () => toast({ title: "Erro ao criar agendamento", variant: "destructive" }),
      }
    );
  };

  const toggleDay = (d: number) => setSchedDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);

  const addedIds = new Set(displayItems.map(i => i.mediaId));
  const filteredMedia = mediaItems?.filter(m => {
    if (addedIds.has(m.id)) return false;
    const matchSearch = m.name.toLowerCase().includes(searchMedia.toLowerCase());
    const matchType = mediaTypeFilter === "all" || m.type === mediaTypeFilter;
    return matchSearch && matchType;
  });

  const selectedIdx = displayItems.findIndex(i => i.id === selectedItem?.id);
  const goNext = () => displayItems[selectedIdx + 1] && setSelectedItemId(displayItems[selectedIdx + 1].id);
  const goPrev = () => displayItems[selectedIdx - 1] && setSelectedItemId(displayItems[selectedIdx - 1].id);

  // ── quick-add widget helpers (clock, weather, rss — stored in media table) ──
  const handleAddWidget = (type: "clock" | "weather" | "rss") => {
    const labels: Record<string, string> = { clock: "Relógio BRT", weather: "Widget Clima", rss: "Ticker RSS" };
    const url: Record<string, string> = { clock: "clock://local", weather: "São Paulo", rss: "https://g1.globo.com/rss/g1/" };
    const existing = mediaItems?.find(m => m.type === type);
    if (existing) {
      handleAdd(existing.id, existing.durationSeconds ?? 15);
    } else {
      toast({ title: `Adicione "${labels[type]}" pela Biblioteca de Mídias primeiro`, description: "Crie o widget na seção Mídias.", variant: "destructive" });
    }
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
    <div className="flex flex-col h-[calc(100vh-80px)] -mx-6 -mt-4 bg-[#0a0c12] overflow-hidden">

      {/* ═══════════════════════════════════════════════════════
          TOP TOOLBAR
      ═══════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-0 border-b border-white/10 bg-[#12141c] shrink-0 h-12">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 px-3 border-r border-white/10 h-full min-w-0 shrink-0">
          <Link href="/playlists">
            <button className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <span className="text-sm font-semibold text-white truncate max-w-[160px]">{playlist.name}</span>
          <Pencil className="w-3 h-3 text-white/25 shrink-0" />
        </div>

        {/* ── Media type quick-add buttons ── */}
        <div className="flex items-center gap-0 px-2 border-r border-white/10 h-full overflow-x-auto scrollbar-none">
          {[
            { label: "Imagem", icon: ImageIcon, type: "image", color: "text-emerald-400" },
            { label: "Vídeo", icon: Film, type: "video", color: "text-purple-400" },
            { label: "Webpage", icon: Globe, type: "web_channel", color: "text-blue-400" },
            { label: "Relógio", icon: Clock, type: "clock", color: "text-slate-300" },
            { label: "Clima", icon: CloudSun, type: "weather", color: "text-sky-400" },
            { label: "RSS", icon: RssIcon, type: "rss", color: "text-orange-400" },
          ].map(({ label, icon: Icon, type, color }) => (
            <button
              key={type}
              className="flex flex-col items-center justify-center gap-0.5 px-3 h-full text-white/50 hover:text-white hover:bg-white/8 transition-colors group shrink-0"
              onClick={() => {
                if (type === "image" || type === "video" || type === "web_channel") {
                  setPickerType(type); setSearchMedia(""); setPickerOpen(true);
                } else {
                  handleAddWidget(type as any);
                }
              }}
              title={`Adicionar ${label}`}
            >
              <Icon className={cn("w-4 h-4 transition-colors group-hover:text-current", color, "opacity-70 group-hover:opacity-100")} />
              <span className="text-[10px] font-medium leading-none whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Duration display */}
        <div className="flex items-center gap-1.5 px-3 border-l border-white/10 h-full text-white/40 text-xs shrink-0">
          <Play className="w-3 h-3" />
          <span>{displayItems.length} slides</span>
          <span className="text-white/20">·</span>
          <span>{formatDur(totalDuration)} total</span>
        </div>

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
            Aplicar
          </Button>
          <Button
            size="sm"
            className="h-7 px-3 text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 text-white border-0"
            onClick={() => setSchedOpen(true)}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            Programar
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          THREE-PANEL BODY
      ═══════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── LEFT: Slide list ──────────────────────────────────── */}
        <div className="w-[200px] border-r border-white/8 bg-[#0e1018] flex flex-col shrink-0">

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
                      onDurationChange={(v) => handleDurationChange(item.id, v)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </ScrollArea>

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

          <div className="flex-1 overflow-auto">
              {!selectedItem ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-6">
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

                  {/* Duration */}
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
                      Exibir 1 vez(es) · Duração total: {formatDur(totalDuration)}
                    </p>
                  </div>

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
      </div>

      {/* ════ DIALOG: Selecionar Mídia ════ */}
      <Dialog open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (!o) setSearchMedia(""); }}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0 bg-[#0e1018] border-white/10">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-white/8 shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm font-semibold text-white flex items-center gap-2">
                {pickerType === "image" && <ImageIcon className="w-4 h-4 text-emerald-400" />}
                {pickerType === "video" && <Film className="w-4 h-4 text-purple-400" />}
                {pickerType === "web_channel" && <Globe className="w-4 h-4 text-blue-400" />}
                Selecionar {pickerType === "image" ? "Imagem" : pickerType === "video" ? "Vídeo" : "Webpage"}
              </DialogTitle>
              <button onClick={() => setPickerOpen(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
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
                {filteredMedia?.map((media) => (
                  <button
                    key={media.id}
                    onClick={() => {
                      handleAdd(media.id, media.durationSeconds ?? 10);
                      setPickerOpen(false);
                      setSearchMedia("");
                    }}
                    className="group text-left rounded-lg border border-white/8 hover:border-blue-500/50 bg-white/3 hover:bg-blue-500/8 transition-all overflow-hidden"
                  >
                    <div className="w-full bg-black" style={{ aspectRatio: "16/9" }}>
                      <Thumb url={media.url} type={media.type} className="w-full h-full" />
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] font-medium text-white/80 truncate leading-tight group-hover:text-white">
                        {media.name}
                      </p>
                      {media.durationSeconds ? (
                        <p className="text-[10px] text-white/30 mt-0.5">{media.durationSeconds}s</p>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ════ DIALOG: Aplicar em Tela ════ */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        {applyOpen && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MonitorPlay className="w-4 h-4 text-primary" />
                Aplicar em Tela
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              A playlist <strong>{playlist?.name}</strong> vai rodar continuamente na tela escolhida (sem restrição de horário).
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tela / Aparelho</Label>
                <Select value={applyScreenId} onValueChange={setApplyScreenId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a tela…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(screens ?? []).map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        <span className="flex items-center gap-2">
                          <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome <span className="text-muted-foreground">(opcional)</span></Label>
                <Input
                  placeholder={playlist?.name ?? ""}
                  value={applyName}
                  onChange={(e) => setApplyName(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setApplyOpen(false)}>Cancelar</Button>
              <Button size="sm" disabled={!applyScreenId || createSchedule.isPending} onClick={handleApply} className="gap-1.5">
                <MonitorPlay className="w-3.5 h-3.5" /> Aplicar agora
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ════ DIALOG: Programar ════ */}
      <Dialog open={schedOpen} onOpenChange={setSchedOpen}>
        {schedOpen && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" />
              Programar Playlist
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Agende <strong>{playlist?.name}</strong> para rodar em horário específico.
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do agendamento *</Label>
              <Input
                placeholder="Ex: Promoção Julho, Horário Comercial…"
                value={schedName}
                onChange={(e) => setSchedName(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tela *</Label>
              <Select value={schedScreenId} onValueChange={setSchedScreenId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a tela…" />
                </SelectTrigger>
                <SelectContent>
                  {screens?.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      <span className="flex items-center gap-2">
                        <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <div className="flex rounded-lg border overflow-hidden">
                {(["promo", "recurring"] as const).map((m) => (
                  <button key={m} onClick={() => setSchedMode(m)}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium transition-colors",
                      schedMode === m ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground",
                      m === "recurring" && "border-l"
                    )}>
                    {m === "promo" ? "📅 Data e Hora" : "🔁 Recorrente"}
                  </button>
                ))}
              </div>
            </div>
            {schedMode === "promo" && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center justify-between">
                  Período <span className="bg-primary/20 px-1.5 py-0.5 rounded">🇧🇷 BRT</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Início</Label>
                    <Input type="datetime-local" className="h-8 text-xs" value={schedStartAt} onChange={(e) => setSchedStartAt(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fim <span className="text-muted-foreground">(opc.)</span></Label>
                    <Input type="datetime-local" className="h-8 text-xs" value={schedEndAt} onChange={(e) => setSchedEndAt(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
            {schedMode === "recurring" && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-3">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Horário recorrente</p>
                <div className="flex gap-1 flex-wrap">
                  {DAYS_LABELS.map((label, i) => (
                    <button key={i} onClick={() => toggleDay(i)}
                      className={cn("px-2 py-1 rounded text-xs font-bold border transition-all",
                        schedDays.includes(i) ? "bg-blue-500 text-white border-blue-400" : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10")}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Das</Label>
                    <Input type="time" className="h-8 text-xs" value={schedStartTime} onChange={(e) => setSchedStartTime(e.target.value)} />
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Até</Label>
                    <Input type="time" className="h-8 text-xs" value={schedEndTime} onChange={(e) => setSchedEndTime(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSchedOpen(false)}>Cancelar</Button>
            <Button size="sm" disabled={!schedScreenId || !schedName.trim() || createSchedule.isPending} onClick={handleSchedule} className="gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" /> Criar agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
