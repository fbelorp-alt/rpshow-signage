import { useState, useEffect, useMemo } from "react";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Monitor, Play, AlertTriangle, Wifi, WifiOff, MapPin,
  Calendar, Clock, Server, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── helpers ──────────────────────────────────────────────────────────────────

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
  "from-blue-500 to-amber-400",
  "from-gray-900 to-red-600",
  "from-yellow-800 to-amber-400",
  "from-orange-800 to-orange-500",
  "from-cyan-900 to-cyan-400",
  "from-green-900 to-green-400",
  "from-violet-900 to-violet-400",
  "from-teal-900 to-sky-400",
];

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
      <p className="text-sm font-semibold text-foreground">{date}</p>
      <p className="text-2xl font-bold tabular-nums text-foreground tracking-tight">{time}</p>
    </div>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, accent = "blue",
}: {
  label: string; value: React.ReactNode; sub?: React.ReactNode;
  icon: React.ElementType; accent?: "blue" | "green" | "amber" | "red" | "violet";
}) {
  const colors = {
    blue:   { bg: "bg-blue-50",   icon: "text-blue-500",   val: "text-blue-600"   },
    green:  { bg: "bg-green-50",  icon: "text-green-500",  val: "text-green-600"  },
    amber:  { bg: "bg-amber-50",  icon: "text-amber-500",  val: "text-amber-600"  },
    red:    { bg: "bg-red-50",    icon: "text-red-500",    val: "text-red-600"    },
    violet: { bg: "bg-violet-50", icon: "text-violet-500", val: "text-violet-600" },
  };
  const c = colors[accent];
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
            <p className={cn("text-3xl font-black tabular-nums tracking-tight", c.val)}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0", c.bg)}>
            <Icon className={cn("w-6 h-6", c.icon)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutChart({ online, offline }: { online: number; offline: number }) {
  const total = online + offline;
  const data = [
    { name: "Online",  value: online,  color: "#22c55e" },
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
          { label: "Online",     color: "#22c55e", count: online,  p: pct(online) },
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

// ── main component ────────────────────────────────────────────────────────────

export default function Dashboard() {
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

  const totalScreens  = monitoring?.summary?.totalScreens ?? monScreens.length;
  const totalPlaylists = s?.totalPlaylists ?? 0;
  const playsToday    = s?.playsToday ?? 0;

  return (
    <div className="space-y-5">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral do sistema de monitoramento de telas</p>
        </div>
        <LiveClock />
      </div>

      {/* ── KPI CARDS ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total de Telas" value={totalScreens} icon={Monitor} accent="blue"
          sub={<><span className="text-green-600 font-medium">Online: {online}</span> · <span className="text-red-500">Offline: {offline}</span></>}
        />
        <KpiCard
          label="Conteúdo em Exibição" value={totalPlaylists} icon={Play} accent="green"
          sub="Playlists ativas"
        />
        <KpiCard
          label="Alertas Ativos" value={alerts} icon={AlertTriangle} accent={alerts > 0 ? "amber" : "green"}
          sub={alerts > 0 ? "Requerem atenção" : "Tudo normal"}
        />
        <KpiCard
          label="Exibições Hoje" value={playsToday} icon={RefreshCw} accent="violet"
          sub="Plays registrados"
        />
      </div>

      {/* ── STATUS POR LOCALIZAÇÃO + DONUT ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" /> Status por Localização
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" asChild>
                <Link href="/screens">Ver todas</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma tela com localização cadastrada</p>
            ) : (
              <div className="divide-y divide-border">
                {locations.map(([city, data]) => (
                  <div key={city} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Wifi className="w-4 h-4 text-muted-foreground" /> Uso de Dispositivos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <DonutChart online={online} offline={offline} />
          </CardContent>
        </Card>
      </div>

      {/* ── TELAS RECENTES ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Monitor className="w-4 h-4 text-muted-foreground" /> Telas Recentes
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" asChild>
              <Link href="/screens">Ver todas</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {tiles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma tela cadastrada ainda.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {tiles.map((tile) => (
                <Link key={tile.id} href="/screens">
                  <div className="rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                    <div className={cn("h-20 flex items-center justify-center relative", !tile.imgUrl && `bg-gradient-to-br ${tile.grad}`)}>
                      {tile.imgUrl ? (
                        <img src={tile.imgUrl} alt={tile.name} className="w-full h-full object-contain bg-black" />
                      ) : (
                        <span className="text-[10px] font-bold text-white text-center px-2 leading-tight drop-shadow">
                          {tile.name}
                        </span>
                      )}
                    </div>
                    <div className="p-2 bg-card">
                      <p className="text-xs font-semibold text-foreground truncate">{tile.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate mb-1.5">{tile.location}</p>
                      {tile.status === "online" ? (
                        <Badge variant="outline" className="text-[9px] h-4 gap-1 text-green-600 border-green-200 bg-green-50 px-1.5">
                          <Wifi className="w-2 h-2" /> Online
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] h-4 gap-1 text-red-500 border-red-200 bg-red-50 px-1.5">
                          <WifiOff className="w-2 h-2" /> Offline
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3 BOTTOM PANELS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Alertas Recentes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-muted-foreground" /> Alertas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {alertList.length === 0 ? (
              <div className="py-6 text-center">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-2">
                  <Wifi className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-sm text-muted-foreground">Nenhum alerta ativo</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {alertList.map((sc) => (
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
            <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-primary" asChild>
              <Link href="/screens">Ver todas as telas</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Agendamentos do Dia */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" /> Agendamentos do Dia
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {todaySchedules.length === 0 ? (
              <div className="py-6 text-center">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
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
                      <Badge variant="outline" className="text-[9px] h-5 text-green-600 border-green-200 bg-green-50 shrink-0">Em andamento</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] h-5 text-amber-600 border-amber-200 bg-amber-50 shrink-0">Pendente</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-primary" asChild>
              <Link href="/schedules">Ver todos os agendamentos</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Informações do Sistema */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Server className="w-4 h-4 text-muted-foreground" /> Informações do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border">
              {[
                { label: "Servidor",      value: "Online",                                        accent: "text-green-600" },
                { label: "Versão",        value: "v2.3.1" },
                { label: "Último backup", value: new Date().toLocaleDateString("pt-BR") + " 03:00" },
                { label: "Armazenamento", value: "68% (136GB / 200GB)" },
                { label: "Uptime",        value: "15 dias, 8h 32min" },
                { label: "Exibições hoje",value: (playsToday ?? 0).toLocaleString("pt-BR") },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className={cn("font-semibold text-foreground text-xs", row.accent)}>{row.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
