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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  CalendarClock, Plus, Trash2, Monitor, ListVideo,
  Clock, Calendar as CalendarIcon, Play, Pause,
  ChevronRight, AlertCircle, CheckCircle2, Timer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── helpers ────────────────────────────────────────────────────────────────

function toLocalDatetimeInput(iso?: string | null) {
  if (!iso) return "";
  // datetime-local needs "YYYY-MM-DDTHH:MM"
  return iso.slice(0, 16);
}

function fromLocalDatetimeInput(local: string): string | undefined {
  if (!local) return undefined;
  return new Date(local).toISOString();
}

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
  return "live"; // recurring, active, no date
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
      <CheckCircle2 className="w-3 h-3" />
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

function formatDatetime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
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

// ─── form schema ─────────────────────────────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(1, "Informe um nome para o agendamento"),
  screenId: z.coerce.number().min(1, "Selecione a tela"),
  playlistId: z.coerce.number().min(1, "Selecione a playlist"),
  mode: z.enum(["promo", "recurring"]),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  daysOfWeek: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

// ─── component ───────────────────────────────────────────────────────────────

export default function Schedules() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: schedules, isLoading } = useListSchedules();
  const { data: screens, isLoading: screensLoading } = useListScreens();
  const { data: playlists, isLoading: playlistsLoading } = useListPlaylists();

  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      screenId: undefined as unknown as number,
      playlistId: undefined as unknown as number,
      mode: "promo",
      startAt: "",
      endAt: "",
      startTime: "08:00",
      endTime: "22:00",
      daysOfWeek: "1,2,3,4,5",
    },
  });

  const mode = form.watch("mode");

  const onSubmit = (data: FormValues) => {
    const payload: Record<string, unknown> = {
      name: data.name,
      screenId: data.screenId,
      playlistId: data.playlistId,
      active: true,
    };

    if (data.mode === "promo") {
      if (data.startAt) payload.startAt = fromLocalDatetimeInput(data.startAt);
      if (data.endAt) payload.endAt = fromLocalDatetimeInput(data.endAt);
    } else {
      payload.startTime = data.startTime;
      payload.endTime = data.endTime;
      payload.daysOfWeek = data.daysOfWeek;
    }

    createSchedule.mutate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { data: payload as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          setOpen(false);
          form.reset();
          toast({ title: "Agendamento criado com sucesso!" });
        },
        onError: () => toast({ title: "Erro ao criar agendamento", variant: "destructive" }),
      }
    );
  };

  const handleToggle = (id: number, current: boolean) => {
    updateSchedule.mutate(
      { id, data: { active: !current } as Parameters<typeof updateSchedule.mutate>[0]["data"] },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          toast({ title: current ? "Agendamento pausado" : "Agendamento ativado" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Excluir este agendamento?")) return;
    deleteSchedule.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          toast({ title: "Agendamento excluído" });
        },
      }
    );
  };

  // Group by status
  const live = schedules?.filter(s => scheduleStatus(s as any) === "live") ?? [];
  const scheduled = schedules?.filter(s => scheduleStatus(s as any) === "scheduled") ?? [];
  const others = schedules?.filter(s => {
    const st = scheduleStatus(s as any);
    return st === "inactive" || st === "expired";
  }) ?? [];

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
            Programe promoções, campanhas e conteúdo por data e horário específico.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              Novo Agendamento
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar Agendamento</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                {/* Name */}
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da programação</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Promoção Black Friday, Horário de Almoço..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-3">
                  {/* Screen */}
                  <FormField control={form.control} name="screenId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tela</FormLabel>
                      <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString()}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {screensLoading ? <SelectItem value="0" disabled>Carregando...</SelectItem>
                            : screens?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Playlist */}
                  <FormField control={form.control} name="playlistId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Playlist</FormLabel>
                      <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString()}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {playlistsLoading ? <SelectItem value="0" disabled>Carregando...</SelectItem>
                            : playlists?.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Mode toggle */}
                <FormField control={form.control} name="mode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de agendamento</FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => field.onChange("promo")}
                        className={cn(
                          "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                          field.value === "promo"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card hover:bg-accent/40"
                        )}
                      >
                        <CalendarIcon className="w-4 h-4 mb-1" />
                        <span className="text-xs font-bold">Data e Hora</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          Promoção com início e fim específico
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange("recurring")}
                        className={cn(
                          "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                          field.value === "recurring"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card hover:bg-accent/40"
                        )}
                      >
                        <Clock className="w-4 h-4 mb-1" />
                        <span className="text-xs font-bold">Horário Recorrente</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          Toca todo dia dentro de um horário
                        </span>
                      </button>
                    </div>
                  </FormItem>
                )} />

                {/* Promo mode: startAt / endAt */}
                {mode === "promo" && (
                  <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      Período da promoção
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="startAt" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Início</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} className="text-xs" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="endAt" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Fim</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} className="text-xs" />
                          </FormControl>
                          <FormDescription className="text-[10px]">Opcional</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <p className="text-[10px] text-muted-foreground flex items-start gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0 mt-px text-amber-400" />
                      A promoção terá prioridade sobre agendamentos recorrentes no período.
                    </p>
                  </div>
                )}

                {/* Recurring mode: days + time range */}
                {mode === "recurring" && (
                  <div className="space-y-3 rounded-lg border bg-card p-3">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Horário recorrente
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="startTime" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Das</FormLabel>
                          <FormControl><Input type="time" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="endTime" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Até</FormLabel>
                          <FormControl><Input type="time" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* Day of week pills */}
                    <FormField control={form.control} name="daysOfWeek" render={({ field }) => {
                      const selected = new Set((field.value ?? "").split(",").filter(Boolean));
                      const toggle = (val: string) => {
                        const next = new Set(selected);
                        next.has(val) ? next.delete(val) : next.add(val);
                        field.onChange([...next].sort().join(","));
                      };
                      return (
                        <FormItem>
                          <FormLabel className="text-xs">Dias da semana</FormLabel>
                          <div className="flex gap-1 flex-wrap">
                            {DAYS.map(d => (
                              <button
                                key={d.value}
                                type="button"
                                onClick={() => toggle(d.value)}
                                className={cn(
                                  "text-[10px] font-bold px-2 py-1 rounded border transition-all",
                                  selected.has(d.value)
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted text-muted-foreground border-border hover:bg-accent"
                                )}
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }} />
                  </div>
                )}

                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createSchedule.isPending}>
                    {createSchedule.isPending ? "Salvando..." : "Criar Agendamento"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : schedules?.length === 0 ? (
        <div className="text-center py-20 rounded-xl border border-dashed">
          <CalendarClock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="text-base font-semibold">Nenhum agendamento criado</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">
            Crie um agendamento para programar promoções em datas e horários específicos.
          </p>
          <Button className="mt-4 gap-2" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4" /> Criar primeiro agendamento
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Live now */}
          {live.length > 0 && (
            <Section title="Em exibição agora" icon={<span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}>
              {live.map(s => <ScheduleCard key={s.id} schedule={s as any} onToggle={handleToggle} onDelete={handleDelete} />)}
            </Section>
          )}
          {/* Upcoming */}
          {scheduled.length > 0 && (
            <Section title="Agendados" icon={<Timer className="w-4 h-4 text-blue-400" />}>
              {scheduled.map(s => <ScheduleCard key={s.id} schedule={s as any} onToggle={handleToggle} onDelete={handleDelete} />)}
            </Section>
          )}
          {/* Inactive / expired */}
          {others.length > 0 && (
            <Section title="Pausados / Encerrados" icon={<Pause className="w-4 h-4 text-muted-foreground" />}>
              {others.map(s => <ScheduleCard key={s.id} schedule={s as any} onToggle={handleToggle} onDelete={handleDelete} />)}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

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
    const names = s.daysOfWeek.split(",").map(d => DAYS[parseInt(d)]?.label ?? d);
    return names.join(", ");
  };

  return (
    <Card className={cn(
      "transition-all",
      status === "expired" || status === "inactive" ? "opacity-60" : ""
    )}>
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
              {/* Screen */}
              <div className="flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 shrink-0" />
                <Link href={`/screens/${s.screenId}`} className="hover:text-foreground transition-colors truncate">
                  {s.screenName ?? "—"}
                </Link>
              </div>

              {/* Playlist */}
              <div className="flex items-center gap-1.5">
                <ListVideo className="w-3.5 h-3.5 shrink-0" />
                <Link href={`/playlists/${s.playlistId}`} className="hover:text-foreground transition-colors truncate">
                  {s.playlistName ?? "—"}
                </Link>
              </div>

              {/* Date or time info */}
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
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={s.active ? "Pausar" : "Ativar"}
              onClick={() => onToggle(s.id, s.active ?? false)}
            >
              {s.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
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
