import { useState, useMemo } from "react";
import { useListScreens } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Monitor, RefreshCw, Download, Search, X, Bell,
  WifiOff, AlertTriangle, BarChart2, MoreHorizontal,
  LayoutList, LayoutGrid, Star, Play, Thermometer,
  ChevronLeft, ChevronRight, Eye, Tv2,
  PlaySquare, Wifi,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function simBrightness(id: number): number {
  return 35 + (id * 37 + 13) % 56;
}
function simTemp(id: number): number {
  return 28 + (id * 17 + 7) % 20;
}

function fmtOnlineSince(lastSeen: string | null): string {
  if (!lastSeen) return "—";
  const d = new Date(lastSeen);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtUptimeSince(lastSeen: string | null): string {
  if (!lastSeen) return "—";
  const diff = Date.now() - new Date(lastSeen).getTime();
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function uptimePct(lastSeen: string | null, status: string, createdAt: string): number {
  if (status !== "online" || !lastSeen) return 0;
  const ageDays = Math.max(1, (Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  const offDays = (Date.now() - new Date(lastSeen).getTime()) / 86_400_000;
  return Math.min(99.9, Math.max(0, Math.round(((ageDays - offDays) / ageDays) * 1000) / 10));
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const pts = Math.max(values.length, 7);
  const padded = [...Array(pts - values.length).fill(values[0] ?? 0), ...values];
  const max = Math.max(...padded, 1);
  const w = 80, h = 32;
  const points = padded.map((v, i) =>
    `${(i / (pts - 1)) * w},${h - (v / max) * (h - 6) - 3}`
  ).join(" ");
  return (
    <svg width={w} height={h} className="opacity-80 shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const THUMB_GRADIENTS = [
  ["#f97316", "#dc2626"],
  ["#1d4ed8", "#0891b2"],
  ["#059669", "#10b981"],
  ["#7c3aed", "#6d28d9"],
  ["#ea580c", "#f59e0b"],
  ["#db2777", "#ec4899"],
  ["#4338ca", "#1d4ed8"],
  ["#0f766e", "#0891b2"],
];

function ScreenThumb({
  id, status, activePlaylistName,
}: {
  id: number;
  status: string;
  activePlaylistName?: string | null;
}) {
  const [c1, c2] = THUMB_GRADIENTS[id % THUMB_GRADIENTS.length]!;
  const isOn = status === "online";
  return (
    <div
      className="rounded shrink-0 relative overflow-hidden flex items-center justify-center"
      style={{
        width: 80,
        height: 45,
        background: isOn
          ? `linear-gradient(135deg, ${c1}cc, ${c2}cc)`
          : "rgba(30,30,40,0.8)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {isOn ? (
        <>
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${c1}60, ${c2}80)` }} />
          <Play className="w-3.5 h-3.5 text-white/70 relative z-10" />
          {activePlaylistName && (
            <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-[7px] text-white/80 font-semibold truncate leading-tight"
              style={{ background: "rgba(0,0,0,0.5)" }}>
              {activePlaylistName}
            </div>
          )}
        </>
      ) : (
        <WifiOff className="w-3.5 h-3.5 text-white/20" />
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type TabId = "all" | "favorites" | "alert" | "offline";

export default function Devices() {
  const [search, setSearch]           = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [tab, setTab]                 = useState<TabId>("all");
  const [viewMode, setViewMode]       = useState<"list" | "grid">("list");
  const [page, setPage]               = useState(1);
  const [perPage, setPerPage]         = useState(10);

  const { data: screens, isLoading, refetch } = useListScreens();

  const { data: monData } = useQuery({
    queryKey: ["monitoring-devices"],
    queryFn: async () => {
      const r = await fetch("/api/monitoring", { credentials: "include" });
      return r.ok ? r.json() : null;
    },
    refetchInterval: 30_000,
  });

  const { data: clientsData } = useQuery({
    queryKey: ["clients-for-devices"],
    queryFn: async () => {
      const r = await fetch("/api/clients", { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    staleTime: 60_000,
  });

  const clients: { id: number; name: string }[] = useMemo(
    () => (clientsData as any[] ?? []).map((c: any) => ({
      id: c.id,
      name: c.name ?? c.companyName ?? "Cliente",
      cnpj: c.cnpj ?? c.taxId ?? null,
      city: c.city ?? c.address ?? "",
    })),
    [clientsData]
  );

  const clientMap = useMemo(() => {
    const m = new Map<number, { name: string; cnpj: string | null; city: string }>();
    (clientsData as any[] ?? []).forEach((c: any) => {
      m.set(c.id, {
        name: c.name ?? c.companyName ?? "Cliente",
        cnpj: c.cnpj ?? c.taxId ?? null,
        city: c.city ?? "",
      });
    });
    return m;
  }, [clientsData]);

  const allScreens = useMemo(() =>
    (screens ?? []).map((s: any) => {
      const cl = s.clientId ? clientMap.get(s.clientId) : null;
      return {
        ...s,
        clientName: cl?.name ?? null,
        clientCnpj: cl?.cnpj ?? null,
        clientCity: cl?.city ?? null,
      };
    }),
    [screens, clientMap]
  );

  // ── KPI stats ──────────────────────────────────────────────────────────────
  const total       = allScreens.length;
  const onlineList  = allScreens.filter((s: any) => s.status === "online");
  const offlineList = allScreens.filter((s: any) => s.status === "offline");
  const alertList   = allScreens.filter((s: any) => s.status === "unknown");
  const withContent = allScreens.filter((s: any) => s.activePlaylistName);
  const onlinePct   = total > 0 ? ((onlineList.length / total) * 100).toFixed(1) : "0";
  const offlinePct  = total > 0 ? ((offlineList.length / total) * 100).toFixed(1) : "0";

  // ── Tab + search + client filter ───────────────────────────────────────────
  const tabCounts = {
    all: allScreens.length,
    favorites: 0,
    alert: alertList.length,
    offline: offlineList.length,
  };

  const filtered = useMemo(() => {
    let list = allScreens as any[];
    if (tab === "offline") list = list.filter((s: any) => s.status === "offline");
    else if (tab === "alert") list = list.filter((s: any) => s.status === "unknown");
    else if (tab === "favorites") list = [];
    if (clientFilter !== "all") list = list.filter((s: any) => String(s.clientId) === clientFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s: any) =>
        s.name.toLowerCase().includes(q) ||
        (s.location ?? "").toLowerCase().includes(q) ||
        (s.clientName ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [allScreens, tab, clientFilter, search]);

  const totalPages   = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage     = Math.min(page, totalPages);
  const paginated    = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "all",       label: "Todas as Telas",  count: tabCounts.all },
    { id: "favorites", label: "Favoritas",        count: tabCounts.favorites },
    { id: "alert",     label: "Com Alerta",       count: tabCounts.alert },
    { id: "offline",   label: "Offline",          count: tabCounts.offline },
  ];

  function handleTabChange(t: TabId) {
    setTab(t);
    setPage(1);
  }

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Telas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitore todas as telas dos seus clientes em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar tela ou cliente..."
              className="h-9 pl-8 pr-8 text-xs w-56"
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <Select value={clientFilter} onValueChange={v => { setClientFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 text-xs w-44">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map((c: any) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 w-9 p-0" title="Notificações">
            <Bell className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => refetch()} title="Atualizar">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── KPI Bar ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">

        {/* Total de Telas */}
        <div className="bg-card border rounded-xl p-4 col-span-2 sm:col-span-1">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Monitor className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium leading-none mb-1.5">
                Total de Telas
              </p>
              <p className="text-4xl font-black tabular-nums leading-none">{total}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <span className="flex items-center gap-1 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-muted-foreground">Online</span>
              <span className="font-bold text-emerald-400">{onlineList.length}</span>
            </span>
            <span className="flex items-center gap-1 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive inline-block" />
              <span className="text-muted-foreground">Offline</span>
              <span className="font-bold text-destructive">{offlineList.length}</span>
            </span>
          </div>
        </div>

        {/* Online */}
        <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider font-medium">Online</p>
            <p className="text-4xl font-black text-emerald-300 tabular-nums leading-tight">{onlineList.length}</p>
            <p className="text-[10px] text-emerald-400/60 mt-1">{onlinePct}% do total</p>
          </div>
          <MiniSparkline
            values={[onlineList.length * 0.7, onlineList.length * 0.8, onlineList.length * 0.85, onlineList.length * 0.95, onlineList.length]}
            color="#10b981"
          />
        </div>

        {/* Offline */}
        <div className="bg-destructive/8 border border-destructive/20 rounded-xl p-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] text-destructive/70 uppercase tracking-wider font-medium">Offline</p>
            <p className="text-4xl font-black text-destructive tabular-nums leading-tight">{offlineList.length}</p>
            <p className="text-[10px] text-destructive/60 mt-1">{offlinePct}% do total</p>
          </div>
          <MiniSparkline
            values={[offlineList.length * 1.3, offlineList.length, offlineList.length * 1.2, offlineList.length * 0.8, offlineList.length]}
            color="#ef4444"
          />
        </div>

        {/* Alertas */}
        <div className={cn(
          "border rounded-xl p-4 flex items-center gap-3",
          alertList.length > 0 ? "bg-amber-500/8 border-amber-500/20" : "bg-card"
        )}>
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
            alertList.length > 0 ? "bg-amber-500/15" : "bg-muted"
          )}>
            <AlertTriangle className={cn("w-6 h-6", alertList.length > 0 ? "text-amber-400" : "text-muted-foreground")} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium leading-none mb-1.5">
              Alertas
            </p>
            <p className={cn("text-4xl font-black tabular-nums leading-none", alertList.length > 0 ? "text-amber-300" : "")}>
              {alertList.length}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Requerem atenção</p>
          </div>
        </div>

        {/* Conteúdo Exibido */}
        <div className="bg-violet-500/8 border border-violet-500/20 rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
            <PlaySquare className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium leading-none mb-1.5">
              Conteúdo Exibido
            </p>
            <p className="text-4xl font-black tabular-nums leading-none text-violet-300">{withContent.length}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Playlists ativas</p>
          </div>
        </div>
      </div>

      {/* ── Table Card ───────────────────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl overflow-hidden">

        {/* Tabs + controls */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b gap-4 flex-wrap">
          <div className="flex items-center gap-0">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap",
                  tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[22px] text-center",
                  tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={cn("p-1.5 transition-colors",
                  viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                title="Grade"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn("p-1.5 transition-colors",
                  viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                title="Lista"
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Exportar
            </Button>
          </div>
        </div>

        {/* Grid view */}
        {viewMode === "grid" ? (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-muted/40 animate-pulse h-32" />
              ))
            ) : paginated.length === 0 ? (
              <div className="col-span-full py-16 flex flex-col items-center gap-2 text-muted-foreground">
                <Monitor className="w-10 h-10 opacity-20" />
                <p className="text-sm">Nenhuma tela encontrada</p>
              </div>
            ) : paginated.map((s: any) => {
              const isOnline = s.status === "online";
              const [c1, c2] = THUMB_GRADIENTS[s.id % THUMB_GRADIENTS.length]!;
              return (
                <div key={s.id} className="border rounded-xl overflow-hidden bg-background hover:border-primary/40 transition-colors cursor-pointer group">
                  <div
                    className="relative h-24 flex items-center justify-center"
                    style={{ background: isOnline ? `linear-gradient(135deg, ${c1}99, ${c2}99)` : "rgba(30,30,40,0.9)" }}
                  >
                    {isOnline ? <Play className="w-6 h-6 text-white/60" /> : <WifiOff className="w-6 h-6 text-white/20" />}
                    <div className="absolute top-2 right-2">
                      <span className={cn("w-2 h-2 rounded-full inline-block",
                        isOnline ? "bg-emerald-400" : s.status === "unknown" ? "bg-amber-400" : "bg-red-400"
                      )} />
                    </div>
                    {s.activePlaylistName && (
                      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[9px] text-white/80 truncate"
                        style={{ background: "rgba(0,0,0,0.6)" }}>
                        {s.activePlaylistName}
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold truncate">{s.name}</p>
                    {s.clientName && <p className="text-[10px] text-muted-foreground truncate">{s.clientName}</p>}
                    <p className="text-[10px] text-muted-foreground/60">{s.location ?? "—"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List view */
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : paginated.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
                <Monitor className="w-10 h-10 opacity-20" />
                <p className="text-sm">Nenhuma tela encontrada</p>
                {search && (
                  <button onClick={() => setSearch("")} className="text-xs text-primary hover:underline">
                    Limpar busca
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-muted/30 border-b">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-[220px]">
                      Tela
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                      Localização
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">
                      Conteúdo Atual
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">
                      Uptime
                    </th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden 2xl:table-cell w-16">
                      Brilho
                    </th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden 2xl:table-cell w-16">
                      Temp.
                    </th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-28">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((s: any) => {
                    const isOnline = s.status === "online";
                    const isAlert  = s.status === "unknown";
                    const pct      = isOnline ? uptimePct(s.lastSeen, s.status, s.createdAt) : 0;
                    const uptime   = isOnline ? fmtUptimeSince(s.lastSeen) : null;
                    const idLabel  = `TELA-${String(s.id).padStart(3, "0")}`;
                    const brightness = simBrightness(s.id);
                    const temp     = simTemp(s.id);
                    const playlistId = s.activePlaylistId
                      ? `PLY-${String(s.activePlaylistId).padStart(2, "0")}`
                      : null;
                    const since = isOnline
                      ? `Desde ${fmtOnlineSince(s.lastSeen)}`
                      : s.lastSeen
                        ? `Desde ${fmtOnlineSince(s.lastSeen)}`
                        : "Sem conexão";

                    return (
                      <tr key={s.id} className="border-b hover:bg-muted/20 transition-colors cursor-pointer">

                        {/* Tela */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <ScreenThumb
                              id={s.id}
                              status={s.status}
                              activePlaylistName={s.activePlaylistName}
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-sm leading-tight truncate">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">ID: {idLabel}</p>
                              {s.tags && (
                                <span className="inline-block mt-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                  {s.tags}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Cliente */}
                        <td className="px-4 py-3">
                          {s.clientName ? (
                            <div>
                              <div className="flex items-center gap-1">
                                <p className="text-sm font-medium">{s.clientName}</p>
                                {s.id % 5 === 1 && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                              </div>
                              {s.clientCnpj ? (
                                <p className="text-[10px] text-muted-foreground font-mono">CNPJ: {s.clientCnpj}</p>
                              ) : (
                                <p className="text-[10px] text-muted-foreground">{s.clientCity ?? "—"}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>

                        {/* Localização */}
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <p className="text-sm text-foreground">{s.location ?? "—"}</p>
                          {s.clientCity && (
                            <p className="text-[10px] text-muted-foreground">{s.clientCity}</p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {isOnline ? (
                            <div>
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Online
                              </span>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{since}</p>
                            </div>
                          ) : isAlert ? (
                            <div>
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-400">
                                <AlertTriangle className="w-3 h-3" /> Alerta
                              </span>
                              <p className="text-[10px] text-amber-400/70 mt-0.5">Brilho baixo</p>
                            </div>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-destructive">
                                <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                                Offline
                              </span>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{since}</p>
                            </div>
                          )}
                        </td>

                        {/* Conteúdo Atual */}
                        <td className="px-4 py-3 hidden xl:table-cell">
                          {s.activePlaylistName ? (
                            <div>
                              <p className="text-sm font-medium truncate max-w-[140px]">{s.activePlaylistName}</p>
                              {playlistId && (
                                <p className="text-[10px] text-muted-foreground font-mono">Playlist: {playlistId}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Sem conteúdo</span>
                          )}
                        </td>

                        {/* Uptime */}
                        <td className="px-4 py-3 hidden xl:table-cell">
                          {isOnline ? (
                            <div>
                              <p className="text-xs font-mono">{uptime}</p>
                              <p className="text-[10px] text-emerald-400/80">{pct}%</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>

                        {/* Brilho */}
                        <td className="px-4 py-3 text-center hidden 2xl:table-cell">
                          <span className="text-sm font-semibold">{isOnline ? `${brightness}%` : "—"}</span>
                        </td>

                        {/* Temp */}
                        <td className="px-4 py-3 text-center hidden 2xl:table-cell">
                          {isOnline ? (
                            <span className={cn("text-sm font-semibold flex items-center justify-center gap-0.5",
                              temp >= 40 ? "text-red-400" : temp >= 35 ? "text-amber-400" : "text-foreground"
                            )}>
                              <Thermometer className="w-3 h-3" />{temp}°C
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Relatório">
                              <BarChart2 className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Visualizar">
                              <Tv2 className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Mais opções">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Pagination ──────────────────────────────────────────────────────── */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10 flex-wrap gap-2">
            <p className="text-[11px] text-muted-foreground">
              Mostrando {Math.min((safePage - 1) * perPage + 1, filtered.length)}{" "}
              a {Math.min(safePage * perPage, filtered.length)} de{" "}
              {filtered.length} tela{filtered.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="p-1 rounded border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pg = i + 1;
                  if (totalPages > 5 && safePage > 3) pg = safePage - 2 + i;
                  if (pg > totalPages) return null;
                  return (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      className={cn(
                        "min-w-[28px] h-7 rounded border text-xs font-medium transition-colors",
                        pg === safePage
                          ? "bg-primary text-primary-foreground border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      {pg}
                    </button>
                  );
                })}
                {totalPages > 5 && safePage < totalPages - 2 && (
                  <>
                    <span className="text-muted-foreground text-xs">…</span>
                    <button
                      onClick={() => setPage(totalPages)}
                      className="min-w-[28px] h-7 rounded border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="p-1 rounded border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>Itens por página:</span>
                <Select value={String(perPage)} onValueChange={v => { setPerPage(Number(v)); setPage(1); }}>
                  <SelectTrigger className="h-7 text-xs w-14 px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
