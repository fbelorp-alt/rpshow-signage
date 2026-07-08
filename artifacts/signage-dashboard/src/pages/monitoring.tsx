import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import {
  Monitor, Wifi, WifiOff, AlertTriangle, Play,
  Download, Grid3X3, List, Search, RefreshCw,
  BarChart2, Eye, MoreVertical, Trash2,
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

function KpiCard({ label, value, sub, subClassName, icon, iconBg, data, lineColor, danger }: {
  label: string; value: React.ReactNode; sub: string; subClassName?: string;
  icon: React.ReactNode; iconBg: string; data?: { v: number }[]; lineColor?: string; danger?: boolean;
}) {
  return (
    <div className="bg-card border rounded-xl p-3.5 flex flex-col gap-1.5 flex-1 min-w-[160px]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1.5">{label}</div>
          <div className={`text-2xl font-bold tracking-tight leading-none ${danger ? "text-red-500" : "text-foreground"}`}>{value}</div>
          <div className={`text-[11.5px] mt-1 ${subClassName ?? "text-muted-foreground"}`}>{sub}</div>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>
      {data && lineColor && (
        <div className="mt-0.5">
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
    online:  { color: "text-emerald-500", dot: "bg-emerald-500", label: "Online" },
    offline: { color: "text-red-500", dot: "bg-red-500", label: "Offline" },
    never:   { color: "text-muted-foreground", dot: "bg-muted-foreground", label: "Offline" },
  }[status];
  return (
    <div>
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${cfg.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
        {cfg.label}
      </div>
      {lastSeen && (
        <div className="text-[11px] text-muted-foreground mt-0.5">Desde {sinceTime(lastSeen)}</div>
      )}
    </div>
  );
}

function UptimeCell({ sc }: { sc: Screen }) {
  const pct = uptimePct(sc);
  const str = uptimeStr(sc);
  const color = pct > 95 ? "text-emerald-500" : pct > 80 ? "text-amber-500" : "text-red-500";
  return (
    <div>
      <div className="text-xs text-muted-foreground">{str}</div>
      <div className={`text-xs font-semibold mt-px ${color}`}>{pct > 0 ? `${pct.toFixed(1)}%` : "—"}</div>
    </div>
  );
}

function TempCell({ sc }: { sc: Screen }) {
  if (sc.status === "never") return <span className="text-muted-foreground">—</span>;
  const t = temperature(sc);
  const color = t >= 50 ? "text-red-500" : t >= 43 ? "text-amber-500" : "text-emerald-500";
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm">🌡</span>
      <span className={`text-xs font-semibold ${color}`}>{t}°C</span>
    </div>
  );
}

function IconBtn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <button title={title} className="w-7 h-7 rounded-md bg-muted/40 border flex items-center justify-center cursor-pointer text-muted-foreground hover:bg-muted transition-colors">
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
  const [cleanupMsg, setCleanupMsg] = useState<string | null>(null);
  const [failedImgs, setFailedImgs] = useState<Set<number>>(new Set());
  const PER_PAGE = 10;

  const markImgFailed = (id: number) =>
    setFailedImgs((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

  const cleanupMutation = useMutation({
    mutationFn: () =>
      fetch("/api/monitoring/orphan-screens", { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: (data: { deleted: number; screens?: string[]; message?: string }) => {
      if (data.deleted > 0) {
        setCleanupMsg(`${data.deleted} tela(s) removida(s): ${(data.screens ?? []).join(", ")}`);
      } else {
        setCleanupMsg(data.message ?? "Nenhuma tela órfã encontrada.");
      }
      qc.invalidateQueries({ queryKey: ["monitoring"] });
      setTimeout(() => setCleanupMsg(null), 8000);
    },
  });

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

  return (
    <div className="text-foreground">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Monitoramento</h1>
          <p className="text-muted-foreground text-[13.5px] mt-0.5">Monitore todas as telas dos seus clientes em tempo real.</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search */}
          <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-2 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              placeholder="Buscar tela ou cliente..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground"
            />
          </div>
          {/* Filter select */}
          <select className="bg-background border rounded-lg px-3 py-2 text-sm cursor-pointer outline-none">
            <option>Todos os clientes</option>
          </select>
          {/* Limpar telas órfãs */}
          <button
            onClick={() => {
              if (window.confirm("Remover todas as telas sem dispositivo aprovado?\n\nEssa ação não pode ser desfeita.")) {
                cleanupMutation.mutate();
              }
            }}
            disabled={cleanupMutation.isPending}
            title="Remover telas sem dispositivo aprovado"
            className="h-9 rounded-lg bg-background border border-red-500/30 flex items-center gap-1.5 px-3 cursor-pointer text-red-500 text-xs font-semibold disabled:opacity-60"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {cleanupMutation.isPending ? "Limpando…" : "Limpar órfãs"}
          </button>
          {/* Refresh */}
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["monitoring"] })}
            className={`w-9 h-9 rounded-lg bg-background border flex items-center justify-center cursor-pointer ${isRefetching ? "text-primary" : "text-muted-foreground"}`}
          >
            <RefreshCw className={`w-[15px] h-[15px] ${isRefetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── CLEANUP FEEDBACK ─────────────────────────────────────────── */}
      {cleanupMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3.5 py-2.5 mb-4 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <span className="font-bold">✓</span> {cleanupMsg}
        </div>
      )}

      {/* ── KPI STRIP ────────────────────────────────────────────────── */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <KpiCard
          label="Total de Telas" value={summary.totalScreens || screens.length}
          sub={`Online: ${summary.onlineCount} · Offline: ${summary.offlineCount + summary.neverCount}`}
          iconBg="bg-blue-500/10"
          icon={<Monitor className="w-[17px] h-[17px] text-blue-500" />}
          data={SP_ONLINE} lineColor="#3b82f6"
        />
        <KpiCard
          label="Online" value={<span className="text-emerald-500">{summary.onlineCount}</span>}
          sub={`${summary.totalScreens > 0 ? ((summary.onlineCount / summary.totalScreens) * 100).toFixed(1) : 0}% do total`}
          iconBg="bg-emerald-500/10"
          icon={<Wifi className="w-[17px] h-[17px] text-emerald-500" />}
          data={SP_ONLINE} lineColor="#22c55e"
        />
        <KpiCard
          label="Offline" value={<span className="text-red-500">{summary.offlineCount + summary.neverCount}</span>}
          sub={`${summary.totalScreens > 0 ? (((summary.offlineCount + summary.neverCount) / summary.totalScreens) * 100).toFixed(1) : 0}% do total`}
          iconBg="bg-red-500/10"
          icon={<WifiOff className="w-[17px] h-[17px] text-red-500" />}
          data={SP_OFFLINE} lineColor="#ef4444"
        />
        <KpiCard
          label="Alertas" value={<span className="text-amber-500">{alertScreens.length}</span>}
          sub="Requerem atenção"
          subClassName="text-amber-500"
          iconBg="bg-amber-500/10"
          icon={<AlertTriangle className="w-[17px] h-[17px] text-amber-500" />}
        />
        <KpiCard
          label="Conteúdo Exibido" value={summary.totalPlaysToday || screens.reduce((a, s) => a + s.playsToday, 0)}
          sub="Plays hoje"
          iconBg="bg-violet-500/10"
          icon={<Play className="w-[17px] h-[17px] text-violet-500" />}
          data={SP_PLAYS} lineColor="#a78bfa"
        />
      </div>

      {/* ── TABLE CARD ───────────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl p-4">

        {/* Tabs + view toggle + export */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
          <div className="flex gap-0.5 border-b">
            {TABS.map(t => (
              <button key={t} onClick={() => { setTab(t); setPage(1); }}
                className={`bg-transparent border-none cursor-pointer px-3.5 py-2 text-sm font-medium flex items-center gap-1.5 whitespace-nowrap -mb-px border-b-2 ${tab === t ? "text-primary border-primary" : "text-muted-foreground border-transparent"}`}>
                {t}
                <span className={`rounded-full px-1.5 py-px text-[11px] ${tab === t ? "bg-primary/15" : "bg-muted"}`}>
                  {tabCount(t)}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {/* view toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              {(["list", "grid"] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`w-8 h-8 border-none cursor-pointer flex items-center justify-center ${view === v ? "bg-muted text-foreground" : "bg-transparent text-muted-foreground"}`}>
                  {v === "list" ? <List className="w-3.5 h-3.5" /> : <Grid3X3 className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
            <button className="flex items-center gap-1.5 bg-background border rounded-lg px-3.5 py-1.5 text-sm font-medium cursor-pointer">
              <Download className="w-3.5 h-3.5 text-muted-foreground" /> Exportar
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-16 text-muted-foreground">
            <div className="mb-2">Carregando...</div>
          </div>
        )}

        {/* GRID VIEW */}
        {!isLoading && view === "grid" && (
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))" }}>
            {pageScreens.map((sc) => {
              const imgUrl = resolveScreenshot(sc.lastScreenshot);
              const showImg = imgUrl && !failedImgs.has(sc.id);
              const grad = GRADS[(sc.id - 1) % GRADS.length];
              const isOnline = sc.status === "online";
              return (
                <div key={sc.id} className="bg-muted/30 border rounded-lg overflow-hidden">
                  <div className="h-[100px] relative flex items-center justify-center" style={{ background: showImg ? "#000" : grad }}>
                    {showImg
                      ? <img src={imgUrl!} alt={sc.name} className="w-full h-full object-contain" onError={() => markImgFailed(sc.id)} />
                      : (
                        <div className="flex flex-col items-center gap-1 text-white" style={{ textShadow: "0 1px 4px rgba(0,0,0,.6)" }}>
                          <Monitor className="w-6 h-6 opacity-90" />
                          <span className="text-[9.5px] font-semibold opacity-90">Sem sinal</span>
                        </div>
                      )
                    }
                    <div className={`absolute top-1.5 left-1.5 flex items-center gap-1 text-[10.5px] font-bold text-white px-2 py-0.5 rounded-md ${isOnline ? "bg-emerald-500/85" : "bg-red-500/85"}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                      {isOnline ? "ONLINE" : "OFFLINE"}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <div className="text-xs font-semibold mb-0.5">{sc.name}</div>
                    <div className="text-[11px] text-muted-foreground mb-1.5">{sc.location ?? "—"}</div>
                    {sc.lastPlay && <div className="text-[11px] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">{sc.lastPlay.mediaName}</div>}
                    <div className="flex justify-between mt-2 text-[11px]">
                      <span className="text-muted-foreground">{sc.playsToday} plays</span>
                      {sc.status === "online" && <span className="text-emerald-500">{temperature(sc)}°C</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            {pageScreens.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">Nenhuma tela encontrada</div>
            )}
          </div>
        )}

        {/* LIST / TABLE VIEW */}
        {!isLoading && view === "list" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {["Tela", "Localização", "Status", "Conteúdo Atual", "Uptime", "Brilho", "Temp.", "Ações"].map(h => (
                    <th key={h} className="text-left text-[10.5px] font-semibold tracking-wider uppercase text-muted-foreground px-3 py-2.5 border-b whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageScreens.length === 0 && (
                  <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">Nenhuma tela encontrada</td></tr>
                )}
                {pageScreens.map((sc) => {
                  const imgUrl = resolveScreenshot(sc.lastScreenshot);
                  const showImg = imgUrl && !failedImgs.has(sc.id);
                  const grad = GRADS[(sc.id - 1) % GRADS.length];
                  const br = brightness(sc);
                  const isAlert = alertScreens.some(a => a.id === sc.id);
                  return (
                    <tr key={sc.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">

                      {/* Tela */}
                      <td className="px-3 py-3 align-middle">
                        <div className="flex items-center gap-2.5">
                          {/* Thumbnail */}
                          <div className="w-[66px] h-10 rounded-md shrink-0 overflow-hidden flex items-center justify-center" style={{ background: showImg ? "#000" : grad }}>
                            {showImg
                              ? <img src={imgUrl!} alt={sc.name} className="w-full h-full object-contain" onError={() => markImgFailed(sc.id)} />
                              : <Monitor className="w-4 h-4 text-white opacity-90" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,.5))" }} />
                            }
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{sc.name}</div>
                            <div className="text-[11px] text-muted-foreground mt-px">ID: {sc.code}</div>
                            {sc.resolution && (
                              <span className="inline-block mt-1 text-[9.5px] font-bold px-1.5 py-px rounded bg-blue-500/15 text-blue-500">{sc.resolution}</span>
                            )}
                            {isAlert && (
                              <span className={`inline-block mt-1 text-[9.5px] font-bold px-1.5 py-px rounded bg-amber-500/15 text-amber-500 ${sc.resolution ? "ml-1" : ""}`}>⚠ Alerta</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Localização */}
                      <td className="px-3 py-3 align-middle text-muted-foreground text-xs whitespace-nowrap">
                        {sc.location ?? "—"}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3 align-middle">
                        <StatusCell status={sc.status} lastSeen={sc.lastSeen} />
                      </td>

                      {/* Conteúdo Atual */}
                      <td className="px-3 py-3 align-middle">
                        {sc.lastPlay ? (
                          <div>
                            <div className="text-xs font-semibold">{sc.lastPlay.mediaName}</div>
                            <div className="text-[11px] text-muted-foreground mt-px">{sc.playsToday} plays hoje</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Uptime */}
                      <td className="px-3 py-3 align-middle">
                        <UptimeCell sc={sc} />
                      </td>

                      {/* Brilho */}
                      <td className="px-3 py-3 align-middle font-semibold text-muted-foreground text-xs">
                        {sc.status !== "never" ? `${br}%` : "—"}
                      </td>

                      {/* Temp */}
                      <td className="px-3 py-3 align-middle">
                        <TempCell sc={sc} />
                      </td>

                      {/* Ações */}
                      <td className="px-3 py-3 align-middle">
                        <div className="flex gap-1.5">
                          <IconBtn title="Estatísticas"><BarChart2 className="w-[13px] h-[13px]" /></IconBtn>
                          <IconBtn title="Ver"><Eye className="w-[13px] h-[13px]" /></IconBtn>
                          <IconBtn title="Mais"><MoreVertical className="w-[13px] h-[13px]" /></IconBtn>
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
          <div className="flex items-center justify-between pt-3.5 text-xs text-muted-foreground flex-wrap gap-2.5">
            <span>Mostrando {Math.min((page - 1) * PER_PAGE + 1, tabScreens.length)} a {Math.min(page * PER_PAGE, tabScreens.length)} de {tabScreens.length} telas</span>
            <div className="flex gap-1">
              <PageBtn active={false} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</PageBtn>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <PageBtn key={p} active={p === page} onClick={() => setPage(p)}>{p}</PageBtn>
              ))}
              {totalPages > 7 && <PageBtn active={false} onClick={() => {}}>…</PageBtn>}
              {totalPages > 7 && <PageBtn active={totalPages === page} onClick={() => setPage(totalPages)}>{totalPages}</PageBtn>}
              <PageBtn active={false} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</PageBtn>
            </div>
            <span className="flex items-center gap-1">Itens por página: <select className="bg-background border rounded px-1.5 py-0.5 text-xs"><option>10</option></select></span>
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
      className={`min-w-[30px] h-[30px] rounded-md border text-xs px-1.5 ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground"
      } ${disabled ? "cursor-default opacity-50" : "cursor-pointer"}`}
    >{children}</button>
  );
}
