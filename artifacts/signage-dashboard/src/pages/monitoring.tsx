import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import {
  Monitor, Wifi, WifiOff, AlertTriangle, Play,
  Download, Search, RefreshCw, BarChart2, Trash2,
  ChevronDown, ChevronRight, Camera, CheckCircle2,
  XCircle, Activity, Film, Smartphone, Send, Signal,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

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
  networkSpeedMbps: number | null;
  playsToday: number;
  durationTodaySec: number;
  lastPlay: { mediaName: string; mediaType: string; playedAt: string } | null;
}

interface PlayRecord {
  id: number;
  mediaName: string | null;
  mediaType: string | null;
  durationSeconds: number | null;
  playedAt: string;
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

function fmtDT(iso: string | null, highlight = false): React.ReactNode {
  if (!iso) return <span className="text-muted-foreground/50">—</span>;
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR");
  const recent = Date.now() - d.getTime() < 3 * 60 * 1000;
  return (
    <span className={cn("text-[11px] tabular-nums", highlight && recent ? "text-blue-400 font-semibold" : "text-muted-foreground")}>
      {date} {time}
    </span>
  );
}

function fmtDuration(sec: number | null): string {
  const s = sec ?? 10;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return [h, m, ss].map(v => String(v).padStart(2, "0")).join(":");
}

// ── sub-components ────────────────────────────────────────────────────────────

function AndroidBadge() {
  return (
    <div className="inline-flex flex-col items-center justify-center gap-0 w-7 h-7 rounded-[5px] bg-green-600 text-white select-none shrink-0 overflow-hidden" title="Android">
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white mt-0.5">
        <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0 0 12 1.5c-.96 0-1.86.23-2.66.63L7.85.65c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31A5.93 5.93 0 0 0 6 7h12a5.93 5.93 0 0 0-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/>
      </svg>
    </div>
  );
}

function StatusIcon({ status, lastSeen }: { status: Screen["status"]; lastSeen: string | null }) {
  if (status === "online") {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </div>
      </div>
    );
  }
  if (status === "offline") {
    const hoursAgo = lastSeen ? (Date.now() - new Date(lastSeen).getTime()) / 3600000 : 999;
    const isAlert = hoursAgo > 2;
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center", isAlert ? "bg-amber-500/15" : "bg-red-500/15")}>
          {isAlert
            ? <AlertTriangle className="w-4 h-4 text-amber-500" />
            : <XCircle className="w-4 h-4 text-red-400" />}
        </div>
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
      <XCircle className="w-4 h-4 text-muted-foreground/40" />
    </div>
  );
}

function PlaylogIcon({ count }: { count: number }) {
  const color = count > 0 ? "text-violet-500" : "text-muted-foreground/40";
  const bg = count > 0 ? "bg-violet-500/10" : "bg-muted/30";
  return (
    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center", bg)}>
      <Play className={cn("w-3.5 h-3.5", color)} />
    </div>
  );
}

function KpiCard({ label, value, sub, icon, iconBg, danger }: {
  label: string; value: React.ReactNode; sub: string;
  icon: React.ReactNode; iconBg: string; danger?: boolean;
}) {
  return (
    <div className="bg-card border rounded-xl p-3.5 flex items-center gap-3 flex-1 min-w-[150px]">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-0.5">{label}</div>
        <div className={cn("text-xl font-bold leading-none", danger ? "text-red-500" : "")}>{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

// ── Expanded panel ────────────────────────────────────────────────────────────

interface ConnectionRecord {
  id: number;
  connectedAt: string;
  disconnectedAt: string | null;
  durationSec: number | null;
}

const DETAIL_TABS = ["Status", "Últimas Mídias", "Screenshots", "Conexões", "Velocidade"] as const;
type DTab = typeof DETAIL_TABS[number];

function fmtSec(s: number | null): string {
  if (s === null) return "em curso";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

// ── Speed Chart ───────────────────────────────────────────────────────────────

interface SpeedPoint { time: string; speedMbps: number; }

function speedColor(mbps: number): string {
  if (mbps >= 10) return "#10b981"; // emerald
  if (mbps >= 2)  return "#f59e0b"; // amber
  return "#ef4444"; // red
}

function SpeedChart({ data, hours, onChangeHours }: {
  data: SpeedPoint[];
  hours: number;
  onChangeHours: (h: number) => void;
}) {
  if (!data.length) {
    return (
      <div className="py-12 text-center text-muted-foreground text-xs flex flex-col items-center gap-3">
        <Signal className="w-8 h-8 opacity-20" />
        <p>Nenhum registro de velocidade ainda.<br />Os dados aparecem após o primeiro heartbeat do player.</p>
      </div>
    );
  }

  const avg   = Math.round((data.reduce((s, d) => s + d.speedMbps, 0) / data.length) * 10) / 10;
  const max   = Math.round(Math.max(...data.map(d => d.speedMbps)) * 10) / 10;
  const min   = Math.round(Math.min(...data.map(d => d.speedMbps)) * 10) / 10;
  const last  = data[data.length - 1].speedMbps;
  const clr   = speedColor(last);

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    if (hours <= 24) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const v = payload[0].value as number;
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
        <div className="text-muted-foreground mb-1">{fmtTime(label)}</div>
        <div className="font-bold" style={{ color: speedColor(v) }}>{v.toFixed(1)} Mbps</div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Agora", value: `${last.toFixed(1)} Mbps`, color: clr },
          { label: "Média", value: `${avg.toFixed(1)} Mbps`, color: "#94a3b8" },
          { label: "Máximo", value: `${max.toFixed(1)} Mbps`, color: "#10b981" },
          { label: "Mínimo", value: `${min.toFixed(1)} Mbps`, color: min < 2 ? "#ef4444" : "#94a3b8" },
        ].map(k => (
          <div key={k.label} className="bg-card border rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{k.label}</div>
            <div className="font-bold text-sm" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Period selector */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{data.length} leituras · média a cada 5 min</span>
        <div className="flex gap-1">
          {[6, 24, 48, 168].map(h => (
            <button
              key={h}
              onClick={() => onChangeHours(h)}
              className={cn(
                "px-2.5 py-1 text-[11px] rounded-md border transition-colors cursor-pointer",
                hours === h ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border hover:border-foreground"
              )}
            >
              {h < 48 ? `${h}h` : `${h / 24}d`}
            </button>
          ))}
        </div>
      </div>

      {/* Area chart */}
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#79b4b0" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#79b4b0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis
              dataKey="time"
              tickFormatter={fmtTime}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}`}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={10} stroke="#10b981" strokeDasharray="4 3" opacity={0.5} label={{ value: "10", fill: "#10b981", fontSize: 9, position: "right" }} />
            <ReferenceLine y={2}  stroke="#f59e0b" strokeDasharray="4 3" opacity={0.5} label={{ value: "2",  fill: "#f59e0b", fontSize: 9, position: "right" }} />
            <Area
              type="monotone"
              dataKey="speedMbps"
              stroke="#79b4b0"
              strokeWidth={2}
              fill="url(#speedGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#79b4b0", strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex gap-5 text-[10px] text-muted-foreground justify-center">
        <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-emerald-500" />≥ 10 Mbps (boa)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-amber-500" />2–9.9 Mbps (ok)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-red-500" />{"< 2 Mbps (fraca)"}</div>
      </div>
    </div>
  );
}

function ConnectionTimeline({ connections }: { connections: ConnectionRecord[] }) {
  if (!connections.length) return (
    <div className="py-10 text-center text-muted-foreground text-xs">Nenhum evento de conexão registrado ainda</div>
  );

  // Build 7-day grid
  const now = Date.now();
  const days: { label: string; start: number; end: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    d.setHours(0, 0, 0, 0);
    const end = new Date(d.getTime() + 86400000).getTime();
    days.push({ label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), start: d.getTime(), end });
  }

  return (
    <div className="space-y-1.5">
      {days.map(day => {
        const dayConns = connections.filter(c => {
          const start = new Date(c.connectedAt).getTime();
          const end = c.disconnectedAt ? new Date(c.disconnectedAt).getTime() : now;
          return start < day.end && end > day.start;
        });

        const dayDur = 86400000;
        const totalOnlineSec = dayConns.reduce((sum, c) => {
          const s = Math.max(new Date(c.connectedAt).getTime(), day.start);
          const e = Math.min(c.disconnectedAt ? new Date(c.disconnectedAt).getTime() : now, day.end);
          return sum + Math.max(0, e - s);
        }, 0);
        const pct = Math.round((totalOnlineSec / dayDur) * 100);

        return (
          <div key={day.label} className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground w-12 shrink-0 text-right tabular-nums">{day.label}</span>
            <div className="flex-1 h-5 bg-red-500/15 rounded relative overflow-hidden border border-muted/30">
              {dayConns.map(c => {
                const s = Math.max(new Date(c.connectedAt).getTime(), day.start);
                const e = Math.min(c.disconnectedAt ? new Date(c.disconnectedAt).getTime() : now, day.end);
                const left = ((s - day.start) / dayDur) * 100;
                const width = ((e - s) / dayDur) * 100;
                if (width <= 0) return null;
                return (
                  <div
                    key={c.id}
                    title={`Conectado: ${new Date(c.connectedAt).toLocaleString("pt-BR")}${c.disconnectedAt ? ` → ${new Date(c.disconnectedAt).toLocaleString("pt-BR")}` : " (em curso)"}`}
                    className="absolute top-0 h-full bg-emerald-500/80 hover:bg-emerald-400 transition-colors cursor-default"
                    style={{ left: `${left}%`, width: `${Math.max(width, 0.3)}%` }}
                  />
                );
              })}
            </div>
            <span className={`text-[11px] w-12 shrink-0 tabular-nums font-semibold ${pct > 80 ? "text-emerald-500" : pct > 40 ? "text-yellow-500" : "text-red-400"}`}>
              {pct}%
            </span>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-500/80" />Online</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-500/15 border border-muted/30" />Offline</div>
      </div>

      {/* Recent events list */}
      <div className="mt-4 border rounded-lg overflow-hidden">
        <div className="px-3 py-1.5 bg-muted/20 border-b text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Eventos recentes
        </div>
        <div className="max-h-[180px] overflow-y-auto">
          {connections.slice(0, 30).map(c => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2 border-b last:border-0 text-xs hover:bg-muted/10">
              <div className={`w-2 h-2 rounded-full shrink-0 ${c.disconnectedAt === null ? "bg-emerald-500" : "bg-red-400"}`} />
              <div className="flex-1">
                <span className="font-medium">{new Date(c.connectedAt).toLocaleString("pt-BR")}</span>
                {c.disconnectedAt && (
                  <span className="text-muted-foreground"> → {new Date(c.disconnectedAt).toLocaleString("pt-BR")}</span>
                )}
              </div>
              <div className="text-muted-foreground tabular-nums">{fmtSec(c.durationSec)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ApkVersion {
  id: number; profile: string; version: string; versionCode: number; apkUrl: string; notes: string | null; active: boolean;
}

function ExpandedPanel({ sc }: { sc: Screen }) {
  const qc = useQueryClient();
  const [dtab, setDtab] = useState<DTab>("Status");
  const [screenshotRequesting, setScreenshotRequesting] = useState(false);
  const [screenshotMsg, setScreenshotMsg] = useState<string | null>(null);
  const [failedImg, setFailedImg] = useState(false);
  const [apkPanelOpen, setApkPanelOpen] = useState(false);
  const [selectedApkUrl, setSelectedApkUrl] = useState("");
  const [apkSending, setApkSending] = useState(false);
  const [apkMsg, setApkMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: apkVersions = [] } = useQuery<ApkVersion[]>({
    queryKey: ["apk-versions-list"],
    queryFn: () => fetch("/api/admin/apk-versions", { credentials: "include" }).then(r => r.json()),
    enabled: apkPanelOpen,
    staleTime: 60_000,
  });

  async function pushApk() {
    if (!selectedApkUrl) return;
    setApkSending(true);
    setApkMsg(null);
    try {
      const r = await fetch(`/api/admin/screens/${sc.id}/push-apk`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apkUrl: selectedApkUrl }),
      });
      const data = await r.json() as { ok?: boolean; note?: string; error?: string };
      if (data.ok) {
        setApkMsg({ ok: true, text: data.note ?? "Comando enviado! O player instalará no próximo heartbeat (~30s)." });
      } else {
        setApkMsg({ ok: false, text: data.error ?? "Erro ao enviar comando." });
      }
    } catch {
      setApkMsg({ ok: false, text: "Falha na requisição." });
    } finally {
      setApkSending(false);
    }
  }

  const { data: plays, isLoading: playsLoading } = useQuery<PlayRecord[]>({
    queryKey: ["monitoring-plays", sc.id],
    queryFn: () =>
      fetch(`/api/monitoring/${sc.id}/plays`, { credentials: "include" }).then(r => r.json()),
    enabled: dtab === "Últimas Mídias",
    staleTime: 30_000,
  });

  const { data: connections, isLoading: connLoading } = useQuery<ConnectionRecord[]>({
    queryKey: ["monitoring-connections", sc.id],
    queryFn: () =>
      fetch(`/api/monitoring/${sc.id}/connections`, { credentials: "include" }).then(r => r.json()),
    enabled: dtab === "Conexões",
    staleTime: 30_000,
  });

  const [speedHours, setSpeedHours] = useState(24);
  const { data: speedHistory = [], isLoading: speedLoading } = useQuery<SpeedPoint[]>({
    queryKey: ["monitoring-speed", sc.id, speedHours],
    queryFn: () =>
      fetch(`/api/monitoring/${sc.id}/speed-history?hours=${speedHours}`, { credentials: "include" }).then(r => r.json()),
    enabled: dtab === "Velocidade",
    staleTime: 60_000,
    refetchInterval: dtab === "Velocidade" ? 60_000 : false,
  });

  const imgUrl = resolveScreenshot(sc.lastScreenshot);
  const showImg = !!(imgUrl && !failedImg);

  async function requestScreenshot() {
    setScreenshotRequesting(true);
    setScreenshotMsg(null);
    try {
      await fetch(`/api/monitoring/screenshot-request/${sc.code}`, {
        method: "POST", credentials: "include",
      });
      setScreenshotMsg("Solicitação enviada. O player enviará o screenshot em até 30s.");
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["monitoring"] });
        setScreenshotRequesting(false);
        setTimeout(() => setScreenshotMsg(null), 5000);
      }, 20000);
    } catch {
      setScreenshotMsg("Falha ao enviar solicitação.");
      setScreenshotRequesting(false);
    }
  }

  return (
    <tr>
      <td colSpan={11} className="p-0">
        <div className="border-t border-b bg-muted/5">
          {/* Tab bar */}
          <div className="flex border-b bg-muted/10 px-6">
            {DETAIL_TABS.map(t => (
              <button key={t} onClick={() => setDtab(t)}
                className={cn(
                  "px-4 py-2.5 text-xs font-medium cursor-pointer bg-transparent border-none -mb-px border-b-2 whitespace-nowrap transition-colors",
                  dtab === t
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                )}>
                {t}
              </button>
            ))}
          </div>

          <div className="px-6 py-4">
            {/* ── Status ── */}
            {dtab === "Status" && (
              <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                <div className="bg-card border rounded-lg p-3">
                  <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Activity className="w-3 h-3" /> Status
                  </div>
                  <div className={cn("font-bold text-sm",
                    sc.status === "online" ? "text-emerald-500" : "text-red-500")}>
                    {sc.status === "online" ? "Online" : sc.status === "offline" ? "Offline" : "Nunca conectou"}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[11px]">
                    {sc.lastSeen ? `Desde ${new Date(sc.lastSeen).toLocaleTimeString("pt-BR")}` : "—"}
                  </div>
                </div>

                <div className="bg-card border rounded-lg p-3">
                  <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Play className="w-3 h-3" /> Plays hoje
                  </div>
                  <div className="font-bold text-sm text-violet-500">{sc.playsToday}</div>
                  <div className="text-muted-foreground mt-0.5 text-[11px]">
                    {sc.durationTodaySec > 0
                      ? `${Math.round(sc.durationTodaySec / 60)} min exibidos`
                      : "Sem exibições"}
                  </div>
                </div>

                <div className="bg-card border rounded-lg p-3">
                  <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Monitor className="w-3 h-3" /> Resolução
                  </div>
                  <div className="font-bold text-sm">{sc.resolution ?? "—"}</div>
                  <div className="text-muted-foreground mt-0.5 text-[11px]">Código: {sc.code}</div>
                </div>

                <div className="bg-card border rounded-lg p-3">
                  <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3" /> Último contato
                  </div>
                  <div className="font-bold text-sm text-[11px]">
                    {sc.lastSeen ? new Date(sc.lastSeen).toLocaleString("pt-BR") : "—"}
                  </div>
                </div>

                <div className="bg-card border rounded-lg p-3">
                  <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Signal className="w-3 h-3" /> Velocidade
                  </div>
                  {sc.networkSpeedMbps != null ? (
                    <>
                      <div className="font-bold text-sm" style={{ color: speedColor(sc.networkSpeedMbps) }}>
                        {sc.networkSpeedMbps.toFixed(1)} Mbps
                      </div>
                      <div className="text-muted-foreground mt-0.5 text-[11px]">
                        {sc.networkSpeedMbps >= 10 ? "Boa" : sc.networkSpeedMbps >= 2 ? "Aceitável" : "Fraca"}
                      </div>
                    </>
                  ) : (
                    <div className="font-bold text-sm text-muted-foreground">—</div>
                  )}
                </div>

                {sc.lastPlay && (
                  <div className="bg-card border rounded-lg p-3">
                    <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Film className="w-3 h-3" /> Última exibição
                    </div>
                    <div className="font-semibold truncate">{sc.lastPlay.mediaName}</div>
                    <div className="text-muted-foreground mt-0.5 text-[11px]">
                      {new Date(sc.lastPlay.playedAt).toLocaleString("pt-BR")}
                    </div>
                  </div>
                )}
              </div>

              {/* ── APK Push Install ── */}
              <div className="mt-4 border border-sky-500/20 rounded-xl bg-sky-500/5 overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setApkPanelOpen(v => !v); setApkMsg(null); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-sky-400 hover:bg-sky-500/10 transition-colors cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Instalar / Atualizar APK nesta tela
                  <ChevronDown className={cn("w-3.5 h-3.5 ml-auto transition-transform", apkPanelOpen && "rotate-180")} />
                </button>
                {apkPanelOpen && (
                  <div className="px-4 pb-4 border-t border-sky-500/20 pt-3 space-y-3">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Selecione a versão do APK abaixo. O comando será entregue no próximo heartbeat do player (<strong>~30s</strong>).
                      O NovaStar fará o download e instalará automaticamente.
                    </p>
                    <select
                      value={selectedApkUrl}
                      onChange={e => setSelectedApkUrl(e.target.value)}
                      className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                    >
                      <option value="">— Selecione uma versão —</option>
                      {apkVersions.map(v => (
                        <option key={v.id} value={v.apkUrl}>
                          {v.profile} · v{v.version} (build {v.versionCode}){v.active ? " ✓ ativo" : ""}
                        </option>
                      ))}
                    </select>
                    {apkMsg && (
                      <div className={cn(
                        "text-[11px] rounded-lg px-3 py-2 font-medium",
                        apkMsg.ok
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      )}>
                        {apkMsg.text}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={pushApk}
                      disabled={!selectedApkUrl || apkSending}
                      className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {apkSending ? "Enviando…" : "Enviar para o player"}
                    </button>
                  </div>
                )}
              </div>
              </>
            )}

            {/* ── Últimas Mídias ── */}
            {dtab === "Últimas Mídias" && (
              playsLoading ? (
                <div className="text-center py-8 text-muted-foreground text-xs">Carregando...</div>
              ) : !plays?.length ? (
                <div className="text-center py-8 text-muted-foreground text-xs">Nenhuma exibição registrada</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        {["Início", "Fim", "Mídia", "Duração", "Status"].map(h => (
                          <th key={h} className="text-left text-[10px] font-semibold tracking-wider uppercase text-muted-foreground px-3 py-2 border-b whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {plays.map(p => {
                        const start = new Date(p.playedAt);
                        const endMs = start.getTime() + (p.durationSeconds ?? 10) * 1000;
                        const end = new Date(endMs);
                        return (
                          <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-3 py-2 text-muted-foreground tabular-nums">
                              {start.toLocaleTimeString("pt-BR")}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground tabular-nums">
                              {end.toLocaleTimeString("pt-BR")}
                            </td>
                            <td className="px-3 py-2 max-w-[220px] truncate font-medium">
                              {p.mediaName ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground tabular-nums">
                              {fmtDuration(p.durationSeconds)}
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-emerald-500 font-semibold">OK</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* ── Screenshots ── */}
            {dtab === "Screenshots" && (
              <div className="flex gap-6 items-start flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  {showImg ? (
                    <img
                      src={imgUrl!}
                      alt={sc.name}
                      className="max-h-[220px] rounded-lg border object-contain"
                      onError={() => setFailedImg(true)}
                    />
                  ) : (
                    <div className="h-[120px] rounded-lg border bg-muted/30 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Camera className="w-8 h-8 opacity-25" />
                      <span className="text-xs">Sem screenshot disponível</span>
                    </div>
                  )}
                  {sc.lastSeen && (
                    <div className="text-[11px] text-muted-foreground mt-1.5">
                      Última captura: {new Date(sc.lastSeen).toLocaleString("pt-BR")}
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex flex-col gap-2">
                  <button
                    onClick={requestScreenshot}
                    disabled={screenshotRequesting || sc.status !== "online"}
                    className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {screenshotRequesting ? "Aguardando..." : "Solicitar Screenshot"}
                  </button>
                  {sc.status !== "online" && (
                    <span className="text-[11px] text-muted-foreground">Tela precisa estar online</span>
                  )}
                  {screenshotMsg && (
                    <div className="text-[11px] text-emerald-500 max-w-[200px]">{screenshotMsg}</div>
                  )}
                </div>
              </div>
            )}

            {/* ── Conexões ── */}
            {dtab === "Conexões" && (
              connLoading ? (
                <div className="py-8 text-center text-muted-foreground text-xs">Carregando histórico de conexões...</div>
              ) : (
                <ConnectionTimeline connections={connections ?? []} />
              )
            )}

            {/* ── Velocidade ── */}
            {dtab === "Velocidade" && (
              speedLoading ? (
                <div className="py-8 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
                  <Signal className="w-6 h-6 opacity-30 animate-pulse" />
                  Carregando histórico de velocidade...
                </div>
              ) : (
                <SpeedChart
                  data={speedHistory}
                  hours={speedHours}
                  onChangeHours={(h) => setSpeedHours(h)}
                />
              )
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

const TABS = ["Todas as Telas", "Com Alerta", "Offline"] as const;
type Tab = typeof TABS[number];

export default function Monitoring() {
  const qc = useQueryClient();
  const [tab, setTab]         = useState<Tab>("Todas as Telas");
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(1);
  const [cleanupMsg, setCleanupMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const PER_PAGE = 12;

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
  const summary: Summary  = data?.summary ?? {
    totalScreens: 0, onlineCount: 0, offlineCount: 0, neverCount: 0, totalPlaysToday: 0,
  };

  const alertScreens  = useMemo(() => screens.filter(s => {
    if (s.status === "never") return true;
    if (s.status === "offline" && s.lastSeen)
      return Date.now() - new Date(s.lastSeen).getTime() > 7_200_000;
    return false;
  }), [screens]);

  const offlineScreens = useMemo(() => screens.filter(s => s.status !== "online"), [screens]);

  const tabScreens = useMemo(() => {
    let list = screens;
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
  }, [screens, tab, search, alertScreens, offlineScreens]);

  const totalPages = Math.max(1, Math.ceil(tabScreens.length / PER_PAGE));
  const pageScreens = tabScreens.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const tabCount = (t: Tab) => {
    if (t === "Todas as Telas") return screens.length;
    if (t === "Com Alerta")     return alertScreens.length;
    if (t === "Offline")        return offlineScreens.length;
    return 0;
  };

  function toggleExpand(id: number) {
    setExpandedId(prev => prev === id ? null : id);
  }

  const TABLE_HEADERS = [
    { key: "id",         label: "ID",           w: "w-10" },
    { key: "tela",       label: "Tela / Player", w: "" },
    { key: "cidade",     label: "Localização",   w: "" },
    { key: "so",         label: "SO",            w: "w-10", center: true },
    { key: "status",     label: "Status",        w: "w-14", center: true },
    { key: "playlog",    label: "Playlog",       w: "w-16", center: true },
    { key: "erros",      label: "Erros",         w: "w-14", center: true },
    { key: "ultstatus",  label: "Último status", w: "" },
    { key: "ultexib",    label: "Última exibição", w: "" },
    { key: "expand",     label: "",              w: "w-8" },
  ];

  return (
    <div className="text-foreground">
      {/* ── HEADER ── */}
      <PageHeader
        icon={BarChart2}
        title="Monitoramento"
        description="Monitore todas as telas em tempo real"
        className="mb-5"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-2 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                placeholder="Buscar tela ou localização..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground"
              />
            </div>
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
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["monitoring"] })}
              className={cn("w-9 h-9 rounded-lg bg-background border flex items-center justify-center cursor-pointer",
                isRefetching ? "text-primary" : "text-muted-foreground")}
            >
              <RefreshCw className={cn("w-[15px] h-[15px]", isRefetching ? "animate-spin" : "")} />
            </button>
          </div>
        }
      />

      {/* ── CLEANUP FEEDBACK ── */}
      {cleanupMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3.5 py-2.5 mb-4 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <span className="font-bold">✓</span> {cleanupMsg}
        </div>
      )}

      {/* ── KPI STRIP ── */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <KpiCard
          label="Total de Telas" value={summary.totalScreens}
          sub={`${summary.onlineCount} online · ${summary.offlineCount + summary.neverCount} offline`}
          iconBg="bg-blue-500/10" icon={<Monitor className="w-5 h-5 text-blue-500" />}
        />
        <KpiCard
          label="Online" value={<span className="text-emerald-500">{summary.onlineCount}</span>}
          sub={`${summary.totalScreens > 0 ? ((summary.onlineCount / summary.totalScreens) * 100).toFixed(1) : 0}% do total`}
          iconBg="bg-emerald-500/10" icon={<Wifi className="w-5 h-5 text-emerald-500" />}
        />
        <KpiCard
          label="Offline" value={<span className="text-red-500">{summary.offlineCount + summary.neverCount}</span>}
          sub={`${alertScreens.length} com alerta`}
          iconBg="bg-red-500/10" icon={<WifiOff className="w-5 h-5 text-red-500" />}
          danger={summary.offlineCount + summary.neverCount > 0}
        />
        <KpiCard
          label="Alertas" value={<span className="text-amber-500">{alertScreens.length}</span>}
          sub="Requerem atenção"
          iconBg="bg-amber-500/10" icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
        />
        <KpiCard
          label="Plays Hoje" value={summary.totalPlaysToday}
          sub="Exibições registradas"
          iconBg="bg-violet-500/10" icon={<Play className="w-5 h-5 text-violet-500" />}
        />
      </div>

      {/* ── TABLE CARD ── */}
      <div className="bg-card border rounded-xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 pt-3 flex-wrap gap-2">
          <div className="flex gap-0.5 border-b border-transparent">
            {TABS.map(t => (
              <button key={t} onClick={() => { setTab(t); setPage(1); }}
                className={cn(
                  "px-3.5 py-2 text-sm font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer bg-transparent border-none border-b-2 -mb-px",
                  tab === t ? "text-primary border-primary" : "text-muted-foreground border-transparent"
                )}>
                {t}
                <span className={cn("rounded-full px-1.5 py-px text-[11px]",
                  tab === t ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                  {tabCount(t)}
                </span>
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 bg-background border rounded-lg px-3.5 py-1.5 text-sm font-medium cursor-pointer mb-1">
            <Download className="w-3.5 h-3.5 text-muted-foreground" /> Exportar
          </button>
        </div>

        {/* Subtitle */}
        <div className="px-4 py-2 border-b">
          <span className="text-xs text-muted-foreground">{tabScreens.length} resultado{tabScreens.length !== 1 ? "s" : ""} no total.</span>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-16 text-muted-foreground text-sm">Carregando...</div>
        )}

        {/* Table */}
        {!isLoading && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  {TABLE_HEADERS.map(h => (
                    <th key={h.key}
                      className={cn(
                        "text-[10.5px] font-semibold tracking-wider uppercase text-muted-foreground px-3 py-2.5 whitespace-nowrap",
                        h.center ? "text-center" : "text-left",
                        h.w
                      )}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageScreens.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-muted-foreground">
                      Nenhuma tela encontrada
                    </td>
                  </tr>
                )}
                {pageScreens.map(sc => {
                  const isExpanded = expandedId === sc.id;
                  const isAlert = alertScreens.some(a => a.id === sc.id);
                  return (
                    <>
                      <tr
                        key={sc.id}
                        className={cn(
                          "border-b transition-colors cursor-pointer",
                          isExpanded ? "bg-muted/20 border-b-0" : "hover:bg-muted/10",
                          isAlert && sc.status !== "online" ? "bg-amber-500/3" : ""
                        )}
                        onClick={() => toggleExpand(sc.id)}
                      >
                        {/* ID */}
                        <td className="px-3 py-3 align-middle text-muted-foreground text-xs tabular-nums w-10">
                          {sc.id}
                        </td>

                        {/* Tela */}
                        <td className="px-3 py-3 align-middle">
                          <div className="font-semibold text-sm leading-tight">{sc.name}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            <span className="font-mono">{sc.code}</span>
                            {sc.resolution && (
                              <span className="bg-blue-500/10 text-blue-500 rounded px-1 py-px text-[9.5px] font-bold">{sc.resolution}</span>
                            )}
                          </div>
                        </td>

                        {/* Localização */}
                        <td className="px-3 py-3 align-middle text-xs text-muted-foreground max-w-[140px] truncate whitespace-nowrap">
                          {sc.location ?? "—"}
                        </td>

                        {/* SO */}
                        <td className="px-3 py-3 align-middle text-center">
                          <div className="flex justify-center">
                            <AndroidBadge />
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3 align-middle text-center">
                          <div className="flex justify-center">
                            <StatusIcon status={sc.status} lastSeen={sc.lastSeen} />
                          </div>
                        </td>

                        {/* Playlog */}
                        <td className="px-3 py-3 align-middle text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <PlaylogIcon count={sc.playsToday} />
                            {sc.playsToday > 0 && (
                              <span className="text-[10px] text-muted-foreground tabular-nums">{sc.playsToday}</span>
                            )}
                          </div>
                        </td>

                        {/* Erros */}
                        <td className="px-3 py-3 align-middle text-center">
                          {isAlert ? (
                            <span className="text-xs font-bold text-amber-500">!</span>
                          ) : (
                            <span className="text-muted-foreground/30 text-xs">—</span>
                          )}
                        </td>

                        {/* Último status */}
                        <td className="px-3 py-3 align-middle whitespace-nowrap">
                          {fmtDT(sc.lastSeen, true)}
                        </td>

                        {/* Última exibição */}
                        <td className="px-3 py-3 align-middle whitespace-nowrap">
                          {fmtDT(sc.lastPlay?.playedAt ?? null, true)}
                        </td>

                        {/* Expand */}
                        <td className="px-3 py-3 align-middle text-right" onClick={e => { e.stopPropagation(); toggleExpand(sc.id); }}>
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center ml-auto transition-colors",
                            isExpanded ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground hover:bg-muted"
                          )}>
                            {isExpanded
                              ? <ChevronDown className="w-3.5 h-3.5" />
                              : <ChevronRight className="w-3.5 h-3.5" />}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded panel */}
                      {isExpanded && <ExpandedPanel key={`exp-${sc.id}`} sc={sc} />}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && tabScreens.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground border-t flex-wrap gap-2">
            <span>
              Mostrando {Math.min((page - 1) * PER_PAGE + 1, tabScreens.length)} a{" "}
              {Math.min(page * PER_PAGE, tabScreens.length)} de {tabScreens.length} telas
            </span>
            <div className="flex gap-1">
              <PageBtn active={false} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</PageBtn>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <PageBtn key={p} active={p === page} onClick={() => setPage(p)}>{p}</PageBtn>
              ))}
              {totalPages > 7 && <PageBtn active={false} onClick={() => {}}>…</PageBtn>}
              {totalPages > 7 && (
                <PageBtn active={totalPages === page} onClick={() => setPage(totalPages)}>{totalPages}</PageBtn>
              )}
              <PageBtn active={false} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</PageBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PageBtn({ children, active, onClick, disabled }: {
  children: React.ReactNode; active: boolean; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-w-[30px] h-[30px] rounded-md border text-xs px-1.5",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground",
        disabled ? "cursor-default opacity-50" : "cursor-pointer"
      )}
    >{children}</button>
  );
}
