import { useState, useMemo, useRef, useCallback, useEffect } from "react";
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
  RefreshCw, Tv, Check,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";

// ─── Constants ────────────────────────────────────────────────────────────────
const WEEK_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DAY_LABELS  = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const CELL_H = 52;

const COLORS = [
  { bg: "#1e3a8a", border: "#60a5fa", text: "#bfdbfe", dot: "bg-blue-400"    },
  { bg: "#064e3b", border: "#34d399", text: "#a7f3d0", dot: "bg-emerald-400" },
  { bg: "#713f12", border: "#fbbf24", text: "#fde68a", dot: "bg-amber-400"   },
  { bg: "#3b0764", border: "#a78bfa", text: "#ddd6fe", dot: "bg-violet-400"  },
  { bg: "#500724", border: "#f472b6", text: "#fbcfe8", dot: "bg-pink-400"    },
  { bg: "#042f2e", border: "#2dd4bf", text: "#99f6e4", dot: "bg-teal-400"    },
  { bg: "#431407", border: "#fb923c", text: "#fed7aa", dot: "bg-orange-400"  },
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

// ─── Visual Scheduler constants & helpers ─────────────────────────────────────
const VIS_START_H = 6, VIS_END_H = 23, VIS_TOTAL_MINS = (VIS_END_H - VIS_START_H) * 60;
const VIS_LANE_H = 52, VIS_RULER_H = 38, VIS_LABEL_W = 180;

const VIS_COLORS = [
  { bg: "rgba(20,184,166,0.88)",  border: "#14b8a6" },
  { bg: "rgba(139,92,246,0.88)",  border: "#8b5cf6" },
  { bg: "rgba(245,158,11,0.88)",  border: "#f59e0b" },
  { bg: "rgba(59,130,246,0.88)",  border: "#3b82f6" },
  { bg: "rgba(244,63,94,0.88)",   border: "#f43f5e" },
  { bg: "rgba(16,185,129,0.88)",  border: "#10b981" },
  { bg: "rgba(249,115,22,0.88)",  border: "#f97316" },
];

function isoAddDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function isoMonday(date: Date): string {
  const dow = date.getDay() || 7;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dow + 1);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function isoDatesInRange(from: string, to: string, max = 31): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to && out.length < max) { out.push(cur); cur = isoAddDays(cur, 1); }
  return out;
}
function fmtISODate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}
function fmtISOWeekday(iso: string, short = false): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("pt-BR", { weekday: short ? "short" : "long", timeZone: "UTC" });
}
function visMins(t: string | null | undefined): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
function visStr(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface CalCampaign {
  id: number;
  name: string;
  clientName: string | null;
  playlistName: string;
  playlistId: number;
  screenId: number;
  screenName: string;
  campaignGroupId: string | null;
  startTime: string;
  endTime: string;
  startHour: number;
  endHour: number;
  days: number[];
  colorIdx: number;
  isDefault: boolean;
  startAt: string | null;
  endAt: string | null;
}

/** Returns true if the given date falls within the campaign's date range (inclusive). */
function isInDateRange(date: Date, startAt: string | null, endAt: string | null): boolean {
  if (!startAt && !endAt) return true;
  const d = date.toISOString().slice(0, 10);
  if (startAt && d < startAt.slice(0, 10)) return false;
  if (endAt   && d > endAt.slice(0, 10))   return false;
  return true;
}

type TabId = "calendar" | "list" | "grid" | "recurrences" | "visual";

// ─── ConflictBanner ───────────────────────────────────────────────────────────
function ConflictBanner({
  conflictIds,
  campaignBlocks,
  onCleanup,
}: {
  conflictIds: Set<number>;
  campaignBlocks: CalCampaign[];
  onCleanup: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const conflicting = campaignBlocks.filter(c => conflictIds.has(c.id));

  // Group by screenName to show them together
  const byScreen = new Map<string, CalCampaign[]>();
  for (const c of conflicting) {
    const list = byScreen.get(c.screenName) ?? [];
    list.push(c);
    byScreen.set(c.screenName, list);
  }

  async function handleCleanup() {
    setCleaning(true);
    await onCleanup();
    setCleaning(false);
  }

  return (
    <div className="border-b border-amber-500/20 bg-amber-500/8">
      <div className="flex items-center gap-2 px-4 py-2 text-amber-400 text-xs">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>
          <strong>{conflictIds.size} conflito{conflictIds.size > 1 ? "s" : ""} de horário</strong>
          {" "}— campanhas sobrepostas podem não exibir corretamente.
        </span>
        <button
          className="ml-1 underline underline-offset-2 hover:text-amber-300 transition-colors"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? "Ocultar" : "Ver detalhes"}
        </button>
        <button
          disabled={cleaning}
          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 transition-colors disabled:opacity-50"
          onClick={handleCleanup}
        >
          {cleaning ? "Limpando…" : "✦ Limpar duplicatas"}
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {Array.from(byScreen.entries()).map(([screen, cams]) => (
            <div key={screen}>
              <div className="text-[10px] font-semibold text-amber-400/70 uppercase tracking-wider mb-1">📺 {screen}</div>
              <div className="space-y-0.5 pl-3">
                {cams.map(c => (
                  <div key={c.id} className="text-[11px] text-amber-300/80 flex items-center gap-2">
                    <span className="font-mono">{fmtTime(c.startTime)}–{fmtTime(c.endTime)}</span>
                    <span className="text-amber-400/50">·</span>
                    <span>{c.clientName ? `${c.clientName} / ` : ""}{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
    selectedScreenIds: [] as number[],
    repeatType: "semanal" as "semanal" | "diario" | "unico",
    singleDate: new Date().toISOString().slice(0, 10),
  });
  const [editGroupCams, setEditGroupCams] = useState<CalCampaign[]>([]);
  const [form, setForm] = useState({
    name: "", clientName: "", playlistId: "", startTime: "08:00", endTime: "22:00",
    days: [1, 2, 3, 4, 5] as number[], selectedScreenIds: [] as number[],
    repeatType: "semanal" as "semanal" | "diario" | "unico",
    singleDate: new Date().toISOString().slice(0, 10),
  });

  // ── Visual scheduler state ────────────────────────────────────────────────
  const [vMode, setVMode]           = useState<"dia"|"semana"|"mes"|"periodo">("semana");
  const [vWeekStart, setVWeekStart] = useState(() => isoMonday(new Date()));
  const [vDayISO, setVDayISO]       = useState(() => new Date().toISOString().slice(0, 10));
  const [vMonthISO, setVMonthISO]   = useState(() => new Date().toISOString().slice(0, 7));
  const [vPeriodFrom, setVPeriodFrom] = useState(() => isoMonday(new Date()));
  const [vPeriodTo,   setVPeriodTo]   = useState(() => isoAddDays(isoMonday(new Date()), 13));
  const [vDragging,   setVDragging]   = useState<number | null>(null);
  const [vDragPreview, setVDragPreview] = useState<{ startMin: number; endMin: number; screenId: number; date: string } | null>(null);
  const vGridRef        = useRef<HTMLDivElement>(null);
  const vDragOffsetMin  = useRef(0);
  const vDragDuration   = useRef(0);
  // Refs for reliable drag state (avoid stale-closure / async-effect gap)
  const vDraggingRef    = useRef<number | null>(null);
  const vDragPreviewRef = useRef<{ startMin: number; endMin: number; screenId: number; date: string } | null>(null);
  const vJustDraggedRef = useRef(false); // prevents cell onClick from firing after drag ends

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
        id:              s.id,
        name:            s.name ?? "Agendamento",
        clientName:      (s as any).clientName ?? null,
        playlistName:    s.playlistName ?? "—",
        playlistId:      s.playlistId,
        screenId:        s.screenId,
        screenName,
        campaignGroupId: (s as any).campaignGroupId ?? null,
        startTime:       s.startTime ?? "00:00",
        endTime:         s.endTime   ?? "23:59",
        startHour,
        endHour,
        days,
        colorIdx:        s.id % COLORS.length,
        isDefault:       isAllDay,
        startAt:         (s as any).startAt ?? null,
        endAt:           (s as any).endAt   ?? null,
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
        // Different screens OR missing screenId → never a conflict
        if (a.screenId == null || b.screenId == null || a.screenId !== b.screenId) continue;
        // Same campaign group = same logical campaign across screens, never a conflict
        if (a.campaignGroupId && b.campaignGroupId && a.campaignGroupId === b.campaignGroupId) continue;
        // Date ranges must overlap for a conflict to exist
        const aS = a.startAt?.slice(0, 10) ?? "0000-01-01";
        const aE = a.endAt?.slice(0, 10)   ?? "9999-12-31";
        const bS = b.startAt?.slice(0, 10) ?? "0000-01-01";
        const bE = b.endAt?.slice(0, 10)   ?? "9999-12-31";
        if (aS > bE || bS > aE) continue;
        if (!a.days.some(d => b.days.includes(d))) continue;
        // Use minutes for precise overlap — integer hours cause false positives for sub-hour schedules
        const aStart = timeMins(a.startTime), aEnd = timeMins(a.endTime) || 24 * 60;
        const bStart = timeMins(b.startTime), bEnd = timeMins(b.endTime) || 24 * 60;
        if (aStart < bEnd && bStart < aEnd) {
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

  const todayCampaigns  = campaignBlocks.filter(c =>
    c.days.includes(todayDow) && isInDateRange(now, c.startAt, c.endAt)
  );
  const liveCampaigns   = todayCampaigns.filter(c =>
    timeMins(c.startTime) <= minuteNow && timeMins(c.endTime) > minuteNow
  );
  const upcomingToday   = todayCampaigns.filter(c => timeMins(c.startTime) > minuteNow);
  const errorCount      = conflictIds.size;

  function isLive(c: CalCampaign) {
    return c.days.includes(todayDow) &&
      isInDateRange(now, c.startAt, c.endAt) &&
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
    setForm({ name: "", clientName: "", playlistId: "", startTime: "08:00", endTime: "22:00", days: [1,2,3,4,5], selectedScreenIds: [], repeatType: "semanal", singleDate: new Date().toISOString().slice(0, 10) });
  }
  function toggleDay(d: number) {
    setForm(p => ({ ...p, days: p.days.includes(d) ? p.days.filter(x => x !== d) : [...p.days, d] }));
  }
  function toggleScreenInForm(id: number) {
    setForm(p => ({
      ...p,
      selectedScreenIds: p.selectedScreenIds.includes(id)
        ? p.selectedScreenIds.filter(x => x !== id)
        : [...p.selectedScreenIds, id],
    }));
  }
  function toggleEditDay(d: number) {
    setEditForm(p => ({ ...p, days: p.days.includes(d) ? p.days.filter(x => x !== d) : [...p.days, d] }));
  }
  function toggleEditScreen(id: number) {
    setEditForm(p => ({
      ...p,
      selectedScreenIds: p.selectedScreenIds.includes(id)
        ? p.selectedScreenIds.filter(x => x !== id)
        : [...p.selectedScreenIds, id],
    }));
  }

  function handleCreate() {
    if (!form.name.trim() || !form.playlistId) {
      toast({ title: "Preencha nome e playlist", variant: "destructive" }); return;
    }
    if (form.repeatType === "semanal" && form.days.length === 0) {
      toast({ title: "Selecione ao menos um dia", variant: "destructive" }); return;
    }
    const targetIds = form.selectedScreenIds.length > 0
      ? form.selectedScreenIds
      : filterScreenId ? [Number(filterScreenId)] : screens?.[0]?.id ? [screens[0].id] : [];
    if (targetIds.length === 0) {
      toast({ title: "Selecione ao menos uma tela", variant: "destructive" }); return;
    }
    const daysForCreate = form.repeatType === "semanal" ? form.days : [0,1,2,3,4,5,6];
    const startAtVal    = form.repeatType === "unico" ? form.singleDate : undefined;
    const endAtVal      = form.repeatType === "unico" ? form.singleDate : undefined;
    createSchedule.mutate(
      { data: { name: form.name.trim(), clientName: form.clientName.trim() || undefined,
          screenIds: targetIds, playlistId: Number(form.playlistId),
          startTime: form.startTime, endTime: form.endTime, daysOfWeek: daysForCreate.join(","),
          startAt: startAtVal, endAt: endAtVal, active: true } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          setShowAdd(false); resetForm();
          toast({ title: `Campanha criada em ${targetIds.length} tela${targetIds.length > 1 ? "s" : ""}!` });
        },
        onError: () => toast({ title: "Erro ao criar campanha", variant: "destructive" }),
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
    // Collect all rows belonging to the same campaign group
    const groupCams = cam.campaignGroupId
      ? campaignBlocks.filter(c => c.campaignGroupId === cam.campaignGroupId)
      : [cam];
    setEditGroupCams(groupCams);
    // Detect repeat type
    const isSingleDate = !!cam.startAt && !!cam.endAt && cam.startAt.slice(0, 10) === cam.endAt.slice(0, 10);
    const isAllDays    = !isSingleDate && (cam.days.length === 7 || cam.days.length === 0);
    const repeatType   = isSingleDate ? "unico" : isAllDays ? "diario" : "semanal";
    setEditForm({
      name:              cam.name,
      playlistId:        String(cam.playlistId),
      startTime:         cam.startTime,
      endTime:           cam.endTime,
      days:              isAllDays ? [0,1,2,3,4,5,6] : [...cam.days],
      selectedScreenIds: groupCams.map(c => c.screenId),
      repeatType,
      singleDate:        cam.startAt ? cam.startAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setEditMode(true);
  }

  async function handleUpdate() {
    if (!editForm.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" }); return;
    }
    if (editForm.repeatType === "semanal" && editForm.days.length === 0) {
      toast({ title: "Selecione ao menos um dia", variant: "destructive" }); return;
    }
    if (editForm.selectedScreenIds.length === 0) {
      toast({ title: "Selecione ao menos uma tela", variant: "destructive" }); return;
    }

    const daysToSave = editForm.repeatType === "diario" || editForm.repeatType === "unico"
      ? [0,1,2,3,4,5,6] : editForm.days;
    const startAtVal = editForm.repeatType === "unico" ? editForm.singleDate : undefined;
    const endAtVal   = editForm.repeatType === "unico" ? editForm.singleDate : undefined;
    const updateData = {
      name:       editForm.name.trim(),
      playlistId: Number(editForm.playlistId) || undefined,
      startTime:  editForm.startTime,
      endTime:    editForm.endTime,
      daysOfWeek: daysToSave.join(","),
      ...(editForm.repeatType === "unico" ? { startAt: startAtVal, endAt: endAtVal } : {}),
    } as any;

    const existingScreenIds = editGroupCams.map(c => c.screenId);
    const nextScreenIds     = editForm.selectedScreenIds;
    const toRemove          = editGroupCams.filter(c => !nextScreenIds.includes(c.screenId));
    const toUpdate          = editGroupCams.filter(c => nextScreenIds.includes(c.screenId));
    const toAdd             = nextScreenIds.filter(id => !existingScreenIds.includes(id));

    // Derive a stable groupId — if the resulting set has >1 screen, ensure there's a groupId
    const existingGroupId = editGroupCams[0]?.campaignGroupId ?? null;
    const needsGroupId    = nextScreenIds.length > 1;
    const groupId         = existingGroupId ?? (needsGroupId ? crypto.randomUUID() : null);

    try {
      // Update existing rows (apply new settings + ensure groupId is set)
      await Promise.all(toUpdate.map(c =>
        updateSchedule.mutateAsync({ id: c.id, data: { ...updateData, campaignGroupId: groupId } as any })
      ));
      // Delete rows for removed screens
      await Promise.all(toRemove.map(c =>
        deleteSchedule.mutateAsync({ id: c.id } as any)
      ));
      // Create rows for newly-added screens (reuse same groupId to keep campaign together)
      if (toAdd.length > 0) {
        await fetch("/api/schedules", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            screenIds: toAdd,
            playlistId: Number(editForm.playlistId),
            name: editForm.name.trim(),
            startTime: editForm.startTime,
            endTime: editForm.endTime,
            daysOfWeek: daysToSave.join(","),
            campaignGroupId: groupId,
            ...(editForm.repeatType === "unico" ? { startAt: startAtVal, endAt: endAtVal } : {}),
          }),
        });
      }
      queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
      setEditMode(false);
      setSelectedId(null);
      toast({ title: "Campanha atualizada!" });
    } catch {
      toast({ title: "Erro ao atualizar campanha", variant: "destructive" });
    }
  }

  // ── Visual drag-drop: closure-based (no useEffect gap) ───────────────────
  // Listeners are attached directly in onMouseDown so the very first mousemove
  // event is already captured — no async render/effect cycle in between.
  const startVDrag = useCallback((
    e: React.MouseEvent,
    campaignId: number,
    campaignScreenId: number,
    startTime: string,
    endTime: string,
    date: string,
    vDates: string[],
    vModeLocal: string,
  ) => {
    if (vDraggingRef.current !== null) return;
    e.preventDefault();
    const grid = vGridRef.current;
    if (!grid) return;

    const rect   = grid.getBoundingClientRect();
    const numCols = vModeLocal === "dia" ? 1 : vDates.length;
    const gw     = rect.width - VIS_LABEL_W;
    const colW   = gw / numCols;
    const colIdx = vDates.indexOf(date);
    const sl     = grid.scrollLeft;
    const relX   = e.clientX - rect.left - VIS_LABEL_W + sl - colIdx * colW;
    const clickM = Math.round(((relX / colW) * VIS_TOTAL_MINS) / 5) * 5 + VIS_START_H * 60;
    vDragOffsetMin.current = clickM - visMins(startTime);
    vDragDuration.current  = (visMins(endTime) || VIS_END_H * 60) - visMins(startTime);

    const initialPreview = { startMin: visMins(startTime), endMin: visMins(endTime) || VIS_END_H * 60, screenId: campaignScreenId, date };
    vDraggingRef.current    = campaignId;
    vDragPreviewRef.current = initialPreview;
    setVDragging(campaignId);
    setVDragPreview(initialPreview);

    const onMove = (me: MouseEvent) => {
      const g = vGridRef.current;
      if (!g) return;
      const r   = g.getBoundingClientRect();
      const nc  = vModeLocal === "dia" ? 1 : vDates.length;
      const cw  = (r.width - VIS_LABEL_W) / nc;
      const slx = g.scrollLeft;
      const sly = g.scrollTop;
      const rx  = me.clientX - r.left - VIS_LABEL_W + slx;
      const ry  = me.clientY - r.top  - VIS_RULER_H + sly;
      const ci  = Math.max(0, Math.min(Math.floor(rx / cw), nc - 1));
      const rxInCol   = rx - ci * cw;
      const rawMin    = Math.round(((rxInCol / cw) * VIS_TOTAL_MINS) / 5) * 5 + VIS_START_H * 60 - vDragOffsetMin.current;
      const startMin  = Math.max(VIS_START_H * 60, Math.min(rawMin, VIS_END_H * 60 - vDragDuration.current));
      const endMin    = startMin + vDragDuration.current;
      const laneIdx   = Math.max(0, Math.min(Math.floor(ry / VIS_LANE_H), (screens?.length ?? 1) - 1));
      const screenId  = screens?.[laneIdx]?.id ?? campaignScreenId;
      const curDate   = vDates[ci] ?? date; // which day column the cursor is in
      const preview   = { startMin, endMin, screenId, date: curDate };
      vDragPreviewRef.current = preview;
      setVDragPreview({ ...preview });
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      const preview = vDragPreviewRef.current;
      const id      = vDraggingRef.current;
      vDraggingRef.current    = null;
      vDragPreviewRef.current = null;
      setVDragging(null);
      setVDragPreview(null);
      // Guard: prevent the cell onClick from firing right after drag ends
      vJustDraggedRef.current = true;
      setTimeout(() => { vJustDraggedRef.current = false; }, 300);
      if (id !== null && preview) {
        updateSchedule.mutate(
          { id, data: { startTime: visStr(preview.startMin), endTime: visStr(preview.endMin), screenId: preview.screenId } as any },
          { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() }) }
        );
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [screens, updateSchedule, queryClient]);

  function camOnDate(c: CalCampaign, iso: string): boolean {
    const d   = new Date(iso + "T12:00:00Z");
    const dow = d.getUTCDay();
    if (c.days.length > 0 && !c.days.includes(dow)) return false;
    return isInDateRange(d, c.startAt, c.endAt);
  }

  function getCamsForDateHour(date: Date, hour: number): CalCampaign[] {
    const dow = date.getDay();
    return campaignBlocks.filter(c =>
      c.days.includes(dow) &&
      c.startHour <= hour && c.endHour > hour &&
      isInDateRange(date, c.startAt, c.endAt)
    );
  }

  // ── Próximos agendamentos list ────────────────────────────────────────────
  const upcomingList = useMemo(() => {
    const items: Array<CalCampaign & { status: "live" | "upcoming" | "next"; minsUntil: number }> = [];
    campaignBlocks.forEach(c => {
      const startM = timeMins(c.startTime);
      const endM   = timeMins(c.endTime);
      const inRange = isInDateRange(now, c.startAt, c.endAt);
      if (c.days.includes(todayDow) && inRange) {
        if (startM <= minuteNow && endM > minuteNow) {
          items.push({ ...c, status: "live", minsUntil: 0 });
        } else if (startM > minuteNow) {
          items.push({ ...c, status: "upcoming", minsUntil: startM - minuteNow });
        }
      } else if (inRange) {
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

      <PageHeader
        icon={CalendarDays}
        title="Agendamentos"
        description="Planeje e gerencie a exibição de conteúdos nas suas telas."
        actions={
          <Button onClick={() => { resetForm(); setShowAdd(true); }} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Novo Agendamento
          </Button>
        }
      />

      {/* ── KPI bar ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Hoje */}
        <div className="rounded-2xl p-4 flex items-center justify-between gap-4 border border-border bg-card shadow-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1 text-muted-foreground">Agendamentos Hoje</p>
            <p className="text-3xl font-black tabular-nums tracking-tight text-foreground">{todayCampaigns.length}</p>
            <p className="text-xs mt-1 text-muted-foreground">{liveCampaigns.length} em execução</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <CalendarDays className="w-6 h-6 text-blue-600" />
          </div>
        </div>
        {/* Próximos */}
        <div className="rounded-2xl p-4 flex items-center justify-between gap-4 border border-border bg-card shadow-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1 text-muted-foreground">Próximos Agendamentos</p>
            <p className="text-3xl font-black tabular-nums tracking-tight text-foreground">{upcomingToday.length}</p>
            <p className="text-xs mt-1 text-muted-foreground">Próximas 24h</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
        </div>
        {/* Total */}
        <div className="rounded-2xl p-4 flex items-center justify-between gap-4 border border-border bg-card shadow-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1 text-muted-foreground">Total de Campanhas</p>
            <p className="text-3xl font-black tabular-nums tracking-tight text-foreground">{totalAll}</p>
            <p className="text-xs mt-1 text-muted-foreground">{campaignBlocks.length} ativas</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
        </div>
        {/* Erros */}
        <div className={cn(
          "rounded-2xl p-4 flex items-center justify-between gap-4 border shadow-sm",
          errorCount > 0 ? "bg-destructive/8 border-destructive/20" : "bg-card border-border"
        )}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1 text-muted-foreground">Com Erro</p>
            <p className={cn("text-3xl font-black tabular-nums tracking-tight", errorCount > 0 ? "text-destructive" : "text-foreground")}>{errorCount}</p>
            <p className="text-xs mt-1 text-muted-foreground">{errorCount > 0 ? "Requerem atenção" : "Tudo certo"}</p>
          </div>
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0", errorCount > 0 ? "bg-destructive/15" : "bg-muted")}>
            <AlertTriangle className={cn("w-6 h-6", errorCount > 0 ? "text-destructive" : "text-muted-foreground")} />
          </div>
        </div>
      </div>

      {/* ── Tabs + Calendar Card ──────────────────────────────────────── */}
      <Card className="overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center gap-0 border-b px-4 pt-3 bg-muted/30">
          {([
            { id: "calendar",    label: "Calendário",   icon: CalendarDays },
            { id: "visual",      label: "Visual",        icon: LayoutGrid   },
            { id: "list",        label: "Lista",         icon: ListVideo    },
            { id: "recurrences", label: "Recorrências",  icon: RefreshCw    },
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
              <ConflictBanner
                conflictIds={conflictIds}
                campaignBlocks={campaignBlocks}
                onCleanup={async () => {
                  try {
                    const r = await fetch("/api/schedules/cleanup", { method: "DELETE" });
                    const data = await r.json();
                    queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
                    toast({ title: `Limpeza concluída`, description: `${data.deleted} registro(s) removido(s) (${data.inactive} inativos, ${data.duplicates} duplicatas).` });
                  } catch {
                    toast({ title: "Erro ao limpar", variant: "destructive" });
                  }
                }}
              />
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
                        className={cn("flex-1 border-l border-t border-border/50 relative overflow-visible", isToday && "bg-primary/2")}
                        style={{ height: CELL_H }}
                      >
                        {cams.map(cam => {
                          if (cam.startHour !== hour) return null;
                          const c           = COLORS[cam.colorIdx % COLORS.length];
                          // Pixel-precise positioning using minutes (not integer hours)
                          const startMins   = timeMins(cam.startTime);
                          const endMins     = timeMins(cam.endTime) || 24 * 60;
                          const totalMins   = Math.max(endMins - startMins, 1);
                          const offsetMins  = startMins - hour * 60; // minutes past start of this hour row
                          const topPx       = (offsetMins / 60) * CELL_H;
                          const blockH      = Math.max((totalMins / 60) * CELL_H, 14); // min 14px so it's clickable
                          const hasConflict = conflictIds.has(cam.id);
                          const live        = isLive(cam) && isToday;
                          return (
                            <div
                              key={cam.id}
                              onClick={() => setSelectedId(selectedId === cam.id ? null : cam.id)}
                              className={cn(
                                "absolute inset-x-0.5 rounded-lg border-l-[3px] cursor-pointer transition-all overflow-hidden",
                                selectedId === cam.id ? "ring-1 ring-primary/60 ring-offset-1" : "hover:brightness-110"
                              )}
                              style={{
                                top: topPx + 1,
                                height: blockH - 2,
                                zIndex: 10,
                                background: hasConflict ? "rgba(239,68,68,0.15)" : c.bg,
                                borderColor: hasConflict ? "#ef4444" : c.border,
                                borderTopWidth: 1,
                                borderRightWidth: 1,
                                borderBottomWidth: 1,
                              }}
                            >
                              <div className="px-1.5 py-1 h-full overflow-hidden flex flex-col gap-0.5">
                                {/* Row 1: time range (always visible) */}
                                <div className="flex items-center gap-1 leading-none">
                                  <span className="text-[8px] font-bold font-mono shrink-0" style={{ color: hasConflict ? "#fca5a5" : c.text, opacity: 0.8 }}>
                                    {fmtTime(cam.startTime)}–{fmtTime(cam.endTime)}
                                  </span>
                                  {hasConflict && <AlertTriangle className="w-2 h-2 shrink-0 text-red-400" />}
                                  {live && (
                                    <span className="ml-auto flex items-center gap-0.5 text-[7px] font-black text-red-400 bg-red-500/20 px-1 py-0.5 rounded shrink-0 leading-none">
                                      <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" /> AO VIVO
                                    </span>
                                  )}
                                </div>
                                {/* Row 2: client (bold) or campaign name — always show if block tall enough */}
                                {blockH >= 24 && (
                                  <div className="text-[10px] font-bold leading-tight truncate" style={{ color: hasConflict ? "#fca5a5" : c.text }}>
                                    {cam.clientName || cam.name}
                                  </div>
                                )}
                                {/* Row 3: campaign name (if client shown separately) */}
                                {blockH >= 38 && cam.clientName && (
                                  <div className="text-[9px] leading-tight truncate opacity-80" style={{ color: hasConflict ? "#fca5a5" : c.text }}>
                                    {cam.name}
                                  </div>
                                )}
                                {/* Row 4: playlist name — show when block has enough height */}
                                {blockH >= 36 && (
                                  <div className="mt-auto space-y-0.5">
                                    <div className="text-[8px] opacity-70 truncate leading-tight" style={{ color: c.text }}>
                                      📋 {cam.playlistName}
                                    </div>
                                    <div className="text-[8px] opacity-70 truncate leading-tight" style={{ color: c.text }}>
                                      📺 {cam.screenName}
                                    </div>
                                  </div>
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

        {/* ── Visual Tab ───────────────────────────────────────────────── */}
        {tab === "visual" && (
          <div className="flex flex-col" style={{ height: "calc(100vh - 320px)", minHeight: 520 }}>
            {/* Sub-nav */}
            <div className="flex items-center gap-2 px-4 py-2 border-b flex-wrap">
              <div className="flex gap-0.5 bg-muted/50 rounded-lg p-1">
                {(["dia","semana","mes","periodo"] as const).map(m => (
                  <button key={m} onClick={() => setVMode(m)}
                    className={cn("px-3 py-1 rounded text-xs font-semibold transition-colors capitalize",
                      vMode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}>
                    {m === "dia" ? "Dia" : m === "semana" ? "Semana" : m === "mes" ? "Mês" : "Período"}
                  </button>
                ))}
              </div>
              {vMode !== "periodo" && (
                <>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => {
                    if (vMode === "dia")    setVDayISO(isoAddDays(vDayISO, -1));
                    else if (vMode === "semana") setVWeekStart(isoAddDays(vWeekStart, -7));
                    else { const d = new Date(vMonthISO + "-01T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 1); setVMonthISO(d.toISOString().slice(0, 7)); }
                  }}><ChevronLeft className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
                    setVDayISO(new Date().toISOString().slice(0, 10));
                    setVWeekStart(isoMonday(new Date()));
                    setVMonthISO(new Date().toISOString().slice(0, 7));
                  }}>Hoje</Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => {
                    if (vMode === "dia")    setVDayISO(isoAddDays(vDayISO, 1));
                    else if (vMode === "semana") setVWeekStart(isoAddDays(vWeekStart, 7));
                    else { const d = new Date(vMonthISO + "-01T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 1); setVMonthISO(d.toISOString().slice(0, 7)); }
                  }}><ChevronRight className="w-4 h-4" /></Button>
                  <span className="text-sm text-muted-foreground font-medium">
                    {vMode === "dia"
                      ? `${fmtISOWeekday(vDayISO)} · ${fmtISODate(vDayISO)}`
                      : vMode === "semana"
                      ? `${fmtISODate(isoAddDays(vWeekStart, -1))} – ${fmtISODate(isoAddDays(vWeekStart, 5))}`
                      : new Date(vMonthISO + "-01T12:00:00Z").toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })}
                  </span>
                </>
              )}
              <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Agora
              </div>
            </div>

            {/* Lane view — Dia & Semana */}
            {(vMode === "dia" || vMode === "semana") && (() => {
              const vDates = vMode === "dia" ? [vDayISO] : Array.from({ length: 7 }, (_, i) => isoAddDays(vWeekStart, i - 1));
              const todayISO = new Date().toISOString().slice(0, 10);
              return (
                <div ref={vGridRef} className="flex-1 overflow-auto select-none"
                  style={{ cursor: vDragging !== null ? "grabbing" : "default" }}>
                  <div style={{ minWidth: vDates.length > 1 ? 1260 : 600 }}>
                    {/* Ruler — day header row */}
                    <div className="flex sticky top-0 z-10 bg-background border-b" style={{ height: VIS_RULER_H }}>
                      <div style={{ width: VIS_LABEL_W, flexShrink: 0 }} className="border-r flex items-end pb-1.5 px-3">
                        <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Tela</span>
                      </div>
                      {vDates.map(d => {
                        const isToday = d === todayISO;
                        return (
                          <div key={d} className={cn("flex-1 border-l relative", isToday && "bg-primary/5")}>
                            {/* Day name + date at top */}
                            <div className="flex items-center gap-1.5 px-2 pt-1.5">
                              <div className={cn("text-[10px] font-bold uppercase tracking-wide", isToday ? "text-primary" : "text-muted-foreground/60")}>
                                {fmtISOWeekday(d, true).replace(".", "")}
                              </div>
                              <div className={cn("text-[9px]", isToday ? "text-primary/70" : "text-muted-foreground/40")}>
                                {fmtISODate(d)}
                              </div>
                            </div>
                            {/* Hour ticks row */}
                            <div className="absolute bottom-0 left-0 right-0 h-4">
                              {Array.from({ length: VIS_END_H - VIS_START_H + 1 }, (_, i) => {
                                const h = VIS_START_H + i;
                                const pct = (i / (VIS_END_H - VIS_START_H)) * 100;
                                const show = i % 2 === 0; // every 2h
                                return (
                                  <div key={h} className="absolute flex flex-col items-center" style={{ left: `${pct}%`, transform: "translateX(-50%)" }}>
                                    <div className="w-px h-1.5 bg-border/50" />
                                    {show && <span className="text-[8px] text-muted-foreground/50 leading-none">{h}h</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Screen lanes */}
                    {(screens ?? []).map((screen, laneIdx) => (
                      <div key={screen.id} className="flex border-b group" style={{ height: VIS_LANE_H }}>
                        <div style={{ width: VIS_LABEL_W, flexShrink: 0 }}
                          className="border-r flex flex-col justify-center px-3 gap-0.5 group-hover:bg-muted/20 transition-colors">
                          <div className="text-[11px] font-semibold text-foreground/80 truncate">{screen.name}</div>
                          <div className="text-[9px] text-muted-foreground/40 truncate">{(screen as any).location ?? ""}</div>
                        </div>
                        <div className="flex flex-1">
                          {vDates.map(date => {
                            const isToday  = date === todayISO;
                            const dayCams  = campaignBlocks.filter(c => c.screenId === screen.id && camOnDate(c, date));
                            const nowMins  = new Date().getHours() * 60 + new Date().getMinutes();
                            return (
                              <div key={date} className={cn("flex-1 border-l relative overflow-hidden", isToday && "bg-primary/[0.025]", laneIdx % 2 === 1 && "bg-muted/[0.018]")}
                                onClick={e => {
                                  if (vJustDraggedRef.current || vDraggingRef.current !== null) return;
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const relX = e.clientX - rect.left;
                                  const clickMin = Math.round(((relX / rect.width) * VIS_TOTAL_MINS + VIS_START_H * 60) / 15) * 15;
                                  const hh = Math.floor(clickMin / 60), mm = clickMin % 60;
                                  const startT = `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
                                  const endHH  = Math.min(hh + 1, VIS_END_H - 1);
                                  const endT   = `${String(endHH).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
                                  const dow    = new Date(date + "T12:00:00Z").getUTCDay();
                                  setForm(p => ({ ...p, startTime: startT, endTime: endT, days: [dow], repeatType: "semanal", selectedScreenIds: [screen.id] }));
                                  setShowAdd(true);
                                }}>

                                {/* Hour grid lines */}
                                {Array.from({ length: VIS_END_H - VIS_START_H }, (_, i) => (
                                  <div key={i} className="absolute top-0 bottom-0 w-px bg-border/25"
                                    style={{ left: `${(i / (VIS_END_H - VIS_START_H)) * 100}%` }} />
                                ))}
                                {/* Now marker */}
                                {isToday && nowMins >= VIS_START_H * 60 && nowMins <= VIS_END_H * 60 && (
                                  <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 z-20"
                                    style={{ left: `${((nowMins - VIS_START_H * 60) / VIS_TOTAL_MINS) * 100}%` }} />
                                )}
                                {/* Campaign blocks */}
                                {dayCams.map(c => {
                                  const isDragging = vDragging === c.id && vDragPreview?.screenId === screen.id;
                                  const isGhost    = vDragging === c.id && vDragPreview?.screenId !== screen.id;
                                  const sMin = isDragging ? vDragPreview!.startMin : visMins(c.startTime);
                                  const eMin = isDragging ? vDragPreview!.endMin   : (visMins(c.endTime) || VIS_END_H * 60);
                                  // Clamp to visible range [VIS_START_H, VIS_END_H]
                                  const visS  = Math.max(sMin, VIS_START_H * 60);
                                  const visE  = Math.min(eMin, VIS_END_H   * 60);
                                  if (visE <= visS && !isDragging) return null; // entirely outside
                                  const lPct = ((visS - VIS_START_H * 60) / VIS_TOTAL_MINS) * 100;
                                  const wPct = Math.max(((visE - visS) / VIS_TOTAL_MINS) * 100, 0.5);
                                  const vc   = VIS_COLORS[c.colorIdx % VIS_COLORS.length];
                                  return (
                                    <div key={c.id}
                                      onMouseDown={e => startVDrag(e, c.id, c.screenId, c.startTime, c.endTime, date, vDates, vMode)}
                                      onClick={e => { e.stopPropagation(); if (vDraggingRef.current === null) startEdit(c); }}
                                      className="absolute top-[5px] bottom-[5px] rounded-md overflow-hidden cursor-grab active:cursor-grabbing"
                                      style={{
                                        left: `${lPct}%`, width: `${wPct}%`,
                                        background: isGhost ? "rgba(0,0,0,0.08)" : vc.bg,
                                        borderLeft: `3px solid ${isGhost ? "rgba(0,0,0,0.15)" : vc.border}`,
                                        opacity: isGhost ? 0.2 : 1,
                                        zIndex: vDragging === c.id ? 30 : 10,
                                        transition: isDragging ? "none" : "opacity 0.15s",
                                        pointerEvents: isGhost ? "none" : "auto",
                                      }}>
                                      <div className="h-full px-1.5 flex flex-col justify-center overflow-hidden">
                                        <div className="text-[10px] font-bold text-white truncate leading-tight">{c.clientName || c.name}</div>
                                        {(eMin - sMin) > 20 && <div className="text-[8px] text-white/70 truncate leading-tight">📋 {c.playlistName}</div>}
                                        {(eMin - sMin) > 35 && <div className="text-[8px] text-white/55 truncate">{visStr(sMin)}–{visStr(eMin)}</div>}
                                      </div>
                                    </div>
                                  );
                                })}
                                {/* Ghost in new lane */}
                                {vDragging !== null && vDragPreview?.screenId === screen.id && vDragPreview?.date === date && (() => {
                                  const orig = campaignBlocks.find(x => x.id === vDragging);
                                  if (!orig || orig.screenId === screen.id) return null;
                                  const lPct2 = ((vDragPreview!.startMin - VIS_START_H * 60) / VIS_TOTAL_MINS) * 100;
                                  const wPct2 = Math.max(((vDragPreview!.endMin - vDragPreview!.startMin) / VIS_TOTAL_MINS) * 100, 0.5);
                                  const vc = VIS_COLORS[orig.colorIdx % VIS_COLORS.length];
                                  return (
                                    <div className="absolute top-[5px] bottom-[5px] rounded-md border-2 border-dashed opacity-60 z-20 pointer-events-none"
                                      style={{ left: `${lPct2}%`, width: `${wPct2}%`, background: vc.bg, borderColor: vc.border }} />
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {(screens ?? []).length === 0 && (
                      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                        <Tv className="w-8 h-8 opacity-20 mr-3" /> Nenhuma tela cadastrada
                      </div>
                    )}
                    <div style={{ height: 24 }} />
                  </div>
                </div>
              );
            })()}

            {/* Month view */}
            {vMode === "mes" && (() => {
              const [year, month] = vMonthISO.split("-").map(Number);
              const firstDay  = new Date(Date.UTC(year, month - 1, 1));
              const daysInM   = new Date(Date.UTC(year, month, 0)).getUTCDate();
              const startWd   = (firstDay.getUTCDay() + 6) % 7;
              const todayISO  = new Date().toISOString().slice(0, 10);
              const cells: Array<string | null> = [];
              for (let i = 0; i < startWd; i++) cells.push(null);
              for (let i = 1; i <= daysInM; i++) cells.push(`${vMonthISO}-${String(i).padStart(2, "0")}`);
              while (cells.length % 7 !== 0) cells.push(null);
              return (
                <div className="flex-1 overflow-auto px-4 py-3">
                  <div className="grid grid-cols-7 mb-2">
                    {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d => (
                      <div key={d} className="text-center text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((date, i) => {
                      if (!date) return <div key={i} className="rounded-xl bg-muted/10 min-h-[80px]" />;
                      const dayCams = campaignBlocks.filter(c => camOnDate(c, date));
                      const isToday = date === todayISO;
                      return (
                        <div key={date} className={cn(
                          "rounded-xl p-1.5 flex flex-col gap-1 min-h-[80px] border transition-colors",
                          isToday ? "border-primary/50 bg-primary/5" : "border-border/40 bg-muted/10 hover:bg-muted/20"
                        )}>
                          <div className={cn("text-[11px] font-bold text-right pr-0.5", isToday ? "text-primary" : "text-muted-foreground/50")}>
                            {parseInt(date.slice(8))}
                          </div>
                          <div className="flex flex-col gap-0.5 overflow-hidden">
                            {dayCams.slice(0, 3).map(c => {
                              const vc = VIS_COLORS[c.colorIdx % VIS_COLORS.length];
                              return (
                                <button key={c.id} onClick={() => startEdit(c)}
                                  className="rounded px-1 py-0.5 text-left text-[8px] font-bold text-white truncate hover:brightness-110 transition-all"
                                  style={{ background: vc.bg }}>
                                  {c.clientName || c.name}
                                </button>
                              );
                            })}
                            {dayCams.length > 3 && <div className="text-[8px] text-muted-foreground/40 px-1">+{dayCams.length - 3} mais</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Period / Gantt view */}
            {vMode === "periodo" && (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="px-4 py-2 border-b flex items-center gap-3 flex-wrap">
                  <span className="text-[11px] text-muted-foreground/60 font-semibold uppercase tracking-wider">Período</span>
                  <div className="flex items-center gap-2">
                    <input type="date" value={vPeriodFrom} onChange={e => setVPeriodFrom(e.target.value)}
                      className="border border-input rounded-md px-2 py-1 text-xs bg-background text-foreground outline-none focus:border-primary" />
                    <span className="text-muted-foreground text-xs">→</span>
                    <input type="date" value={vPeriodTo} onChange={e => setVPeriodTo(e.target.value)}
                      className="border border-input rounded-md px-2 py-1 text-xs bg-background text-foreground outline-none focus:border-primary" />
                  </div>
                  <span className="ml-auto text-[10px] text-muted-foreground/50">
                    {campaignBlocks.filter(c =>
                      (!c.endAt || c.endAt.slice(0, 10) >= vPeriodFrom) &&
                      (!c.startAt || c.startAt.slice(0, 10) <= vPeriodTo)
                    ).length} campanhas no período
                  </span>
                </div>
                <div className="flex-1 overflow-auto">
                  {(() => {
                    const pdates  = isoDatesInRange(vPeriodFrom, vPeriodTo, 31);
                    const todayISO = new Date().toISOString().slice(0, 10);
                    return (
                      <div style={{ minWidth: Math.max(700, pdates.length * 52 + 200) }}>
                        {/* Date header */}
                        <div className="flex sticky top-0 z-10 bg-background border-b" style={{ height: 40 }}>
                          <div style={{ width: 200, flexShrink: 0 }} className="border-r flex items-center px-3">
                            <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Tela / Campanha</span>
                          </div>
                          <div className="flex flex-1">
                            {pdates.map(d => {
                              const isToday = d === todayISO;
                              return (
                                <div key={d} className={cn("flex-1 border-l flex flex-col items-center justify-center", isToday && "bg-primary/5")} style={{ minWidth: 44 }}>
                                  <div className={cn("text-[8px] font-bold", isToday ? "text-primary" : "text-muted-foreground/40")}>
                                    {fmtISOWeekday(d, true).slice(0, 3).toUpperCase()}
                                  </div>
                                  <div className={cn("text-[9px] font-mono", isToday ? "text-primary/80" : "text-muted-foreground/30")}>
                                    {d.slice(8)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* Screen + campaign rows */}
                        {(screens ?? []).map(screen => {
                          const scrCams = campaignBlocks.filter(c =>
                            c.screenId === screen.id &&
                            (!c.endAt   || c.endAt.slice(0, 10)   >= vPeriodFrom) &&
                            (!c.startAt || c.startAt.slice(0, 10) <= vPeriodTo)
                          );
                          return (
                            <div key={screen.id}>
                              <div className="flex border-b bg-muted/25" style={{ height: 28 }}>
                                <div style={{ width: 200, flexShrink: 0 }} className="border-r flex items-center px-3 gap-2">
                                  <Monitor className="w-3 h-3 text-primary/60 shrink-0" />
                                  <span className="text-[10px] font-semibold text-foreground/70 truncate">{screen.name}</span>
                                </div>
                                <div className="flex flex-1">
                                  {pdates.map(d => (
                                    <div key={d} className={cn("flex-1 border-l", d === todayISO && "bg-primary/5")} style={{ minWidth: 44 }} />
                                  ))}
                                </div>
                              </div>
                              {scrCams.length === 0 ? (
                                <div className="flex border-b border-border/20" style={{ height: 26 }}>
                                  <div style={{ width: 200, flexShrink: 0 }} className="border-r flex items-center px-8">
                                    <span className="text-[9px] text-muted-foreground/30 italic">sem campanhas no período</span>
                                  </div>
                                  <div className="flex flex-1">
                                    {pdates.map(d => <div key={d} className="flex-1 border-l border-border/20" style={{ minWidth: 44 }} />)}
                                  </div>
                                </div>
                              ) : scrCams.map(c => {
                                const vc      = VIS_COLORS[c.colorIdx % VIS_COLORS.length];
                                const cStart  = c.startAt?.slice(0, 10) ?? vPeriodFrom;
                                const cEnd    = c.endAt?.slice(0, 10)   ?? vPeriodTo;
                                const clampS  = cStart < vPeriodFrom ? vPeriodFrom : cStart;
                                const clampE  = cEnd   > vPeriodTo   ? vPeriodTo   : cEnd;
                                const si      = pdates.indexOf(clampS);
                                const ei      = pdates.indexOf(clampE);
                                return (
                                  <div key={c.id} className="flex border-b border-border/25" style={{ height: 30 }}>
                                    <div style={{ width: 200, flexShrink: 0 }} className="border-r flex items-center px-3 pl-7 gap-1.5">
                                      <div className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ background: vc.border }} />
                                      <span className="text-[10px] text-muted-foreground/70 truncate">{c.clientName || c.name}</span>
                                      <span className="text-[8px] text-muted-foreground/35 ml-auto shrink-0 font-mono">{fmtTime(c.startTime)}</span>
                                    </div>
                                    <div className="flex flex-1 relative items-center">
                                      {pdates.map(d => (
                                        <div key={d} className={cn("flex-1 h-full border-l border-border/25", d === todayISO && "bg-primary/5")} style={{ minWidth: 44 }} />
                                      ))}
                                      {si >= 0 && ei >= 0 && (
                                        <button onClick={() => startEdit(c)}
                                          className="absolute top-[4px] bottom-[4px] rounded text-[8px] font-bold text-white px-1.5 overflow-hidden truncate hover:brightness-110 transition-all"
                                          style={{
                                            left: `${(si / pdates.length) * 100}%`,
                                            width: `${((ei - si + 1) / pdates.length) * 100}%`,
                                            background: vc.bg,
                                            borderLeft: `2px solid ${vc.border}`,
                                            minWidth: 20,
                                            zIndex: 10,
                                          }}>
                                          {c.clientName || c.name}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "recurrences" && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <RefreshCw className="w-12 h-12 opacity-20" />
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
                        <input type="time" value={editForm[field]}
                          onWheel={e => e.currentTarget.blur()}
                          onChange={e => {
                            const val = e.target.value;
                            setEditForm(p => {
                              const next = { ...p, [field]: val };
                              if (next.startTime && next.endTime && next.endTime <= next.startTime) {
                                const [h, m] = next.startTime.split(":").map(Number);
                                const bumped = h < 23 ? `${String(h + 1).padStart(2,"0")}:${String(m).padStart(2,"0")}` : "23:59";
                                next.endTime = bumped;
                              }
                              return next;
                            });
                          }}
                          className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Repetição</label>
                    <div className="flex gap-1.5">
                      {([
                        { value: "semanal", label: "Semanal" },
                        { value: "diario",  label: "Todo dia" },
                        { value: "unico",   label: "Uma vez"  },
                      ] as const).map(opt => (
                        <button key={opt.value} type="button"
                          onClick={() => setEditForm(p => ({
                            ...p,
                            repeatType: opt.value,
                            days: opt.value === "diario" || opt.value === "unico"
                              ? [0,1,2,3,4,5,6]
                              : p.days.length === 7 ? [1,2,3,4,5] : p.days
                          }))}
                          className={cn("flex-1 py-1 text-[9px] font-bold rounded border transition-all",
                            editForm.repeatType === opt.value ? "bg-primary border-primary text-primary-foreground" : "bg-muted border-border text-muted-foreground hover:bg-muted/80")}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {editForm.repeatType === "unico" && (
                      <input type="date" value={editForm.singleDate}
                        onChange={e => setEditForm(p => ({ ...p, singleDate: e.target.value }))}
                        className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary mt-1.5" />
                    )}
                  </div>
                  {editForm.repeatType === "semanal" && (
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
                  )}
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      Telas
                      {editForm.selectedScreenIds.length > 0 && (
                        <span className="text-primary font-semibold">{editForm.selectedScreenIds.length} selecionada{editForm.selectedScreenIds.length > 1 ? "s" : ""}</span>
                      )}
                    </label>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {(screens ?? []).map(s => {
                        const sel = editForm.selectedScreenIds.includes(s.id);
                        return (
                          <button key={s.id} type="button" onClick={() => toggleEditScreen(s.id)}
                            className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs transition-all text-left",
                              sel ? "bg-primary/10 border-primary text-primary font-medium" : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                            )}>
                            <span className={cn("w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center text-[8px]",
                              sel ? "bg-primary border-primary text-primary-foreground" : "border-border bg-background"
                            )}>{sel ? "✓" : ""}</span>
                            <span className="truncate">{s.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="flex-1 text-xs" onClick={handleUpdate} disabled={updateSchedule.isPending}>
                      {updateSchedule.isPending ? "Salvando…" : "Salvar"}
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditMode(false)}>Cancelar</Button>
                  </div>
                </>
              ) : (() => {
                  if (!selectedCam) return null;
                  const cam = selectedCam; // capture for nested functions (TS narrowing)
                  // All rows belonging to the same campaign group
                  const viewGroupCams = cam.campaignGroupId
                    ? campaignBlocks.filter(c => c.campaignGroupId === cam.campaignGroupId)
                    : [cam];
                  const isGroup = viewGroupCams.length > 1;

                  function handleDeleteOne(id: number, screenName: string) {
                    if (!confirm(`Remover campanha do painel "${screenName}"?`)) return;
                    deleteSchedule.mutate({ id }, {
                      onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
                        // If we deleted the selected block, close the panel
                        if (selectedId === id) { setSelectedId(null); setEditMode(false); }
                        toast({ title: `Removido de "${screenName}"` });
                      },
                      onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
                    });
                  }

                  function handleDeleteAll() {
                    const groupId = cam.campaignGroupId;
                    const msg = isGroup
                      ? `Excluir campanha de todos os ${viewGroupCams.length} painéis?`
                      : "Excluir esta campanha?";
                    if (!confirm(msg)) return;
                    const doDelete = groupId
                      ? fetch(`/api/schedules/group/${groupId}`, { method: "DELETE", credentials: "include" })
                          .then(r => { if (!r.ok) throw new Error(); })
                      : deleteSchedule.mutateAsync({ id: cam.id });
                    doDelete
                      .then(() => {
                        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
                        setSelectedId(null); setEditMode(false);
                        toast({ title: "Campanha excluída" });
                      })
                      .catch(() => toast({ title: "Erro ao excluir", variant: "destructive" }));
                  }

                  return (
                    <>
                      <div>
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: COLORS[cam.colorIdx % COLORS.length].bg, color: COLORS[cam.colorIdx % COLORS.length].text }}>
                          <span className={`w-1.5 h-1.5 rounded-full ${COLORS[cam.colorIdx % COLORS.length].dot}`} />
                          {cam.name}
                        </div>
                      </div>
                      {([
                        cam.clientName ? { label: "Cliente", value: cam.clientName } : null,
                        { label: "Playlist", value: cam.playlistName },
                        { label: "Horário",  value: `${fmtTime(cam.startTime)} → ${fmtTime(cam.endTime)}` },
                      ] as Array<{ label: string; value: string } | null>).filter((r): r is { label: string; value: string } => r !== null).map(r => (
                        <div key={r.label} className="space-y-0.5">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{r.label}</div>
                          <div className="text-sm text-foreground">{r.value}</div>
                        </div>
                      ))}
                      {/* Screens list — individual remove per screen */}
                      <div className="space-y-1">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {isGroup ? `Painéis (${viewGroupCams.length})` : "Tela"}
                        </div>
                        <div className="space-y-1">
                          {viewGroupCams.map(gc => (
                            <div key={gc.id} className={cn(
                              "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs",
                              gc.id === cam.id ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted border-border text-foreground"
                            )}>
                              <span className="flex-1 truncate">{gc.screenName}</span>
                              <button
                                onClick={() => handleDeleteOne(gc.id, gc.screenName)}
                                title="Remover deste painel"
                                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors px-0.5"
                              >✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
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
                        <Button size="sm" variant="outline" className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleDeleteAll}>
                          {isGroup ? "Excluir Tudo" : "Excluir"}
                        </Button>
                      </div>
                    </>
                  );
                })()}
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
                placeholder="Ex: Promoção Café, Lançamento Verão…"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Cliente / Marca</label>
              <input value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                placeholder="Ex: Boticário, Fiat, Chevrolet…"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Telas *
                {form.selectedScreenIds.length > 0 && (
                  <span className="ml-2 text-primary normal-case font-semibold">{form.selectedScreenIds.length} selecionada{form.selectedScreenIds.length > 1 ? "s" : ""}</span>
                )}
              </label>
              <div className="rounded-lg border border-border/60 bg-muted/10 max-h-36 overflow-y-auto divide-y divide-border/30">
                {(screens ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">Nenhuma tela cadastrada</p>
                ) : (screens ?? []).map(s => {
                  const sel = form.selectedScreenIds.includes(s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggleScreenInForm(s.id)}
                      className={cn("w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/30", sel && "bg-primary/8")}>
                      <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        sel ? "bg-primary border-primary" : "border-border/60")}>
                        {sel && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </div>
                      <Monitor className={cn("w-3.5 h-3.5 shrink-0", sel ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("text-xs font-medium", sel ? "text-foreground" : "text-muted-foreground")}>{s.name}</span>
                    </button>
                  );
                })}
              </div>
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
                  <input type="time" value={form[field]}
                    onWheel={e => e.currentTarget.blur()}
                    onChange={e => {
                      const val = e.target.value;
                      setForm(p => {
                        const next = { ...p, [field]: val };
                        if (next.startTime && next.endTime && next.endTime <= next.startTime) {
                          const [h, m] = next.startTime.split(":").map(Number);
                          const bumped = h < 23 ? `${String(h + 1).padStart(2,"0")}:${String(m).padStart(2,"0")}` : "23:59";
                          next.endTime = bumped;
                        }
                        return next;
                      });
                    }}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors" />
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Repetição</label>
              <div className="flex gap-2">
                {([
                  { value: "semanal", label: "Semanal" },
                  { value: "diario",  label: "Todo dia" },
                  { value: "unico",   label: "Uma vez"  },
                ] as const).map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(p => ({ ...p, repeatType: opt.value }))}
                    className={cn("flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all",
                      form.repeatType === opt.value
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-muted border-border text-muted-foreground hover:bg-muted/80")}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {form.repeatType === "semanal" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Dias da semana</label>
                <div className="flex gap-1.5">
                  {DAY_LABELS.map((d, i) => (
                    <button key={i} type="button" onClick={() => toggleDay(i)}
                      className={cn("flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all", form.days.includes(i) ? "bg-primary border-primary text-primary-foreground" : "bg-muted border-border text-muted-foreground hover:bg-muted/80")}>
                      {d[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {form.repeatType === "unico" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Data de exibição</label>
                <input type="date" value={form.singleDate}
                  onChange={e => setForm(p => ({ ...p, singleDate: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors" />
              </div>
            )}
            {form.repeatType === "diario" && (
              <div className="rounded-lg bg-primary/8 border border-primary/20 px-3 py-2">
                <p className="text-[11px] text-primary/80">Aparece em todas as telas selecionadas todos os dias, sem limite de data.</p>
              </div>
            )}
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
