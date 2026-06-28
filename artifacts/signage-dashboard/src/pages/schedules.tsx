import { useState } from "react";
import { Link } from "wouter";
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
import {
  CalendarClock, Plus, Trash2, Monitor, ListVideo,
  Clock, Calendar as CalendarIcon, Play, Pause, Timer, AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── BRT helpers ─────────────────────────────────────────────────────────────
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

function fromLocalDatetimeInput(local: string): string | undefined {
  if (!local) return undefined;
  const [datePart, timePart] = local.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour + 3, minute)).toISOString();
}

function toLocalDatetimeInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - BRT_OFFSET_MS);
  return d.toISOString().slice(0, 16);
}

function formatDatetime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }) + " BRT";
}

const DAYS = [
  { value: "0", label: "Dom" },
  { value: "1", label: "Seg" },
  { value: "2", label: "Ter" },
  { value: "3", label: "Qua" },
  { value: "4", label: "Qui" },
  { value: "5", label: "Sex" },
  { value: "6", label: "Sáb" },
];

// ─── Status helpers ───────────────────────────────────────────────────────────
function scheduleStatus(s: {
  active?: boolean | null;
  startAt?: string | null;
  endAt?: string | null;
}): "inactive" | "scheduled" | "live" | "expired" {
  if (!s.active) return "inactive";
  const now = Date.now();
  if (s.startAt) {
    const start = new Date(s.startAt).getTime();
    const end = s.endAt ? new Date(s.endAt).getTime() : Infinity;
    if (now < start) return "scheduled";
    if (now > end) return "expired";
    return "live";
  }
  return "live";
}

function StatusBadge({ status }: { status: ReturnType<typeof scheduleStatus> }) {
  if (status === "live") return (
    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
      Em exibição
    </Badge>
  );
  if (status === "scheduled") return (
    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 border gap-1">
      <Timer className="w-3 h-3" />
      Agendado
    </Badge>
  );
  if (status === "expired") return (
    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 border gap-1">
      Encerrado
    </Badge>
  );
  return (
    <Badge variant="secondary" className="gap-1">
      <Pause className="w-3 h-3" />
      Pausado
    </Badge>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Schedules() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Form state
  const [name, setName] = useState("");
  const [screenId, setScreenId] = useState("");
  const [playlistId, setPlaylistId] = useState("");
  const [mode, setMode] = useState<"promo" | "recurring">("promo");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("22:00");
  const [days, setDays] = useState<string[]>(["1", "2", "3", "4", "5"]);

  const { data: schedules, isLoading } = useListSchedules();
  const { data: screens } = useListScreens();
  const { data: playlists } = useListPlaylists();

  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();

  const resetForm = () => {
    setName(""); setScreenId(""); setPlaylistId("");
    setMode("promo"); setStartAt(""); setEndAt("");
    setStartTime("08:00"); setEndTime("22:00");
    setDays(["1", "2", "3", "4", "5"]);
  };

  const handleOpen = () => { resetForm(); setOpen(true); };

  const handleCreate = () => {
    if (!name.trim() || !screenId || !playlistId) {
      toast({ title: "Preencha nome, tela e playlist", variant: "destructive" });
      return;
    }
    const payload: Record<string, unknown> = {
      name: name.trim(),
      screenId: Number(screenId),
      playlistId: Number(playlistId),
      active: true,
    };
    if (mode === "promo") {
      if (startAt) payload.startAt = fromLocalDatetimeInput(startAt);
      if (endAt) payload.endAt = fromLocalDatetimeInput(endAt);
    } else {
      payload.startTime = startTime;
      payload.endTime = endTime;
      payload.daysOfWeek = days.join(",");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createSchedule.mutate({ data: payload as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
        setOpen(false);
        resetForm();
        toast({ title: "Agendamento criado!" });
      },
      onError: () => toast({ title: "Erro ao criar agendamento", variant: "destructive" }),
    });
  };

  const handleToggle = (id: number, current: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateSchedule.mutate({ id, data: { active: !current } as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
        toast({ title: current ? "Pausado" : "Ativado" });
      },
      onError: () => toast({ title: "Erro", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Excluir este agendamento?")) return;
    deleteSchedule.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
        toast({ title: "Agendamento excluído" });
      },
      onError: () => toast({ title: "Erro", variant: "destructive" }),
    });
  };

  const toggleDay = (val: string) => {
    setDays(prev => prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]);
  };

  // Group by status
  const live = (schedules ?? []).filter(s => scheduleStatus(s as any) === "live");
  const scheduled = (schedules ?? []).filter(s => scheduleStatus(s as any) === "scheduled");
  const others = (schedules ?? []).filter(s => {
    const st = scheduleStatus(s as any);
    return st === "inactive" || st === "expired";
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-primary" />
            Agendamento
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Programe playlists por data, horário e dias da semana.
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={handleOpen}>
          <Plus className="w-4 h-4" /> Novo Agendamento
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : (schedules ?? []).length === 0 ? (
        <div className="text-center py-20 rounded-xl border border-dashed">
          <CalendarClock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="text-base font-semibold">Nenhum agendamento criado</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">
            Programe playlists para rodar em datas e horários específicos.
          </p>
          <Button className="mt-4 gap-2" onClick={handleOpen}>
            <Plus className="w-4 h-4" /> Criar primeiro agendamento
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {live.length > 0 && (
            <Section title="Em exibição agora" icon={<span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}>
              {live.map(s => <ScheduleCard key={s.id} schedule={s as any} onToggle={handleToggle} onDelete={handleDelete} />)}
            </Section>
          )}
          {scheduled.length > 0 && (
            <Section title="Agendados" icon={<Timer className="w-4 h-4 text-blue-400" />}>
              {scheduled.map(s => <ScheduleCard key={s.id} schedule={s as any} onToggle={handleToggle} onDelete={handleDelete} />)}
            </Section>
          )}
          {others.length > 0 && (
            <Section title="Pausados / Encerrados" icon={<Pause className="w-4 h-4 text-muted-foreground" />}>
              {others.map(s => <ScheduleCard key={s.id} schedule={s as any} onToggle={handleToggle} onDelete={handleDelete} />)}
            </Section>
          )}
        </div>
      )}

      {/* ── Create dialog ── */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Agendamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Nome da programação *</Label>
              <Input
                placeholder="Ex: Promoção Black Friday, Horário de Almoço…"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            {/* Screen + Playlist */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tela *</Label>
                <Select value={screenId} onValueChange={setScreenId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {screens?.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Playlist *</Label>
                <Select value={playlistId} onValueChange={setPlaylistId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {playlists?.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mode toggle */}
            <div className="space-y-1.5">
              <Label>Tipo de agendamento</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("promo")}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                    mode === "promo"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-accent/40"
                  )}
                >
                  <CalendarIcon className="w-4 h-4 mb-1" />
                  <span className="text-xs font-bold">Data e Hora</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Promoção com início e fim</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("recurring")}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                    mode === "recurring"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-accent/40"
                  )}
                >
                  <Clock className="w-4 h-4 mb-1" />
                  <span className="text-xs font-bold">Horário Recorrente</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Todo dia num horário fixo</span>
                </button>
              </div>
            </div>

            {/* Promo: date range */}
            {mode === "promo" && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5" /> Período da promoção
                  </p>
                  <span className="text-[10px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                    🇧🇷 Horário Brasília
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Início</Label>
                    <Input type="datetime-local" className="text-xs" value={startAt} onChange={e => setStartAt(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fim <span className="text-muted-foreground">(opcional)</span></Label>
                    <Input type="datetime-local" className="text-xs" value={endAt} onChange={e => setEndAt(e.target.value)} />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0 mt-px text-amber-400" />
                  Promoções têm prioridade sobre agendamentos recorrentes no período.
                </p>
              </div>
            )}

            {/* Recurring: days + time */}
            {mode === "recurring" && (
              <div className="rounded-lg border bg-card p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Horário recorrente
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Das</Label>
                    <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Até</Label>
                    <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dias da semana</Label>
                  <div className="flex gap-1 flex-wrap">
                    {DAYS.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={cn(
                          "text-[10px] font-bold px-2 py-1 rounded border transition-all",
                          days.includes(d.value)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-border hover:bg-accent"
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { resetForm(); setOpen(false); }}>Cancelar</Button>
            <Button
              disabled={!name.trim() || !screenId || !playlistId || createSchedule.isPending}
              onClick={handleCreate}
            >
              {createSchedule.isPending ? "Salvando…" : "Criar Agendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface CardSchedule {
  id: number;
  name?: string | null;
  screenId: number;
  screenName?: string | null;
  playlistId: number;
  playlistName?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  daysOfWeek?: string | null;
  active?: boolean | null;
}

function ScheduleCard({ schedule: s, onToggle, onDelete }: {
  schedule: CardSchedule;
  onToggle: (id: number, current: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const status = scheduleStatus(s);
  const isPromo = !!s.startAt;

  const daysLabel = () => {
    if (!s.daysOfWeek) return "Todos os dias";
    const names = s.daysOfWeek.split(",").map(d => {
      const idx = parseInt(d, 10);
      return DAYS[idx]?.label ?? d;
    });
    return names.join(", ");
  };

  return (
    <Card className={cn("transition-all", (status === "expired" || status === "inactive") ? "opacity-60" : "")}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            isPromo ? "bg-purple-500/15" : "bg-blue-500/15"
          )}>
            {isPromo
              ? <CalendarIcon className="w-5 h-5 text-purple-400" />
              : <Clock className="w-5 h-5 text-blue-400" />
            }
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-semibold text-sm">{s.name ?? "Sem nome"}</span>
              <StatusBadge status={status} />
              <Badge variant="outline" className="text-[10px]">
                {isPromo ? "Promoção" : "Recorrente"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 shrink-0" />
                <Link href={`/screens/${s.screenId}`} className="hover:text-foreground transition-colors truncate">
                  {s.screenName ?? "—"}
                </Link>
              </div>
              <div className="flex items-center gap-1.5">
                <ListVideo className="w-3.5 h-3.5 shrink-0" />
                <Link href={`/playlists/${s.playlistId}`} className="hover:text-foreground transition-colors truncate">
                  {s.playlistName ?? "—"}
                </Link>
              </div>
              {isPromo ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>Início: <strong className="text-foreground">{formatDatetime(s.startAt)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>Fim: <strong className="text-foreground">{s.endAt ? formatDatetime(s.endAt) : "Sem limite"}</strong></span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>{s.startTime ?? "00:00"} – {s.endTime ?? "23:59"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{daysLabel()}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost" size="icon" className="h-8 w-8"
              title={s.active ? "Pausar" : "Ativar"}
              onClick={() => onToggle(s.id, s.active ?? false)}
            >
              {s.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Excluir"
              onClick={() => onDelete(s.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
