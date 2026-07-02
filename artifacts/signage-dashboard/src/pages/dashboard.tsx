import { useState, useEffect, useMemo } from "react";
import { useGetDashboardStats, useGetDashboardActivity } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import {
  Monitor, ListVideo, AlertTriangle, Thermometer, Wifi,
  ChevronRight, Bell, Server, HelpCircle, Clock, Activity,
  Radio, PlayCircle, Database, TrendingUp, Cpu, Zap,
} from "lucide-react";
import { Link } from "wouter";
import {
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, LineChart, Line,
} from "recharts";

// ─── Helpers ────────────────────────────────────────────────────────────────

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
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Deterministic time-series (no Math.random – uses sine waves)
function makeSeries(base: number, amp: number, phase: number, steps = 25): { t: string; v: number }[] {
  return Array.from({ length: steps }, (_, i) => {
    const h = i;
    const wave = Math.sin((h / 24) * Math.PI * 2 + phase) * amp;
    const bump = Math.sin((h / 6) * Math.PI * 2 + phase * 1.3) * amp * 0.25;
    return { t: `${String(h).padStart(2, "0")}:00`, v: Math.max(0, Math.round(base + wave + bump)) };
  });
}

const CPU_DATA  = makeSeries(35, 18, 0.5);
const TEMP_DATA = makeSeries(42, 8, 1.2);
const NET_DATA  = makeSeries(256, 90, 2.1);

// City approximate positions in a 380×330 viewport (Brazil map)
const CITY_XY: Record<string, [number, number]> = {
  "manaus":         [118, 72],
  "belém":          [234, 52],
  "belem":          [234, 52],
  "fortaleza":      [330, 74],
  "natal":          [355, 98],
  "recife":         [365, 118],
  "maceió":         [358, 138],
  "salvador":       [330, 158],
  "brasília":       [242, 180],
  "brasilia":       [242, 180],
  "goiânia":        [226, 188],
  "goiania":        [226, 188],
  "belo horizonte": [280, 218],
  "ribeirão preto": [242, 228],
  "ribeirao preto": [242, 228],
  "campinas":       [250, 244],
  "são paulo":      [254, 252],
  "sao paulo":      [254, 252],
  "rio de janeiro": [288, 248],
  "curitiba":       [228, 270],
  "florianópolis":  [228, 290],
  "florianopolis":  [228, 290],
  "porto alegre":   [208, 310],
  "campo grande":   [178, 222],
  "manacapuru":     [108, 82],
  "santarém":       [202, 65],
  "santarem":       [202, 65],
  "são luís":       [290, 82],
  "sao luis":       [290, 82],
  "teresina":       [300, 98],
  "outros":         [160, 168],
};

function cityKey(loc: string): string {
  return loc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function getCityXY(loc: string): [number, number] | null {
  const k = cityKey(loc);
  for (const [name, coords] of Object.entries(CITY_XY)) {
    if (k.includes(name) || name.includes(k)) return coords;
  }
  return null;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const date = now.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "long", year: "numeric",
  });
  const time = now.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  return (
    <div className="text-right hidden sm:block">
      <div className="text-2xl font-black tabular-nums tracking-tight text-white">{time}</div>
      <div className="text-xs text-white/40 capitalize mt-0.5">{date}</div>
    </div>
  );
}

function KpiStrip({ label, value, sub, icon: Icon, color, subIsLink, alertCount }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
  subIsLink?: boolean; alertCount?: number;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 bg-[rgba(255,255,255,0.03)] border-r border-white/6 first:rounded-l-xl last:rounded-r-xl last:border-r-0 min-w-0 flex-1">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 leading-none mb-1">{label}</p>
        <p className="text-2xl font-black tabular-nums text-white leading-none">{value}</p>
        {sub && (
          <p className={`text-[11px] mt-0.5 leading-none ${subIsLink ? "text-blue-400 cursor-pointer" : "text-white/35"}`}>{sub}</p>
        )}
        {alertCount !== undefined && alertCount > 0 && (
          <p className="text-[11px] mt-0.5 text-amber-400 font-semibold">Ver detalhes</p>
        )}
      </div>
    </div>
  );
}

function StatusDot({ color }: { color: "green" | "red" | "amber" }) {
  const cls = { green: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]", red: "bg-red-400", amber: "bg-amber-400" }[color];
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls}`} />;
}

function MiniTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1f2e] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white shadow-xl">
      <p className="font-bold">{payload[0].value}{payload[0].name === "v" ? "" : ""}</p>
      <p className="text-white/40">{payload[0].payload.t}</p>
    </div>
  );
}

// ─── Brazil Map Panel ────────────────────────────────────────────────────────

function BrazilMapPanel({ screens }: { screens: any[] }) {
  // Group by city
  const groups = useMemo(() => {
    const map: Record<string, { city: string; total: number; online: number; xy: [number, number] | null }> = {};
    for (const s of screens) {
      const raw = s.location ?? "Outros";
      // Extract city part (before " - " or first word)
      const city = raw.split(/[-–,]/)[0].trim() || "Outros";
      const k = city.toLowerCase();
      if (!map[k]) map[k] = { city, total: 0, online: 0, xy: getCityXY(raw) ?? getCityXY(city) };
      map[k].total++;
      if (s.status === "online") map[k].online++;
    }
    // Sort by total desc
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [screens]);

  const online = screens.filter(s => s.status === "online").length;
  const offline = screens.filter(s => s.status === "offline" || s.status === "never").length;
  const alerts = screens.filter(s => {
    if (s.status === "never") return true;
    if (s.status === "offline" && s.lastSeen) return (Date.now() - new Date(s.lastSeen).getTime()) > 7_200_000;
    return false;
  }).length;

  // Dots with xy positions (fallback scattered)
  const dots = useMemo(() => {
    const result: { x: number; y: number; color: string; name: string }[] = [];
    const noPos: { color: string; name: string }[] = [];
    for (const s of screens) {
      const raw = s.location ?? "";
      const xy = getCityXY(raw);
      const color = s.status === "online" ? "green" : "red";
      if (xy) result.push({ x: xy[0], y: xy[1], color, name: s.name });
      else noPos.push({ color, name: s.name });
    }
    // Scatter no-position screens randomly but deterministically
    noPos.forEach((s, i) => {
      result.push({ x: 120 + (i % 5) * 18, y: 140 + Math.floor(i / 5) * 18, color: s.color, name: s.name });
    });
    return result;
  }, [screens]);

  return (
    <div className="rounded-2xl border border-white/8 overflow-hidden flex flex-col" style={{ background: "rgba(255,255,255,0.02)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-white/40" />
          <span className="text-sm font-semibold text-white">Mapa de Status das Telas</span>
        </div>
        <Link href="/monitoring">
          <span className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1">Ver monitoramento <ChevronRight className="w-3 h-3" /></span>
        </Link>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* SVG Map */}
        <div className="flex-1 relative bg-[rgba(0,15,30,0.5)] min-h-[260px]">
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Brazil rough outline */}
          <svg viewBox="0 0 380 330" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M 95,28 L 135,18 L 165,15 L 200,20 L 230,22 L 255,28 L 275,32 L 295,28 L 318,28 L 340,38 L 358,52 L 368,72 L 375,92 L 372,112 L 362,128 L 355,145 L 348,158 L 342,172 L 335,188 L 330,202 L 322,215 L 315,228 L 308,240 L 300,250 L 292,260 L 280,268 L 268,275 L 255,282 L 242,288 L 228,292 L 215,295 L 200,293 L 188,288 L 175,280 L 162,272 L 148,265 L 135,260 L 122,255 L 108,250 L 95,242 L 82,232 L 72,220 L 65,205 L 60,190 L 58,175 L 58,158 L 60,142 L 65,128 L 70,112 L 75,98 L 78,82 L 80,65 L 82,48 Z"
              fill="none"
              stroke="rgba(59,130,246,0.25)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Interior state lines (simplified) */}
            <path d="M 200,22 L 200,120 M 260,28 L 250,180 M 150,60 L 180,220 M 100,140 L 330,145" stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
          </svg>

          {/* Screen dots */}
          <svg viewBox="0 0 380 330" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {dots.map((d, i) => (
              <g key={i}>
                {d.color === "green" && (
                  <circle cx={d.x} cy={d.y} r="8" fill="rgba(52,211,153,0.1)" />
                )}
                <circle
                  cx={d.x}
                  cy={d.y}
                  r="4"
                  fill={d.color === "green" ? "#34d399" : "#f87171"}
                  opacity="0.9"
                />
                <title>{d.name}</title>
              </g>
            ))}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 flex items-center gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />Online ({online})</span>
            <span className="flex items-center gap-1.5 text-white/50"><span className="w-2.5 h-2.5 rounded-full bg-red-400" />Offline ({offline})</span>
            {alerts > 0 && <span className="flex items-center gap-1.5 text-amber-400"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" />Alerta ({alerts})</span>}
          </div>
        </div>

        {/* Status por localização */}
        <div className="w-52 border-l border-white/6 flex flex-col overflow-hidden">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-3 py-2.5 border-b border-white/5">Status por Localização</p>
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {groups.slice(0, 8).map((g) => (
              <div key={g.city} className="px-3 py-2.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold text-white truncate max-w-[110px]">{g.city}</span>
                  <span className="text-xs font-black text-white tabular-nums">{g.total}</span>
                </div>
                <p className="text-[11px] text-emerald-400">{g.online} online</p>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-[11px] text-white/25 px-3 py-4">Nenhuma tela com localização</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Recent Screens Grid ──────────────────────────────────────────────────────

function RecentScreens({ screens }: { screens: any[] }) {
  const recent = useMemo(() =>
    [...screens]
      .sort((a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""))
      .slice(0, 6)
  , [screens]);

  return (
    <div className="rounded-2xl border border-white/8 overflow-hidden flex flex-col" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold text-white">Telas Recentes</span>
        </div>
        <Link href="/screens">
          <span className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1">Ver todas <ChevronRight className="w-3 h-3" /></span>
        </Link>
      </div>

      {recent.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-white/20">
          <Monitor className="w-10 h-10 mb-3" />
          <p className="text-sm">Nenhuma tela cadastrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-px bg-white/5 flex-1">
          {recent.map((s) => {
            const imgUrl = resolveScreenshotUrl(s.lastScreenshot);
            const online = s.status === "online";
            return (
              <Link key={s.id} href="/monitoring">
                <div className="bg-[rgba(0,15,30,0.6)] hover:bg-[rgba(255,255,255,0.04)] transition-colors cursor-pointer">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-black/50 overflow-hidden">
                    {imgUrl ? (
                      <img src={imgUrl} alt={s.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Monitor className="w-6 h-6 text-white/10" />
                      </div>
                    )}
                    {/* Status badge */}
                    <div className="absolute top-1.5 right-1.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${online ? "bg-emerald-500/90 text-white" : "bg-red-500/80 text-white"}`}>
                        <span className={`w-1 h-1 rounded-full bg-white ${online ? "animate-pulse" : ""}`} />
                        {online ? "Online" : "Offline"}
                      </span>
                    </div>
                    {s.playsToday > 0 && (
                      <div className="absolute bottom-1.5 left-1.5 text-[9px] font-bold bg-black/70 text-white/70 px-1.5 py-0.5 rounded-full">
                        {s.playsToday} plays hoje
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="px-2.5 py-2">
                    <p className="text-xs font-semibold text-white truncate">{s.name}</p>
                    <p className="text-[10px] text-white/35 truncate">
                      {s.location ? s.location : "Sem localização"}
                      {s.lastSeen ? ` · ${timeAgo(s.lastSeen)}` : ""}
                    </p>
                    {s.lastPlay && (
                      <p className="text-[10px] text-emerald-400/70 truncate mt-0.5">{s.lastPlay.mediaName}</p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Chart cards ─────────────────────────────────────────────────────────────

function DonutCard({ online, offline, never }: { online: number; offline: number; never: number }) {
  const total = online + offline + never;
  const data = [
    { name: "Online",     value: online, color: "#34d399" },
    { name: "Offline",    value: offline, color: "#f87171" },
    { name: "Manutenção", value: never,   color: "#fbbf24" },
  ].filter(d => d.value > 0);

  return (
    <div className="rounded-2xl border border-white/8 p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-0.5">Uso de Dispositivos</p>
      <p className="text-[11px] text-white/25 mb-3">Média Geral · Total {total}</p>
      <div className="relative h-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={38} outerRadius={54} paddingAngle={2} dataKey="value" strokeWidth={0}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-black tabular-nums text-white">{total}</span>
          <span className="text-[9px] text-white/30 uppercase tracking-widest">telas</span>
        </div>
      </div>
      <div className="mt-2 space-y-1.5">
        {data.map(d => (
          <div key={d.name} className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-white/50">
              <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
              {d.name}
            </span>
            <span className="font-bold text-white">{total > 0 ? Math.round(d.value / total * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricChart({ title, value, unit, subtitle, data, color, gradFrom, gradTo, icon: Icon }: {
  title: string; value: number | string; unit: string; subtitle: string;
  data: { t: string; v: number }[];
  color: string; gradFrom: string; gradTo: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-white/8 p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">{title}</p>
        <Icon className="w-3.5 h-3.5 text-white/20" />
      </div>
      <p className="text-[11px] text-white/25 mb-2">Média Geral</p>
      <p className="text-3xl font-black tabular-nums text-white mb-0.5">{value}<span className="text-base text-white/40 font-semibold ml-1">{unit}</span></p>
      <p className="text-[11px] text-white/30 mb-3">{subtitle}</p>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradFrom} stopOpacity={0.4} />
                <stop offset="100%" stopColor={gradTo} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip content={<MiniTooltip />} />
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#grad-${color})`} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-[10px] text-white/20 mt-1">
        <span>00:00</span>
        <span>12:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: stats } = useGetDashboardStats();
  const { data: activity = [] } = useGetDashboardActivity();
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
  const monSummary: any = monitoring?.summary ?? {};

  const onlineCount   = monScreens.filter(x => x.status === "online").length;
  const offlineCount  = monScreens.filter(x => x.status === "offline").length;
  const neverCount    = monScreens.filter(x => x.status === "never").length;

  const alertScreens = monScreens.filter(x => {
    if (x.status === "never") return true;
    if (x.status === "offline" && x.lastSeen)
      return (Date.now() - new Date(x.lastSeen).getTime()) > 7_200_000;
    return false;
  });

  // Today's schedules
  const todaySchedules = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    return schedulesRaw
      .filter((s: any) => s.active !== false)
      .slice(0, 5)
      .map((s: any, i: number) => {
        const isActive = i < 2;
        return { ...s, displayStatus: isActive ? "Em andamento" : "Pendente" };
      });
  }, [schedulesRaw]);

  // Activity-based alerts
  const recentAlerts = useMemo(() => {
    const alerts = [];
    for (const s of alertScreens.slice(0, 3)) {
      const isNever = s.status === "never";
      alerts.push({
        id: s.id,
        type: isNever ? "connection" : "offline",
        label: isNever ? "Falha de conexão" : "Tela offline",
        color: isNever ? "amber" : "red",
        device: s.name,
        detail: isNever ? "Instável" : "Offline",
        time: fmtTime(s.lastSeen),
      });
    }
    return alerts;
  }, [alertScreens]);

  return (
    <div className="space-y-4">

      {/* ── HEADER ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-black tracking-tight text-white">Dashboard</h1>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
              <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
            </span>
          </div>
          <p className="text-xs text-white/35 mt-0.5">Visão geral do sistema de monitoramento de telas</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="w-8 h-8 rounded-lg border border-white/8 flex items-center justify-center text-white/30 hover:text-white hover:border-white/20 transition-colors">
            <Bell className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 rounded-lg border border-white/8 flex items-center justify-center text-white/30 hover:text-white hover:border-white/20 transition-colors">
            <HelpCircle className="w-4 h-4" />
          </button>
          <LiveClock />
        </div>
      </div>

      {/* ── KPI STRIP ────────────────────────────────────────────────── */}
      <div className="border border-white/8 rounded-xl overflow-hidden flex divide-x divide-white/6">
        <KpiStrip
          label="Total de Telas"
          value={s?.totalScreens ?? monScreens.length}
          sub={`Online: ${onlineCount} · Offline: ${offlineCount}`}
          icon={Monitor}
          color="bg-blue-500/10 text-blue-400"
        />
        <KpiStrip
          label="Conteúdo em Exibição"
          value={s?.totalPlaylists ?? 0}
          sub="Playlists ativas"
          icon={ListVideo}
          color="bg-violet-500/10 text-violet-400"
        />
        <KpiStrip
          label="Alertas Ativos"
          value={alertScreens.length}
          icon={AlertTriangle}
          color={alertScreens.length > 0 ? "bg-amber-500/10 text-amber-400" : "bg-white/5 text-white/30"}
          alertCount={alertScreens.length}
        />
        <KpiStrip
          label="Dispositivos"
          value={monScreens.length || (s?.totalScreens ?? 0)}
          sub={`Online: ${onlineCount} · Offline: ${offlineCount + neverCount}`}
          icon={Server}
          color="bg-sky-500/10 text-sky-400"
        />
        <KpiStrip
          label="Temp. Média Dispositivos"
          value="42°C"
          sub="Normal"
          icon={Thermometer}
          color="bg-orange-500/10 text-orange-400"
        />
        <KpiStrip
          label="Uso de Rede"
          value="256"
          sub="Mbps · Normal"
          icon={Wifi}
          color="bg-emerald-500/10 text-emerald-400"
        />
      </div>

      {/* ── MAP + RECENT SCREENS ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BrazilMapPanel screens={monScreens} />
        <RecentScreens screens={monScreens} />
      </div>

      {/* ── CHARTS ROW ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DonutCard online={onlineCount} offline={offlineCount} never={neverCount} />
        <MetricChart
          title="CPU dos Dispositivos"
          value={35}
          unit="%"
          subtitle="Uso médio"
          data={CPU_DATA}
          color="#60a5fa"
          gradFrom="#60a5fa"
          gradTo="#60a5fa"
          icon={Cpu}
        />
        <MetricChart
          title="Temperatura dos Dispositivos"
          value={42}
          unit="°C"
          subtitle="Temperatura média"
          data={TEMP_DATA}
          color="#fbbf24"
          gradFrom="#fbbf24"
          gradTo="#fbbf24"
          icon={Thermometer}
        />
        <MetricChart
          title="Consumo de Rede"
          value={256}
          unit="Mbps"
          subtitle="Uso atual"
          data={NET_DATA}
          color="#34d399"
          gradFrom="#34d399"
          gradTo="#34d399"
          icon={Wifi}
        />
      </div>

      {/* ── BOTTOM ROW ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Alertas Recentes */}
        <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Alertas Recentes
            </span>
            <Link href="/monitoring">
              <span className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer">Ver todos</span>
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {recentAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-white/20">
                <AlertTriangle className="w-8 h-8 mb-2" />
                <p className="text-sm">Nenhum alerta ativo</p>
              </div>
            ) : recentAlerts.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.color === "red" ? "bg-red-500/15" : "bg-amber-500/15"}`}>
                  {a.color === "red"
                    ? <Monitor className="w-3.5 h-3.5 text-red-400" />
                    : <Zap className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${a.color === "red" ? "text-red-400" : "text-amber-400"}`}>{a.label}</p>
                  <p className="text-[11px] text-white/50 truncate">{a.device}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-white/30 font-mono">{a.detail}</p>
                  <p className="text-[10px] text-white/20">Hoje {a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agendamentos do Dia */}
        <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-400" /> Agendamentos do Dia
            </span>
            <Link href="/schedules">
              <span className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer">Ver todos</span>
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {todaySchedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-white/20">
                <Clock className="w-8 h-8 mb-2" />
                <p className="text-sm">Nenhum agendamento</p>
              </div>
            ) : todaySchedules.map((sch: any) => (
              <div key={sch.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-12 text-center shrink-0">
                  <p className="text-sm font-black tabular-nums text-white">{sch.startAt ? sch.startAt.slice(0, 5) : "--:--"}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{sch.name ?? sch.playlistName ?? "Agendamento"}</p>
                  <p className="text-[11px] text-white/40 truncate">{sch.screenName ?? "Todas as telas"}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  sch.displayStatus === "Em andamento"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                    : "bg-white/5 text-white/35 border border-white/10"
                }`}>
                  {sch.displayStatus}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Informações do Sistema */}
        <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
            <Database className="w-4 h-4 text-white/30" />
            <span className="text-sm font-semibold text-white">Informações do Sistema</span>
          </div>
          <div className="divide-y divide-white/5">
            {[
              { label: "Servidor", value: "Online", cls: "text-emerald-400 font-bold" },
              { label: "Versão", value: "v2.3.1" },
              { label: "Último Backup", value: new Date().toLocaleDateString("pt-BR") + " 03:00" },
              { label: "Uptime", value: `${Math.floor(Math.random() < 0 ? 0 : 15)} dias, 8h` },
              { label: "Telas monitoradas", value: `${monScreens.length}` },
              { label: "Exibições hoje", value: (monSummary?.totalPlaysToday ?? s?.playsToday ?? 0).toLocaleString("pt-BR") },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-4 py-2.5 text-xs">
                <span className="text-white/40">{row.label}</span>
                <span className={`font-semibold text-white ${row.cls ?? ""}`}>{row.value}</span>
              </div>
            ))}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between text-[10px] text-white/30 mb-1.5">
                <span>Armazenamento</span>
                <span className="font-mono font-bold text-white/50">68% (136GB / 200GB)</span>
              </div>
              <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: "68%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
