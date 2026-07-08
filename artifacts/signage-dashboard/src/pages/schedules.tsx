import { useState, useMemo } from "react";
import {
  useListSchedules,
  useCreateSchedule,
  useDeleteSchedule,
  useUpdateSchedule,
  useListScreens,
  useListPlaylists,
  getListSchedulesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  CalendarDays, Clock, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight,
  Plus, Monitor, ListVideo, SlidersHorizontal, Play, Radio, LayoutGrid,
  RefreshCw, Tv,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const WEEK_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DAY_LABELS  = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const CELL_H = 52;

const COLORS = [
  { bg: "rgba(59,130,246,0.15)",  border: "#3b82f6", text: "#93c5fd", dot: "bg-blue-400"    },
  { bg: "rgba(16,185,129,0.15)",  border: "#10b981", text: "#6ee7b7", dot: "bg-emerald-400" },
  { bg: "rgba(245,158,11,0.15)",  border: "#f59e0b", text: "#fcd34d", dot: "bg-amber-400"   },
  { bg: "rgba(139,92,246,0.15)",  border: "#8b5cf6", text: "#c4b5fd", dot: "bg-violet-400"  },
  { bg: "rgba(236,72,153,0.15)",  border: "#ec4899", text: "#f9a8d4", dot: "bg-pink-400"    },
  { bg: "rgba(20,184,166,0.15)",  border: "#14b8a6", text: "#5eead4", dot: "bg-teal-400"    },
  { bg: "rgba(249,115,22,0.15)",  border: "#f97316", text: "#fdba74", dot: "bg-orange-400"  },
];

const DONUT_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeMins(t?: string | null): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function timeToHour(t?: string | null): number {
  if (!t) return 0;
  return parseInt(t.split(":")[0], 10);
}
function timeToEndHour(t?: string | null): number {
  if (!t) return 24;
  const [h, m] = t.split(":").map(Number);
  if (h === 0 && m === 0) return 24;
  return Math.ceil((h * 60 + (m || 0)) / 60);
}
function parseDays(s?: string | null): number[] {
  if (!s) return [0, 1, 2, 3, 4, 5, 6];
  return s.split(",").map(Number).filter(n => !isNaN(n));
}

/** Monday-first week: index 0 = Monday, 6 = Sunday */
function getWeekDates(offset = 0): Date[] {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const start = new Date(now);
  start.setDate(now.getDate() - daysFromMonday + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function fmtTime(t: string | null | undefined): string {
  if (!t) return "00:00";
  return t.slice(0, 5);
}

function timeAgo(mins: number): string {
  if (mins < 60) return `em ${mins}min`;
  return `em ${Math.floor(mins / 60)}h${mins % 60 > 0 ? `${mins % 60}min` : ""}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface CalCampaign {
  id: number;
  name: string;
  playlistName: string;
  playlistId: number;
  screenId: number;
  screenName: string;
  startTime: string;
  endTime: string;
  startHour: number;
  endHour: number;
  days: number[];
  colorIdx: number;
  isDefault: boolean;
}

type TabId = "calendar" | "list" | "grid" | "recurrences";

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Schedules() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [showAdd, setShowAdd]         = useState(false);
  const [filterScreenId, setFilterScreenId]     = useState<string>("");
  const [filterPlaylistId, setFilterPlaylistId] = useState<string>("");
  const [tab, setTab]                 = useState<TabId>("calendar");
  const [editMode, setEditMode]       = useState(false);
  const [editForm, setEditForm]       = useState({
    name: "", playlistId: "", startTime: "08:00", endTime: "22:00", days: [] as number[],
  });
  const [form, setForm] = useState({
    name: "", playlistId: "", startTime: "08:00", endTime: "22:00",
    days: [1, 2, 3, 4, 5] as number[],
  });

  const queryClient   = useQueryClient();
  const { toast }     = useToast();
  const { data: schedulesRaw, isLoading } = useListSchedules();
  const { data: screens }    = useListScreens();
  const { data: playlists }  = useListPlaylists();
  const createSchedule = useCreateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const updateSchedule = useUpdateSchedule();

  // ── Derived campaigns ────────────────────────────────────────────────────
  const campaigns = useMemo<CalCampaign[]>(() => {
    const list = schedulesRaw ?? [];
    const filtered = list
      .filter(s => !filterScreenId   || String(s.screenId)   === filterScreenId)
      .filter(s => !filterPlaylistId || String(s.playlistId) === filterPlaylistId);

    return filtered.map((s, idx) => {
      const startHour = timeToHour(s.startTime);
      const endHour   = timeToEndHour(s.endTime);
      const days      = parseDays(s.daysOfWeek);
      const isAllDay  = startHour === 0 && endHour >= 23 && days.length === 7;
      const screenName = (screens ?? []).find(sc => sc.id === s.screenId)?.name ?? "—";
      return {
        id:          s.id,
        name:        s.name ?? "Agendamento",
        playlistName: s.playlistName ?? "—",
        playlistId:  s.playlistId,
        screenId:    s.screenId,
        screenName,
        startTime:   s.startTime ?? "00:00",
        endTime:     s.endTime   ?? "23:59",
        startHour,
        endHour,
        days,
        colorIdx:    idx % COLORS.length,
        isDefault:   isAllDay,
      };
    });
  }, [schedulesRaw, filterScreenId, filterPlaylistId, screens]);

  const defaultCampaign  = campaigns.find(c => c.isDefault);
  const campaignBlocks   = campaigns.filter(c => !c.isDefault);
  const selectedCam      = campaigns.find(c => c.id === selectedId);

  const conflictIds = useMemo(() => {
    const ids = new Set<number>();
    for (let i = 0; i < campaignBlocks.length; i++) {
      for (let j = i + 1; j < campaignBlocks.length; j++) {
        const a = campaignBlocks[i], b = campaignBlocks[j];
        if (!a.days.some(d => b.days.includes(d))) continue;
        if (a.startHour < b.endHour && b.startHour < a.endHour) {
          ids.add(a.id); ids.add(b.id);
        }
      }
    }
    return ids;
  }, [campaignBlocks]);

  // ── KPI stats ────────────────────────────────────────────────────────────
  const now         = new Date();
  const todayDow    = now.getDay();
  const minuteNow   = now.getHours() * 60 + now.getMinutes();

  const todayCampaigns  = campaignBlocks.filter(c => c.days.includes(todayDow));
  const liveCampaigns   = todayCampaigns.filter(c =>
    timeMins(c.startTime) <= minuteNow && timeMins(c.endTime) > minuteNow
  );
  const upcomingToday   = todayCampaigns.filter(c => timeMins(c.startTime) > minuteNow);
  const errorCount      = conflictIds.size;

  function isLive(c: CalCampaign) {
    return c.days.includes(todayDow) &&
      timeMins(c.startTime) <= minuteNow && timeMins(c.endTime) > minuteNow;
  }

  // ── Donut data ────────────────────────────────────────────────────────────
  const totalAll  = schedulesRaw?.length ?? 0;
  const liveN     = liveCampaigns.length;
  const upcomingN = upcomingToday.length;
  const errorN    = errorCount;
  const otherN    = Math.max(0, totalAll - liveN - upcomingN - errorN);
  const donutData = [
    { name: "Concluídos", value: otherN  },
    { name: "Em execução", value: liveN  },
    { name: "Próximos",    value: upcomingN },
    { name: "Com erro",    value: errorN },
  ].filter(d => d.value > 0);

  // ── Bar chart: campaigns per day ──────────────────────────────────────────
  const barData = WEEK_LABELS.map((label, i) => {
    const dow = i === 6 ? 0 : i + 1; // Mon(1)…Sat(6), Sun(0)
    return { label, count: campaignBlocks.filter(c => c.days.includes(dow)).length };
  });

  // ── Date labels ──────────────────────────────────────────────────────────
  const dates      = getWeekDates(weekOffset);
  const startLabel = dates[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const endLabel   = dates[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const yearLabel  = dates[3].getFullYear();
  const monthFull  = dates[3].toLocaleDateString("pt-BR", { month: "long" });

  // ── Handlers ─────────────────────────────────────────────────────────────
  function resetForm() {
    setForm({ name: "", playlistId: "", startTime: "08:00", endTime: "22:00", days: [1,2,3,4,5] });
  }
  function toggleDay(d: number) {
    setForm(p => ({ ...p, days: p.days.includes(d) ? p.days.filter(x => x !== d) : [...p.days, d] }));
  }
  function toggleEditDay(d: number) {
    setEditForm(p => ({ ...p, days: p.days.includes(d) ? p.days.filter(x => x !== d) : [...p.days, d] }));
  }

  function handleCreate() {
    if (!form.name.trim() || !form.playlistId) {
      toast({ title: "Preencha nome e playlist", variant: "destructive" }); return;
    }
    if (form.days.length === 0) {
      toast({ title: "Selecione ao menos um dia", variant: "destructive" }); return;
    }
    const screenId = filterScreenId ? Number(filterScreenId) : screens?.[0]?.id;
    if (!screenId) {
      toast({ title: "Selecione uma tela", variant: "destructive" }); return;
    }
    createSchedule.mutate(
      { data: { name: form.name.trim(), screenId, playlistId: Number(form.playlistId),
          startTime: form.startTime, endTime: form.endTime, daysOfWeek: form.days.join(","), active: true } as any },
      {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() }); setShowAdd(false); resetForm(); toast({ title: "Campanha criada!" }); },
        onError:   () => toast({ title: "Erro ao criar campanha", variant: "destructive" }),
      }
    );
  }

  function handleDelete(id: number) {
    if (!confirm("Excluir esta campanha?")) return;
    deleteSchedule.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() }); if (selectedId === id) { setSelectedId(null); setEditMode(false); } toast({ title: "Campanha excluída" }); },
      onError:   () => toast({ title: "Erro ao excluir", variant: "destructive" }),
    });
  }

  function startEdit(cam: CalCampaign) {
    setEditForm({
      name:       cam.name,
      playlistId: String(cam.playlistId),
      startTime:  cam.startTime,
      endTime:    cam.endTime,
      days:       [...cam.days],
    });
    setEditMode(true);
  }

  function handleUpdate() {
    if (!selectedId || !editForm.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" }); return;
    }
    if (editForm.days.length === 0) {
      toast({ title: "Selecione ao menos um dia", variant: "destructive" }); return;
    }
    updateSchedule.mutate(
      { id: selectedId, data: { name: editForm.name.trim(), playlistId: Number(editForm.playlistId) || undefined,
          startTime: editForm.startTime, endTime: editForm.endTime, daysOfWeek: editForm.days.join(",") } },
      {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() }); setEditMode(false); toast({ title: "Campanha atualizada!" }); },
        onError:   () => toast({ title: "Erro ao atualizar campanha", variant: "destructive" }),
      }
    );
  }

  function getCamsForDateHour(date: Date, hour: number): CalCampaign[] {
    const dow = date.getDay();
    return campaignBlocks.filter(c => c.days.includes(dow) && c.startHour <= hour && c.endHour > hour);
  }

  // ── Próximos agendamentos list ────────────────────────────────────────────
  const upcomingList = useMemo(() => {
    const items: Array<CalCampaign & { status: "live" | "upcoming" | "next"; minsUntil: number }> = [];
    campaignBlocks.forEach(c => {
      const startM = timeMins(c.startTime);
      const endM   = timeMins(c.endTime);
      if (c.days.includes(todayDow)) {
        if (startM <= minuteNow && endM > minuteNow) {
          items.push({ ...c, status: "live", minsUntil: 0 });
        } else if (startM > minuteNow) {
          items.push({ ...c, status: "upcoming", minsUntil: startM - minuteNow });
        }
      } else {
        items.push({ ...c, status: "next", minsUntil: 9999 });
      }
    });
    return items.sort((a, b) => a.minsUntil - b.minsUntil).slice(0, 6);
  }, [campaignBlocks, todayDow, minuteNow]);

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agendamentos</h1>
          <p className="text-muted-foreground mt-1 text-sm">Planeje e gerencie a exibição de conteúdos nas suas telas.</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Novo Agendamento
        </Button>
      </div>

      {/* ── KPI bar ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Hoje */}
        <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] text-blue-400/60 uppercase tracking-wider font-medium">Agendamentos Hoje</p>
            <p className="text-2xl font-black text-blue-300 tabular-nums">{todayCampaigns.length}</p>
            <p className="text-[10px] text-blue-400/50">{liveCampaigns.length} em execução</p>
          </div>
        </div>
        {/* Próximos */}
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] text-amber-400/60 uppercase tracking-wider font-medium">Próximos Agendamentos</p>
            <p className="text-2xl font-black text-amber-300 tabular-nums">{upcomingToday.length}</p>
            <p className="text-[10px] text-amber-400/50">Próximas 24h</p>
          </div>
        </div>
        {/* Total */}
        <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider font-medium">Total de Campanhas</p>
            <p className="text-2xl font-black text-emerald-300 tabular-nums">{totalAll}</p>
            <p className="text-[10px] text-emerald-400/50">{campaignBlocks.length} ativas</p>
          </div>
        </div>
        {/* Erros */}
        <div className={cn(
          "border rounded-xl p-4 flex items-center gap-4",
          errorCount > 0 ? "bg-destructive/8 border-destructive/20" : "bg-card"
        )}>
          <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", errorCount > 0 ? "bg-destructive/15" : "bg-muted")}>
            <AlertTriangle className={cn("w-5 h-5", errorCount > 0 ? "text-destructive" : "text-muted-foreground")} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Agendamentos com Erro</p>
            <p className={cn("text-2xl font-black tabular-nums", errorCount > 0 ? "text-destructive" : "text-foreground")}>{errorCount}</p>
            <p className="text-[10px] text-muted-foreground">{errorCount > 0 ? "Requerem atenção" : "Tudo certo"}</p>
          </div>
        </div>
      </div>

      {/* ── Tabs + Calendar Card ──────────────────────────────────────── */}
      <Card className="overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center gap-0 border-b px-4 pt-3 bg-muted/30">
          {([
            { id: "calendar",    label: "Calendário",  icon: CalendarDays },
            { id: "list",        label: "Lista",        icon: ListVideo    },
            { id: "grid",        label: "Grade",        icon: LayoutGrid   },
            { id: "recurrences", label: "Recorrências", icon: RefreshCw    },
          ] as { id: TabId; label: string; icon: React.ElementType }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* Calendar toolbar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b flex-wrap">
          {/* Left: nav */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-muted/40 text-sm font-semibold min-w-[190px] justify-center">
              <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="capitalize">{startLabel} - {endLabel} de {monthFull}, {yearLabel}</span>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setWeekOffset(0)}>Hoje</Button>
          </div>

          {/* Right: filters */}
          <div className="flex items-center gap-2">
            <Select value={filterScreenId} onValueChange={v => { setFilterScreenId(v === "__all" ? "" : v); setSelectedId(null); }}>
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="Todas as telas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas as telas</SelectItem>
                {screens?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPlaylistId} onValueChange={v => setFilterPlaylistId(v === "__all" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="Todas as playlists" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas as playlists</SelectItem>
                {playlists?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros
            </Button>
          </div>
        </div>

        {/* ── Calendar / List / etc ─────────────────────────────────── */}
        {tab === "calendar" && (
          <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 460px)", minHeight: 400 }}>
            {/* Conflict banner */}
            {conflictIds.size > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span><strong>{conflictIds.size} conflito{conflictIds.size > 1 ? "s" : ""} de horário</strong> — campanhas sobrepostas podem não exibir corretamente.</span>
              </div>
            )}

            {/* Day headers */}
            <div className="flex sticky top-0 z-20 bg-background border-b">
              {/* Hour col */}
              <div className="w-14 shrink-0 border-r" />
              {dates.map((d, i) => {
                const isToday = d.toDateString() === new Date().toDateString();
                const dayNum  = d.getDate();
                const mon     = d.toLocaleDateString("pt-BR", { month: "2-digit" });
                return (
                  <div key={i} className={cn("flex-1 text-center py-2.5 border-l", isToday && "bg-primary/5")}>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{WEEK_LABELS[i]}</div>
                    <div className={cn(
                      "text-sm font-bold mt-0.5 w-8 h-8 mx-auto rounded-full flex items-center justify-center",
                      isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                    )}>{dayNum}</div>
                    <div className="text-[9px] text-muted-foreground/50">{mon}</div>
                  </div>
                );
              })}
            </div>

            {/* "Dia inteiro" row */}
            <div className="flex border-b bg-muted/20">
              <div className="w-14 shrink-0 flex items-center justify-center border-r">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>Dia inteiro</span>
              </div>
              {dates.map((_, i) => (
                <div key={i} className="flex-1 border-l py-1.5 px-1 min-h-[28px] flex items-center justify-center">
                  {defaultCampaign && (
                    <span className="text-[10px] text-muted-foreground/60 truncate max-w-full font-medium">{defaultCampaign.playlistName}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Hour rows */}
            {isLoading ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Carregando agenda…
              </div>
            ) : (
              HOURS.map(hour => (
                <div key={hour} className="flex" style={{ height: CELL_H }}>
                  <div className="w-14 shrink-0 text-[10px] text-muted-foreground/50 flex items-start justify-center pt-1 border-r">
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  {dates.map((date, colIdx) => {
                    const cams = getCamsForDateHour(date, hour);
                    const isToday = date.toDateString() === new Date().toDateString();
                    return (
                      <div
                        key={colIdx}
                        className={cn("flex-1 border-l border-t border-border/50 relative", isToday && "bg-primary/2")}
                        style={{ height: CELL_H }}
                      >
                        {cams.map(cam => {
                          if (cam.startHour !== hour) return null;
                          const c       = COLORS[cam.colorIdx % COLORS.length];
                          const spanH   = (cam.endHour - cam.startHour) * CELL_H;
                          if (spanH <= 0) return null;
                          const hasConflict = conflictIds.has(cam.id);
                          const live    = isLive(cam) && isToday;
                          return (
                            <div
                              key={cam.id}
                              onClick={() => setSelectedId(selectedId === cam.id ? null : cam.id)}
                              className={cn(
                                "absolute inset-x-0.5 rounded-lg border-l-[3px] cursor-pointer transition-all overflow-hidden",
                                selectedId === cam.id ? "ring-1 ring-primary/60 ring-offset-1" : "hover:brightness-110"
                              )}
                              style={{
                                top: 1,
                                height: spanH - 2,
                                zIndex: 10,
                                background: hasConflict ? "rgba(239,68,68,0.15)" : c.bg,
                                borderColor: hasConflict ? "#ef4444" : c.border,
                                borderTopWidth: 1,
                                borderRightWidth: 1,
                                borderBottomWidth: 1,
                              }}
                            >
                              <div className="px-2 pt-1 pb-1 h-full overflow-hidden">
                                {/* Time */}
                                <div className="text-[9px] opacity-60 font-mono" style={{ color: hasConflict ? "#fca5a5" : c.text }}>
                                  {fmtTime(cam.startTime)} - {fmtTime(cam.endTime)}
                                </div>
                                {/* Name */}
                                <div className="flex items-center gap-1 mt-0.5">
                                  {hasConflict && <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-red-400" />}
                                  <div className="text-[10px] font-bold truncate" style={{ color: hasConflict ? "#fca5a5" : c.text }}>
                                    {cam.name}
                                  </div>
                                  {live && (
                                    <span className="ml-auto flex items-center gap-0.5 text-[8px] font-black text-red-400 bg-red-500/15 border border-red-500/30 px-1 py-0.5 rounded shrink-0">
                                      <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" /> AO VIVO
                                    </span>
                                  )}
                                </div>
                                {/* Playlist + Screen */}
                                {spanH > CELL_H && (
                                  <>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <ListVideo className="w-2.5 h-2.5 shrink-0 opacity-50" style={{ color: c.text }} />
                                      <span className="text-[9px] opacity-60 truncate" style={{ color: c.text }}>{cam.playlistName}</span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Tv className="w-2.5 h-2.5 shrink-0 opacity-50" style={{ color: c.text }} />
                                      <span className="text-[9px] opacity-60 truncate" style={{ color: c.text }}>{cam.screenName}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "list" && (
          <div className="overflow-auto">
            {campaignBlocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <CalendarDays className="w-10 h-10 opacity-20" />
                <p className="text-sm">Nenhuma campanha encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campanha</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Playlist</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tela</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Horário</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dias</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {campaignBlocks.map(cam => {
                    const c    = COLORS[cam.colorIdx % COLORS.length];
                    const live = isLive(cam);
                    return (
                      <tr key={cam.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                            <span className="font-medium">{cam.name}</span>
                            {conflictIds.has(cam.id) && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{cam.playlistName}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{cam.screenName}</td>
                        <td className="px-4 py-3 text-xs font-mono">{fmtTime(cam.startTime)} – {fmtTime(cam.endTime)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-0.5">
                            {DAY_LABELS.map((d, i) => (
                              <span key={i} className={cn("text-[9px] font-bold px-1 py-0.5 rounded", cam.days.includes(i) ? "bg-primary/20 text-primary" : "text-muted-foreground/30")}>{d[0]}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {live ? (
                            <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] gap-1">
                              <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" /> AO VIVO
                            </Badge>
                          ) : cam.days.includes(todayDow) ? (
                            <Badge variant="outline" className="text-[10px]">Hoje</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">Programado</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleDelete(cam.id)} className="text-muted-foreground/40 hover:text-destructive transition-colors text-xs">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {(tab === "grid" || tab === "recurrences") && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <LayoutGrid className="w-12 h-12 opacity-20" />
            <p className="text-sm font-medium">Em desenvolvimento</p>
            <p className="text-xs opacity-60">Esta visualização estará disponível em breve</p>
          </div>
        )}
      </Card>

      {/* ── Bottom panels ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Próximos Agendamentos */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> Próximos Agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-xs">Nenhum agendamento para hoje</p>
              </div>
            ) : (
              <div className="divide-y">
                {upcomingList.map(item => {
                  const c = COLORS[item.colorIdx % COLORS.length];
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-1 h-10 rounded-full shrink-0" style={{ background: c.border }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                          <ListVideo className="w-2.5 h-2.5" /> {item.playlistName}
                          <span className="mx-0.5">·</span>
                          <Tv className="w-2.5 h-2.5" /> {item.screenName}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {fmtTime(item.startTime)} – {fmtTime(item.endTime)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {item.status === "live" && (
                          <span className="flex items-center gap-1 text-[9px] font-black text-red-400 bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 rounded-full">
                            <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" /> EM EXEC.
                          </span>
                        )}
                        {item.status === "upcoming" && (
                          <span className="text-[9px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full block">
                            {timeAgo(item.minsUntil)}
                          </span>
                        )}
                        {item.status === "next" && (
                          <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full block">A seguir</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <Play className="w-4 h-4 text-violet-400" /> Estatísticas de Agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {totalAll === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <Radio className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-xs">Nenhum dado ainda</p>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="relative">
                  <ResponsiveContainer width={110} height={110}>
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={32} outerRadius={50} paddingAngle={2} dataKey="value">
                        {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-black tabular-nums">{totalAll}</span>
                    <span className="text-[9px] text-muted-foreground">total</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  {[
                    { label: "Concluídos", value: otherN,    pct: totalAll ? Math.round((otherN    / totalAll) * 100) : 0, color: DONUT_COLORS[0] },
                    { label: "Em execução", value: liveN,    pct: totalAll ? Math.round((liveN     / totalAll) * 100) : 0, color: DONUT_COLORS[1] },
                    { label: "Próximos",    value: upcomingN, pct: totalAll ? Math.round((upcomingN / totalAll) * 100) : 0, color: DONUT_COLORS[2] },
                    { label: "Com erro",    value: errorN,    pct: totalAll ? Math.round((errorN    / totalAll) * 100) : 0, color: DONUT_COLORS[3] },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
                      <span className="text-muted-foreground flex-1">{row.label}</span>
                      <span className="font-bold tabular-nums">{row.value}</span>
                      <span className="text-muted-foreground/50 w-9 text-right">({row.pct}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agendamentos por Período */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-400" /> Agendamentos por Período
              </span>
              <span className="text-xs font-normal text-muted-foreground">7 dias</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {totalAll === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <CalendarDays className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-xs">Nenhum dado ainda</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={barData} barCategoryGap="30%">
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number) => [`${v} campanha${v !== 1 ? "s" : ""}`, ""]}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <span className="text-[10px] text-muted-foreground">Campanhas cadastradas por dia da semana</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Side panel (selected campaign) ───────────────────────────── */}
      {selectedCam && (
        <div className="fixed right-4 top-20 z-40 w-72 shadow-2xl">
          <Card>
            <CardHeader className="pb-2 border-b flex-row items-center justify-between">
              <CardTitle className="text-sm">{editMode ? "Editar Campanha" : "Campanha"}</CardTitle>
              <button onClick={() => { setSelectedId(null); setEditMode(false); }} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
            </CardHeader>
            <CardContent className="pt-3 pb-4 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
              {editMode ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Nome</label>
                    <input autoFocus value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Playlist</label>
                    <Select value={editForm.playlistId} onValueChange={v => setEditForm(p => ({ ...p, playlistId: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="— manter atual —" /></SelectTrigger>
                      <SelectContent>
                        {playlists?.map(pl => <SelectItem key={pl.id} value={String(pl.id)} className="text-xs">{pl.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["startTime", "endTime"] as const).map(field => (
                      <div key={field} className="space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{field === "startTime" ? "Início" : "Fim"}</label>
                        <input type="time" value={editForm[field]} onChange={e => setEditForm(p => ({ ...p, [field]: e.target.value }))}
                          className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Dias</label>
                    <div className="flex gap-1">
                      {DAY_LABELS.map((d, i) => (
                        <button key={i} type="button" onClick={() => toggleEditDay(i)}
                          className={cn("flex-1 py-1 text-[9px] font-bold rounded border transition-all", editForm.days.includes(i) ? "bg-primary border-primary text-primary-foreground" : "bg-muted border-border text-muted-foreground hover:bg-muted/80")}>
                          {d[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="flex-1 text-xs" onClick={handleUpdate} disabled={updateSchedule.isPending}>
                      {updateSchedule.isPending ? "Salvando…" : "Salvar"}
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditMode(false)}>Cancelar</Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: COLORS[selectedCam.colorIdx % COLORS.length].bg, color: COLORS[selectedCam.colorIdx % COLORS.length].text }}>
                      <span className={`w-1.5 h-1.5 rounded-full ${COLORS[selectedCam.colorIdx % COLORS.length].dot}`} />
                      {selectedCam.name}
                    </div>
                  </div>
                  {[
                    { label: "Playlist", value: selectedCam.playlistName },
                    { label: "Tela",     value: selectedCam.screenName   },
                    { label: "Horário",  value: `${fmtTime(selectedCam.startTime)} → ${fmtTime(selectedCam.endTime)}` },
                  ].map(r => (
                    <div key={r.label} className="space-y-0.5">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{r.label}</div>
                      <div className="text-sm text-foreground">{r.value}</div>
                    </div>
                  ))}
                  <div className="space-y-0.5">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Dias</div>
                    <div className="flex flex-wrap gap-1">
                      {DAY_LABELS.map((d, i) => (
                        <span key={i} className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", selectedCam.days.includes(i) ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground/30")}>{d}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => startEdit(selectedCam)}>✏️ Editar</Button>
                    <Button size="sm" variant="outline" className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleDelete(selectedCam.id)}>Excluir</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Nova Campanha Dialog ──────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={open => { if (!open) { setShowAdd(false); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> Nova Campanha
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Nome da campanha *</label>
              <input autoFocus value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Promoção Café, Ofertas Fim de Semana…"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Tela *</label>
              <Select value={filterScreenId || (screens?.[0]?.id ? String(screens[0].id) : "")} onValueChange={v => setFilterScreenId(v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar tela…" /></SelectTrigger>
                <SelectContent>
                  {screens?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Playlist *</label>
              <Select value={form.playlistId} onValueChange={v => setForm(p => ({ ...p, playlistId: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar playlist…" /></SelectTrigger>
                <SelectContent>
                  {playlists?.map(pl => <SelectItem key={pl.id} value={String(pl.id)}>{pl.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(["startTime", "endTime"] as const).map(field => (
                <div key={field} className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{field === "startTime" ? "Início" : "Fim"}</label>
                  <input type="time" value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors" />
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Repetir nos dias</label>
              <div className="flex gap-1.5">
                {DAY_LABELS.map((d, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={cn("flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all", form.days.includes(i) ? "bg-primary border-primary text-primary-foreground" : "bg-muted border-border text-muted-foreground hover:bg-muted/80")}>
                    {d[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createSchedule.isPending} className="gap-2">
              <CalendarDays className="w-3.5 h-3.5" />
              {createSchedule.isPending ? "Salvando…" : "Salvar Campanha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
