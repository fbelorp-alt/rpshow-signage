import { useState, useEffect } from "react";
import { useGetDashboardStats, useGetDashboardActivity } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, ListVideo, Image as ImageIcon, Activity, Clock, PlayCircle, Wifi, WifiOff, HelpCircle, Radio, Play, AlertTriangle, BarChart2, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "wouter";

async function fetchMonitoring() {
  const res = await fetch("/api/monitoring", { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

function resolveScreenshotUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/objects/")) return `/api/storage${path}`;
  return path;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const date = now.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long", day: "2-digit", month: "long",
  });
  return (
    <div className="text-right">
      <div className="text-2xl font-black tabular-nums tracking-tight">{time}</div>
      <div className="text-xs text-muted-foreground capitalize">{date} · BRT</div>
    </div>
  );
}

const STAT_CARDS = [
  {
    key: "totalScreens",
    label: "Telas Cadastradas",
    icon: Monitor,
    bg: "from-emerald-500 to-emerald-600",
    shadow: "shadow-emerald-500/30",
  },
  {
    key: "totalPlaylists",
    label: "Playlists",
    icon: ListVideo,
    bg: "from-violet-500 to-violet-600",
    shadow: "shadow-violet-500/30",
  },
  {
    key: "totalMedia",
    label: "Mídias na Biblioteca",
    icon: ImageIcon,
    bg: "from-sky-500 to-sky-600",
    shadow: "shadow-sky-500/30",
  },
  {
    key: "playsToday",
    label: "Exibições Hoje",
    icon: PlayCircle,
    bg: "from-orange-500 to-orange-600",
    shadow: "shadow-orange-500/30",
  },
];

const STATUS_ITEMS = [
  {
    key: "onlineScreens",
    label: "Online",
    icon: Wifi,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    dotColor: "#10b981",
    pulse: true,
  },
  {
    key: "offlineScreens",
    label: "Offline",
    icon: WifiOff,
    color: "text-red-500",
    bg: "bg-red-500/10 border-red-500/30",
    dotColor: "#ef4444",
    pulse: false,
  },
  {
    key: "neverConnected",
    label: "Nunca Conectou",
    icon: HelpCircle,
    color: "text-muted-foreground",
    bg: "bg-muted/50 border-border",
    dotColor: "#6b7280",
    pulse: false,
  },
];

function DonutChart({ online, offline, never }: { online: number; offline: number; never: number }) {
  const total = online + offline + never;
  const data = [
    { name: "Online", value: online, color: "#10b981" },
    { name: "Offline", value: offline, color: "#ef4444" },
    { name: "Desconhecido", value: never, color: "#6b7280" },
  ].filter((d) => d.value > 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-muted-foreground text-sm">
        Nenhuma tela cadastrada
      </div>
    );
  }

  return (
    <div className="relative h-36">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={44}
            outerRadius={60}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
            itemStyle={{ color: "#fff" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-black tabular-nums">{total}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">telas</span>
      </div>
    </div>
  );
}

function ActionLabel({ action }: { action: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    created:  { label: "CRIADO",   cls: "text-emerald-500 bg-emerald-500/10" },
    updated:  { label: "EDITADO",  cls: "text-sky-500 bg-sky-500/10" },
    deleted:  { label: "REMOVIDO", cls: "text-red-500 bg-red-500/10" },
  };
  const m = map[action] ?? { label: action.toUpperCase(), cls: "text-muted-foreground bg-muted" };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider ${m.cls}`}>
      {m.label}
    </span>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetDashboardActivity();
  const { data: monitoring } = useQuery({
    queryKey: ["monitoring-dashboard"],
    queryFn: fetchMonitoring,
    refetchInterval: 30_000,
  });

  const monScreens: any[] = monitoring?.screens ?? [];
  const monSummary: any = monitoring?.summary ?? null;
  const onlineScreens = monScreens.filter((s: any) => s.status === "online");
  const alertScreens = monScreens.filter((s: any) => {
    if (s.status === "never") return true;
    if (s.status === "offline" && s.lastSeen) {
      const diffH = (Date.now() - new Date(s.lastSeen).getTime()) / 3_600_000;
      return diffH > 2;
    }
    return false;
  });

  const s = stats as any;

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Painel</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-destructive font-bold bg-destructive/10 px-2 py-0.5 rounded">
              <Radio className="w-3 h-3 animate-pulse" />
              LIVE BROADCASTING
            </span>
          </div>
        </div>
        <LiveClock />
      </div>

      {/* ── Stat Cards ─────────────────────────────────── */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STAT_CARDS.map(({ key, label, icon: Icon, bg, shadow }) => (
            <div
              key={key}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${bg} p-5 text-white shadow-lg ${shadow}`}
            >
              <div className="absolute -right-3 -top-3 opacity-10">
                <Icon className="w-24 h-24" strokeWidth={1} />
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-80">{label}</p>
              <p className="text-4xl font-black mt-1 tabular-nums">
                {(s?.[key] ?? 0).toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Em Exibição Agora ──────────────────────────── */}
      {onlineScreens.length > 0 && (
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Em Exibição Agora
                <span className="text-xs font-normal text-muted-foreground">· {onlineScreens.length} tela{onlineScreens.length !== 1 ? "s" : ""} online</span>
              </span>
              <Link href="/monitoring">
                <span className="text-xs font-normal text-primary hover:underline cursor-pointer">Ver monitoramento →</span>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex gap-3 overflow-x-auto pb-1">
              {onlineScreens.map((screen: any) => {
                const imgUrl = resolveScreenshotUrl(screen.lastScreenshot);
                return (
                  <Link key={screen.id} href="/monitoring">
                    <div className="flex-shrink-0 w-52 bg-muted/30 border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all cursor-pointer group">
                      {/* Screenshot */}
                      <div className="relative aspect-video bg-black/40">
                        {imgUrl ? (
                          <img src={imgUrl} alt={screen.name} className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Monitor className="w-6 h-6 text-muted-foreground/20" />
                          </div>
                        )}
                        <div className="absolute top-1.5 left-1.5">
                          <span className="flex items-center gap-1 text-[9px] font-bold bg-emerald-500/90 text-white px-1.5 py-0.5 rounded-full">
                            <span className="w-1 h-1 rounded-full bg-white animate-pulse" />LIVE
                          </span>
                        </div>
                        {screen.playsToday > 0 && (
                          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 bg-black/70 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full">
                            <BarChart2 className="w-2 h-2 text-blue-400" />{screen.playsToday}
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-2.5 space-y-1">
                        <p className="text-xs font-semibold truncate">{screen.name}</p>
                        {screen.lastPlay ? (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Play className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" />
                            <span className="truncate">{screen.lastPlay.mediaName}</span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/40">Sem exibição hoje</p>
                        )}
                        <p className="text-[9px] text-muted-foreground/50 font-mono flex items-center gap-1">
                          <Timer className="w-2 h-2" />
                          {screen.durationTodaySec > 0 ? `${Math.round(screen.durationTodaySec / 60)}min exibidos` : timeAgo(screen.lastSeen)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Alertas ────────────────────────────────────── */}
      {alertScreens.length > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/3">
          <CardHeader className="pb-3 border-b border-amber-500/20">
            <CardTitle className="text-base flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-4 h-4" />
              Atenção — {alertScreens.length} tela{alertScreens.length !== 1 ? "s" : ""} com problema
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 p-4 space-y-2">
            {alertScreens.map((screen: any) => {
              const isNever = screen.status === "never";
              const diffH = screen.lastSeen ? Math.floor((Date.now() - new Date(screen.lastSeen).getTime()) / 3_600_000) : null;
              return (
                <div key={screen.id} className="flex items-center gap-3 bg-background/60 border border-border rounded-lg px-3 py-2.5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isNever ? "bg-muted-foreground/40" : "bg-amber-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{screen.name}</p>
                    {screen.location && <p className="text-[10px] text-muted-foreground truncate">{screen.location}</p>}
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${isNever ? "bg-muted/50 text-muted-foreground border-border" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
                    {isNever ? "Nunca conectou" : diffH !== null ? `Offline há ${diffH}h` : "Offline"}
                  </span>
                </div>
              );
            })}
            <Link href="/screens">
              <span className="block text-center text-xs text-primary hover:underline font-medium pt-1 cursor-pointer">
                Gerenciar telas →
              </span>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── Agendamentos do Dia + Sistema ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Agendamentos do Dia */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-violet-400" />
                Agendamentos do Dia
              </span>
              <Link href="/schedules">
                <span className="text-xs font-normal text-primary hover:underline cursor-pointer">Ver todos →</span>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {monSummary?.totalPlaysToday > 0 ? (
              <div className="divide-y">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{monSummary.topMedia ?? "Conteúdo ativo"}</p>
                    <p className="text-[10px] text-muted-foreground">Mídia mais exibida · {monSummary.topMediaCount}× hoje</p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex-shrink-0">Em andamento</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Total de exibições hoje</p>
                    <p className="text-[10px] text-muted-foreground">{monSummary.totalDurationTodayMin} minutos de conteúdo</p>
                  </div>
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                    {monSummary.totalPlaysToday.toLocaleString("pt-BR")} plays
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <PlayCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhum conteúdo exibido hoje ainda</p>
                <p className="text-xs mt-0.5 opacity-60">Os agendamentos aparecerão aqui quando as telas estiverem transmitindo</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informações do Sistema */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
              Informações do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {[
                { label: "Servidor", value: "Online", valueClass: "text-emerald-400 font-bold" },
                { label: "Versão", value: "v2.0.0" },
                { label: "Telas monitoradas", value: `${monSummary?.totalScreens ?? s?.totalScreens ?? 0} telas` },
                { label: "Uptime hoje", value: monSummary?.totalDurationTodayMin ? `${monSummary.totalDurationTodayMin}min exibidos` : "—" },
                { label: "Disponibilidade", value: monSummary?.totalScreens > 0 ? `${Math.round((monSummary.onlineCount / monSummary.totalScreens) * 100)}%` : "—" },
                { label: "Exibições hoje", value: (monSummary?.totalPlaysToday ?? 0).toLocaleString("pt-BR") },
              ].map(({ label, value, valueClass }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={cn("font-medium", valueClass ?? "")}>{value}</span>
                </div>
              ))}
              <div className="pt-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Disponibilidade de telas</span>
                  <span className="font-mono font-bold text-foreground">
                    {monSummary?.totalScreens > 0 ? Math.round((monSummary.onlineCount / monSummary.totalScreens) * 100) : 0}%
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${monSummary?.totalScreens > 0 ? Math.round((monSummary.onlineCount / monSummary.totalScreens) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Status + Activity ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Status da Rede */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Wifi className="w-4 h-4 text-primary" />
              Status da Rede
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            {statsLoading ? (
              <div className="flex gap-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 flex-1 rounded-xl" />)}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Status badges */}
                <div className="flex flex-col gap-3 flex-1">
                  {STATUS_ITEMS.map(({ key, label, icon: Icon, color, bg, pulse }) => (
                    <div
                      key={key}
                      className={`flex items-center gap-4 px-4 py-3 rounded-xl border ${bg}`}
                    >
                      <div className={`relative flex items-center justify-center w-10 h-10 rounded-full bg-background/50`}>
                        <Icon className={`w-5 h-5 ${color}`} />
                        {pulse && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
                        )}
                      </div>
                      <div>
                        <p className="text-2xl font-black tabular-nums">{(s?.[key] ?? 0)}</p>
                        <p className="text-xs text-muted-foreground font-medium">{label}</p>
                      </div>
                    </div>
                  ))}

                  <Link href="/screens">
                    <span className="block text-center text-xs text-primary hover:underline font-medium mt-1 cursor-pointer">
                      Ver todas as telas →
                    </span>
                  </Link>
                </div>

                {/* Donut chart */}
                <div className="flex flex-col items-center justify-center min-w-[160px]">
                  <DonutChart
                    online={s?.onlineScreens ?? 0}
                    offline={s?.offlineScreens ?? 0}
                    never={s?.neverConnected ?? 0}
                  />
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
                    {[
                      { label: "Online", color: "bg-emerald-500" },
                      { label: "Offline", color: "bg-red-500" },
                      { label: "Nunca", color: "bg-gray-500" },
                    ].map(({ label, color }) => (
                      <span key={label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span className={`w-2 h-2 rounded-full ${color}`} />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Atividade Recente */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activityLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="divide-y max-h-[340px] overflow-y-auto">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="shrink-0 mt-0.5">
                      <ActionLabel action={item.action} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">
                        <span className="font-medium">{item.entityType}</span>: {item.entityName}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                        {new Date(item.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Nenhuma atividade recente
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
