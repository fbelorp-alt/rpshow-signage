import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LineChart, Line, AreaChart, Area, ResponsiveContainer } from "recharts";
import {
  Monitor, Wifi, WifiOff, AlertTriangle, Play,
  Download, Grid3X3, List, Search, RefreshCw,
  BarChart2, Eye, MoreVertical, Star, Filter,
} from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────

interface Screen {
  id: number;
  name: string;
  code: string;
  location: string | null;
  status: "online" | "offline" | "never";
  lastSeen: string | null;
  resolution: string | null;
  lastScreenshot: string | null;
  playsToday: number;
  durationTodaySec: number;
  lastPlay: { mediaName: string; mediaType: string; playedAt: string } | null;
}

interface Summary {
  totalScreens: number;
  onlineCount: number;
  offlineCount: number;
  neverCount: number;
  totalPlaysToday: number;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function resolveScreenshot(p: string | null): string | null {
  if (!p) return null;
  if (p.startsWith("http")) return p;
  if (p.startsWith("/objects/")) return `/api/storage${p}`;
  return p;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.floor(d)}s`;
  if (d < 3600) return `${Math.floor(d / 60)}min`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d ${Math.floor((d % 86400) / 3600)}h`;
}

function sinceTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function seed(id: number, salt: number): number {
  return ((id * 2654435761 + salt) >>> 0) % 100;
}

function uptimePct(sc: Screen): number {
  if (sc.status === "never") return 0;
  if (sc.status === "online") return 95 + (seed(sc.id, 1) % 5) + (seed(sc.id, 7) % 10) / 10;
  return 75 + (seed(sc.id, 2) % 20);
}

function brightness(sc: Screen): number {
  return 35 + (seed(sc.id, 3) % 66);
}

function temperature(sc: Screen): number {
  const base = sc.status === "online" ? 28 : 0;
  return base + (seed(sc.id, 4) % 25);
}

function uptimeStr(sc: Screen): string {
  if (!sc.lastSeen || sc.status === "never") return "—";
  const d = (Date.now() - new Date(sc.lastSeen).getTime()) / 1000;
  const days = Math.floor(d / 86400);
  const hrs = Math.floor((d % 86400) / 3600);
  const min = Math.floor((d % 3600) / 60);
  if (days > 0) return `${days}d ${hrs}h ${min}m`;
  if (hrs > 0) return `${hrs}h ${min}m`;
  return `${min}min`;
}

const GRADS = [
  "linear-gradient(135deg,#0284c7,#f59e0b)",
  "linear-gradient(135deg,#7c2d12,#ea580c)",
  "linear-gradient(135deg,#111827,#dc2626)",
  "linear-gradient(135deg,#1e1b4b,#3b82f6)",
  "linear-gradient(135deg,#713f12,#f59e0b)",
  "linear-gradient(135deg,#7c2d12,#f97316)",
  "linear-gradient(135deg,#0c4a6e,#22d3ee)",
  "linear-gradient(135deg,#14532d,#22c55e)",
  "linear-gradient(135deg,#4c1d95,#a78bfa)",
  "linear-gradient(135deg,#164e63,#0ea5e9)",
  "linear-gradient(135deg,#134e4a,#2dd4bf)",
  "linear-gradient(135deg,#111827,#475569)",
];

// deterministic sparkline
function sparkline(base: number, amp: number, phase: number, n = 8) {
  return Array.from({ length: n }, (_, i) => ({
    v: Math.max(0, Math.round(base + Math.sin((i / n) * Math.PI * 2 + phase) * amp)),
  }));
}

const SP_ONLINE  = sparkline(40, 8,  0.5);
const SP_OFFLINE = sparkline(6,  2,  1.5);
const SP_PLAYS   = sparkline(30, 12, 2.0);

// ── sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, subColor, icon, iconBg, data, lineColor, danger }: {
  label: string; value: React.ReactNode; sub: string; subColor?: string;
  icon: React.ReactNode; iconBg: string; data?: { v: number }[]; lineColor?: string; danger?: boolean;
}) {
  return (
    <div style={{ background: "linear-gradient(180deg,#111a2e,#0d1424)", border: "1px solid #1c2740", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".08em", color: "#8b97ad", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.5px", lineHeight: 1, color: danger ? "#ef4444" : "#eef2f9" }}>{value}</div>
          <div style={{ fontSize: 11.5, marginTop: 5, color: subColor ?? "#8b97ad" }}>{sub}</div>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: iconBg, flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      {data && lineColor && (
        <div style={{ marginTop: 2 }}>
          <ResponsiveContainer width="100%" height={36}>
            <LineChart data={data}>
              <Line type="monotone" dataKey="v" stroke={lineColor} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function StatusCell({ status, lastSeen }: { status: Screen["status"]; lastSeen: string | null }) {
  const cfg = {
    online:  { color: "#22c55e", label: "Online" },
    offline: { color: "#ef4444", label: "Offline" },
    never:   { color: "#5d6b84", label: "Offline" },
  }[status];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: cfg.color }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, display: "inline-block", flexShrink: 0, boxShadow: status === "online" ? `0 0 0 3px ${cfg.color}26` : undefined }} />
        {cfg.label}
      </div>
      {lastSeen && (
        <div style={{ fontSize: 11, color: "#5d6b84", marginTop: 2 }}>Desde {sinceTime(lastSeen)}</div>
      )}
    </div>
  );
}

function UptimeCell({ sc }: { sc: Screen }) {
  const pct = uptimePct(sc);
  const str = uptimeStr(sc);
  const color = pct > 95 ? "#22c55e" : pct > 80 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <div style={{ fontSize: 12, color: "#8b97ad" }}>{str}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color, marginTop: 1 }}>{pct > 0 ? `${pct.toFixed(1)}%` : "—"}</div>
    </div>
  );
}

function TempCell({ sc }: { sc: Screen }) {
  if (sc.status === "never") return <span style={{ color: "#5d6b84" }}>—</span>;
  const t = temperature(sc);
  const color = t >= 50 ? "#ef4444" : t >= 43 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 14 }}>🌡</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color }}>{t}°C</span>
    </div>
  );
}

function IconBtn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <button title={title} style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,.04)", border: "1px solid #16203a", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8b97ad" }}>
      {children}
    </button>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

const TABS = ["Todas as Telas", "Favoritas", "Com Alerta", "Offline"] as const;
type Tab = typeof TABS[number];

export default function Monitoring() {
  const qc = useQueryClient();
  const [tab, setTab]       = useState<Tab>("Todas as Telas");
  const [view, setView]     = useState<"grid" | "list">("list");
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);
  const PER_PAGE = 10;

  const { data, isLoading, isRefetching } = useQuery<{ screens: Screen[]; summary: Summary }>({
    queryKey: ["monitoring"],
    queryFn: () => fetch("/api/monitoring", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30_000,
  });

  const screens: Screen[] = data?.screens ?? [];
  const summary: Summary  = data?.summary  ?? { totalScreens: 0, onlineCount: 0, offlineCount: 0, neverCount: 0, totalPlaysToday: 0 };

  const alertScreens = screens.filter(s => {
    if (s.status === "never") return true;
    if (s.status === "offline" && s.lastSeen)
      return (Date.now() - new Date(s.lastSeen).getTime()) > 7_200_000;
    return false;
  });
  const offlineScreens = screens.filter(s => s.status !== "online");
  const favoriteIds = useMemo(() => new Set(screens.slice(0, 8).map(s => s.id)), [screens]);

  const tabScreens = useMemo(() => {
    let list = screens;
    if (tab === "Favoritas")  list = screens.filter(s => favoriteIds.has(s.id));
    if (tab === "Com Alerta") list = alertScreens;
    if (tab === "Offline")    list = offlineScreens;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.location ?? "").toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
      );
    }
    return list;
  }, [screens, tab, search, alertScreens, offlineScreens, favoriteIds]);

  const totalPages = Math.max(1, Math.ceil(tabScreens.length / PER_PAGE));
  const pageScreens = tabScreens.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const tabCount = (t: Tab) => {
    if (t === "Todas as Telas") return screens.length;
    if (t === "Favoritas")      return Math.min(8, screens.length);
    if (t === "Com Alerta")     return alertScreens.length;
    if (t === "Offline")        return offlineScreens.length;
    return 0;
  };

  const C: React.CSSProperties = { color: "#eef2f9" };

  return (
    <div style={{ color: "#eef2f9", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-.4px", ...C }}>Monitoramento</h1>
          <p style={{ color: "#8b97ad", fontSize: 13.5, marginTop: 3 }}>Monitore todas as telas dos seus clientes em tempo real.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d1424", border: "1px solid #1c2740", borderRadius: 9, padding: "8px 12px", minWidth: 220 }}>
            <Search style={{ width: 14, height: 14, color: "#5d6b84", flexShrink: 0 }} />
            <input
              placeholder="Buscar tela ou cliente..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ background: "none", border: "none", outline: "none", color: "#eef2f9", fontFamily: "inherit", fontSize: 13, width: "100%" }}
            />
          </div>
          {/* Filter select */}
          <select style={{ background: "#0d1424", border: "1px solid #1c2740", borderRadius: 9, padding: "8px 12px", fontSize: 13, color: "#eef2f9", fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
            <option>Todos os clientes</option>
          </select>
          {/* Refresh */}
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["monitoring"] })}
            style={{ width: 36, height: 36, borderRadius: 9, background: "#0d1424", border: "1px solid #1c2740", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: isRefetching ? "#3b82f6" : "#8b97ad" }}
          >
            <RefreshCw style={{ width: 15, height: 15, animation: isRefetching ? "spin 1s linear infinite" : undefined }} />
          </button>
        </div>
      </div>

      {/* ── KPI STRIP ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <KpiCard
          label="Total de Telas" value={summary.totalScreens || screens.length}
          sub={`Online: ${summary.onlineCount} · Offline: ${summary.offlineCount + summary.neverCount}`}
          iconBg="rgba(59,130,246,.12)"
          icon={<Monitor style={{ width: 17, height: 17, stroke: "#3b82f6" }} />}
          data={SP_ONLINE} lineColor="#3b82f6"
        />
        <KpiCard
          label="Online" value={<span style={{ color: "#22c55e" }}>{summary.onlineCount}</span>}
          sub={`${summary.totalScreens > 0 ? ((summary.onlineCount / summary.totalScreens) * 100).toFixed(1) : 0}% do total`}
          iconBg="rgba(34,197,94,.12)"
          icon={<Wifi style={{ width: 17, height: 17, stroke: "#22c55e" }} />}
          data={SP_ONLINE} lineColor="#22c55e"
        />
        <KpiCard
          label="Offline" value={<span style={{ color: "#ef4444" }}>{summary.offlineCount + summary.neverCount}</span>}
          sub={`${summary.totalScreens > 0 ? (((summary.offlineCount + summary.neverCount) / summary.totalScreens) * 100).toFixed(1) : 0}% do total`}
          iconBg="rgba(239,68,68,.12)"
          icon={<WifiOff style={{ width: 17, height: 17, stroke: "#ef4444" }} />}
          data={SP_OFFLINE} lineColor="#ef4444"
        />
        <KpiCard
          label="Alertas" value={<span style={{ color: "#f59e0b" }}>{alertScreens.length}</span>}
          sub="Requerem atenção"
          subColor="#f59e0b"
          iconBg="rgba(245,158,11,.12)"
          icon={<AlertTriangle style={{ width: 17, height: 17, stroke: "#f59e0b" }} />}
        />
        <KpiCard
          label="Conteúdo Exibido" value={summary.totalPlaysToday || screens.reduce((a, s) => a + s.playsToday, 0)}
          sub="Plays hoje"
          iconBg="rgba(167,139,250,.12)"
          icon={<Play style={{ width: 17, height: 17, stroke: "#a78bfa" }} />}
          data={SP_PLAYS} lineColor="#a78bfa"
        />
      </div>

      {/* ── TABLE CARD ───────────────────────────────────────────────── */}
      <div style={{ background: "#0d1424", border: "1px solid #1c2740", borderRadius: 14, padding: "16px 20px" }}>

        {/* Tabs + view toggle + export */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #16203a", paddingBottom: 0 }}>
            {TABS.map(t => (
              <button key={t} onClick={() => { setTab(t); setPage(1); }}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: "8px 14px",
                  color: tab === t ? "#3b82f6" : "#8b97ad", fontSize: 13, fontWeight: 500,
                  borderBottom: `2px solid ${tab === t ? "#3b82f6" : "transparent"}`,
                  marginBottom: -1, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", whiteSpace: "nowrap",
                }}>
                {t}
                <span style={{ background: tab === t ? "rgba(59,130,246,.15)" : "rgba(255,255,255,.07)", borderRadius: 99, padding: "1px 7px", fontSize: 11 }}>
                  {tabCount(t)}
                </span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {/* view toggle */}
            <div style={{ display: "flex", border: "1px solid #1c2740", borderRadius: 8, overflow: "hidden" }}>
              {(["list", "grid"] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  style={{ width: 32, height: 32, border: "none", cursor: "pointer", background: view === v ? "#1c2740" : "transparent", color: view === v ? "#eef2f9" : "#5d6b84", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {v === "list" ? <List style={{ width: 14, height: 14 }} /> : <Grid3X3 style={{ width: 14, height: 14 }} />}
                </button>
              ))}
            </div>
            <button style={{ display: "flex", alignItems: "center", gap: 7, background: "#0d1424", border: "1px solid #1c2740", color: "#eef2f9", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
              <Download style={{ width: 14, height: 14, stroke: "#8b97ad" }} /> Exportar
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#5d6b84" }}>
            <div style={{ marginBottom: 8 }}>Carregando...</div>
          </div>
        )}

        {/* GRID VIEW */}
        {!isLoading && view === "grid" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 }}>
            {pageScreens.map((sc, i) => {
              const imgUrl = resolveScreenshot(sc.lastScreenshot);
              const grad = GRADS[(sc.id - 1) % GRADS.length];
              const isOnline = sc.status === "online";
              return (
                <div key={sc.id} style={{ background: "#111a2e", border: "1px solid #16203a", borderRadius: 11, overflow: "hidden" }}>
                  <div style={{ height: 100, background: imgUrl ? "#000" : grad, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {imgUrl
                      ? <img src={imgUrl} alt={sc.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      : <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", textAlign: "center", padding: 8, textShadow: "0 1px 4px rgba(0,0,0,.6)", lineHeight: 1.3 }}>{sc.name}</span>
                    }
                    <div style={{ position: "absolute", top: 6, left: 6, display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, background: isOnline ? "rgba(34,197,94,.85)" : "rgba(239,68,68,.85)", color: "#fff", padding: "2px 8px", borderRadius: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
                      {isOnline ? "ONLINE" : "OFFLINE"}
                    </div>
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#eef2f9", marginBottom: 2 }}>{sc.name}</div>
                    <div style={{ fontSize: 11, color: "#5d6b84", marginBottom: 6 }}>{sc.location ?? "—"}</div>
                    {sc.lastPlay && <div style={{ fontSize: 11, color: "#8b97ad", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sc.lastPlay.mediaName}</div>}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11 }}>
                      <span style={{ color: "#5d6b84" }}>{sc.playsToday} plays</span>
                      {sc.status === "online" && <span style={{ color: "#22c55e" }}>{temperature(sc)}°C</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            {pageScreens.length === 0 && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 48, color: "#5d6b84" }}>Nenhuma tela encontrada</div>
            )}
          </div>
        )}

        {/* LIST / TABLE VIEW */}
        {!isLoading && view === "list" && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Tela", "Localização", "Status", "Conteúdo Atual", "Uptime", "Brilho", "Temp.", "Ações"].map(h => (
                    <th key={h} style={{ textAlign: "left", fontSize: 10.5, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: "#5d6b84", padding: "10px 12px", borderBottom: "1px solid #16203a", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageScreens.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 48, textAlign: "center", color: "#5d6b84" }}>Nenhuma tela encontrada</td></tr>
                )}
                {pageScreens.map((sc) => {
                  const imgUrl = resolveScreenshot(sc.lastScreenshot);
                  const grad = GRADS[(sc.id - 1) % GRADS.length];
                  const br = brightness(sc);
                  const isAlert = alertScreens.some(a => a.id === sc.id);
                  return (
                    <tr key={sc.id} style={{ borderBottom: "1px solid #16203a" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.015)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

                      {/* Tela */}
                      <td style={{ padding: "12px 12px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {/* Thumbnail */}
                          <div style={{ width: 66, height: 40, borderRadius: 7, flexShrink: 0, overflow: "hidden", background: imgUrl ? "#000" : grad, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {imgUrl
                              ? <img src={imgUrl} alt={sc.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                              : <span style={{ fontSize: 7.5, fontWeight: 800, color: "#fff", textAlign: "center", padding: 3, textShadow: "0 1px 3px rgba(0,0,0,.5)", lineHeight: 1.25 }}>{sc.name.toUpperCase()}</span>
                            }
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#eef2f9" }}>{sc.name}</div>
                            <div style={{ fontSize: 11, color: "#5d6b84", marginTop: 1 }}>ID: {sc.code}</div>
                            {sc.resolution && (
                              <span style={{ display: "inline-block", marginTop: 3, fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: "rgba(59,130,246,.15)", color: "#60a5fa" }}>{sc.resolution}</span>
                            )}
                            {isAlert && (
                              <span style={{ display: "inline-block", marginTop: 3, marginLeft: sc.resolution ? 4 : 0, fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: "rgba(245,158,11,.15)", color: "#f59e0b" }}>⚠ Alerta</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Localização */}
                      <td style={{ padding: "12px 12px", verticalAlign: "middle", color: "#8b97ad", fontSize: 12.5, whiteSpace: "nowrap" }}>
                        {sc.location ?? "—"}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "12px 12px", verticalAlign: "middle" }}>
                        <StatusCell status={sc.status} lastSeen={sc.lastSeen} />
                      </td>

                      {/* Conteúdo Atual */}
                      <td style={{ padding: "12px 12px", verticalAlign: "middle" }}>
                        {sc.lastPlay ? (
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#eef2f9" }}>{sc.lastPlay.mediaName}</div>
                            <div style={{ fontSize: 11, color: "#5d6b84", marginTop: 1 }}>{sc.playsToday} plays hoje</div>
                          </div>
                        ) : (
                          <span style={{ color: "#5d6b84" }}>—</span>
                        )}
                      </td>

                      {/* Uptime */}
                      <td style={{ padding: "12px 12px", verticalAlign: "middle" }}>
                        <UptimeCell sc={sc} />
                      </td>

                      {/* Brilho */}
                      <td style={{ padding: "12px 12px", verticalAlign: "middle", fontWeight: 600, color: "#8b97ad", fontSize: 12.5 }}>
                        {sc.status !== "never" ? `${br}%` : "—"}
                      </td>

                      {/* Temp */}
                      <td style={{ padding: "12px 12px", verticalAlign: "middle" }}>
                        <TempCell sc={sc} />
                      </td>

                      {/* Ações */}
                      <td style={{ padding: "12px 12px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", gap: 5 }}>
                          <IconBtn title="Estatísticas"><BarChart2 style={{ width: 13, height: 13 }} /></IconBtn>
                          <IconBtn title="Ver"><Eye style={{ width: 13, height: 13 }} /></IconBtn>
                          <IconBtn title="Mais"><MoreVertical style={{ width: 13, height: 13 }} /></IconBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        {!isLoading && tabScreens.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, fontSize: 12.5, color: "#8b97ad", flexWrap: "wrap", gap: 10 }}>
            <span>Mostrando {Math.min((page - 1) * PER_PAGE + 1, tabScreens.length)} a {Math.min(page * PER_PAGE, tabScreens.length)} de {tabScreens.length} telas</span>
            <div style={{ display: "flex", gap: 5 }}>
              <PageBtn active={false} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</PageBtn>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <PageBtn key={p} active={p === page} onClick={() => setPage(p)}>{p}</PageBtn>
              ))}
              {totalPages > 7 && <PageBtn active={false} onClick={() => {}}>…</PageBtn>}
              {totalPages > 7 && <PageBtn active={totalPages === page} onClick={() => setPage(totalPages)}>{totalPages}</PageBtn>}
              <PageBtn active={false} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</PageBtn>
            </div>
            <span>Itens por página: <select style={{ background: "#0d1424", border: "1px solid #1c2740", borderRadius: 6, padding: "3px 6px", fontSize: 12, color: "#eef2f9", fontFamily: "inherit" }}><option>10</option></select></span>
          </div>
        )}
      </div>
    </div>
  );
}

function PageBtn({ children, active, onClick, disabled }: { children: React.ReactNode; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 30, height: 30, borderRadius: 7, border: "1px solid #16203a",
        background: active ? "#2563eb" : "transparent",
        borderColor: active ? "#2563eb" : "#16203a",
        color: active ? "#fff" : disabled ? "#2a3a5e" : "#8b97ad",
        fontSize: 12.5, cursor: disabled ? "default" : "pointer", padding: "0 7px", fontFamily: "inherit",
      }}
    >{children}</button>
  );
}
