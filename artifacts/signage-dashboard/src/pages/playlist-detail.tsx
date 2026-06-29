import { useState, useCallback, useMemo } from "react";
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
  getGetPlaylistQueryKey,
  getListMediaQueryKey,
  getListPlaylistsQueryKey,
  getListScreensQueryKey,
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
  SlidersHorizontal, Save, X, CheckCircle2, Layers, CalendarDays,
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
  if (type === "video") {
    const resolved = resolveUrl(url);
    if (resolved) return <VideoThumbnail url={resolved} className={className} />;
    return (
      <div className={cn("bg-[#1a1025] flex items-center justify-center", className)}>
        <Film className="w-1/3 h-1/3 text-purple-400/70" />
      </div>
    );
  }
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
}
function SlideItem({ item, index, isSelected, onSelect, onRemove }: SlideItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      onClick={onSelect}
      className={cn(
        "group relative flex items-center gap-0 select-none transition-all",
        isDragging ? "cursor-grabbing" : "cursor-grab",
        isSelected ? "bg-[#1a3a6a]" : "hover:bg-white/5"
      )}
    >
      {/* Blue left accent on selected */}
      {isSelected && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-400" />}

      {/* Drag affordance — visual only */}
      <div className="w-5 flex items-center justify-center shrink-0 self-stretch text-white/20 group-hover:text-white/50 transition-colors">
        <GripVertical className="w-3.5 h-3.5" />
      </div>

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

      {/* Delete */}
      <button
        className="shrink-0 w-7 self-stretch flex items-center justify-center text-red-400/40 hover:text-red-300 hover:bg-red-500/15 transition-all border-l border-white/8"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        title="Remover slide"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Trash2 className="w-3.5 h-3.5" />
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
  const [pickerMulti, setPickerMulti] = useState(false);
  const [pickerSelected, setPickerSelected] = useState<Set<number>>(new Set());
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  // ── Apply dialog ──
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyScreenId, setApplyScreenId] = useState<string>("");
  const [applyName, setApplyName] = useState("");

  const { data: screens } = useListScreens();
  const updateScreen = useUpdateScreen();
  const updateMedia = useUpdateMedia();

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
    updateScreen.mutate(
      { id: Number(applyScreenId), data: { defaultPlaylistId: id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListScreensQueryKey() });
          setApplyOpen(false); setApplyScreenId(""); setApplyName("");
          toast({ title: "✅ Playlist padrão definida!", description: `"${playlist?.name}" vai rodar 24h em ${s?.name ?? "—"}.` });
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
  const [weatherDialogOpen, setWeatherDialogOpen] = useState(false);
  const [weatherForm, setWeatherForm] = useState({ name: "", city: "", durationSeconds: "20" });
  const [forecastDialogOpen, setForecastDialogOpen] = useState(false);
  const [forecastForm, setForecastForm] = useState({ name: "", city: "", days: "5", durationSeconds: "30" });
  const [rssDialogOpen, setRssDialogOpen] = useState(false);
  const [rssForm, setRssForm] = useState({ name: "", feedUrl: "https://g1.globo.com/rss/g1/", displayMode: "ticker" as "ticker" | "fullscreen" });

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
            { label: "Webpage", icon: Globe, type: "web_channel", color: "text-blue-400" },
            { label: "Relógio", icon: Clock, type: "clock", color: "text-slate-300" },
            { label: "Clima", icon: CloudSun, type: "weather", color: "text-sky-400" },
            { label: "Previsão", icon: CalendarDays, type: "weather_forecast", color: "text-amber-400" },
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
            Publicar
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          THREE-PANEL BODY
      ═══════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">

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

          <div className="flex-1 overflow-auto flex flex-col">
              {/* ─── Zone Layout Editor ────────────────────────────── */}
              {playlist && (() => {
                const parseZones = (json?: string | null): Record<string, { mediaId: number }> => {
                  try { return json ? JSON.parse(json) : {}; } catch { return {}; }
                };
                const zones = parseZones(playlist.layoutJson);
                const imageMedia = (mediaItems ?? []).filter((m) => m.type === "image" || m.type === "video");
                const saveZone = (key: string, mediaId: number | null) => {
                  const next: Record<string, { mediaId: number }> = { ...zones };
                  if (mediaId === null) delete next[key];
                  else next[key] = { mediaId };
                  updatePlaylist.mutate({
                    id,
                    data: { layoutJson: Object.keys(next).length ? JSON.stringify(next) : null },
                  }, {
                    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) }),
                  });
                };
                return (
                  <div className="p-4 border-b border-white/8 shrink-0">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Layers className="w-3 h-3" /> Layout da Tela
                    </p>
                    {/* Mini TV mockup */}
                    <div className="rounded-lg border border-white/15 bg-black overflow-hidden mb-3" style={{ aspectRatio: "16/9" }}>
                      <div className="w-full h-full flex">
                        <div className="flex-1 flex items-center justify-center bg-white/3 border-r border-white/10">
                          <span className="text-[8px] text-white/30 font-medium text-center px-1">Principal<br/>(slides)</span>
                        </div>
                        <div className="w-[38%] flex flex-col">
                          <div className={`flex-1 flex items-center justify-center border-b border-white/10 transition-colors ${zones.sidebar ? "bg-blue-500/25" : "bg-white/3"}`}>
                            <span className="text-[7px] font-bold text-white/40">SIDEBAR</span>
                          </div>
                          <div className={`flex-1 flex items-center justify-center transition-colors ${zones.logo ? "bg-amber-500/25" : "bg-white/3"}`}>
                            <span className="text-[7px] font-bold text-white/40">LOGO</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Zone pickers */}
                    {([
                      { key: "sidebar", label: "Sidebar (superior direita)", color: "text-blue-400" },
                      { key: "logo",    label: "Logo (inferior direita)",    color: "text-amber-400" },
                    ] as const).map(({ key, label, color }) => (
                      <div key={key} className="mb-2.5">
                        <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${color}`}>{label}</p>
                        <select
                          value={zones[key]?.mediaId ?? ""}
                          onChange={(e) => saveZone(key, e.target.value ? Number(e.target.value) : null)}
                          className="w-full bg-white/5 border border-white/10 rounded text-[10px] text-white/70 px-2 py-1.5 outline-none focus:border-white/25 cursor-pointer"
                        >
                          <option value="">— Nenhuma —</option>
                          {imageMedia.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                );
              })()}

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

                  {/* File info — resolution, format, size */}
                  {(() => {
                    const meta = parseFileMeta((selectedItem as any).mediaMetaJson);
                    if (!meta || (!meta.width && !meta.fileSize)) return null;
                    const isIdeal = meta.width === 1920 && meta.height === 1080;
                    const notIdeal = meta.width && meta.height && !isIdeal;
                    return (
                      <div>
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Arquivo</p>
                        <div className="rounded-lg bg-white/4 border border-white/8 p-2.5 space-y-1.5 text-[10px]">
                          {meta.width && meta.height && (
                            <div className="flex items-center justify-between">
                              <span className="text-white/40">Resolução</span>
                              <span className={`font-mono font-bold ${isIdeal ? "text-green-400" : "text-amber-400"}`}>
                                {meta.width}×{meta.height}
                              </span>
                            </div>
                          )}
                          {meta.format && (
                            <div className="flex items-center justify-between">
                              <span className="text-white/40">Formato</span>
                              <span className="font-mono text-white/60">{mimeToLabel(meta.format)}</span>
                            </div>
                          )}
                          {meta.fileSize && (
                            <div className="flex items-center justify-between">
                              <span className="text-white/40">Tamanho</span>
                              <span className="font-mono text-white/60">{formatBytes(meta.fileSize)}</span>
                            </div>
                          )}
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
      {applyOpen && (
        <Dialog open onOpenChange={setApplyOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MonitorPlay className="w-4 h-4 text-primary" />
                Publicar em Tela
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
              <Button size="sm" disabled={!applyScreenId} onClick={handleApply} className="gap-1.5">
                <MonitorPlay className="w-3.5 h-3.5" /> Publicar agora
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
