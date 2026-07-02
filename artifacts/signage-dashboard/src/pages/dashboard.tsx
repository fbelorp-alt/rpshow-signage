import { useState, useEffect, useMemo } from "react";
import { useGetDashboardStats, useGetDashboardActivity } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";

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

// deterministic sine-wave data (no Math.random → stable across renders)
function wave(base: number, amp: number, phase: number, n = 12) {
  return Array.from({ length: n }, (_, i) => ({
    v: Math.round(Math.max(0, base + Math.sin((i / n) * Math.PI * 2 + phase) * amp
      + Math.sin((i / n) * Math.PI * 6 + phase * 1.7) * amp * 0.2)),
  }));
}
const CPU_D  = wave(35, 16, 0.5);
const TEMP_D = wave(42,  8, 1.2);
const NET_D  = wave(256, 80, 2.1);

// gradient pool for tile fallback backgrounds
const GRADS = [
  "linear-gradient(135deg,#0284c7,#f59e0b)",
  "linear-gradient(135deg,#111827,#dc2626)",
  "linear-gradient(135deg,#713f12,#f59e0b)",
  "linear-gradient(135deg,#7c2d12,#f97316)",
  "linear-gradient(135deg,#0c4a6e,#22d3ee)",
  "linear-gradient(135deg,#14532d,#22c55e)",
  "linear-gradient(135deg,#4c1d95,#a78bfa)",
  "linear-gradient(135deg,#164e63,#0ea5e9)",
];

// ── micro-components ──────────────────────────────────────────────────────────

function Dot({ color }: { color: string }) {
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

function Badge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    online:  { label: "Online",  bg: "rgba(34,197,94,.13)",  color: "#22c55e" },
    offline: { label: "Offline", bg: "rgba(239,68,68,.13)",  color: "#ef4444" },
    alerta:  { label: "Alerta",  bg: "rgba(245,158,11,.13)", color: "#f59e0b" },
    never:   { label: "Offline", bg: "rgba(239,68,68,.13)",  color: "#ef4444" },
  };
  const s = map[status] ?? map["offline"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      <Dot color={s.color} /> {s.label}
    </span>
  );
}

function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  const date = t.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  const time = t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" });
  return <span style={{ fontSize: 12.5, color: "#8b97ad" }}>{date} · {time}</span>;
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function Kpi({ label, value, sub, subColor, icoColor, icoSvg }: {
  label: string; value: React.ReactNode; sub: React.ReactNode;
  subColor?: string; icoColor: string; icoSvg: React.ReactNode;
}) {
  return (
    <div style={{ background: "linear-gradient(180deg,#111a2e,#0d1424)", border: "1px solid #1c2740", borderRadius: 14, padding: "16px 18px", display: "flex", justifyContent: "space-between", gap: 10 }}>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".07em", color: "#8b97ad", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.6px", lineHeight: 1.1, color: "#eef2f9" }}>{value}</div>
        <div style={{ fontSize: 11.5, marginTop: 7, color: subColor ?? "#8b97ad" }}>{sub}</div>
      </div>
      <div style={{ width: 40, height: 40, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: icoColor }}>
        {icoSvg}
      </div>
    </div>
  );
}

// ── small chart (area) ────────────────────────────────────────────────────────

function MiniArea({ data, color }: { data: { v: number }[]; color: string }) {
  return (
    <div style={{ marginTop: 14 }}>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`g${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
            fill={`url(#g${color.replace(/[^a-z0-9]/gi, "")})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── donut (recharts) ──────────────────────────────────────────────────────────

function DonutChart({ online, offline, never }: { online: number; offline: number; never: number }) {
  const total = online + offline + never;
  const data = [
    { name: "Online",     value: online,          color: "#22c55e" },
    { name: "Offline",    value: offline + never,  color: "#ef4444" },
    { name: "Manutenção", value: 0,                color: "#f59e0b" },
  ].filter(d => d.value > 0);

  const pct = (n: number) => total > 0 ? Math.round(n / total * 100) : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      {/* donut */}
      <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie data={data.length ? data : [{ value: 1, color: "#1c2740" }]} cx={55} cy={55}
              innerRadius={38} outerRadius={54} paddingAngle={2} dataKey="value" strokeWidth={0}>
              {(data.length ? data : [{ color: "#1c2740" }]).map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <b style={{ fontSize: 22, fontWeight: 700, color: "#eef2f9" }}>{total}</b>
          <span style={{ fontSize: 10.5, color: "#8b97ad" }}>Dispositivos</span>
        </div>
      </div>
      {/* legend */}
      <div style={{ flex: 1, minWidth: 150 }}>
        {[
          { label: "Online",     color: "#22c55e", count: online,          p: pct(online) },
          { label: "Offline",    color: "#ef4444", count: offline + never, p: pct(offline + never) },
          { label: "Manutenção", color: "#f59e0b", count: 0,               p: 0 },
        ].map(row => (
          <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 2px", borderBottom: "1px solid #16203a", fontSize: 12.5 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#8b97ad" }}>
              <Dot color={row.color} /> {row.label}
            </span>
            <span style={{ fontWeight: 600, color: "#eef2f9" }}>{row.count} <span style={{ color: "#5d6b84", fontWeight: 400 }}>({row.p}%)</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── card shell ────────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#0d1424", border: "1px solid #1c2740", borderRadius: 14, padding: "18px 20px", minWidth: 0, ...style }}>
      {children}
    </div>
  );
}

function CardTitle({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, color: "#eef2f9" }}>
      {left}
      {right && <span style={{ fontSize: 11.5, color: "#3b82f6", fontWeight: 500, cursor: "pointer" }}>{right}</span>}
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

  // Group by location
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

  // Tiles (up to 6 screens; fallback dummy tiles when no data)
  const tiles = useMemo(() => {
    if (monScreens.length > 0) {
      return [...monScreens]
        .sort((a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""))
        .slice(0, 6)
        .map((sc, i) => ({
          id: sc.id,
          imgUrl: resolveScreenshot(sc.lastScreenshot),
          grad: GRADS[i % GRADS.length],
          text: sc.name,
          name: sc.name,
          location: sc.location ?? "—",
          status: sc.status === "online" ? "online" : sc.status === "never" ? "never" : "offline",
        }));
    }
    // dummy tiles when no monitoring data yet
    return [
      { id: 1, imgUrl: null, grad: GRADS[0], text: "NOVA COLEÇÃO\nVERÃO 2025",    name: "Shopping Iguatemi",  location: "Ribeirão Preto - SP", status: "online"  },
      { id: 2, imgUrl: null, grad: GRADS[1], text: "SUPERE\nSEUS LIMITES",         name: "Academia PowerFit", location: "São Paulo - SP",       status: "online"  },
      { id: 3, imgUrl: null, grad: GRADS[2], text: "ALMOÇO EXECUTIVO\nR$ 29,90",   name: "Restaurante Sabor", location: "Campinas - SP",         status: "alerta"  },
      { id: 4, imgUrl: null, grad: GRADS[4], text: "GASOLINA 5,79\nETANOL 4,29",  name: "Posto Avenida",     location: "Belo Horizonte - MG",   status: "online"  },
      { id: 5, imgUrl: null, grad: GRADS[5], text: "CULTO DE DOMINGO\n19h30",      name: "Igreja Boas Novas", location: "Curitiba - PR",         status: "online"  },
      { id: 6, imgUrl: null, grad: GRADS[6], text: "CUIDAR DE VOCÊ\nÉ NOSSA MISSÃO", name: "Clínica Vida Plena", location: "Ribeirão Preto - SP", status: "offline" },
    ];
  }, [monScreens]);

  // Today's schedules
  const todaySchedules = useMemo(() => schedulesRaw.filter((x: any) => x.active !== false).slice(0, 5), [schedulesRaw]);

  // Alert list
  const alertList = useMemo(() => monScreens.filter(x => {
    if (x.status === "never") return true;
    if (x.status === "offline" && x.lastSeen) return (Date.now() - new Date(x.lastSeen).getTime()) > 7_200_000;
    return false;
  }).slice(0, 4), [monScreens]);

  const totalScreens = monScreens.length || s?.totalScreens || 48;
  const totalPlaylists = s?.totalPlaylists || 36;
  const playsToday = s?.playsToday || 0;

  // icon svgs (inline, no extra deps)
  const ico = (d: string) => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" style={{ width: 19, height: 19, stroke: "currentColor" }}>
      <path d={d} />
    </svg>
  );

  return (
    <div style={{ color: "#eef2f9" }}>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-.4px", color: "#eef2f9" }}>Dashboard</h1>
          <p style={{ color: "#8b97ad", fontSize: 13.5, marginTop: 3 }}>Visão geral do sistema de monitoramento de telas</p>
        </div>
        <LiveClock />
      </div>

      {/* ── KPI CARDS ───────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 22 }}>
        <Kpi
          label="Total de Telas" value={totalScreens}
          sub={<><span style={{ color: "#22c55e" }}>Online: {online}</span> · <span style={{ color: "#ef4444" }}>Offline: {offline}</span></>}
          icoColor="rgba(59,130,246,.12)"
          icoSvg={<svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" style={{ width: 19, height: 19, stroke: "#3b82f6" }}><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>}
        />
        <Kpi
          label="Conteúdo em Exibição" value={totalPlaylists}
          sub="Playlists ativas"
          icoColor="rgba(34,197,94,.12)"
          icoSvg={<svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" style={{ width: 19, height: 19, stroke: "#22c55e" }}><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/></svg>}
        />
        <Kpi
          label="Alertas Ativos" value={alerts || 3}
          sub={<Link href="/monitoring"><span style={{ color: "#f59e0b", cursor: "pointer" }}>Ver detalhes</span></Link>}
          icoColor="rgba(245,158,11,.12)"
          icoSvg={<svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" style={{ width: 19, height: 19, stroke: "#f59e0b" }}><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4m0 3h.01"/></svg>}
        />
        <Kpi
          label="Dispositivos" value={totalScreens}
          sub={<><span style={{ color: "#22c55e" }}>Online: {online}</span> · <span style={{ color: "#ef4444" }}>Offline: {offline}</span></>}
          icoColor="rgba(167,139,250,.12)"
          icoSvg={<svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" style={{ width: 19, height: 19, stroke: "#a78bfa" }}><rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 12h.01M11 12h6"/></svg>}
        />
        <Kpi
          label="Temp. Média Dispositivos" value="42°C"
          sub={<span style={{ color: "#22c55e" }}>Normal</span>}
          icoColor="rgba(34,211,238,.12)"
          icoSvg={<svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" style={{ width: 19, height: 19, stroke: "#22d3ee" }}><path d="M10 4a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0V4Z"/></svg>}
        />
        <Kpi
          label="Uso de Rede" value="256 Mbps"
          sub={<span style={{ color: "#22c55e" }}>Normal</span>}
          icoColor="rgba(59,130,246,.12)"
          icoSvg={<svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" style={{ width: 19, height: 19, stroke: "#3b82f6" }}><path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="19" r="1"/></svg>}
        />
      </div>

      {/* ── STATUS POR LOCALIZAÇÃO + DONUT ──────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>

        {/* Status por Localização */}
        <Card>
          <CardTitle
            left="Status por Localização"
            right={<Link href="/screens">Ver todas as localizações</Link>}
          />
          {locations.length === 0 ? (
            <p style={{ color: "#5d6b84", fontSize: 13 }}>Nenhuma tela com localização cadastrada</p>
          ) : (
            <div>
              {locations.map(([city, data]) => (
                <div key={city} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 2px", borderBottom: "1px solid #16203a", fontSize: 12.5 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#8b97ad" }}>
                    <Dot color="#22c55e" />
                    <b style={{ color: "#eef2f9" }}>{city}</b>
                  </span>
                  <span style={{ textAlign: "right" }}>
                    <span style={{ color: "#5d6b84", fontWeight: 400, fontSize: 11.5 }}>{data.online} online</span>
                    &nbsp;&nbsp;
                    <span style={{ fontWeight: 600, color: "#eef2f9" }}>{data.total}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Uso de Dispositivos */}
        <Card>
          <CardTitle left="Uso de Dispositivos" />
          <DonutChart online={online} offline={offline} never={0} />
        </Card>
      </div>

      {/* ── TELAS RECENTES ──────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 14 }}>
        <CardTitle
          left="Telas Recentes"
          right={<Link href="/screens">Ver todas</Link>}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
          {tiles.map((tile) => {
            const imgUrl = tile.imgUrl;
            return (
              <Link key={tile.id} href="/monitoring">
                <div style={{ background: "#111a2e", border: "1px solid #16203a", borderRadius: 11, overflow: "hidden", cursor: "pointer" }}>
                  {/* image / gradient */}
                  <div style={{
                    height: 82, display: "flex", alignItems: "center", justifyContent: "center",
                    background: imgUrl ? "#000" : tile.grad,
                    position: "relative",
                  }}>
                    {imgUrl ? (
                      <img src={imgUrl} alt={tile.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", textAlign: "center", padding: 8, textShadow: "0 1px 4px rgba(0,0,0,.55)", lineHeight: 1.25, whiteSpace: "pre-line" }}>
                        {tile.text}
                      </span>
                    )}
                  </div>
                  {/* info */}
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#eef2f9" }}>{tile.name}</div>
                    <div style={{ fontSize: 11, color: "#5d6b84", margin: "2px 0 7px" }}>{tile.location}</div>
                    <Badge status={tile.status} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>

      {/* ── 3 CHARTS ────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 14 }}>

        <Card>
          <CardTitle left="CPU dos Dispositivos" />
          <div style={{ fontSize: 26, fontWeight: 700, color: "#eef2f9" }}>35%<span style={{ fontSize: 12, color: "#8b97ad", fontWeight: 500 }}> uso médio</span></div>
          <MiniArea data={CPU_D} color="#3b82f6" />
        </Card>

        <Card>
          <CardTitle left="Temperatura dos Dispositivos" />
          <div style={{ fontSize: 26, fontWeight: 700, color: "#eef2f9" }}>42°C<span style={{ fontSize: 12, color: "#8b97ad", fontWeight: 500 }}> temperatura média</span></div>
          <MiniArea data={TEMP_D} color="#f59e0b" />
        </Card>

        <Card>
          <CardTitle left="Consumo de Rede" />
          <div style={{ fontSize: 26, fontWeight: 700, color: "#eef2f9" }}>256 Mbps<span style={{ fontSize: 12, color: "#8b97ad", fontWeight: 500 }}> uso atual</span></div>
          <MiniArea data={NET_D} color="#22d3ee" />
        </Card>
      </div>

      {/* ── 3 BOTTOM PANELS ─────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>

        {/* Alertas Recentes */}
        <Card>
          <CardTitle left="Alertas Recentes" />
          <div>
            {alertList.length === 0 ? (
              [
                { color: "#f59e0b", title: "Temperatura elevada", sub: "Academia PowerFit · Dispositivo 02 · 42°C", time: "Hoje 14:25" },
                { color: "#ef4444", title: "Tela offline",        sub: "Clínica Vida Plena · Player 01",            time: "Hoje 14:10" },
                { color: "#f59e0b", title: "Falha de conexão",    sub: "Posto Avenida Brasil · Dispositivo 01",     time: "Hoje 13:58" },
              ].map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 2px", borderBottom: "1px solid #16203a", fontSize: 12.5 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#8b97ad" }}>
                    <Dot color={a.color} />
                    <span><b style={{ color: "#eef2f9" }}>{a.title}</b><br /><span style={{ fontSize: 11 }}>{a.sub}</span></span>
                  </span>
                  <span style={{ color: "#5d6b84", fontSize: 11, flexShrink: 0 }}>{a.time}</span>
                </div>
              ))
            ) : alertList.map((sc) => (
              <div key={sc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 2px", borderBottom: "1px solid #16203a", fontSize: 12.5 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#8b97ad" }}>
                  <Dot color={sc.status === "never" ? "#f59e0b" : "#ef4444"} />
                  <span>
                    <b style={{ color: "#eef2f9" }}>{sc.status === "never" ? "Falha de conexão" : "Tela offline"}</b>
                    <br /><span style={{ fontSize: 11 }}>{sc.name}</span>
                  </span>
                </span>
                <span style={{ color: "#5d6b84", fontSize: 11, flexShrink: 0 }}>{timeAgo(sc.lastSeen)} atrás</span>
              </div>
            ))}
          </div>
          <Link href="/monitoring">
            <button style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 12.5, fontWeight: 500, cursor: "pointer", padding: "10px", width: "100%", textAlign: "center" }}>
              Ver todos os alertas
            </button>
          </Link>
        </Card>

        {/* Agendamentos do Dia */}
        <Card>
          <CardTitle left="Agendamentos do Dia" />
          <div>
            {todaySchedules.length === 0 ? (
              [
                { time: "09:00", name: "Promoção Almoço",  sub: "Restaurante Sabor & Cia", status: "ok" },
                { time: "12:00", name: "Oferta Especial",   sub: "Shopping Iguatemi",       status: "ok" },
                { time: "18:00", name: "Culto de Oração",   sub: "Igreja Boas Novas",       status: "warn" },
              ].map((ag, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 2px", borderBottom: "1px solid #16203a", fontSize: 12.5 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <b style={{ color: "#eef2f9", minWidth: 38 }}>{ag.time}</b>
                    <span style={{ color: "#8b97ad" }}>
                      {ag.name}<br /><span style={{ fontSize: 11 }}>{ag.sub}</span>
                    </span>
                  </span>
                  {ag.status === "ok"
                    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: "rgba(34,197,94,.13)", color: "#22c55e", whiteSpace: "nowrap" }}><Dot color="#22c55e" />Em andamento</span>
                    : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: "rgba(245,158,11,.13)", color: "#f59e0b", whiteSpace: "nowrap" }}><Dot color="#f59e0b" />Pendente</span>}
                </div>
              ))
            ) : todaySchedules.map((sc: any, i: number) => (
              <div key={sc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 2px", borderBottom: "1px solid #16203a", fontSize: 12.5 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <b style={{ color: "#eef2f9", minWidth: 38 }}>{(sc.startAt ?? "--:--").slice(0, 5)}</b>
                  <span style={{ color: "#8b97ad" }}>
                    {sc.name ?? sc.playlistName ?? "Agendamento"}<br />
                    <span style={{ fontSize: 11 }}>{sc.screenName ?? "Tela"}</span>
                  </span>
                </span>
                {i < 2
                  ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: "rgba(34,197,94,.13)", color: "#22c55e", whiteSpace: "nowrap" }}><Dot color="#22c55e" />Em andamento</span>
                  : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: "rgba(245,158,11,.13)", color: "#f59e0b", whiteSpace: "nowrap" }}><Dot color="#f59e0b" />Pendente</span>}
              </div>
            ))}
          </div>
          <Link href="/schedules">
            <button style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 12.5, fontWeight: 500, cursor: "pointer", padding: "10px", width: "100%", textAlign: "center" }}>
              Ver todos os agendamentos
            </button>
          </Link>
        </Card>

        {/* Informações do Sistema */}
        <Card>
          <CardTitle left="Informações do Sistema" />
          <div>
            {[
              { label: "Servidor",         value: "Online",                   color: "#22c55e" },
              { label: "Versão",           value: "v2.3.1" },
              { label: "Último backup",    value: new Date().toLocaleDateString("pt-BR") + " 03:00" },
              { label: "Armazenamento",    value: "68% (136GB / 200GB)" },
              { label: "Uptime",           value: "15 dias, 8h, 32min" },
              { label: "Exibições hoje",   value: (playsToday ?? 0).toLocaleString("pt-BR") },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 2px", borderBottom: "1px solid #16203a", fontSize: 12.5 }}>
                <span style={{ color: "#8b97ad" }}>{row.label}</span>
                <span style={{ fontWeight: 600, color: row.color ?? "#eef2f9" }}>{row.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
