import { useState, useEffect, useMemo } from "react";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import {
  Monitor, Play, AlertTriangle, Wifi, WifiOff, MapPin,
  Calendar, Server, RefreshCw, LayoutDashboard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── helpers ───────────────────────────────────────────────────────────────────

function resolveScreenshot(p: string | null) {
  if (!p) return null;
  if (p.startsWith("http")) return p;
  if (p.startsWith("/objects/")) return `/api/storage${p}`;
  return p;
}

function timeAgo(iso: string | null) {
  if (!iso) return "nunca";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.floor(d)}s`;
  if (d < 3600) return `${Math.floor(d / 60)}min`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

const GRADS = [
  "from-green-700 to-emerald-400",
  "from-green-900 to-green-500",
  "from-teal-800 to-emerald-400",
  "from-emerald-800 to-green-400",
  "from-green-800 to-teal-400",
  "from-teal-900 to-green-400",
  "from-emerald-900 to-teal-400",
  "from-green-700 to-teal-500",
];

// ── Live clock ────────────────────────────────────────────────────────────────

function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const date = t.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  const time = t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" });
  return (
    <div className="text-right hidden sm:block">
      <p className="text-xs font-medium text-white/60">{date}</p>
      <p className="text-xl font-bold tabular-nums text-white tracking-tight">{time}</p>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon,
}: {
  label: string; value: React.ReactNode; sub?: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl p-4 flex items-center justify-between gap-4 border border-border bg-card shadow-sm">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-1 text-muted-foreground">{label}</p>
        <p className="text-3xl font-black tabular-nums tracking-tight text-foreground">{value}</p>
        {sub && <p className="text-xs mt-1 text-muted-foreground">{sub}</p>}
      </div>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-primary/10">
        <Icon className="w-6 h-6 text-primary" />
      </div>
    </div>
  );
}

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutChart({ online, offline }: { online: number; offline: number }) {
  const total = online + offline;
  const data = [
    { name: "Online",  value: online,  color: "#16a34a" },
    { name: "Offline", value: offline, color: "#ef4444" },
  ].filter(d => d.value > 0);
  const pct = (n: number) => total > 0 ? Math.round(n / total * 100) : 0;

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative w-28 h-28 flex-shrink-0">
        <ResponsiveContainer width={112} height={112}>
          <PieChart>
            <Pie
              data={data.length ? data : [{ value: 1, color: "#e5e7eb" }]}
              cx={52} cy={52} innerRadius={36} outerRadius={52}
              paddingAngle={2} dataKey="value" strokeWidth={0}
            >
              {(data.length ? data : [{ color: "#e5e7eb" }]).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-foreground">{total}</span>
          <span className="text-[10px] text-muted-foreground">Total</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {[
          { label: "Online",     color: "#16a34a", count: online,  p: pct(online) },
          { label: "Offline",    color: "#ef4444", count: offline, p: pct(offline) },
          { label: "Manutenção", color: "#f59e0b", count: 0,       p: 0 },
        ].map(row => (
          <div key={row.label} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0 last:pb-0">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
              {row.label}
            </span>
            <span className="font-semibold text-foreground">
              {row.count} <span className="text-muted-foreground font-normal text-xs">({row.p}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Screen tile ───────────────────────────────────────────────────────────────

type Tile = { id: number; imgUrl: string | null; grad: string; name: string; location: string; status: string };

function ScreenTile({ tile }: { tile: Tile }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = tile.imgUrl && !imgFailed;
  return (
    <Link href="/screens">
      <div className="rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-primary/40 transition-all cursor-pointer bg-card">
        <div className={cn("h-20 flex items-center justify-center relative overflow-hidden",
          !showImg && `bg-gradient-to-br ${tile.grad}`)}>
          {showImg ? (
            <img src={tile.imgUrl!} alt={tile.name}
              className="w-full h-full object-cover"
              onError={() => setImgFailed(true)} />
          ) : (
            <span className="text-[10px] font-bold text-white text-center px-2 leading-tight drop-shadow">
              {tile.name}
            </span>
          )}
        </div>
        <div className="p-2">
          <p className="text-xs font-semibold text-foreground truncate">{tile.name}</p>
          <p className="text-[10px] text-muted-foreground truncate mb-1.5">{tile.location}</p>
          {tile.status === "online" ? (
            <Badge variant="outline" className="text-[9px] h-4 gap-1 text-emerald-700 border-emerald-200 bg-emerald-50 px-1.5">
              <Wifi className="w-2 h-2" /> Online
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] h-4 gap-1 text-red-600 border-red-200 bg-red-50 px-1.5">
              <WifiOff className="w-2 h-2" /> Offline
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Card wrapper com borda verde ──────────────────────────────────────────────

function GCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card rounded-2xl border border-border shadow-sm overflow-hidden", className)}>
      {children}
    </div>
  );
}

function GCardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries();
    setTimeout(() => setRefreshing(false), 800);
  };

  const { data: stats } = useGetDashboardStats();
  const { data: monitoring } = useQuery({
    queryKey: ["monitoring-dashboard"],
    queryFn: () => fetch("/api/monitoring", { credentials: "include" }).then(r => r.json()).catch(() => null),
    refetchInterval: 30_000,
  });
  const { data: schedulesRaw = [] } = useQuery<any[]>({
    queryKey: ["schedules-dashboard"],
    queryFn: () => fetch("/api/schedules", { credentials: "include" }).then(r => r.json()).catch(() => []),
    refetchInterval: 60_000,
  });

  const s = stats as any;
  const monScreens: any[] = monitoring?.screens ?? [];

  const online  = monScreens.filter(x => x.status === "online").length;
  const offline = monScreens.filter(x => x.status !== "online").length;
  const alerts  = monScreens.filter(x => {
    if (x.status === "never") return true;
    if (x.status === "offline" && x.lastSeen)
      return (Date.now() - new Date(x.lastSeen).getTime()) > 7_200_000;
    return false;
  }).length;

  const locations = useMemo(() => {
    const map: Record<string, { total: number; online: number }> = {};
    for (const sc of monScreens) {
      const city = (sc.location ?? "Outros").split(/[-–,]/)[0].trim() || "Outros";
      if (!map[city]) map[city] = { total: 0, online: 0 };
      map[city].total++;
      if (sc.status === "online") map[city].online++;
    }
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  }, [monScreens]);

  const tiles = useMemo(() => {
    if (monScreens.length === 0) return [];
    return [...monScreens]
      .sort((a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""))
      .slice(0, 6)
      .map((sc, i) => ({
        id: sc.id,
        imgUrl: resolveScreenshot(sc.lastScreenshot),
        grad: GRADS[i % GRADS.length],
        name: sc.name,
        location: sc.location ?? "—",
        status: sc.status === "online" ? "online" : sc.status === "never" ? "never" : "offline",
      }));
  }, [monScreens]);

  const todaySchedules = useMemo(() =>
    schedulesRaw.filter((x: any) => x.active !== false).slice(0, 5), [schedulesRaw]);

  const alertList = useMemo(() =>
    monScreens.filter(x => {
      if (x.status === "never") return true;
      if (x.status === "offline" && x.lastSeen)
        return (Date.now() - new Date(x.lastSeen).getTime()) > 7_200_000;
      return false;
    }).slice(0, 4), [monScreens]);

  const totalScreens   = monitoring?.summary?.totalScreens ?? monScreens.length;
  const totalPlaylists = s?.totalPlaylists ?? 0;
  const playsToday     = s?.playsToday ?? 0;

  return (
    <div className="space-y-5 -m-4 sm:-m-6">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="border-b bg-card px-6 pt-5 pb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Dashboard</h1>
              <p className="text-xs text-muted-foreground">Visão geral do sistema de monitoramento</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-foreground text-xs font-medium transition-all disabled:opacity-60"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
              {refreshing ? "Atualizando…" : "Atualizar"}
            </button>
            <LiveClock />
          </div>
        </div>

        {/* KPI cards */}
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Total de Telas" value={totalScreens} icon={Monitor}
            sub={<><span className="text-emerald-700 font-medium">Online: {online}</span> · <span className="text-red-600">Offline: {offline}</span></>}
          />
          <KpiCard
            label="Playlists Ativas" value={totalPlaylists} icon={Play}
            sub="Conteúdo em exibição"
          />
          <KpiCard
            label="Alertas Ativos" value={alerts} icon={AlertTriangle}
            sub={alerts > 0 ? "Requerem atenção" : "Tudo normal"}
          />
          <KpiCard
            label="Exibições Hoje" value={playsToday.toLocaleString("pt-BR")} icon={Play}
            sub={totalScreens > 0 ? `~${Math.round(playsToday / totalScreens).toLocaleString("pt-BR")} por tela` : "Plays registrados"}
          />
        </div>
      </div>

      {/* ── CONTEÚDO ────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 space-y-5 pb-6">

        {/* Status por Localização + Donut */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <GCard className="lg:col-span-2">
            <GCardHeader>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> Status por Localização
              </h2>
              <Link href="/screens">
                <button className="text-xs text-primary font-medium hover:text-primary/80 transition-colors">Ver todas →</button>
              </Link>
            </GCardHeader>
            <div className="px-5 pb-4 pt-2">
              {locations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma tela com localização cadastrada</p>
              ) : (
                <div className="divide-y divide-border">
                  {locations.map(([city, data]) => (
                    <div key={city} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        <span className="font-medium text-foreground">{city}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{data.online} online</span>
                        <span className="font-semibold text-foreground tabular-nums">{data.total}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GCard>

          <GCard>
            <GCardHeader>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Wifi className="w-4 h-4 text-primary" /> Uso de Dispositivos
              </h2>
            </GCardHeader>
            <div className="px-5 pb-4 pt-3">
              <DonutChart online={online} offline={offline} />
            </div>
          </GCard>
        </div>

        {/* Telas Recentes */}
        <GCard>
          <GCardHeader>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Monitor className="w-4 h-4 text-primary" /> Telas Recentes
            </h2>
            <Link href="/screens">
              <button className="text-xs text-primary font-medium hover:text-primary/80 transition-colors">Ver todas →</button>
            </Link>
          </GCardHeader>
          <div className="px-5 pb-5 pt-3">
            {tiles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma tela cadastrada ainda.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {tiles.map(tile => <ScreenTile key={tile.id} tile={tile} />)}
              </div>
            )}
          </div>
        </GCard>

        {/* 3 Bottom Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Alertas */}
          <GCard>
            <GCardHeader>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary" /> Alertas Recentes
              </h2>
            </GCardHeader>
            <div className="px-5 pb-2 pt-2">
              {alertList.length === 0 ? (
                <div className="py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <Wifi className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">Nenhum alerta ativo</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {alertList.map(sc => (
                    <div key={sc.id} className="flex items-center justify-between py-2.5 gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                          sc.status === "never" ? "bg-amber-500" : "bg-red-500")} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {sc.status === "never" ? "Falha de conexão" : "Tela offline"}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">{sc.name}</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground flex-shrink-0">{timeAgo(sc.lastSeen)} atrás</span>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/screens">
                <button className="w-full mt-2 py-2 text-xs text-primary font-medium hover:bg-primary/5 rounded-lg transition-colors">
                  Ver todas as telas →
                </button>
              </Link>
            </div>
          </GCard>

          {/* Agendamentos */}
          <GCard>
            <GCardHeader>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" /> Agendamentos do Dia
              </h2>
            </GCardHeader>
            <div className="px-5 pb-2 pt-2">
              {todaySchedules.length === 0 ? (
                <div className="py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">Nenhum agendamento ativo</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {todaySchedules.map((sc: any, i: number) => (
                    <div key={sc.id} className="flex items-center justify-between py-2.5 gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-foreground tabular-nums flex-shrink-0 w-10">
                          {(sc.startAt ?? "00:00").slice(0, 5)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {sc.name ?? sc.playlistName ?? "Agendamento"}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">{sc.screenName ?? "Tela"}</p>
                        </div>
                      </div>
                      {i < 2 ? (
                        <Badge variant="outline" className="text-[9px] h-5 text-emerald-700 border-emerald-200 bg-emerald-50 shrink-0">Em andamento</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] h-5 text-amber-600 border-amber-200 bg-amber-50 shrink-0">Pendente</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Link href="/schedules">
                <button className="w-full mt-2 py-2 text-xs text-primary font-medium hover:bg-primary/5 rounded-lg transition-colors">
                  Ver todos os agendamentos →
                </button>
              </Link>
            </div>
          </GCard>

          {/* Sistema */}
          <GCard>
            <GCardHeader>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" /> Informações do Sistema
              </h2>
            </GCardHeader>
            <div className="px-5 pb-4 pt-2">
              <div className="divide-y divide-border">
                {[
                  { label: "Servidor",       value: "Online",                                          accent: "text-emerald-700 font-bold" },
                  { label: "Versão",         value: "v2.3.1" },
                  { label: "Último backup",  value: new Date().toLocaleDateString("pt-BR") + " 03:00" },
                  { label: "Armazenamento",  value: "68% (136GB / 200GB)" },
                  { label: "Uptime",         value: "15 dias, 8h 32min" },
                  { label: "Exibições hoje", value: (playsToday ?? 0).toLocaleString("pt-BR"),         accent: "text-primary font-bold" },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={cn("text-foreground text-xs", row.accent ?? "font-semibold")}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </GCard>
        </div>
      </div>
    </div>
  );
}
