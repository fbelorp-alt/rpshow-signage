import { useState, useMemo } from "react";
import { useListScreens } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Cpu, Wifi, WifiOff, AlertTriangle, Monitor, RefreshCw,
  Download, Search, X, ChevronRight, BarChart2,
  Pencil, MoreHorizontal, Zap, Terminal, Camera,
  Server, HardDrive, Thermometer, MemoryStick,
  LayoutList, LayoutGrid, Settings,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtUptime(lastSeen: string | null, status: string) {
  if (status !== "online" || !lastSeen) return null;
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

function uptimePct(lastSeen: string | null, status: string, createdAt: string): number | null {
  if (status !== "online") return null;
  if (!lastSeen) return null;
  const ageDays = Math.max(1, (Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  const offlineDays = (Date.now() - new Date(lastSeen).getTime()) / 86_400_000;
  return Math.min(99.9, Math.max(0, Math.round(((ageDays - offlineDays) / ageDays) * 1000) / 10));
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const pts = Math.max(values.length, 7);
  const padded = [...Array(pts - values.length).fill(values[0] ?? 0), ...values];
  const max = Math.max(...padded, 1);
  const w = 72, h = 28;
  const points = padded.map((v, i) => `${(i / (pts - 1)) * w},${h - (v / max) * (h - 6) - 3}`).join(" ");
  return (
    <svg width={w} height={h} className="opacity-70 shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
    queryFn: async () => { const r = await fetch("/api/monitoring", { credentials: "include" }); return r.ok ? r.json() : null; },
    refetchInterval: 30_000,
  });

  const { data: clientsData } = useQuery({
    queryKey: ["clients-for-devices"],
    queryFn: async () => { const r = await fetch("/api/clients", { credentials: "include" }); return r.ok ? r.json() : []; },
    staleTime: 60_000,
  });

  const clientMap = useMemo(() => {
    const m = new Map<number, { name: string; city?: string }>();
    (clientsData as any[] ?? []).forEach((c: any) => {
      m.set(c.id, { name: c.name ?? c.companyName ?? "Cliente", city: c.city ?? c.address ?? "" });
    });
    return m;
  }, [clientsData]);

  const monScreens: Record<string, any> = useMemo(() => {
    const map: Record<string, any> = {};
    ((monData as any)?.screens ?? []).forEach((s: any) => { map[s.code] = s; });
    return map;
  }, [monData]);

  const allDevices = useMemo(() => (screens ?? []).map(s => {
    const sx = s as any;
    const client = sx.clientId ? clientMap.get(sx.clientId) : null;
    return {
      ...sx,
      deviceType: getDeviceType(sx.tags ?? null),
      monData: monScreens[sx.code] ?? null,
      clientName: client?.name ?? null,
      clientCity: client?.city ?? null,
    };
  }), [screens, monScreens, clientMap]);

  const filtered = useMemo(() => {
    let list = allDevices;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        (d.location ?? "").toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        (d.clientName ?? "").toLowerCase().includes(q)
      );
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
  const alertPct     = totalCount > 0 ? Math.round((alertList.length  / totalCount) * 100) : 0;
  const playerCount  = allDevices.filter(d => d.deviceType === "Player").length;
  const receiverCount = allDevices.filter(d => d.deviceType === "Receiver").length;
  const controllerCount = allDevices.filter(d => d.deviceType === "Controladora").length;

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dispositivos</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Monitore e gerencie todos os dispositivos conectados ao sistema.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar dispositivo..." className="h-9 pl-8 pr-8 text-xs w-52" />
            {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>}
          </div>
          <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => refetch()} title="Atualizar">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" className="h-9 gap-2 text-xs">
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
        </div>
      </div>

      {/* ── KPI bar ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">

        {/* Total */}
        <div className="bg-card border rounded-xl p-4 col-span-2 lg:col-span-1">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Monitor className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium leading-none mb-1">Total de Dispositivos</p>
              <p className="text-4xl font-black tabular-nums leading-none">{totalCount}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            <span className="flex items-center gap-1 text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /><span className="text-muted-foreground">Online</span> <span className="font-bold">{onlineList.length} ({onlinePct}%)</span></span>
            <span className="flex items-center gap-1 text-[10px]"><WifiOff className="w-2.5 h-2.5 text-destructive" /><span className="text-muted-foreground">Offline</span> <span className="font-bold text-destructive">{offlineList.length}</span></span>
            {alertList.length > 0 && <span className="flex items-center gap-1 text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /><span className="text-muted-foreground">Alerta</span> <span className="font-bold text-amber-400">{alertList.length}</span></span>}
          </div>
        </div>

        {/* Online */}
        <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider font-medium">Online</p>
            <p className="text-4xl font-black text-emerald-300 tabular-nums leading-tight">{onlineList.length}</p>
            <p className="text-[10px] text-emerald-400/60 mt-1">{onlinePct}% do total</p>
          </div>
          <MiniSparkline values={[onlineList.length * 0.7, onlineList.length * 0.8, onlineList.length * 0.9, onlineList.length, onlineList.length]} color="#10b981" />
        </div>

        {/* Offline */}
        <div className="bg-destructive/8 border border-destructive/20 rounded-xl p-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] text-destructive/70 uppercase tracking-wider font-medium">Offline</p>
            <p className="text-4xl font-black text-destructive tabular-nums leading-tight">{offlineList.length}</p>
            <p className="text-[10px] text-destructive/60 mt-1">{offlinePct}% do total</p>
          </div>
          <MiniSparkline values={[offlineList.length, offlineList.length * 1.2, offlineList.length * 0.8, offlineList.length, offlineList.length * 1.1]} color="#ef4444" />
        </div>

        {/* Com Alerta */}
        <div className={cn("border rounded-xl p-4 flex items-center justify-between gap-2", alertList.length > 0 ? "bg-amber-500/8 border-amber-500/20" : "bg-card")}>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Com Alerta</p>
            <p className={cn("text-4xl font-black tabular-nums leading-tight", alertList.length > 0 ? "text-amber-300" : "")}>{alertList.length}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{alertPct}% do total</p>
          </div>
          <MiniSparkline values={[alertList.length * 1.2, alertList.length, alertList.length * 0.8, alertList.length * 1.1, alertList.length]} color="#f59e0b" />
        </div>

        {/* Firmware */}
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
            <Cpu className="w-7 h-7 text-violet-400" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium leading-none mb-1">Firmware Desatualizado</p>
            <p className="text-4xl font-black tabular-nums leading-none">0</p>
            <p className="text-[10px] text-primary cursor-pointer hover:underline mt-1">Ver dispositivos</p>
          </div>
        </div>
      </div>

      {/* ── Table area ─────────────────────────────────────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* Main table card */}
        <Card className={cn("flex-1 overflow-hidden min-w-0 transition-all", selected ? "lg:max-w-[calc(100%-340px)]" : "")}>

          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b flex-wrap bg-card">
            {([
              { id: "all",          label: "Todos",         count: totalCount       },
              { id: "player",       label: "Players",       count: playerCount      },
              { id: "receiver",     label: "Receivers",     count: receiverCount    },
              { id: "controladora", label: "Controladoras", count: controllerCount  },
            ] as { id: typeof typeFilter; label: string; count: number }[]).map(t => (
              <button
                key={t.id}
                onClick={() => setTypeFilter(t.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap",
                  typeFilter === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[22px] text-center",
                  typeFilter === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>{t.count}</span>
              </button>
            ))}
            <div className="flex-1" />
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button onClick={() => setViewMode("list")} className={cn("p-1.5 transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} title="Lista">
                <LayoutList className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("grid")} className={cn("p-1.5 transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} title="Grade">
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List view */}
          {viewMode === "list" ? (
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />)}</div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <Monitor className="w-10 h-10 opacity-20" />
                  <p className="text-sm">Nenhum dispositivo encontrado</p>
                  {search && <button onClick={() => setSearch("")} className="text-xs text-primary hover:underline">Limpar busca</button>}
                </div>
              ) : (
                <table className="w-full text-sm min-w-[820px]">
                  <thead>
                    <tr className="bg-muted/30 border-b">
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dispositivo</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Cliente</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Tela associada</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Uptime</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Versão</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">IP</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Última conexão</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(device => {
                      const isSelected = selectedId === device.id;
                      const isOnline   = device.status === "online";
                      const isAlert    = device.status === "unknown";
                      const uptime     = fmtUptime(device.lastSeen as string | null, device.status);
                      const uptPct     = uptimePct(device.lastSeen as string | null, device.status, device.createdAt as string);
                      const statusSub  = isOnline ? `${uptPct ?? 99.9}%` : isAlert ? "Nunca conectado" : "Sem conexão";
                      return (
                        <tr
                          key={device.id}
                          onClick={() => { setSelectedId(isSelected ? null : device.id); setPanelTab("resumo"); }}
                          className={cn(
                            "border-b cursor-pointer transition-colors",
                            isSelected ? "bg-primary/8 hover:bg-primary/10" : "hover:bg-muted/25"
                          )}
                        >
                          {/* Dispositivo */}
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border text-xs font-bold",
                                isOnline ? "bg-slate-800 border-slate-600" : isAlert ? "bg-slate-800 border-amber-500/30" : "bg-slate-800/50 border-slate-700"
                              )}>
                                <Monitor className="w-5 h-5 text-slate-400" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm leading-tight">{device.name}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">ID: {deviceId(device.code)}</p>
                              </div>
                            </div>
                          </td>
                          {/* Cliente */}
                          <td className="px-4 py-2.5 hidden lg:table-cell">
                            {device.clientName ? (
                              <div>
                                <p className="text-sm font-medium">{device.clientName}</p>
                                {device.clientCity && <p className="text-[10px] text-muted-foreground">{device.clientCity}</p>}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          {/* Tela associada */}
                          <td className="px-4 py-2.5 hidden xl:table-cell">
                            <p className="text-sm text-foreground">{device.location ?? "—"}</p>
                            <p className="text-[10px] text-muted-foreground">{device.resolution ?? "—"}</p>
                          </td>
                          {/* Tipo */}
                          <td className="px-4 py-2.5 text-center">
                            <Badge variant="outline" className={cn("text-[10px] font-semibold whitespace-nowrap",
                              device.deviceType === "Player"       ? "border-blue-500/30 text-blue-400 bg-blue-500/8" :
                              device.deviceType === "Receiver"     ? "border-violet-500/30 text-violet-400 bg-violet-500/8" :
                              "border-amber-500/30 text-amber-400 bg-amber-500/8"
                            )}>
                              {device.deviceType}
                            </Badge>
                          </td>
                          {/* Status */}
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col gap-0.5">
                              {isOnline ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full w-fit">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Online
                                </span>
                              ) : isAlert ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full w-fit">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Alerta
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-full w-fit">
                                  <WifiOff className="w-2.5 h-2.5" /> Offline
                                </span>
                              )}
                              <span className={cn("text-[9px] pl-0.5", isOnline ? "text-emerald-400/60" : "text-muted-foreground/60")}>{statusSub}</span>
                            </div>
                          </td>
                          {/* Uptime */}
                          <td className="px-4 py-2.5 hidden xl:table-cell">
                            <p className="text-xs font-mono text-foreground">{uptime ?? "—"}</p>
                            {uptPct !== null && <p className="text-[9px] text-emerald-400/70">{uptPct}%</p>}
                          </td>
                          {/* Versão */}
                          <td className="px-4 py-2.5 hidden xl:table-cell">
                            <p className="text-xs text-muted-foreground">—</p>
                            <p className={cn("text-[9px]", isOnline ? "text-emerald-400" : "text-muted-foreground/50")}>
                              {isOnline ? "Atualizado" : "—"}
                            </p>
                          </td>
                          {/* IP */}
                          <td className="px-4 py-2.5 hidden lg:table-cell">
                            <span className="text-xs font-mono text-muted-foreground">—</span>
                          </td>
                          {/* Última conexão */}
                          <td className="px-4 py-2.5 hidden lg:table-cell">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtLastSeen(device.lastSeen as string | null)}</span>
                          </td>
                          {/* Ações */}
                          <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-0.5">
                              <Link href={`/screens/${device.id}`}>
                                <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Relatórios">
                                  <BarChart2 className="w-3.5 h-3.5" />
                                </button>
                              </Link>
                              <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Mais opções">
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
              {!isLoading && filtered.length > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t text-xs text-muted-foreground bg-muted/10">
                  <span>Mostrando 1 a {filtered.length} de {filtered.length} dispositivo{filtered.length !== 1 ? "s" : ""}</span>
                  <span>Itens por página: 10</span>
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
                      "border rounded-xl p-3.5 cursor-pointer transition-all hover:shadow-md",
                      selectedId === device.id ? "border-primary/50 bg-primary/5" : "bg-card hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center">
                        <Monitor className="w-5 h-5 text-slate-400" />
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
                    <p className="text-[10px] text-muted-foreground font-mono">ID: {deviceId(device.code)}</p>
                    {device.clientName && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{device.clientName}</p>}
                    <p className="text-[10px] text-muted-foreground truncate">{device.location ?? "Sem localização"}</p>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t">
                      <Badge variant="outline" className="text-[9px]">{device.deviceType}</Badge>
                      <span className="text-[9px] text-muted-foreground">{fmtLastSeen(device.lastSeen as string | null)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── Side panel ───────────────────────────────────────────────────── */}
        {selected && (
          <div className="w-[320px] shrink-0">
            <Card className="sticky top-4 overflow-hidden">

              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/10">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("w-2 h-2 rounded-full shrink-0",
                    selected.status === "online" ? "bg-emerald-500 shadow-[0_0_6px_#10b981] animate-pulse" :
                    (selected as any).status === "unknown" ? "bg-amber-400" : "bg-destructive"
                  )} />
                  <span className="font-bold text-sm truncate">{selected.name}</span>
                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0",
                    selected.status === "online" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                    (selected as any).status === "unknown" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                    "text-destructive bg-destructive/10 border-destructive/20"
                  )}>
                    {selected.status === "online" ? "Online" : (selected as any).status === "unknown" ? "Alerta" : "Offline"}
                  </span>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground shrink-0 ml-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Device mini-header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/5">
                <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center shrink-0">
                  <Monitor className="w-6 h-6 text-slate-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm leading-tight">{selected.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">ID: {deviceId(selected.code)}</p>
                  {(selected as any).clientName && <p className="text-[10px] text-muted-foreground truncate">{(selected as any).clientName}</p>}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b">
                {(["resumo", "informacoes", "configuracoes"] as TabId[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setPanelTab(t)}
                    className={cn(
                      "flex-1 py-2.5 text-[11px] font-medium transition-colors",
                      panelTab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t === "resumo" ? "Resumo" : t === "informacoes" ? "Informações" : "Configurações"}
                  </button>
                ))}
              </div>

              <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 360px)" }}>

                {/* ── Resumo ── */}
                {panelTab === "resumo" && (
                  <div className="divide-y">

                    {/* Informações Gerais */}
                    <div className="px-4 py-3 space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Informações Gerais</p>
                      {[
                        { label: "Tipo",              value: getDeviceType((selected as any).tags ?? null) },
                        { label: "Modelo",            value: "Android TV Player" },
                        { label: "Versão do Firmware",value: <span className="text-muted-foreground">—</span> },
                        { label: "IP",                value: <span className="text-muted-foreground font-mono">—</span> },
                        { label: "MAC Address",       value: <span className="text-muted-foreground font-mono">—</span> },
                        { label: "Cliente",           value: (selected as any).clientName ?? <span className="text-muted-foreground">—</span> },
                        { label: "Localização",       value: selected.location ?? <span className="text-muted-foreground">—</span> },
                        { label: "Data de Instalação",value: new Date(selected.createdAt as string).toLocaleDateString("pt-BR") },
                      ].map(row => (
                        <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground shrink-0">{row.label}</span>
                          <span className="font-medium text-right truncate max-w-[150px]">{row.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Status do Sistema */}
                    <div className="px-4 py-3 space-y-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status do Sistema</p>
                      {[
                        { label: "CPU",           icon: Cpu,         value: selected.status === "online" ? 35 : null, color: "bg-blue-500"   },
                        { label: "Memória",       icon: MemoryStick, value: selected.status === "online" ? 48 : null, color: "bg-violet-500" },
                        { label: "Armazenamento", icon: HardDrive,   value: selected.status === "online" ? 62 : null, color: "bg-amber-500"  },
                        { label: "Temperatura",   icon: Thermometer, value: null, extra: selected.status === "online" ? "42°C" : "—", color: "bg-emerald-500" },
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
                              <div className={cn("h-full rounded-full", row.color)} style={{ width: `${row.value}%` }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Ações Rápidas */}
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Ações Rápidas</p>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {[
                          { label: "Reiniciar", icon: RefreshCw, action: () => {} },
                          { label: "Atualizar", icon: Zap,       action: () => {} },
                          { label: "Logs",      icon: Terminal,  action: () => {} },
                        ].map(a => (
                          <button
                            key={a.label}
                            onClick={a.action}
                            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <a.icon className="w-4 h-4" />
                            <span className="text-[9px] font-medium">{a.label}</span>
                          </button>
                        ))}
                      </div>
                      {/* Captura de Tela — botão largo separado */}
                      <button
                        onClick={() => window.location.href = "/monitoring"}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground text-xs font-medium"
                      >
                        <Camera className="w-4 h-4" /> Captura de Tela
                      </button>

                      {/* Screenshot preview */}
                      {((selected as any).lastScreenshot || (selected as any).monData?.lastScreenshot) && (
                        <div className="mt-3 rounded-lg overflow-hidden border aspect-video bg-muted">
                          <img
                            src={(() => {
                              const p = (selected as any).lastScreenshot ?? (selected as any).monData?.lastScreenshot;
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

                    {/* Ver detalhes */}
                    <div className="px-4 py-3">
                      <Link href={`/screens/${selected.id}`}>
                        <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                          Ver detalhes completos <ChevronRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                {/* ── Informações ── */}
                {panelTab === "informacoes" && (
                  <div className="px-4 py-3 space-y-2.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Dados do Dispositivo</p>
                    {[
                      { label: "Código de Pareamento", value: selected.code },
                      { label: "Nome",                  value: selected.name },
                      { label: "Localização",           value: selected.location ?? "—" },
                      { label: "Resolução",             value: (selected as any).resolution ?? "—" },
                      { label: "Playlist Padrão",       value: (selected as any).defaultPlaylistName ?? "—" },
                      { label: "Playlist Ativa",        value: (selected as any).activePlaylistName ?? "—" },
                      { label: "Exibições Hoje",        value: String((selected as any).playsToday ?? 0) },
                      { label: "Ligado às",             value: (selected as any).powerOnTime ?? "—" },
                      { label: "Desligado às",          value: (selected as any).powerOffTime ?? "—" },
                      { label: "Fuso Horário",          value: (selected as any).timezone ?? "America/Sao_Paulo" },
                      { label: "Bloqueado",             value: (selected as any).blocked ? "Sim" : "Não" },
                      { label: "Cadastrado em",         value: new Date(selected.createdAt as string).toLocaleDateString("pt-BR") },
                      { label: "Última conexão",        value: fmtLastSeen(selected.lastSeen as string | null) },
                    ].map(row => (
                      <div key={row.label} className="flex items-start justify-between gap-2 text-xs">
                        <span className="text-muted-foreground shrink-0 pt-0.5">{row.label}</span>
                        <span className="font-medium text-right break-all max-w-[160px]">{row.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Configurações ── */}
                {panelTab === "configuracoes" && (
                  <div className="px-4 py-6 text-center text-muted-foreground space-y-2">
                    <Settings className="w-8 h-8 mx-auto opacity-20" />
                    <p className="text-sm font-medium">Configurações remotas</p>
                    <p className="text-xs opacity-60">Acesse os detalhes completos da tela para configurar o dispositivo remotamente.</p>
                    <Link href={`/screens/${selected.id}`}>
                      <Button size="sm" variant="outline" className="mt-3 gap-2 text-xs">
                        Abrir configurações <ChevronRight className="w-3 h-3" />
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
