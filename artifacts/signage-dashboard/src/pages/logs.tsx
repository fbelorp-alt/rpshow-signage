import { useState, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useListScreens } from "@workspace/api-client-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ScrollText, Search, RefreshCw, Monitor, ListVideo,
  Image as ImageIcon, Send, Trash2, Plus, Edit, Wifi, WifiOff,
  ChevronLeft, ChevronRight, Download, Siren, Calendar, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: number;
  userId: string | null;
  action: string;
  entityType: string;
  entityName: string;
  entityId: number | null;
  screenId: number | null;
  playlistId: number | null;
  screenStatus: string | null;
  details: string | null;
  createdAt: string;
}

interface LogsResponse {
  items: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

const ACTION_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pushed:    { label: "Publicou",   color: "text-sky-400",     bg: "bg-sky-500/10",     icon: Send },
  broadcast: { label: "Broadcast",  color: "text-violet-400",  bg: "bg-violet-500/10",  icon: Send },
  created:   { label: "Criou",      color: "text-emerald-400", bg: "bg-emerald-500/10", icon: Plus },
  updated:   { label: "Editou",     color: "text-amber-400",   bg: "bg-amber-500/10",   icon: Edit },
  deleted:   { label: "Deletou",    color: "text-destructive", bg: "bg-destructive/10", icon: Trash2 },
  uploaded:  { label: "Upload",     color: "text-primary",     bg: "bg-primary/10",     icon: ImageIcon },
  renamed:   { label: "Renomeou",   color: "text-amber-400",   bg: "bg-amber-500/10",   icon: Edit },
  paired:    { label: "Pareou",     color: "text-emerald-400", bg: "bg-emerald-500/10", icon: Monitor },
  published: { label: "Publicou",   color: "text-sky-400",     bg: "bg-sky-500/10",     icon: Send },
  alert:     { label: "Alerta",     color: "text-destructive", bg: "bg-destructive/10", icon: Siren },
};

const ENTITY_META: Record<string, { label: string; icon: React.ElementType }> = {
  screen:   { label: "Tela",     icon: Monitor },
  playlist: { label: "Playlist", icon: ListVideo },
  media:    { label: "Mídia",    icon: ImageIcon },
  client:   { label: "Cliente",  icon: Monitor },
};

function todayBRT() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
function daysAgoBRT(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
function firstOfMonthBRT() {
  const d = new Date();
  d.setDate(1);
  return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const days = Math.floor(h / 24);
  return `${days}d atrás`;
}

const PRESETS = [
  { label: "Hoje",      from: () => todayBRT(),       to: () => todayBRT() },
  { label: "7 dias",    from: () => daysAgoBRT(6),    to: () => todayBRT() },
  { label: "30 dias",   from: () => daysAgoBRT(29),   to: () => todayBRT() },
  { label: "Este mês",  from: () => firstOfMonthBRT(), to: () => todayBRT() },
  { label: "90 dias",   from: () => daysAgoBRT(89),   to: () => todayBRT() },
];

export default function Logs() {
  const today = todayBRT();

  const [search, setSearch]           = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [screenFilter, setScreenFilter] = useState("all");
  const [from, setFrom]               = useState(daysAgoBRT(29));
  const [to, setTo]                   = useState(today);
  const [activePreset, setActivePreset] = useState("30 dias");
  const [page, setPage]               = useState(1);
  const PAGE_SIZE = 50;

  const { data: screens } = useListScreens();

  function applyPreset(p: typeof PRESETS[0]) {
    setFrom(p.from());
    setTo(p.to());
    setActivePreset(p.label);
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setActionFilter("all");
    setEntityFilter("all");
    setScreenFilter("all");
    setFrom(daysAgoBRT(29));
    setTo(today);
    setActivePreset("30 dias");
    setPage(1);
  }

  const hasActiveFilters =
    search || actionFilter !== "all" || entityFilter !== "all" || screenFilter !== "all";

  const params = useMemo(() => new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
    from,
    to,
    ...(actionFilter !== "all" ? { action: actionFilter } : {}),
    ...(entityFilter !== "all" ? { entityType: entityFilter } : {}),
    ...(screenFilter !== "all" ? { screenId: screenFilter } : {}),
  }), [page, actionFilter, entityFilter, screenFilter, from, to]);

  const { data, isLoading, refetch, isFetching } = useQuery<LogsResponse>({
    queryKey: ["logs", page, actionFilter, entityFilter, screenFilter, from, to],
    queryFn: async () => {
      const r = await fetch(`/api/logs?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar logs");
      return r.json();
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return data?.items ?? [];
    const q = search.toLowerCase();
    return (data?.items ?? []).filter(l =>
      l.entityName.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.entityType.toLowerCase().includes(q) ||
      (l.userId ?? "").toLowerCase().includes(q)
    );
  }, [data, search]);

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  function exportCsv() {
    const rows = [
      ["Data/Hora", "Ação", "Tipo", "Nome", "Tela ID", "Playlist ID", "Status da Tela", "Usuário"],
      ...(data?.items ?? []).map(l => [
        formatDateTime(l.createdAt),
        l.action,
        l.entityType,
        l.entityName,
        l.screenId ?? "",
        l.playlistId ?? "",
        l.screenStatus ?? "",
        l.userId ?? "",
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const actions  = ["all", "pushed", "broadcast", "created", "updated", "deleted", "uploaded", "paired"];
  const entities = ["all", "screen", "playlist", "media"];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ScrollText}
        title="Logs de Atividade"
        description={
          isLoading ? "Carregando…" :
          `${data?.total ?? 0} registro${(data?.total ?? 0) !== 1 ? "s" : ""} · ${from === to ? from : `${from} → ${to}`}`
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={exportCsv} disabled={!data?.items?.length}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} /> Atualizar
            </Button>
          </div>
        }
      />

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3">

        {/* Row 1: Period presets + date inputs */}
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <div className="flex items-center rounded-md border overflow-hidden text-xs">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={cn(
                  "px-2.5 py-1.5 transition-colors whitespace-nowrap",
                  activePreset === p.label
                    ? "bg-primary/15 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted/40"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              className="h-8 text-xs w-[130px]"
              value={from}
              max={to}
              onChange={e => { setFrom(e.target.value); setActivePreset(""); setPage(1); }}
            />
            <span className="text-muted-foreground text-xs">→</span>
            <Input
              type="date"
              className="h-8 text-xs w-[130px]"
              value={to}
              min={from}
              max={today}
              onChange={e => { setTo(e.target.value); setActivePreset(""); setPage(1); }}
            />
          </div>
        </div>

        {/* Row 2: Search + entity + action + screen + clear */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative min-w-[180px] max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, ação…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-8 text-xs"
            />
          </div>

          {/* Entity filter */}
          <div className="flex items-center rounded-md border overflow-hidden text-xs">
            {entities.map(e => (
              <button key={e}
                onClick={() => { setEntityFilter(e); setPage(1); }}
                className={cn("px-2.5 py-1.5 transition-colors whitespace-nowrap",
                  entityFilter === e ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:bg-muted/40")}
              >
                {e === "all" ? "Tudo" : ENTITY_META[e]?.label ?? e}
              </button>
            ))}
          </div>

          {/* Action filter */}
          <div className="flex items-center rounded-md border overflow-hidden text-xs">
            {actions.map(a => (
              <button key={a}
                onClick={() => { setActionFilter(a); setPage(1); }}
                className={cn("px-2.5 py-1.5 transition-colors whitespace-nowrap",
                  actionFilter === a ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:bg-muted/40")}
              >
                {a === "all" ? "Todas as ações" : ACTION_META[a]?.label ?? a}
              </button>
            ))}
          </div>

          {/* Screen filter */}
          {(screens ?? []).length > 0 && (
            <Select value={screenFilter} onValueChange={v => { setScreenFilter(v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <Monitor className="w-3 h-3 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Todas as telas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as telas</SelectItem>
                {(screens ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
              <X className="w-3 h-3" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left w-[170px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data/Hora</span>
                </th>
                <th className="px-4 py-3 text-left w-[110px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ação</span>
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</span>
                </th>
                <th className="px-4 py-3 text-center w-[110px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status Tela</span>
                </th>
                <th className="px-4 py-3 text-center w-[80px] hidden md:table-cell">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-64" /></td>
                    <td className="px-4 py-3 text-center"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></td>
                    <td className="px-4 py-3 text-center hidden md:table-cell"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 px-4">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                        <ScrollText className="w-6 h-6 text-muted-foreground opacity-40" />
                      </div>
                      <p className="font-medium">Nenhum registro encontrado</p>
                      <p className="text-muted-foreground text-sm">Tente mudar os filtros ou o período.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(log => {
                  const am = ACTION_META[log.action] ?? { label: log.action, color: "text-muted-foreground", bg: "bg-muted/10", icon: ScrollText };
                  const em = ENTITY_META[log.entityType] ?? { label: log.entityType, icon: ScrollText };
                  const ActionIcon = am.icon;
                  const EntityIcon = em.icon;

                  return (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs tabular-nums font-mono">{formatDateTime(log.createdAt)}</span>
                          <span className="text-[10px] text-muted-foreground">{formatRelative(log.createdAt)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full font-semibold", am.bg, am.color)}>
                          <ActionIcon className="w-3 h-3" />
                          {am.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium truncate block max-w-[400px]">{log.entityName}</span>
                        {(log.screenId || log.playlistId) && (
                          <div className="flex items-center gap-2 mt-0.5">
                            {log.screenId && (
                              <span className="text-[10px] text-muted-foreground">
                                Tela: {(screens ?? []).find((s: any) => s.id === log.screenId)?.name ?? `#${log.screenId}`}
                              </span>
                            )}
                            {log.playlistId && (
                              <span className="text-[10px] text-muted-foreground">Playlist #{log.playlistId}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {log.screenStatus ? (
                          log.screenStatus === "online" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-medium bg-emerald-500/10 text-emerald-500">
                              <Wifi className="w-3 h-3" /> Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-medium bg-amber-500/10 text-amber-500">
                              <WifiOff className="w-3 h-3" /> Offline
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium bg-muted/50 text-muted-foreground">
                          <EntityIcon className="w-3 h-3" />
                          {em.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
            <span className="text-xs text-muted-foreground">
              Página {page} de {totalPages} · {data?.total ?? 0} registros
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
