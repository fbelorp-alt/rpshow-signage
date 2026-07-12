import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useListSchedules, useListScreens, useDeleteSchedule, useUpdateSchedule, getListSchedulesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Megaphone, CalendarDays, Monitor, ListVideo, BarChart2,
  Plus, Search, ChevronRight, Clock, CheckCircle2, AlertTriangle,
  Building2, Trash2, ExternalLink, RefreshCw, Play, Pause,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── helpers ────────────────────────────────────────────────────────────────
function todayBRT() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

function fmtDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function fmtDateShort(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit",
  });
}

type CampaignStatus = "ativa" | "agendada" | "encerrada" | "recorrente" | "pausada";

function getCampaignStatus(s: {
  active: boolean;
  startAt?: string | null;
  endAt?: string | null;
  startTime?: string | null;
  daysOfWeek?: string | null;
}): CampaignStatus {
  if (!s.active) return "pausada";
  const today = todayBRT();
  if (s.startAt || s.endAt) {
    const start = s.startAt ? s.startAt.slice(0, 10) : null;
    const end = s.endAt ? s.endAt.slice(0, 10) : null;
    if (start && today < start) return "agendada";
    if (end && today > end) return "encerrada";
    return "ativa";
  }
  if (s.startTime || s.daysOfWeek) return "recorrente";
  return "ativa";
}

const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; dot: string; icon: React.ReactNode }> = {
  ativa:      { label: "Em andamento", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400", icon: <Play className="w-3 h-3" /> },
  agendada:   { label: "Agendada",     color: "bg-blue-500/15 text-blue-400 border-blue-500/30",         dot: "bg-blue-400",    icon: <CalendarDays className="w-3 h-3" /> },
  encerrada:  { label: "Encerrada",    color: "bg-white/5 text-white/30 border-white/10",                dot: "bg-white/30",    icon: <CheckCircle2 className="w-3 h-3" /> },
  recorrente: { label: "Recorrente",   color: "bg-violet-500/15 text-violet-400 border-violet-500/30",   dot: "bg-violet-400",  icon: <RefreshCw className="w-3 h-3" /> },
  pausada:    { label: "Pausada",      color: "bg-amber-500/15 text-amber-400 border-amber-500/30",      dot: "bg-amber-400",   icon: <Pause className="w-3 h-3" /> },
};

function StatusBadge({ status }: { status: CampaignStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border", cfg.color)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function progressPercent(startAt?: string | null, endAt?: string | null): number | null {
  if (!startAt || !endAt) return null;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

function daysRemaining(endAt?: string | null): number | null {
  if (!endAt) return null;
  const diff = new Date(endAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Campaigns() {
  const { data: schedules = [], isLoading } = useListSchedules();
  const deleteSchedule = useDeleteSchedule();
  const updateSchedule = useUpdateSchedule();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "todas">("todas");

  const campaigns = useMemo(() => {
    return schedules.map(s => ({
      ...s,
      status: getCampaignStatus({ ...s, active: s.active ?? false }),
      progress: progressPercent(s.startAt, s.endAt),
      daysLeft: daysRemaining(s.endAt),
    }));
  }, [schedules]);

  const filtered = useMemo(() => {
    return campaigns.filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !q
        || (c.name ?? "").toLowerCase().includes(q)
        || (c.clientName ?? "").toLowerCase().includes(q)
        || (c.screenName ?? "").toLowerCase().includes(q)
        || (c.playlistName ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "todas" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [campaigns, search, statusFilter]);

  const counts = useMemo(() => ({
    total: campaigns.length,
    ativas: campaigns.filter(c => c.status === "ativa").length,
    agendadas: campaigns.filter(c => c.status === "agendada").length,
    recorrentes: campaigns.filter(c => c.status === "recorrente").length,
    encerradas: campaigns.filter(c => c.status === "encerrada").length,
  }), [campaigns]);

  function handleToggleActive(id: number, currentActive: boolean) {
    updateSchedule.mutate(
      { id, data: { active: !currentActive } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          toast({ title: currentActive ? "Campanha pausada." : "Campanha ativada." });
        },
        onError: () => toast({ title: "Erro ao atualizar campanha", variant: "destructive" }),
      }
    );
  }

  function handleDelete(id: number, name: string) {
    if (!confirm(`Excluir campanha "${name}"? Esta ação não pode ser desfeita.`)) return;
    deleteSchedule.mutate({ id } as any, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
        toast({ title: "Campanha excluída." });
      },
      onError: () => toast({ title: "Erro ao excluir campanha", variant: "destructive" }),
    });
  }

  function buildReportLink(c: typeof campaigns[number]) {
    const params = new URLSearchParams();
    if (c.startAt) params.set("from", c.startAt.slice(0, 10));
    if (c.endAt) params.set("to", c.endAt.slice(0, 10));
    if (c.screenId) params.set("screenId", String(c.screenId));
    return `/reports?${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Campanhas</h1>
            <p className="text-xs text-muted-foreground">Gerencie e acompanhe todas as campanhas publicitárias</p>
          </div>
        </div>
        <Link href="/schedules">
          <Button size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Nova Campanha
          </Button>
        </Link>
      </div>

      {/* ── Stats cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-foreground", icon: <Megaphone className="w-4 h-4 text-muted-foreground" /> },
          { label: "Em andamento", value: counts.ativas, color: "text-emerald-400", icon: <Play className="w-4 h-4 text-emerald-400" /> },
          { label: "Agendadas", value: counts.agendadas, color: "text-blue-400", icon: <CalendarDays className="w-4 h-4 text-blue-400" /> },
          { label: "Recorrentes", value: counts.recorrentes, color: "text-violet-400", icon: <RefreshCw className="w-4 h-4 text-violet-400" /> },
        ].map(stat => (
          <Card key={stat.label} className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                {stat.icon}
              </div>
              <div>
                <div className={cn("text-2xl font-bold leading-none", stat.color)}>{stat.value}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs"
            placeholder="Buscar por campanha, cliente, tela…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["todas", "ativa", "agendada", "recorrente", "encerrada", "pausada"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all",
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/60"
              )}
            >
              {s === "todas" ? "Todas" : STATUS_CONFIG[s].label}
              {s !== "todas" && (
                <span className="ml-1 opacity-70">
                  {s === "ativa" ? counts.ativas : s === "agendada" ? counts.agendadas : s === "recorrente" ? counts.recorrentes : s === "encerrada" ? counts.encerradas : 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Campaign list ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-xl bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
            <Megaphone className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {search || statusFilter !== "todas" ? "Nenhuma campanha encontrada" : "Nenhuma campanha criada ainda"}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {search || statusFilter !== "todas"
              ? "Tente outros filtros"
              : "Crie sua primeira campanha em Agendamento"}
          </p>
          {!search && statusFilter === "todas" && (
            <Link href="/schedules">
              <Button size="sm" className="mt-4 gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Nova Campanha
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const cfg = STATUS_CONFIG[c.status];
            const hasDateRange = !!(c.startAt || c.endAt);
            const hasReport = hasDateRange && c.screenId;
            return (
              <div
                key={c.id}
                className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm hover:border-border transition-all overflow-hidden"
              >
                {/* Progress bar for active date campaigns */}
                {c.status === "ativa" && c.progress !== null && (
                  <div className="h-0.5 bg-muted/30">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                      c.status === "ativa" ? "bg-emerald-500/15" :
                      c.status === "agendada" ? "bg-blue-500/15" :
                      c.status === "recorrente" ? "bg-violet-500/15" :
                      "bg-muted/30"
                    )}>
                      <Megaphone className={cn(
                        "w-4.5 h-4.5",
                        c.status === "ativa" ? "text-emerald-400" :
                        c.status === "agendada" ? "text-blue-400" :
                        c.status === "recorrente" ? "text-violet-400" :
                        "text-muted-foreground/40"
                      )} />
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold leading-tight">
                              {c.name || c.playlistName || "Sem nome"}
                            </h3>
                            <StatusBadge status={c.status} />
                          </div>
                          {c.clientName && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3 text-muted-foreground/50" />
                              <span className="text-[11px] text-muted-foreground font-medium">{c.clientName}</span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasReport && (
                            <Link href={buildReportLink(c)}>
                              <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-[10px]">
                                <BarChart2 className="w-3 h-3" />
                                Relatório
                              </Button>
                            </Link>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title={c.active ? "Pausar" : "Ativar"}
                            onClick={() => handleToggleActive(c.id, c.active ?? false)}
                          >
                            {c.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            title="Excluir"
                            onClick={() => handleDelete(c.id, c.name ?? c.playlistName ?? "esta campanha")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {c.screenName && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Monitor className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[120px]">{c.screenName}</span>
                          </div>
                        )}
                        {c.playlistName && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <ListVideo className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[120px]">{c.playlistName}</span>
                          </div>
                        )}
                        {(c.startAt || c.endAt) && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <CalendarDays className="w-3 h-3 shrink-0" />
                            <span>
                              {fmtDateShort(c.startAt) ?? "—"} → {fmtDateShort(c.endAt) ?? "∞"}
                            </span>
                          </div>
                        )}
                        {c.startTime && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{c.startTime} – {c.endTime ?? "23:59"}</span>
                          </div>
                        )}
                      </div>

                      {/* Progress info for active campaigns */}
                      {c.status === "ativa" && c.progress !== null && c.daysLeft !== null && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                            <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${c.progress}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {c.daysLeft === 0 ? "Último dia" : `${c.daysLeft} dia${c.daysLeft !== 1 ? "s" : ""} restantes`}
                          </span>
                        </div>
                      )}

                      {/* Scheduled countdown */}
                      {c.status === "agendada" && c.startAt && (
                        <div className="mt-1.5">
                          <span className="text-[10px] text-blue-400/80">
                            Inicia em {fmtDate(c.startAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bottom hint ─────────────────────────────────────────────────────── */}
      {campaigns.length > 0 && (
        <p className="text-center text-[10px] text-muted-foreground/40 pb-2">
          {campaigns.length} campanha{campaigns.length !== 1 ? "s" : ""} · Clique em "Relatório" para ver prova de exibição
        </p>
      )}
    </div>
  );
}
