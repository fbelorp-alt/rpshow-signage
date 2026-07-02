import { useState, useMemo } from "react";
import { useListScreens } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Cpu, Wifi, WifiOff, AlertTriangle, Monitor, RefreshCw,
  Download, Search, X, ChevronRight, BarChart2,
  Pencil, MoreHorizontal, Zap, Terminal, Camera,
  Server, HardDrive, Thermometer, MemoryStick,
  LayoutList, LayoutGrid, Calendar,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtUptime(lastSeen: string | null, status: string): string {
  if (status !== "online" || !lastSeen) return "—";
  const diff = Date.now() - new Date(lastSeen).getTime();
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return "Nunca";
  const diff = Date.now() - new Date(lastSeen).getTime();
  if (diff < 60_000) return "Agora há pouco";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`;
  return `${Math.floor(diff / 86_400_000)}d atrás`;
}

function deviceId(code: string): string {
  return `PLR-${code.toUpperCase()}`;
}

function getDeviceType(tags: string | null): string {
  if (!tags) return "Player";
  const t = tags.toLowerCase();
  if (t.includes("receiver")) return "Receiver";
  if (t.includes("controller") || t.includes("controlador")) return "Controladora";
  return "Player";
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const data = values.length >= 2 ? values : [0, 0, ...values, ...Array(6).fill(values[0] ?? 0)];
  const max = Math.max(...data, 1);
  const w = 64, h = 24, pts = data.length;
  const points = data.map((v, i) => `${(i / (pts - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} className="flex-shrink-0 opacity-60">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type TabId = "resumo" | "informacoes" | "configuracoes";

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Devices() {
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "player" | "receiver" | "controladora">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [panelTab, setPanelTab]     = useState<TabId>("resumo");
  const [viewMode, setViewMode]     = useState<"list" | "grid">("list");

  const { data: screens, isLoading, refetch } = useListScreens();
  const { data: monData } = useQuery({
    queryKey: ["monitoring-devices"],
    queryFn: async () => {
      const r = await fetch("/api/monitoring", { credentials: "include" });
      return r.ok ? r.json() : null;
    },
    refetchInterval: 30_000,
  });

  // Enrich with monitoring screenshot data
  const monScreens: Record<string, any> = useMemo(() => {
    const map: Record<string, any> = {};
    ((monData as any)?.screens ?? []).forEach((s: any) => { map[s.code] = s; });
    return map;
  }, [monData]);

  const allDevices = useMemo(() => (screens ?? []).map(s => {
    const sx = s as any;
    return {
      ...sx,
      deviceType: getDeviceType(sx.tags ?? null),
      monData: monScreens[sx.code] ?? null,
    };
  }), [screens, monScreens]);

  const filtered = useMemo(() => {
    let list = allDevices;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q) || (d.location ?? "").toLowerCase().includes(q) || d.code.toLowerCase().includes(q));
    }
    if (typeFilter !== "all") list = list.filter(d => d.deviceType.toLowerCase() === typeFilter);
    return list;
  }, [allDevices, search, typeFilter]);

  const selected = allDevices.find(d => d.id === selectedId) ?? null;

  // ── KPI stats ──────────────────────────────────────────────────────────────
  const totalCount   = allDevices.length;
  const onlineList   = allDevices.filter(d => d.status === "online");
  const offlineList  = allDevices.filter(d => d.status === "offline");
  const alertList    = allDevices.filter(d => d.status === "unknown");
  const onlinePct    = totalCount > 0 ? Math.round((onlineList.length / totalCount) * 100) : 0;
  const offlinePct   = totalCount > 0 ? Math.round((offlineList.length / totalCount) * 100) : 0;

  // Counts by type for tabs
  const playerCount      = allDevices.filter(d => d.deviceType === "Player").length;
  const receiverCount    = allDevices.filter(d => d.deviceType === "Receiver").length;
  const controllerCount  = allDevices.filter(d => d.deviceType === "Controladora").length;

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dispositivos</h1>
          <p className="text-muted-foreground mt-1 text-sm">Monitore e gerencie todos os dispositivos conectados ao sistema.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="gap-2 text-xs">
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
        </div>
      </div>

      {/* ── KPI bar ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total */}
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3 lg:col-span-1">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Monitor className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total de Dispositivos</p>
            <p className="text-3xl font-black tabular-nums">{totalCount}</p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online {onlinePct}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive" /> Offline {offlinePct}%
              </span>
              {alertList.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Alerta {alertList.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Online */}
        <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider font-medium">Online</p>
            <p className="text-3xl font-black text-emerald-300 tabular-nums">{onlineList.length}</p>
            <p className="text-[10px] text-emerald-400/50">{onlinePct}% do total</p>
          </div>
          <MiniSparkline values={[0, 0, onlineList.length, onlineList.length, onlineList.length]} color="#10b981" />
        </div>

        {/* Offline */}
        <div className="bg-destructive/8 border border-destructive/20 rounded-xl p-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] text-destructive/70 uppercase tracking-wider font-medium">Offline</p>
            <p className="text-3xl font-black text-destructive tabular-nums">{offlineList.length}</p>
            <p className="text-[10px] text-destructive/50">{offlinePct}% do total</p>
          </div>
          <MiniSparkline values={[offlineList.length, offlineList.length, offlineList.length, 0, 0]} color="#ef4444" />
        </div>

        {/* Alerta */}
        <div className={cn("border rounded-xl p-4 flex items-center justify-between gap-2", alertList.length > 0 ? "bg-amber-500/8 border-amber-500/20" : "bg-card")}>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Com Alerta</p>
            <p className={cn("text-3xl font-black tabular-nums", alertList.length > 0 ? "text-amber-300" : "text-foreground")}>{alertList.length}</p>
            <p className="text-[10px] text-muted-foreground">{alertList.length > 0 ? "Requerem atenção" : "Tudo normal"}</p>
          </div>
          <MiniSparkline values={[alertList.length, alertList.length, 0, 0]} color="#f59e0b" />
        </div>

        {/* Firmware / Nunca visto */}
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
            <Cpu className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Firmware Desatualizado</p>
            <p className="text-3xl font-black tabular-nums">0</p>
            <p className="text-[10px] text-muted-foreground text-primary cursor-pointer hover:underline">Ver dispositivos</p>
          </div>
        </div>
      </div>

      {/* ── Main card: tabs + table ─────────────────────────────────── */}
      <div className="flex gap-5 items-start">
        {/* Table section */}
        <Card className={cn("overflow-hidden flex-1 transition-all", selected ? "lg:flex-[3]" : "")}>
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
            {/* Type tabs */}
            <div className="flex items-center gap-0 overflow-x-auto">
              {([
                { id: "all",          label: "Todos",         count: totalCount      },
                { id: "player",       label: "Players",       count: playerCount     },
                { id: "receiver",     label: "Receivers",     count: receiverCount   },
                { id: "controladora", label: "Controladoras", count: controllerCount },
              ] as { id: typeof typeFilter; label: string; count: number }[]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTypeFilter(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap mr-1",
                    typeFilter === t.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                  <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                    typeFilter === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>{t.count}</span>
                </button>
              ))}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Search + view mode */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar dispositivo..."
                className="h-8 pl-8 pr-8 text-xs w-52"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button onClick={() => setViewMode("list")} className={cn("p-1.5 transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                <LayoutList className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("grid")} className={cn("p-1.5 transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table */}
          {viewMode === "list" ? (
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="space-y-3 p-4">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <Monitor className="w-10 h-10 opacity-20" />
                  <p className="text-sm">Nenhum dispositivo encontrado</p>
                  {search && <button onClick={() => setSearch("")} className="text-xs text-primary hover:underline">Limpar busca</button>}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b">
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dispositivo</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Tela associada</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Uptime</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Versão</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden 2xl:table-cell">Última conexão</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(device => {
                      const isSelected = selectedId === device.id;
                      const isOnline   = device.status === "online";
                      const isAlert    = device.status === "unknown";
                      return (
                        <tr
                          key={device.id}
                          onClick={() => { setSelectedId(isSelected ? null : device.id); setPanelTab("resumo"); }}
                          className={cn(
                            "border-b cursor-pointer transition-colors",
                            isSelected ? "bg-primary/8 hover:bg-primary/10" : "hover:bg-muted/30"
                          )}
                        >
                          {/* Dispositivo */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border",
                                isOnline ? "bg-emerald-500/10 border-emerald-500/20" : isAlert ? "bg-amber-500/10 border-amber-500/20" : "bg-muted border-border"
                              )}>
                                <Monitor className={cn("w-4 h-4", isOnline ? "text-emerald-400" : isAlert ? "text-amber-400" : "text-muted-foreground")} />
                              </div>
                              <div>
                                <p className="font-semibold text-sm truncate max-w-[160px]">{device.name}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{deviceId(device.code)}</p>
                              </div>
                            </div>
                          </td>
                          {/* Tela */}
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <p className="text-sm text-muted-foreground">{device.location ?? "—"}</p>
                            <p className="text-[10px] text-muted-foreground/50">{device.resolution ? device.resolution.replace(/(\d+\.\d+)/g, (n: string) => String(Math.round(Number(n)))) : "—"}</p>
                          </td>
                          {/* Tipo */}
                          <td className="px-4 py-3 text-center">
                            <Badge variant="outline" className={cn("text-[10px] font-semibold",
                              device.deviceType === "Player"       ? "border-blue-500/30 text-blue-400 bg-blue-500/8" :
                              device.deviceType === "Receiver"     ? "border-violet-500/30 text-violet-400 bg-violet-500/8" :
                              "border-amber-500/30 text-amber-400 bg-amber-500/8"
                            )}>
                              {device.deviceType}
                            </Badge>
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3 text-center">
                            {isOnline ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                <Wifi className="w-3 h-3" /> Online
                              </span>
                            ) : isAlert ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3" /> Alerta
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-full">
                                <WifiOff className="w-3 h-3" /> Offline
                              </span>
                            )}
                          </td>
                          {/* Uptime */}
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <span className="text-xs font-mono text-muted-foreground">{fmtUptime(device.lastSeen as string | null, device.status)}</span>
                          </td>
                          {/* Versão */}
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <span className="text-xs text-muted-foreground">—</span>
                          </td>
                          {/* Última conexão */}
                          <td className="px-4 py-3 hidden 2xl:table-cell">
                            <span className="text-xs text-muted-foreground">{fmtLastSeen(device.lastSeen as string | null)}</span>
                          </td>
                          {/* Ações */}
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Link href={`/screens/${device.id}`}>
                                <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Detalhes">
                                  <BarChart2 className="w-3.5 h-3.5" />
                                </button>
                              </Link>
                              <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Mais ações">
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Pagination info */}
              {!isLoading && filtered.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
                  <span>Mostrando 1 a {filtered.length} de {filtered.length} dispositivo{filtered.length !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
          ) : (
            /* Grid view */
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map(device => {
                const isOnline = device.status === "online";
                const isAlert  = device.status === "unknown";
                return (
                  <div
                    key={device.id}
                    onClick={() => { setSelectedId(selectedId === device.id ? null : device.id); setPanelTab("resumo"); }}
                    className={cn(
                      "border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md",
                      selectedId === device.id ? "border-primary/50 bg-primary/5" : "bg-card hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center border",
                        isOnline ? "bg-emerald-500/10 border-emerald-500/20" : isAlert ? "bg-amber-500/10 border-amber-500/20" : "bg-muted border-border"
                      )}>
                        <Monitor className={cn("w-5 h-5", isOnline ? "text-emerald-400" : isAlert ? "text-amber-400" : "text-muted-foreground")} />
                      </div>
                      {isOnline ? (
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /> Online
                        </span>
                      ) : isAlert ? (
                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">Alerta</span>
                      ) : (
                        <span className="text-[9px] font-bold text-destructive bg-destructive/10 border border-destructive/20 px-1.5 py-0.5 rounded-full">Offline</span>
                      )}
                    </div>
                    <p className="font-semibold text-sm truncate">{device.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{deviceId(device.code)}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">{device.location ?? "Sem localização"}</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <Badge variant="outline" className="text-[9px]">{device.deviceType}</Badge>
                      <span className="text-[9px] text-muted-foreground">{fmtLastSeen(device.lastSeen as string | null)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── Side panel ───────────────────────────────────────────── */}
        {selected && (
          <div className="w-80 shrink-0">
            <Card className="sticky top-4">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    selected.status === "online" ? "bg-emerald-500 animate-pulse" : selected.status === "unknown" ? "bg-amber-400" : "bg-destructive"
                  )} />
                  <span className="font-semibold text-sm truncate max-w-[160px]">{selected.name}</span>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Device info summary */}
              <div className="px-4 py-3 border-b bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center border",
                    selected.status === "online" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-muted border-border"
                  )}>
                    <Monitor className={cn("w-6 h-6", selected.status === "online" ? "text-emerald-400" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{selected.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{deviceId(selected.code)}</p>
                    <p className="text-[10px] text-muted-foreground">ID: {selected.code}</p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b">
                {(["resumo", "informacoes", "configuracoes"] as TabId[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setPanelTab(t)}
                    className={cn(
                      "flex-1 py-2.5 text-[11px] font-medium transition-colors capitalize",
                      panelTab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t === "resumo" ? "Resumo" : t === "informacoes" ? "Informações" : "Configurações"}
                  </button>
                ))}
              </div>

              <div className="overflow-y-auto max-h-[calc(100vh-380px)]">
                {panelTab === "resumo" && (
                  <div className="divide-y">
                    {/* Informações Gerais */}
                    <div className="px-4 py-3 space-y-2.5">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Informações Gerais</p>
                      {[
                        { label: "Tipo",            value: getDeviceType(selected.tags ?? null)                     },
                        { label: "Modelo",           value: "Android TV Player"                                      },
                        { label: "Versão do Firmware", value: "—"                                                   },
                        { label: "IP",               value: "—"                                                     },
                        { label: "MAC Address",      value: "—"                                                     },
                        { label: "Localização",      value: selected.location ?? "—"                                 },
                        { label: "Resolução",        value: selected.resolution ? selected.resolution.replace(/(\d+\.\d+)/g, (n: string) => String(Math.round(Number(n)))) : "—" },
                        { label: "Data de Instalação", value: new Date(selected.createdAt as string).toLocaleDateString("pt-BR") },
                      ].map(row => (
                        <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground shrink-0">{row.label}</span>
                          <span className="font-medium text-right truncate max-w-[140px]">{row.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Status do Sistema */}
                    <div className="px-4 py-3 space-y-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status do Sistema</p>
                      {[
                        { label: "CPU",            icon: Cpu,         value: selected.status === "online" ? 35 : null, color: "bg-blue-500"    },
                        { label: "Memória",         icon: MemoryStick, value: selected.status === "online" ? 48 : null, color: "bg-violet-500"  },
                        { label: "Armazenamento",  icon: HardDrive,   value: selected.status === "online" ? 62 : null, color: "bg-amber-500"   },
                        { label: "Temperatura",    icon: Thermometer, value: null, extra: selected.status === "online" ? "42°C" : "—", color: "bg-emerald-500" },
                      ].map(row => (
                        <div key={row.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <row.icon className="w-3 h-3" /> {row.label}
                            </span>
                            <span className="font-bold tabular-nums">
                              {row.extra ?? (row.value !== null ? `${row.value}%` : "—")}
                            </span>
                          </div>
                          {row.value !== null && (
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${row.value}%` }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Ações Rápidas */}
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Ações Rápidas</p>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: "Reiniciar",    icon: RefreshCw, action: () => {} },
                          { label: "Atualizar",    icon: Zap,       action: () => {} },
                          { label: "Logs",         icon: Terminal,  action: () => {} },
                          { label: "Captura",      icon: Camera,    action: () => window.location.href = "/monitoring" },
                        ].map(a => (
                          <button
                            key={a.label}
                            onClick={a.action}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <a.icon className="w-4 h-4" />
                            <span className="text-[9px] font-medium">{a.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Screenshot preview */}
                      {(selected.lastScreenshot || selected.monData?.lastScreenshot) && (
                        <div className="mt-3 rounded-lg overflow-hidden border aspect-video bg-muted">
                          <img
                            src={(() => {
                              const p = selected.lastScreenshot ?? selected.monData?.lastScreenshot;
                              if (!p) return "";
                              if ((p as string).startsWith("http")) return p as string;
                              if ((p as string).startsWith("/objects/")) return `/api/storage${p}`;
                              return p as string;
                            })()}
                            alt="Captura de tela"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>

                    {/* Ver detalhes link */}
                    <div className="px-4 py-3">
                      <Link href={`/screens/${selected.id}`}>
                        <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                          Ver detalhes completos <ChevronRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                {panelTab === "informacoes" && (
                  <div className="px-4 py-3 space-y-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Dados do Dispositivo</p>
                    {[
                      { label: "Código de Pareamento", value: selected.code },
                      { label: "Nome",                  value: selected.name },
                      { label: "Localização",           value: selected.location ?? "—" },
                      { label: "Resolução",             value: selected.resolution ? selected.resolution.replace(/(\d+\.\d+)/g, (n: string) => String(Math.round(Number(n)))) : "—" },
                      { label: "Playlist Padrão",       value: (selected as any).defaultPlaylistName ?? "—" },
                      { label: "Playlist Ativa",        value: (selected as any).activePlaylistName ?? "—" },
                      { label: "Exibições Hoje",        value: String((selected as any).playsToday ?? 0) },
                      { label: "Ligado",                value: selected.powerOnTime ?? "—" },
                      { label: "Desligado",             value: selected.powerOffTime ?? "—" },
                      { label: "Fuso Horário",          value: (selected as any).timezone ?? "America/Sao_Paulo" },
                      { label: "Bloqueado",             value: (selected as any).blocked ? "Sim" : "Não" },
                      { label: "Cadastrado em",         value: new Date(selected.createdAt as string).toLocaleDateString("pt-BR") },
                      { label: "Última conexão",        value: fmtLastSeen(selected.lastSeen as string | null) },
                    ].map(row => (
                      <div key={row.label} className="flex items-start justify-between gap-2 text-xs">
                        <span className="text-muted-foreground shrink-0 pt-0.5">{row.label}</span>
                        <span className="font-medium text-right break-all max-w-[150px]">{row.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {panelTab === "configuracoes" && (
                  <div className="px-4 py-6 text-center text-muted-foreground space-y-2">
                    <Server className="w-8 h-8 mx-auto opacity-20" />
                    <p className="text-sm font-medium">Configurações remotas</p>
                    <p className="text-xs opacity-60">Acesse os detalhes completos da tela para configurar o dispositivo remotamente.</p>
                    <Link href={`/screens/${selected.id}`}>
                      <Button size="sm" variant="outline" className="mt-2 gap-2 text-xs">
                        <Calendar className="w-3.5 h-3.5" /> Abrir tela
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
