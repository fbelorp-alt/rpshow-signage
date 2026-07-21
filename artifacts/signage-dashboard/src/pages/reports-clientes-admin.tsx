import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users, UserCheck, Clock, Monitor, Download, Printer, Search,
  Play, Film, TrendingUp, BarChart2, ChevronDown, ChevronUp, Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

type Operator = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  trialDays: number;
  pricePerScreen: string;
  monthlyAmount: string;
  screenCount: number;
  createdAt: string;
};

type ClientPlayStat = {
  clientName: string | null;
  playCount: number;
  totalSeconds: number;
  distinctDays: number;
  screenCount: number;
  mediaCount: number;
  lastPlayAt: string | null;
};

type TopMedia = {
  mediaName: string;
  mediaType: string;
  screenName: string;
  playCount: number;
  totalSeconds: number;
  lastPlayedAt: string | null;
};

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDur(s: number | null) {
  if (!s || s === 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}
function todayBRT() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
function monthStartBRT() {
  const d = new Date(); d.setDate(1);
  return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  trial:     { label: "Em Trial",  cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  active:    { label: "Ativo",     cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  overdue:   { label: "Atrasado",  cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
};
function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, cls: "bg-muted text-muted-foreground border-border" };
}

const CHART_COLORS = ["#79B4B0", "#5a9a96", "#3d7e7a", "#2d6360", "#1e4846"];

function exportClientsCsv(rows: Operator[]) {
  const header = ["Cliente", "Usuário", "E-mail", "Telefone", "Status", "Telas", "Valor/Tela", "Mensalidade", "Cliente desde"];
  const body = rows.map(o => [
    o.name, o.username, o.email ?? "", o.phone ?? "", statusMeta(o.subscriptionStatus).label,
    o.screenCount, o.pricePerScreen, o.monthlyAmount, fmtDate(o.createdAt),
  ]);
  downloadCsv([header, ...body].map(r => r.map(c => `"${c}"`).join(",")).join("\n"),
    `relatorio_clientes_${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportPlaysCsv(rows: ClientPlayStat[], from: string, to: string) {
  const header = ["Cliente", "Exibições", "Tempo Total", "Dias Ativos", "Telas", "Mídias", "Última Exibição"];
  const body = rows.map(r => [
    r.clientName ?? "—",
    r.playCount,
    fmtDur(r.totalSeconds),
    r.distinctDays,
    r.screenCount,
    r.mediaCount,
    fmtDateTime(r.lastPlayAt),
  ]);
  downloadCsv([header, ...body].map(r => r.map(c => `"${c}"`).join(",")).join("\n"),
    `relatorio_exibicoes_clientes_${from}_${to}.csv`);
}

function printClientsReport(rows: Operator[]) {
  const logoUrl = `${window.location.origin}/logo-rpshow.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const totalMonthly = rows.reduce((s, o) => s + parseFloat(o.monthlyAmount || "0"), 0);
  const totalScreens = rows.reduce((s, o) => s + o.screenCount, 0);
  const rowsHtml = rows.map(o => `<tr><td>${o.name}</td><td>${o.username}</td><td>${o.email ?? "—"}</td><td>${o.phone ?? "—"}</td><td class="center">${statusMeta(o.subscriptionStatus).label}</td><td class="mono center">${o.screenCount}</td><td class="mono">${brl(parseFloat(o.pricePerScreen || "0"))}</td><td class="mono">${brl(parseFloat(o.monthlyAmount || "0"))}</td><td class="mono">${fmtDate(o.createdAt)}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Relatório de Clientes — RPShow OnSign</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff}.header{display:flex;align-items:center;gap:20px;padding:20px 28px 16px;border-bottom:3px solid #111}.header img{height:64px;width:auto}.header-text h1{font-size:22px;font-weight:900;color:#111}.header-text p{font-size:12px;color:#555;margin-top:2px}.header-right{margin-left:auto;text-align:right;font-size:10px;color:#666;line-height:1.6}.header-right strong{font-size:13px;color:#111;display:block}.meta{display:flex;gap:32px;padding:12px 28px;background:#f4f4f4;border-bottom:1px solid #ddd;font-size:11px}.meta-item label{font-weight:700;text-transform:uppercase;font-size:9px;letter-spacing:.8px;color:#888;display:block;margin-bottom:2px}.meta-item span{font-size:13px;font-weight:600;color:#111}.table-wrap{padding:20px 28px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#111;color:#fff}thead th{padding:9px 12px;text-align:left;font-weight:700;font-size:10px;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}tbody tr{border-bottom:1px solid #e5e5e5}tbody tr:nth-child(even){background:#f9f9f9}td{padding:7px 12px;vertical-align:middle}td.mono{font-family:monospace;font-size:10.5px;white-space:nowrap}td.center{text-align:center}.footer{padding:14px 28px 20px;font-size:9px;color:#aaa;text-align:center;border-top:1px solid #e0e0e0;margin-top:10px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:10mm}}</style></head><body><div class="header"><img src="${logoUrl}" alt="RPShow"/><div class="header-text"><h1>RPShow OnSign</h1><p>Sistema de Sinalização Digital</p></div><div class="header-right"><strong>RELATÓRIO DE CLIENTES</strong>Gerado em: ${now}</div></div><div class="meta"><div class="meta-item"><label>Total de Operadores</label><span>${rows.length}</span></div><div class="meta-item"><label>Total de Telas</label><span>${totalScreens}</span></div><div class="meta-item"><label>Mensalidade Total</label><span>${brl(totalMonthly)}</span></div></div><div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Usuário</th><th>E-mail</th><th>Telefone</th><th>Status</th><th>Telas</th><th>Valor/Tela</th><th>Mensalidade</th><th>Desde</th></tr></thead><tbody>${rowsHtml}</tbody></table></div><div class="footer">RPShow OnSign — Relatório gerado automaticamente</div></body></html>`;
  const win = window.open("", "_blank", "width=1200,height=800");
  if (!win) { alert("Permita popups para imprimir."); return; }
  win.document.write(html); win.document.close();
}

function ExpandedTopMidias({ clientName, startDate, endDate }: { clientName: string; startDate: string; endDate: string }) {
  const params = new URLSearchParams({ clientName, startDate, endDate });
  const { data, isLoading } = useQuery<{ items: TopMedia[]; totalPlays: number }>({
    queryKey: ["client-top-midias", clientName, startDate, endDate],
    queryFn: () => fetch(`/api/reports/period-summary?${params}`, { credentials: "include" }).then(r => r.json()),
  });
  const items = data?.items?.slice(0, 10) ?? [];

  if (isLoading) return <div className="p-4"><Skeleton className="h-4 w-48" /></div>;
  if (items.length === 0) return <div className="p-4 text-xs text-muted-foreground italic">Sem exibições no período.</div>;

  return (
    <div className="px-4 pb-4 pt-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Top Mídias — {clientName}</p>
      <div className="space-y-1.5">
        {items.map((m, i) => (
          <div key={i} className="flex items-center gap-3 text-xs">
            <span className="w-5 text-center text-[10px] font-bold text-muted-foreground">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{m.mediaName}</p>
              <p className="text-muted-foreground text-[10px]">{m.screenName} · {m.mediaType}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-semibold tabular-nums">{m.playCount.toLocaleString("pt-BR")}</p>
              <p className="text-[10px] text-muted-foreground">{fmtDur(m.totalSeconds)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReportsClientesAdmin() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState(monthStartBRT);
  const [endDate, setEndDate] = useState(todayBRT);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [playsSearch, setPlaysSearch] = useState("");

  const { data: operators = [], isLoading: operatorsLoading } = useQuery<Operator[]>({
    queryKey: ["admin-report-clients"],
    queryFn: () => fetch("/api/admin/operators", { credentials: "include" }).then(r => r.json()),
  });

  const { data: playsData = [], isLoading: playsLoading } = useQuery<ClientPlayStat[]>({
    queryKey: ["clients-plays", startDate, endDate],
    queryFn: () => fetch(`/api/reports/clients-plays?startDate=${startDate}&endDate=${endDate}`, { credentials: "include" }).then(r => r.json()),
  });

  const filteredOps = useMemo(() => {
    return operators.filter(o => {
      if (statusFilter !== "all" && o.subscriptionStatus !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!o.name.toLowerCase().includes(q) && !o.email?.toLowerCase().includes(q) && !o.username.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [operators, search, statusFilter]);

  const filteredPlays = useMemo(() => {
    const rows = (playsData as ClientPlayStat[]).filter(r => r.clientName);
    if (!playsSearch.trim()) return rows;
    const q = playsSearch.trim().toLowerCase();
    return rows.filter(r => r.clientName!.toLowerCase().includes(q));
  }, [playsData, playsSearch]);

  const totalOps     = filteredOps.length;
  const trialCount   = filteredOps.filter(o => o.subscriptionStatus === "trial").length;
  const activeCount  = filteredOps.filter(o => o.subscriptionStatus === "active").length;
  const totalScreens = filteredOps.reduce((s, o) => s + o.screenCount, 0);

  const totalPlays   = filteredPlays.reduce((s, r) => s + r.playCount, 0);
  const totalMedia   = filteredPlays.reduce((s, r) => s + r.mediaCount, 0);
  const clientsAtivos = filteredPlays.filter(r => r.playCount > 0).length;
  const totalHoras   = filteredPlays.reduce((s, r) => s + (r.totalSeconds || 0), 0);

  const chartData = filteredPlays.slice(0, 10).map(r => ({
    name: r.clientName!.length > 16 ? r.clientName!.slice(0, 14) + "…" : r.clientName!,
    fullName: r.clientName!,
    plays: r.playCount,
  }));

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatório de Clientes</h1>
        <p className="text-muted-foreground text-sm mt-1">Base completa de operadores e atividade de exibições por cliente.</p>
      </div>

      {/* ══════════════════════════════════════════
          SEÇÃO 1 — OPERADORES / ASSINATURAS
      ══════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <h2 className="text-base font-semibold">Operadores e Assinaturas</h2>
        </div>

        <div className="bg-card border rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, usuário ou e-mail..." className="h-8 text-xs pl-8" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="trial">Em Trial</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="overdue">Atrasado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="h-8 gap-2 text-xs" onClick={() => printClientsReport(filteredOps)}>
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </Button>
            <Button size="sm" className="h-8 gap-2 text-xs" onClick={() => exportClientsCsv(filteredOps)}>
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Users, color: "text-primary", bg: "bg-primary/10", label: "Total de Operadores", value: totalOps, loading: operatorsLoading },
            { icon: Clock, color: "text-blue-400", bg: "bg-blue-500/10", label: "Em Trial", value: trialCount, loading: operatorsLoading },
            { icon: UserCheck, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Ativos", value: activeCount, loading: operatorsLoading },
            { icon: Monitor, color: "text-violet-400", bg: "bg-violet-500/10", label: "Total de Telas", value: totalScreens, loading: operatorsLoading },
          ].map(({ icon: Icon, color, bg, label, value, loading }) => (
            <div key={label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
                {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-black tabular-nums">{value.toLocaleString("pt-BR")}</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">E-mail</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Telefone</th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Telas</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Valor/Tela</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mensalidade</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Desde</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {operatorsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={8} className="px-3 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                  ))
                ) : filteredOps.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">Nenhum cliente encontrado</td></tr>
                ) : filteredOps.map(o => {
                  const meta = statusMeta(o.subscriptionStatus);
                  return (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <p className="text-sm font-medium">{o.name}</p>
                        <p className="text-[11px] text-muted-foreground">@{o.username}</p>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-xs text-muted-foreground">{o.email ?? "—"}</td>
                      <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">{o.phone ?? "—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs font-medium tabular-nums">{o.screenCount}</td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-right text-xs tabular-nums">{brl(parseFloat(o.pricePerScreen || "0"))}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums">{brl(parseFloat(o.monthlyAmount || "0"))}</td>
                      <td className="px-3 py-2.5 hidden lg:table-cell text-right text-xs text-muted-foreground">{fmtDate(o.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SEÇÃO 2 — EXIBIÇÕES POR CLIENTE
      ══════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <h2 className="text-base font-semibold">Atividade de Exibições por Cliente</h2>
        </div>

        {/* Filtro de período */}
        <div className="bg-card border rounded-xl p-4 flex flex-wrap items-center gap-3">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">De</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Até</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex-1" />
          <Button size="sm" variant="outline" className="h-8 gap-2 text-xs"
            onClick={() => exportPlaysCsv(filteredPlays, startDate, endDate)}>
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </Button>
        </div>

        {/* KPIs de exibições */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Play,       color: "text-primary",        bg: "bg-primary/10",       label: "Total de Exibições", value: totalPlays.toLocaleString("pt-BR") },
            { icon: Users,      color: "text-emerald-400",    bg: "bg-emerald-500/10",   label: "Clientes com Atividade", value: clientsAtivos.toLocaleString("pt-BR") },
            { icon: Film,       color: "text-violet-400",     bg: "bg-violet-500/10",    label: "Mídias Exibidas", value: totalMedia.toLocaleString("pt-BR") },
            { icon: TrendingUp, color: "text-amber-400",      bg: "bg-amber-500/10",     label: "Tempo Total", value: fmtDur(totalHoras) },
          ].map(({ icon: Icon, color, bg, label, value }) => (
            <div key={label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
                {playsLoading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-xl font-black tabular-nums">{value}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Gráfico top clientes */}
        {!playsLoading && chartData.length > 0 && (
          <div className="bg-card border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Top 10 Clientes por Exibições</p>
              <span className="text-xs text-muted-foreground ml-1">({startDate} → {endDate})</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 40 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} width={48} />
                <Tooltip
                  formatter={(v: number, _: string, p: any) => [v.toLocaleString("pt-BR"), p.payload.fullName]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="plays" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabela de clientes com exibições */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={playsSearch} onChange={e => setPlaysSearch(e.target.value)}
                placeholder="Buscar cliente..." className="h-8 text-xs pl-8" />
            </div>
            <span className="text-xs text-muted-foreground">{filteredPlays.length} cliente{filteredPlays.length !== 1 ? "s" : ""} com atividade</span>
          </div>

          {playsLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filteredPlays.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Play className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhum dado de exibição no período selecionado.
            </div>
          ) : (
            <div className="divide-y">
              {filteredPlays.map((row, idx) => {
                const isExpanded = expandedClient === row.clientName;
                return (
                  <div key={idx}>
                    <button
                      className="w-full text-left hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedClient(isExpanded ? null : row.clientName!)}
                    >
                      <div className="px-4 py-3 flex items-center gap-3">
                        {/* Rank */}
                        <span className="w-6 text-center text-xs font-bold text-muted-foreground shrink-0">{idx + 1}</span>

                        {/* Nome */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{row.clientName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {row.distinctDays} dia{row.distinctDays !== 1 ? "s" : ""} ativo · última: {fmtDateTime(row.lastPlayAt)}
                          </p>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Telas</p>
                            <p className="text-sm font-bold tabular-nums">{row.screenCount}</p>
                          </div>
                          <div className="text-right hidden md:block">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Mídias</p>
                            <p className="text-sm font-bold tabular-nums">{row.mediaCount}</p>
                          </div>
                          <div className="text-right hidden md:block">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tempo</p>
                            <p className="text-sm font-bold tabular-nums">{fmtDur(row.totalSeconds)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Exibições</p>
                            <p className="text-base font-black tabular-nums text-primary">{row.playCount.toLocaleString("pt-BR")}</p>
                          </div>
                          {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                            : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                        </div>
                      </div>
                    </button>

                    {/* Expand: top mídias */}
                    {isExpanded && (
                      <div className="border-t bg-muted/20">
                        <ExpandedTopMidias
                          clientName={row.clientName!}
                          startDate={startDate}
                          endDate={endDate}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
