import { useState, useEffect, useRef } from "react";
import {
  useListScreens,
  useDeleteScreen,
  useCreateScreen,
  useUpdateScreen,
  getListScreensQueryKey,
  useListScreenGroups,
  useCreateScreenGroup,
  useUpdateScreenGroup,
  useDeleteScreenGroup,
  useAssignScreenToGroup,
  useUnassignScreenFromGroup,
  usePushPlaylistToGroup,
  getListScreenGroupsQueryKey,
  useListPlaylists,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Monitor, Search, Wifi, WifiOff, Clock, PlaySquare, Trash2, ExternalLink, Plus, Tag, Check, X, MonitorSmartphone, CalendarClock, Settings2, Layers, Pencil, ChevronDown, ChevronRight, Send, Play, BarChart2, Power, AlertTriangle, TrendingUp, Download, Cpu } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const data = values.length >= 2 ? values : [...values, ...Array(8).fill(0)];
  const max = Math.max(...data, 1);
  const w = 72, h = 28, pts = data.length;
  const points = data.map((v, i) =>
    `${(i / (pts - 1)) * w},${h - (v / max) * (h - 4) - 2}`
  ).join(" ");
  return (
    <svg width={w} height={h} className="flex-shrink-0 opacity-70">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function resolveScreenshotUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/objects/")) return `/api/storage${path}`;
  return path;
}

export function timeAgo(iso: string | null): string {
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

export function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return "Nunca";
  const diff = Date.now() - new Date(lastSeen).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  return new Date(lastSeen).toLocaleDateString("pt-BR");
}

export function formatFullDate(lastSeen: string | null): string {
  if (!lastSeen) return "Nunca";
  return new Date(lastSeen).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const TAG_COLORS = [
  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "bg-rose-500/20 text-rose-400 border-rose-500/30",
  "bg-sky-500/20 text-sky-400 border-sky-500/30",
];

function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export function TagCell({ screenId, tagsRaw, onSaved }: { screenId: number; tagsRaw: string | null; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tagsRaw ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const updateScreen = useUpdateScreen();

  const tags = (tagsRaw ?? "").split(",").map(t => t.trim()).filter(Boolean);

  const handleSave = () => {
    const normalized = value.split(",").map(t => t.trim()).filter(Boolean).join(", ");
    updateScreen.mutate(
      { id: screenId, data: { tags: normalized || null } as any },
      { onSuccess: () => { setEditing(false); onSaved(); }, onError: () => setEditing(false) }
    );
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <Input
          ref={inputRef}
          autoFocus
          className="h-6 text-xs px-1.5 py-0 w-36"
          placeholder="tag1, tag2..."
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
        />
        <button onClick={handleSave} className="text-primary"><Check className="w-3 h-3" /></button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground"><X className="w-3 h-3" /></button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1 cursor-pointer group min-h-[20px]"
      onClick={() => { setValue(tagsRaw ?? ""); setEditing(true); }}
      title="Clique para editar tags"
    >
      {tags.length > 0 ? tags.map(t => (
        <span key={t} className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${tagColor(t)}`}>
          {t}
        </span>
      )) : (
        <span className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <Tag className="w-2.5 h-2.5" /> Adicionar
        </span>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "online") {
    return (
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-emerald-500 text-sm font-medium">Online</span>
      </span>
    );
  }
  if (status === "offline") {
    return (
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-destructive" />
        <span className="text-destructive text-sm font-medium">Offline</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-muted-foreground" />
      <span className="text-muted-foreground text-sm font-medium">Desconhecido</span>
    </span>
  );
}

type DaySchedule = { day: number; active: boolean; on: string; off: string };
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DEFAULT_SCHEDULE: DaySchedule[] = [0, 1, 2, 3, 4, 5, 6].map(day => ({
  day,
  active: day >= 1 && day <= 5,
  on: "08:00",
  off: "22:00",
}));

function parsePowerSchedule(json: string | null): DaySchedule[] {
  if (!json) return DEFAULT_SCHEDULE.map(d => ({ ...d, active: false }));
  try { return JSON.parse(json) as DaySchedule[]; } catch { return DEFAULT_SCHEDULE; }
}

export function PowerScheduleCell({ screenId, powerScheduleJson, onSaved }: {
  screenId: number;
  powerScheduleJson: string | null;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sched, setSched] = useState<DaySchedule[]>(() => parsePowerSchedule(powerScheduleJson));
  const updateScreen = useUpdateScreen();

  const activeDays = sched.filter(d => d.active);
  const hasSchedule = activeDays.length > 0;

  const openDialog = () => {
    setSched(parsePowerSchedule(powerScheduleJson));
    setOpen(true);
  };

  const setDay = (day: number, patch: Partial<DaySchedule>) => {
    setSched(prev => prev.map(d => d.day === day ? { ...d, ...patch } : d));
  };

  const applyToAll = (src: DaySchedule, days: number[]) => {
    setSched(prev => prev.map(d => days.includes(d.day) ? { ...d, on: src.on, off: src.off } : d));
  };

  const handleSave = () => {
    updateScreen.mutate(
      { id: screenId, data: { powerScheduleJson: JSON.stringify(sched) } as any },
      { onSuccess: () => { setOpen(false); onSaved(); } }
    );
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateScreen.mutate(
      { id: screenId, data: { powerScheduleJson: null } as any },
      { onSuccess: () => { onSaved(); } }
    );
  };

  return (
    <>
      {hasSchedule ? (
        <button
          className="flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-400 group"
          onClick={openDialog}
          title="Clique para editar programação de energia"
        >
          <Power className="w-3 h-3" />
          <span>{activeDays.length === 7 ? "Todos os dias" : activeDays.length === 5 && !sched[0].active && !sched[6].active ? "Dias úteis" : `${activeDays.length} dias`}</span>
          <button
            onClick={handleClear}
            className="ml-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remover programação"
          >
            <X className="w-3 h-3" />
          </button>
        </button>
      ) : (
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          onClick={openDialog}
        >
          <Power className="w-3 h-3" /> Definir horário
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Power className="w-4 h-4" />
              Programação de energia
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1">
            <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-x-3 gap-y-1 items-center text-[11px] text-muted-foreground font-medium mb-1 px-1">
              <span />
              <span>Dia</span>
              <span>Liga</span>
              <span>Desliga</span>
            </div>

            {sched.map(d => (
              <div key={d.day} className={cn("grid grid-cols-[auto_1fr_1fr_1fr] gap-x-3 items-center rounded-md px-1 py-0.5", d.active ? "bg-muted/40" : "opacity-50")}>
                <input
                  type="checkbox"
                  checked={d.active}
                  onChange={e => setDay(d.day, { active: e.target.checked })}
                  className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer"
                />
                <span className="text-sm font-medium">{DAY_NAMES[d.day]}</span>
                <input
                  type="time"
                  value={d.on}
                  disabled={!d.active}
                  onChange={e => setDay(d.day, { on: e.target.value })}
                  className="text-xs border rounded px-1.5 py-1 bg-background disabled:opacity-40 w-full"
                />
                <input
                  type="time"
                  value={d.off}
                  disabled={!d.active}
                  onChange={e => setDay(d.day, { off: e.target.value })}
                  className="text-xs border rounded px-1.5 py-1 bg-background disabled:opacity-40 w-full"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap pt-1">
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              onClick={() => applyToAll(sched[1], [0, 1, 2, 3, 4, 5, 6])}
            >
              Aplicar Seg para todos
            </button>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              onClick={() => setSched(prev => prev.map(d => ({ ...d, active: d.day >= 1 && d.day <= 5 })))}
            >
              Só dias úteis
            </button>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              onClick={() => setSched(prev => prev.map(d => ({ ...d, active: true })))}
            >
              Todos os dias
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={updateScreen.isPending}>
              {updateScreen.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CodeEditCell({ screenId, code, onSaved }: { screenId: number; code: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(code);
  const updateScreen = useUpdateScreen();
  const { toast } = useToast();

  const handleSave = () => {
    const upper = value.trim().toUpperCase();
    if (!upper) return;
    updateScreen.mutate(
      { id: screenId, data: { code: upper } },
      {
        onSuccess: () => { setEditing(false); onSaved(); toast({ title: "Código atualizado!" }); },
        onError: () => toast({ title: "Erro ao atualizar código", variant: "destructive" }),
      }
    );
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={value}
          onChange={e => setValue(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setValue(code); setEditing(false); } }}
          className="h-6 text-xs font-mono w-40 px-1.5 uppercase tracking-wider"
          autoFocus
          maxLength={32}
        />
        <button onClick={handleSave} disabled={updateScreen.isPending} className="text-emerald-500 hover:text-emerald-400"><Check className="w-3 h-3" /></button>
        <button onClick={() => { setValue(code); setEditing(false); }} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group">
      <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded tracking-wider">{code}</code>
      <button
        onClick={() => { setValue(code); setEditing(true); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        title="Editar código"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ScreenRow({ screen, onDelete, deleteIsPending, onTagSaved, isAdmin }: {
  screen: any;
  onDelete: (id: number, name: string) => void;
  deleteIsPending: boolean;
  onTagSaved: () => void;
  isAdmin: boolean;
}) {
  const [pushOpen, setPushOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>("none");
  const { data: playlists } = useListPlaylists();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const pushMutation = useMutation({
    mutationFn: async ({ screenId, playlistId }: { screenId: number; playlistId: number }) => {
      const r = await fetch("/api/schedules/push-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ screenId, playlistId }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Erro");
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: `✅ Playlist enviada para ${data.screenName}`, description: data.playlistName });
      queryClient.invalidateQueries({ queryKey: getListScreensQueryKey() });
      setPushOpen(false);
      setSelectedPlaylist("none");
    },
    onError: (err: any) => {
      toast({ title: "Erro ao trocar playlist", description: err.message, variant: "destructive" });
    },
  });

  const handlePush = () => {
    if (selectedPlaylist === "none") return;
    pushMutation.mutate({ screenId: screen.id, playlistId: Number(selectedPlaylist) });
  };

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Monitor className="w-4 h-4 text-muted-foreground/50" />
          </div>
          <div className="min-w-0">
            <Link href={`/screens/${screen.id}`} className="font-medium hover:text-primary transition-colors truncate block max-w-[160px]">
              {screen.name}
            </Link>
            {screen.location && (
              <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate max-w-[160px]">{screen.location}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={screen.status} />
      </td>
      <td className="px-4 py-3">
        <CodeEditCell screenId={screen.id} code={screen.code} onSaved={onTagSaved} />
      </td>
      <td className="px-4 py-3">
        {(screen as any).device ? (
          <div className="flex flex-col gap-0.5">
            <code className="font-mono text-[11px] text-foreground/80">{(screen as any).device.serial}</code>
            {(screen as any).device.name && (
              <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">{(screen as any).device.name}</span>
            )}
            <span className={`text-[10px] font-medium ${(screen as any).device.status === "approved" ? "text-emerald-500" : "text-amber-500"}`}>
              {(screen as any).device.status === "approved" ? "● Aprovado" : "● Pendente"}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground/40 text-xs italic">Sem aparelho</span>
        )}
      </td>
      <td className="px-4 py-3">
        {(screen as any).resolution ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <MonitorSmartphone className="w-3 h-3 shrink-0" />
            {(screen as any).resolution.replace(/(\d+\.\d+)/g, (n: string) => Math.round(Number(n)))}
          </span>
        ) : (
          <span className="text-muted-foreground/40 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {screen.activePlaylistName ? (
          <span className="flex items-center gap-1.5 text-primary">
            <PlaySquare className="w-3.5 h-3.5" />
            <span className="truncate max-w-[140px]">{screen.activePlaylistName}</span>
          </span>
        ) : screen.defaultPlaylistName ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <PlaySquare className="w-3.5 h-3.5 opacity-50" />
            <span className="truncate max-w-[140px] opacity-70">{screen.defaultPlaylistName}</span>
          </span>
        ) : (
          <span className="text-muted-foreground/40 text-xs">—</span>
        )}
      </td>
      {/* ── Tocando Agora ── */}
      <td className="px-4 py-3 max-w-[180px]">
        {(screen as any).lastPlay ? (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", screen.status === "online" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30")} />
              <span className="text-xs truncate text-foreground/80">{(screen as any).lastPlay.mediaName}</span>
            </div>
            <div className="flex items-center gap-2 pl-3">
              <span className="text-[10px] text-muted-foreground font-mono">{timeAgo((screen as any).lastPlay.playedAt)}</span>
              {(screen as any).playsToday > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded">
                  <BarChart2 className="w-2 h-2" />{(screen as any).playsToday} hoje
                </span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground/30 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <TagCell
          screenId={screen.id}
          tagsRaw={(screen as any).tags ?? null}
          onSaved={onTagSaved}
        />
      </td>
      <td className="px-4 py-3 group">
        <PowerScheduleCell
          screenId={screen.id}
          powerScheduleJson={(screen as any).powerScheduleJson ?? null}
          onSaved={onTagSaved}
        />
      </td>
      <td className="px-4 py-3">
        <span
          className="flex items-center gap-1.5 text-muted-foreground cursor-default"
          title={formatFullDate(screen.lastSeen ?? null)}
        >
          <Clock className="w-3.5 h-3.5" />
          {formatLastSeen(screen.lastSeen ?? null)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
            onClick={() => { setSelectedPlaylist("none"); setPushOpen(true); }}
            title="Trocar playlist desta tela"
          >
            <Send className="w-3.5 h-3.5" />
            Playlist
          </Button>
          <Link href={`/screens/${screen.id}`}>
            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5 text-foreground/80 hover:text-foreground">
              <ExternalLink className="w-3.5 h-3.5" />
              Detalhes
            </Button>
          </Link>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(screen.id, screen.name)}
              disabled={deleteIsPending}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </td>

      {/* Dialog — Trocar Playlist desta tela */}
      <Dialog open={pushOpen} onOpenChange={setPushOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-400" />
              Trocar Playlist — {screen.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Selecione a playlist que será enviada para esta tela imediatamente.
            </p>
            <div className="space-y-1.5">
              <Label>Playlist</Label>
              <Select value={selectedPlaylist} onValueChange={setSelectedPlaylist}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar playlist" />
                </SelectTrigger>
                <SelectContent>
                  {(playlists ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPushOpen(false)}>Cancelar</Button>
            <Button
              onClick={handlePush}
              disabled={selectedPlaylist === "none" || pushMutation.isPending}
              className="gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {pushMutation.isPending ? "Enviando…" : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </tr>
  );
}

const GROUP_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f97316","#22c55e","#14b8a6","#3b82f6","#f59e0b","#ef4444","#64748b"];

function ScreenGroupsPanel({ screens }: { screens: any[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<{ id: number; name: string; color: string } | null>(null);
  const [pushOpen, setPushOpen] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(GROUP_COLORS[0]);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [selectedPushPlaylist, setSelectedPushPlaylist] = useState<string>("none");

  const { data: groups } = useListScreenGroups();
  const { data: playlists } = useListPlaylists();
  const createGroup = useCreateScreenGroup();
  const updateGroup = useUpdateScreenGroup();
  const deleteGroup = useDeleteScreenGroup();
  const assignScreen = useAssignScreenToGroup();
  const unassignScreen = useUnassignScreenFromGroup();
  const pushPlaylist = usePushPlaylistToGroup();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListScreenGroupsQueryKey() });
    qc.invalidateQueries({ queryKey: getListScreensQueryKey() });
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createGroup.mutate(
      { data: { name: newName.trim(), color: newColor } },
      { onSuccess: () => { toast({ title: "Grupo criado!" }); setCreateOpen(false); setNewName(""); invalidate(); }, onError: () => toast({ title: "Erro", variant: "destructive" }) }
    );
  };

  const handleUpdate = () => {
    if (!editGroup || !editName.trim()) return;
    updateGroup.mutate(
      { id: editGroup.id, data: { name: editName.trim(), color: editColor } },
      { onSuccess: () => { toast({ title: "Grupo atualizado!" }); setEditGroup(null); invalidate(); }, onError: () => toast({ title: "Erro", variant: "destructive" }) }
    );
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Remover o grupo "${name}"? As telas não serão apagadas.`)) return;
    deleteGroup.mutate({ id }, { onSuccess: () => { toast({ title: "Grupo removido" }); invalidate(); }, onError: () => toast({ title: "Erro", variant: "destructive" }) });
  };

  const handleAssign = (groupId: number, screenId: number) => {
    assignScreen.mutate({ id: groupId, data: { screenId } }, { onSuccess: () => { toast({ title: "Tela adicionada ao grupo" }); invalidate(); }, onError: () => toast({ title: "Erro", variant: "destructive" }) });
  };

  const handleUnassign = (groupId: number, screenId: number) => {
    unassignScreen.mutate({ id: groupId, data: { screenId } }, { onSuccess: () => { toast({ title: "Tela removida do grupo" }); invalidate(); }, onError: () => toast({ title: "Erro", variant: "destructive" }) });
  };

  const handlePush = (groupId: number) => {
    const pid = parseInt(selectedPushPlaylist);
    if (!pid) return;
    pushPlaylist.mutate(
      { id: groupId, data: { playlistId: pid } },
      { onSuccess: (res: any) => { toast({ title: `Playlist publicada em ${res.pushed} tela(s)` }); setPushOpen(null); setSelectedPushPlaylist("none"); invalidate(); }, onError: () => toast({ title: "Erro", variant: "destructive" }) }
    );
  };

  return (
    <>
      <div className="bg-card rounded-lg border">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted/20 transition-colors"
        >
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <Layers className="w-4 h-4 text-primary" />
          <span className="font-semibold">Grupos de Telas</span>
          <Badge variant="outline" className="ml-auto text-xs">{groups?.length ?? 0} grupos</Badge>
        </button>

        {open && (
          <div className="border-t p-4 space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Novo Grupo
              </Button>
            </div>

            {(!groups || groups.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum grupo criado ainda.</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {(groups ?? []).map((group: any) => {
                const groupScreenIds = screens.filter((s: any) => s.groupId === group.id).map((s: any) => s.id);
                const groupScreens = screens.filter((s: any) => s.groupId === group.id);
                const unassignedScreens = screens.filter((s: any) => !s.groupId);

                return (
                  <div key={group.id} className="rounded-lg border bg-muted/10 p-3 space-y-2" style={{ borderColor: group.color + "40" }}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                      <span className="font-semibold text-sm flex-1 truncate">{group.name}</span>
                      <button onClick={() => { setEditGroup(group); setEditName(group.name); setEditColor(group.color); }} className="text-muted-foreground hover:text-foreground p-0.5">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setPushOpen(group.id); setSelectedPushPlaylist("none"); }} className="text-muted-foreground hover:text-primary p-0.5">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(group.id, group.name)} className="text-muted-foreground hover:text-destructive p-0.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1 min-h-[32px]">
                      {groupScreens.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-1.5 text-xs bg-background rounded px-2 py-1">
                          <div className={cn("w-1.5 h-1.5 rounded-full", s.status === "online" ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                          <span className="flex-1 truncate">{s.name}</span>
                          <button onClick={() => handleUnassign(group.id, s.id)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                      {groupScreens.length === 0 && <p className="text-xs text-muted-foreground/50 px-2">Sem telas neste grupo</p>}
                    </div>

                    {unassignedScreens.length > 0 && (
                      <Select onValueChange={(val) => handleAssign(group.id, parseInt(val))}>
                        <SelectTrigger className="h-7 text-xs bg-white/6 border-white/12 text-white">
                          <SelectValue placeholder="+ Adicionar tela" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1f2e] border-white/10 text-white">
                          {unassignedScreens.map((s: any) => (
                            <SelectItem key={s.id} value={String(s.id)} className="text-xs text-white/80 focus:bg-white/8 focus:text-white">{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Create group dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Grupo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do grupo *</Label>
              <Input placeholder="Ex: Loja Centro" value={newName} onChange={e => setNewName(e.target.value)} autoFocus onKeyDown={e => e.key === "Enter" && handleCreate()} />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {GROUP_COLORS.map(c => (
                  <button key={c} onClick={() => setNewColor(c)} className={cn("w-7 h-7 rounded-full border-2 transition-all", newColor === c ? "border-white scale-110" : "border-transparent")} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || createGroup.isPending}>{createGroup.isPending ? "Criando..." : "Criar Grupo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit group dialog */}
      <Dialog open={!!editGroup} onOpenChange={v => { if (!v) setEditGroup(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Grupo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleUpdate()} />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {GROUP_COLORS.map(c => (
                  <button key={c} onClick={() => setEditColor(c)} className={cn("w-7 h-7 rounded-full border-2 transition-all", editColor === c ? "border-white scale-110" : "border-transparent")} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroup(null)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={!editName.trim() || updateGroup.isPending}>{updateGroup.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Push playlist dialog */}
      <Dialog open={pushOpen !== null} onOpenChange={v => { if (!v) setPushOpen(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="w-4 h-4" /> Publicar Playlist no Grupo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Selecione uma playlist para publicar em todas as telas deste grupo como playlist padrão.</p>
            <Select value={selectedPushPlaylist} onValueChange={setSelectedPushPlaylist}>
              <SelectTrigger className="bg-[#1a1f2e] border-white/15 text-white">
                <SelectValue placeholder="Selecionar playlist" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1f2e] border-white/10 text-white">
                <SelectItem value="none" className="text-white/50">Selecionar...</SelectItem>
                {(playlists ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)} className="text-white/80 focus:bg-white/8 focus:text-white">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPushOpen(null)}>Cancelar</Button>
            <Button onClick={() => pushOpen !== null && handlePush(pushOpen)} disabled={selectedPushPlaylist === "none" || pushPlaylist.isPending}>{pushPlaylist.isPending ? "Publicando..." : "Publicar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Screens() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [devSerial, setDevSerial] = useState("");
  const [devName, setDevName] = useState("");
  const [devTimezone, setDevTimezone] = useState("America/Sao_Paulo");
  const [devPowerOn, setDevPowerOn] = useState("");
  const [devPowerOff, setDevPowerOff] = useState("");
  const [devPanelW, setDevPanelW] = useState("");
  const [devPanelH, setDevPanelH] = useState("");

  // ── Endereço via CEP ────────────────────────────────────────────────────────
  const [devCep, setDevCep] = useState("");
  const [devLogradouro, setDevLogradouro] = useState("");
  const [devNumero, setDevNumero] = useState("");
  const [devComplemento, setDevComplemento] = useState("");
  const [devBairro, setDevBairro] = useState("");
  const [devCidade, setDevCidade] = useState("");
  const [devUf, setDevUf] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  // Monta o endereço completo para salvar no campo location
  const devLocation = [
    devLogradouro && devNumero ? `${devLogradouro}, ${devNumero}` : devLogradouro || "",
    devComplemento,
    devBairro,
    devCidade && devUf ? `${devCidade}/${devUf}` : devCidade || devUf,
    devCep ? `CEP ${devCep}` : "",
  ].filter(Boolean).join(", ");

  async function lookupCep(raw: string) {
    const cep = raw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    setCepError("");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) { setCepError("CEP não encontrado."); return; }
      setDevLogradouro(data.logradouro ?? "");
      setDevBairro(data.bairro ?? "");
      setDevCidade(data.localidade ?? "");
      setDevUf(data.uf ?? "");
    } catch {
      setCepError("Erro ao buscar CEP. Verifique sua conexão.");
    } finally {
      setCepLoading(false);
    }
  }

  function resetDevForm() {
    setDevSerial(""); setDevName("");
    setDevTimezone("America/Sao_Paulo");
    setDevPowerOn(""); setDevPowerOff("");
    setDevPanelW(""); setDevPanelH("");
    setDevCep(""); setDevLogradouro(""); setDevNumero("");
    setDevComplemento(""); setDevBairro(""); setDevCidade(""); setDevUf("");
    setCepError(""); setCepLoading(false);
  }
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: screens, isLoading, refetch } = useListScreens();
  const { data: monData } = useQuery({
    queryKey: ["monitoring-screens-banner"],
    queryFn: async () => {
      const r = await fetch("/api/monitoring", { credentials: "include" });
      return r.ok ? r.json() : null;
    },
    refetchInterval: 30_000,
  });
  const { data: todayData } = useQuery({
    queryKey: ["monitoring-today-screens"],
    queryFn: async () => {
      const r = await fetch("/api/monitoring/plays/today", { credentials: "include" });
      return r.ok ? r.json() : null;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const interval = setInterval(() => { refetch(); }, 30_000);
    return () => clearInterval(interval);
  }, [refetch]);
  const deleteScreen = useDeleteScreen();
  const createScreen = useCreateScreen();

  const addDeviceMutation = useMutation({
    mutationFn: async (data: {
      serial: string; name: string; location: string;
      timezone: string; powerOn: string; powerOff: string;
      panelW: string; panelH: string;
    }) => {
      const screenResp = await fetch("/api/screens", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name || "Nova Tela",
          location: data.location || undefined,
          timezone: data.timezone || "America/Sao_Paulo",
          powerOnTime: data.powerOn || null,
          powerOffTime: data.powerOff || null,
          panelWidth: data.panelW ? parseInt(data.panelW, 10) : null,
          panelHeight: data.panelH ? parseInt(data.panelH, 10) : null,
        }),
      });
      if (!screenResp.ok) throw new Error("Erro ao criar tela");
      const screen = await screenResp.json();

      const devResp = await fetch("/api/devices", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serial: data.serial,
          name: data.name || undefined,
          location: data.location || undefined,
          screenCode: screen.code,
        }),
      });
      if (!devResp.ok) {
        const e = await devResp.json().catch(() => ({}));
        throw new Error((e as any).error ?? "Erro ao registrar aparelho");
      }
      return devResp.json();
    },
    onSuccess: () => {
      toast({ title: "Tela adicionada! Aguardando aprovação do administrador." });
      queryClient.invalidateQueries({ queryKey: getListScreensQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      setShowAddDevice(false);
      resetDevForm();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    createScreen.mutate(
      { data: { name: newName.trim(), location: newLocation.trim() || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListScreensQueryKey() });
          toast({ title: "Tela criada com sucesso!" });
          setShowCreate(false);
          setNewName("");
          setNewLocation("");
        },
        onError: () => {
          toast({ title: "Erro ao criar tela", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Remover a tela "${name}"?`)) return;
    deleteScreen.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListScreensQueryKey() });
          toast({ title: "Tela removida" });
        },
        onError: () => {
          toast({ title: "Erro ao remover tela", variant: "destructive" });
        },
      }
    );
  };

  const allTags = Array.from(
    new Set(
      (screens ?? [])
        .flatMap((s) => ((s as any).tags ?? "").split(",").map((t: string) => t.trim()).filter(Boolean))
    )
  ).sort();

  const filtered = (screens ?? []).filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.location ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "online" && s.status === "online") ||
      (statusFilter === "offline" && s.status !== "online");
    const matchTag =
      tagFilter === "all" ||
      ((s as any).tags ?? "").split(",").map((t: string) => t.trim()).includes(tagFilter);
    return matchSearch && matchStatus && matchTag;
  });

  const onlineScreens = filtered.filter((s) => s.status === "online");
  const offlineScreens = filtered.filter((s) => s.status !== "online");

  const onlineCount = screens?.filter((s) => s.status === "online").length ?? 0;
  const totalCount = screens?.length ?? 0;
  const offlineCount = totalCount - onlineCount;
  const alertCount = (screens ?? []).filter((s) => {
    if ((s as any).status === "never") return true;
    if (s.status !== "online" && (s as any).lastSeen) {
      return Date.now() - new Date((s as any).lastSeen).getTime() > 2 * 3_600_000;
    }
    return false;
  }).length;
  const monSummary = (monData as any)?.summary;
  const hourly: number[] = ((todayData as any)?.hourly ?? []).map((h: any) => h.plays);
  // Online/offline trend from last 8 hours
  const now = new Date().getHours();
  const last8 = hourly.length ? hourly.slice(Math.max(0, now - 7), now + 1) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Minhas Telas</h1>
          <p className="text-muted-foreground mt-1 text-sm">Monitore todas as telas em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => {}}>
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
          {isAdmin ? (
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Nova Tela
            </Button>
          ) : (
            <Button onClick={() => setShowAddDevice(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Adicionar Tela
            </Button>
          )}
        </div>
      </div>

      {/* KPI Banner — like competitor */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total */}
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Monitor className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total de Telas</p>
            <p className="text-2xl font-black tabular-nums">{totalCount}</p>
            <p className="text-[10px] text-muted-foreground">
              Online: <span className="text-emerald-500 font-bold">{onlineCount}</span> · Offline: <span className="text-destructive font-bold">{offlineCount}</span>
            </p>
          </div>
        </div>
        {/* Online */}
        <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider font-medium">Online</p>
            <p className="text-2xl font-black text-emerald-400 tabular-nums">{onlineCount}</p>
            <p className="text-[10px] text-emerald-400/50">{totalCount > 0 ? Math.round((onlineCount / totalCount) * 100) : 0}% do total</p>
          </div>
          <MiniSparkline values={last8.length ? last8 : [0,0,onlineCount,onlineCount]} color="#10b981" />
        </div>
        {/* Offline */}
        <div className="bg-destructive/8 border border-destructive/20 rounded-xl p-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] text-destructive/70 uppercase tracking-wider font-medium">Offline</p>
            <p className="text-2xl font-black text-destructive tabular-nums">{offlineCount}</p>
            <p className="text-[10px] text-destructive/50">{totalCount > 0 ? Math.round((offlineCount / totalCount) * 100) : 0}% do total</p>
          </div>
          <MiniSparkline values={last8.length ? last8.map(v => Math.max(0, offlineCount - v + 1)) : [offlineCount,offlineCount,0,0]} color="#ef4444" />
        </div>
        {/* Alertas */}
        <div className={cn(
          "border rounded-xl p-4 flex items-center gap-3",
          alertCount > 0 ? "bg-amber-500/8 border-amber-500/20" : "bg-card"
        )}>
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", alertCount > 0 ? "bg-amber-500/15" : "bg-muted")}>
            <AlertTriangle className={cn("w-5 h-5", alertCount > 0 ? "text-amber-400" : "text-muted-foreground")} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Alertas</p>
            <p className={cn("text-2xl font-black tabular-nums", alertCount > 0 ? "text-amber-400" : "text-foreground")}>{alertCount}</p>
            <p className="text-[10px] text-muted-foreground">{alertCount > 0 ? "Requerem atenção" : "Tudo normal"}</p>
          </div>
        </div>
        {/* Exibições hoje */}
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
            <Play className="w-5 h-5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Conteúdo Exibido</p>
            <p className="text-2xl font-black text-violet-400 tabular-nums">
              {(monSummary?.totalPlaysToday ?? 0).toLocaleString("pt-BR")}
            </p>
            <p className="text-[10px] text-muted-foreground">exibições hoje</p>
          </div>
        </div>
      </div>

      <ScreenGroupsPanel screens={screens ?? []} />

      <div className="bg-card rounded-lg border">
        <div className="p-4 border-b flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, código ou local..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {/* Status filter */}
          <div className="flex items-center rounded-md border overflow-hidden text-xs">
            {(["all", "online", "offline"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  "px-3 py-1.5 transition-colors",
                  statusFilter === f
                    ? f === "online"
                      ? "bg-emerald-500/20 text-emerald-500 font-medium"
                      : f === "offline"
                      ? "bg-destructive/20 text-destructive font-medium"
                      : "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/40"
                )}
              >
                {f === "all" ? "Todos" : f === "online" ? "Online" : "Offline"}
              </button>
            ))}
          </div>
          {/* Tag filter */}
          {allTags.length > 0 && (
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="h-8 text-xs bg-white/6 border-white/12 text-white min-w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1f2e] border-white/10 text-white">
                <SelectItem value="all" className="text-xs text-white/80 focus:bg-white/8 focus:text-white">Todas as tags</SelectItem>
                {allTags.map((tag) => (
                  <SelectItem key={tag} value={tag} className="text-xs text-white/80 focus:bg-white/8 focus:text-white">{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Monitor className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="text-lg font-medium">Nenhuma tela cadastrada</h3>
            <p className="text-muted-foreground mt-1 text-sm max-w-xs mx-auto">
              {isAdmin
                ? "Crie uma tela manualmente ou aguarde um operador cadastrar um aparelho."
                : "Clique em \"Adicionar Tela\", informe o Android ID exibido na sua TV Box e dê um nome. Após aprovação, a tela aparece aqui automaticamente."}
            </p>
            {!isAdmin && (
              <Button className="mt-4 gap-2" onClick={() => setShowAddDevice(true)}>
                <Plus className="w-4 h-4" /> Adicionar Tela
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome da Tela</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Código SN</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Aparelho</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Resolução</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Playlist Ativa</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <span className="flex items-center gap-1"><Play className="w-3 h-3 text-emerald-500" />Tocando Agora</span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tags</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Liga / Desliga</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Último Sinal</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {/* ── ONLINE ── */}
                {onlineScreens.length > 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-2 bg-emerald-500/8 border-b border-emerald-500/20">
                      <span className="flex items-center gap-2 text-[11px] font-bold text-emerald-500 uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Online — {onlineScreens.length} {onlineScreens.length === 1 ? "tela" : "telas"}
                      </span>
                    </td>
                  </tr>
                )}
                {onlineScreens.map((screen) => (
                  <ScreenRow
                    key={screen.id}
                    screen={screen}
                    onDelete={handleDelete}
                    deleteIsPending={deleteScreen.isPending}
                    onTagSaved={() => queryClient.invalidateQueries({ queryKey: getListScreensQueryKey() })}
                    isAdmin={isAdmin}
                  />
                ))}

                {/* ── OFFLINE ── */}
                {offlineScreens.length > 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-2 bg-muted/20 border-b border-muted/40">
                      <span className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                        Offline — {offlineScreens.length} {offlineScreens.length === 1 ? "tela" : "telas"}
                      </span>
                    </td>
                  </tr>
                )}
                {offlineScreens.map((screen) => (
                  <ScreenRow
                    key={screen.id}
                    screen={screen}
                    onDelete={handleDelete}
                    deleteIsPending={deleteScreen.isPending}
                    onTagSaved={() => queryClient.invalidateQueries({ queryKey: getListScreensQueryKey() })}
                    isAdmin={isAdmin}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tela</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="screen-name">Nome da tela *</Label>
              <Input
                id="screen-name"
                placeholder="Ex: Loja Centro, Recepção..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="screen-location">Localização (opcional)</Label>
              <Input
                id="screen-location"
                placeholder="Ex: Av. Paulista, 1000"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || createScreen.isPending}>
              {createScreen.isPending ? "Criando..." : "Criar Tela"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adicionar Tela dialog */}
      <Dialog open={showAddDevice} onOpenChange={(o) => { if (!o) resetDevForm(); setShowAddDevice(o); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5" /> Adicionar Tela
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Configure tudo de uma vez — o que não souber agora pode deixar em branco.
            </p>
          </DialogHeader>

          {/* ── Aparelho ── */}
          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aparelho</p>
            <div className="space-y-1">
              <Label>Android ID da TV Box <span className="text-destructive">*</span></Label>
              <Input
                value={devSerial}
                onChange={(e) => setDevSerial(e.target.value.toUpperCase())}
                placeholder="Ex: 748E0291ECB45A73"
                className="font-mono"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Exibido na tela da TV quando o app RPShow inicia.</p>
            </div>
          </div>

          <div className="border-t my-1" />

          {/* ── Identificação ── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identificação</p>
            <div className="space-y-1">
              <Label>Nome da tela <span className="text-destructive">*</span></Label>
              <Input
                value={devName}
                onChange={(e) => setDevName(e.target.value)}
                placeholder="Ex: TV Recepção, LED Sala de Espera"
              />
            </div>
            {/* ── CEP + Endereço ── */}
            <div className="space-y-3">
              <Label>Endereço <span className="text-muted-foreground">(opcional)</span></Label>

              {/* CEP */}
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="CEP (somente números)"
                    value={devCep}
                    maxLength={9}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
                      const fmt = raw.length > 5 ? `${raw.slice(0,5)}-${raw.slice(5)}` : raw;
                      setDevCep(fmt);
                      if (raw.length === 8) lookupCep(raw);
                    }}
                  />
                </div>
                {cepLoading && (
                  <div className="flex items-center px-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {cepError && <p className="text-xs text-destructive">{cepError}</p>}

              {/* Logradouro + Número */}
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  placeholder="Logradouro"
                  value={devLogradouro}
                  onChange={(e) => setDevLogradouro(e.target.value)}
                />
                <Input
                  className="w-24"
                  placeholder="Nº"
                  value={devNumero}
                  onChange={(e) => setDevNumero(e.target.value)}
                />
              </div>

              {/* Complemento */}
              <Input
                placeholder="Complemento (Sala, Apto, etc.) — opcional"
                value={devComplemento}
                onChange={(e) => setDevComplemento(e.target.value)}
              />

              {/* Bairro + Cidade + UF */}
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  placeholder="Bairro"
                  value={devBairro}
                  onChange={(e) => setDevBairro(e.target.value)}
                />
                <Input
                  className="flex-1"
                  placeholder="Cidade"
                  value={devCidade}
                  onChange={(e) => setDevCidade(e.target.value)}
                />
                <Input
                  className="w-16 uppercase"
                  placeholder="UF"
                  maxLength={2}
                  value={devUf}
                  onChange={(e) => setDevUf(e.target.value.toUpperCase())}
                />
              </div>

              {/* Preview do endereço montado */}
              {devLocation && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                  📍 {devLocation}
                </p>
              )}
            </div>
          </div>

          <div className="border-t my-1" />

          {/* ── Display ── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Display</p>
            <div className="space-y-1">
              <Label>Fuso horário</Label>
              <Select value={devTimezone} onValueChange={setDevTimezone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[
                    { value: "America/Sao_Paulo",   label: "Brasília / SP / RJ (BRT −3h)" },
                    { value: "America/Manaus",       label: "Manaus / AM (AMT −4h)" },
                    { value: "America/Belem",        label: "Belém / PA / MA (BRT −3h)" },
                    { value: "America/Fortaleza",    label: "Fortaleza / CE (BRT −3h)" },
                    { value: "America/Recife",       label: "Recife / PE (BRT −3h)" },
                    { value: "America/Cuiaba",       label: "Cuiabá / MT (AMT −4h)" },
                    { value: "America/Porto_Velho",  label: "Porto Velho / RO (AMT −4h)" },
                    { value: "America/Boa_Vista",    label: "Boa Vista / RR (AMT −4h)" },
                    { value: "America/Rio_Branco",   label: "Rio Branco / AC (ACT −5h)" },
                    { value: "America/Noronha",      label: "Fernando de Noronha (FNT −2h)" },
                  ].map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resolução do painel <span className="text-muted-foreground">(opcional)</span></Label>
              <Select
                value={
                  devPanelW && devPanelH
                    ? [`${devPanelW}x${devPanelH}`, "1920x1080", "1080x1920", "576x1152", "1152x576", "768x1536"].includes(`${devPanelW}x${devPanelH}`)
                      ? `${devPanelW}x${devPanelH}`
                      : "custom"
                    : ""
                }
                onValueChange={(v) => {
                  const map: Record<string, [string, string]> = {
                    "1920x1080": ["1920", "1080"],
                    "1080x1920": ["1080", "1920"],
                    "576x1152":  ["576",  "1152"],
                    "1152x576":  ["1152", "576"],
                    "768x1536":  ["768",  "1536"],
                    "custom":    [devPanelW, devPanelH],
                    "":          ["", ""],
                  };
                  const [w, h] = map[v] ?? ["", ""];
                  setDevPanelW(w); setDevPanelH(h);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar formato..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Automático (sem restrição)</SelectItem>
                  <SelectItem value="1920x1080">📺 TV Full HD — 1920×1080</SelectItem>
                  <SelectItem value="1080x1920">📱 TV Vertical — 1080×1920</SelectItem>
                  <SelectItem value="576x1152">🟥 LED P5 Vertical 3×6 — 576×1152</SelectItem>
                  <SelectItem value="1152x576">🟥 LED P5 Horizontal — 1152×576</SelectItem>
                  <SelectItem value="768x1536">🟥 LED P4 Vertical — 768×1536</SelectItem>
                  <SelectItem value="custom">✏️ Personalizado</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Input value={devPanelW} onChange={(e) => setDevPanelW(e.target.value.replace(/\D/g,""))} placeholder="Largura px" className="w-28 text-center" />
                <span className="text-muted-foreground text-sm">×</span>
                <Input value={devPanelH} onChange={(e) => setDevPanelH(e.target.value.replace(/\D/g,""))} placeholder="Altura px" className="w-28 text-center" />
              </div>
              <p className="text-xs text-muted-foreground">Deixe vazio se não souber — pode ajustar depois.</p>
            </div>
          </div>

          <div className="border-t my-1" />

          {/* ── Horário de funcionamento ── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Horário de funcionamento <span className="text-muted-foreground font-normal normal-case">(opcional)</span></p>
            <div className="flex items-center gap-4">
              <div className="space-y-1 flex-1">
                <Label>Ligar às</Label>
                <Input type="time" value={devPowerOn} onChange={(e) => setDevPowerOn(e.target.value)} />
              </div>
              <div className="space-y-1 flex-1">
                <Label>Desligar às</Label>
                <Input type="time" value={devPowerOff} onChange={(e) => setDevPowerOff(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">A TV liga e desliga automaticamente nos horários definidos.</p>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => { setShowAddDevice(false); resetDevForm(); }}>Cancelar</Button>
            <Button
              onClick={() => addDeviceMutation.mutate({
                serial: devSerial, name: devName, location: devLocation,
                timezone: devTimezone, powerOn: devPowerOn, powerOff: devPowerOff,
                panelW: devPanelW, panelH: devPanelH,
              })}
              disabled={!devSerial.trim() || !devName.trim() || addDeviceMutation.isPending}
            >
              {addDeviceMutation.isPending ? "Adicionando…" : "Adicionar Tela"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
