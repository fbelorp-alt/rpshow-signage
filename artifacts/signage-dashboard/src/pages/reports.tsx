import { useState, useMemo } from "react";
import {
  useGetReportSummary,
  useListPlayHistory,
  useGetReportPeriodSummary,
  useListScreens,
} from "@workspace/api-client-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  PlayCircle, TrendingUp, Calendar, Clock, Monitor, Download,
  FileText, Table2, ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── helpers ────────────────────────────────────────────────────────────────

function todayBRT() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // "YYYY-MM-DD"
}

function sevenDaysAgoBRT() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDuration(seconds?: number | null) {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    image: "Imagem", video: "Vídeo", web_channel: "Canal Web",
    rss: "RSS", weather: "Clima", clock: "Relógio",
  };
  return map[type] ?? type;
}

function typeColor(type: string) {
  const map: Record<string, string> = {
    image: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    video: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    web_channel: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    rss: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    weather: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    clock: "bg-green-500/10 text-green-400 border-green-500/20",
  };
  return map[type] ?? "bg-muted text-muted-foreground";
}

function StatCard({ label, value, icon: Icon, sub }: {
  label: string; value: number | string; icon: React.ElementType; sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className="text-3xl font-bold tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover shadow-md px-3 py-2 text-sm">
      <p className="font-medium">{label}</p>
      <p className="text-primary font-bold">{payload[0].value} exibições</p>
    </div>
  );
}

// ─── CSV export ─────────────────────────────────────────────────────────────

function exportDetailedCsv(items: any[], screenName: string, from: string, to: string) {
  const header = ["Data/Hora (BRT)", "Tela", "Mídia", "Tipo", "Duração"];
  const rows = items.map((i) => [
    fmtDatetime(i.playedAt),
    i.screenName,
    i.mediaName,
    typeLabel(i.mediaType),
    fmtDuration(i.durationSeconds),
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  downloadCsv(csv, `relatorio_detalhado_${screenName}_${from}_${to}.csv`);
}

function exportSummaryCsv(items: any[], screenName: string, from: string, to: string) {
  const header = ["Mídia", "Tipo", "Tela", "Exibições", "Tempo Total"];
  const rows = items.map((i) => [
    i.mediaName,
    typeLabel(i.mediaType),
    i.screenName ?? "Todas",
    i.playCount,
    fmtDuration(i.totalSeconds),
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  downloadCsv(csv, `relatorio_resumido_${screenName}_${from}_${to}.csv`);
}

function downloadCsv(content: string, filename: string) {
  const bom = "\uFEFF"; // UTF-8 BOM for Excel
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main page ───────────────────────────────────────────────────────────────

type Tab = "resumido" | "detalhado";

export default function Reports() {
  const [tab, setTab] = useState<Tab>("resumido");
  const [screenId, setScreenId] = useState<string>("all");
  const [startDate, setStartDate] = useState(sevenDaysAgoBRT());
  const [endDate, setEndDate] = useState(todayBRT());

  const { data: screens } = useListScreens();
  const { data: summary, isLoading: loadingSummary } = useGetReportSummary();

  const queryParams = useMemo(() => ({
    screenId: screenId !== "all" ? Number(screenId) : undefined,
    startDate,
    endDate,
  }), [screenId, startDate, endDate]);

  const { data: detailed, isLoading: loadingDetailed } = useListPlayHistory({
    ...queryParams,
    limit: 500,
  });

  const { data: periodSummary, isLoading: loadingPeriod } = useGetReportPeriodSummary(queryParams);

  const chartData = summary?.playsByDay?.map((d) => ({
    date: d.date.slice(5).replace("-", "/"),
    count: d.count,
  })) ?? [];

  const selectedScreenName = screenId === "all"
    ? "todas-telas"
    : (screens?.find((s: any) => String(s.id) === screenId)?.name ?? screenId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Histórico de exibição de mídias nas suas telas
        </p>
      </div>

      {/* Overview stats (always visible) */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Hoje" value={summary?.playsToday ?? 0} icon={Clock} sub="exibições no dia" />
          <StatCard label="Esta Semana" value={summary?.playsThisWeek ?? 0} icon={Calendar} sub="exibições na semana" />
          <StatCard label="Este Mês" value={summary?.playsThisMonth ?? 0} icon={TrendingUp} sub="exibições no mês" />
          <StatCard label="Total Geral" value={summary?.totalPlays ?? 0} icon={PlayCircle} sub="desde o início" />
        </div>
      )}

      {/* 7-day chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Exibições — Últimos 7 dias</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSummary ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Period report ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Relatório por Período
        </h2>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-end">
              {/* Screen selector */}
              <div className="space-y-1.5 min-w-[180px]">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Aparelho / Tela
                </Label>
                <Select value={screenId} onValueChange={setScreenId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas as telas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-2">
                        <Monitor className="w-3.5 h-3.5" /> Todas as telas
                      </span>
                    </SelectItem>
                    {screens?.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        <span className="flex items-center gap-2">
                          <Monitor className="w-3.5 h-3.5" /> {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date range */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  De
                </Label>
                <Input
                  type="date"
                  className="h-9 w-[150px]"
                  value={startDate}
                  max={endDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Até
                </Label>
                <Input
                  type="date"
                  className="h-9 w-[150px]"
                  value={endDate}
                  min={startDate}
                  max={todayBRT()}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Mode tabs */}
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  onClick={() => setTab("resumido")}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                    tab === "resumido"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5" /> Resumido
                </button>
                <button
                  onClick={() => setTab("detalhado")}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l ${
                    tab === "detalhado"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Detalhado
                </button>
              </div>

              {/* Export */}
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => {
                  if (tab === "resumido" && periodSummary?.items) {
                    exportSummaryCsv(periodSummary.items, selectedScreenName, startDate, endDate);
                  } else if (detailed?.items) {
                    exportDetailedCsv(detailed.items, selectedScreenName, startDate, endDate);
                  }
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Resumido (Summary) ────────────────────────────────────── */}
        {tab === "resumido" && (
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Resumo do período
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {startDate.split("-").reverse().join("/")} → {endDate.split("-").reverse().join("/")}
                </span>
              </CardTitle>
              {!loadingPeriod && (
                <Badge variant="secondary" className="text-xs tabular-nums">
                  {periodSummary?.totalPlays ?? 0} exibições
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {loadingPeriod ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : (periodSummary?.items?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <PlayCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="font-medium text-sm">Nenhuma exibição no período selecionado</p>
                  <p className="text-xs text-muted-foreground mt-1">Tente ampliar o período ou selecionar outra tela.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                        <th className="px-4 py-2.5 text-left font-semibold w-8">#</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Mídia</th>
                        <th className="px-4 py-2.5 text-left font-semibold w-24">Tipo</th>
                        {screenId === "all" && (
                          <th className="px-4 py-2.5 text-left font-semibold w-36">Tela</th>
                        )}
                        <th className="px-4 py-2.5 text-right font-semibold w-28">Exibições</th>
                        <th className="px-4 py-2.5 text-right font-semibold w-28">Tempo total</th>
                        <th className="px-4 py-2.5 text-right font-semibold w-28">Média/dia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {periodSummary!.items!.map((item: any, i: number) => {
                        const days = Math.max(1, Math.ceil(
                          (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000
                        ) + 1);
                        return (
                          <tr key={i} className="hover:bg-accent/20 transition-colors">
                            <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                            <td className="px-4 py-2.5 font-medium truncate max-w-[220px]" title={item.mediaName}>
                              {item.mediaName}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 uppercase ${typeColor(item.mediaType)}`}>
                                {typeLabel(item.mediaType)}
                              </Badge>
                            </td>
                            {screenId === "all" && (
                              <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-[140px]">
                                {item.screenName ?? "—"}
                              </td>
                            )}
                            <td className="px-4 py-2.5 text-right">
                              <span className="font-bold text-primary tabular-nums text-base">
                                {item.playCount.toLocaleString("pt-BR")}
                              </span>
                              <span className="text-muted-foreground text-xs ml-1">×</span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-muted-foreground tabular-nums">
                              {fmtDuration(item.totalSeconds)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-muted-foreground tabular-nums">
                              {(item.playCount / days).toFixed(1)}/dia
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Detalhado (Detailed log) ──────────────────────────────── */}
        {tab === "detalhado" && (
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Log detalhado
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {startDate.split("-").reverse().join("/")} → {endDate.split("-").reverse().join("/")}
                </span>
              </CardTitle>
              {!loadingDetailed && (
                <Badge variant="secondary" className="text-xs tabular-nums">
                  {(detailed?.total ?? 0).toLocaleString("pt-BR")} registros
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {loadingDetailed ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : (detailed?.items?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <PlayCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="font-medium text-sm">Nenhuma exibição no período selecionado</p>
                  <p className="text-xs text-muted-foreground mt-1">Tente ampliar o período ou selecionar outra tela.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                          <th className="px-4 py-2.5 text-left font-semibold w-40">Data e Hora (BRT)</th>
                          <th className="px-4 py-2.5 text-left font-semibold w-36">Tela</th>
                          <th className="px-4 py-2.5 text-left font-semibold">Mídia</th>
                          <th className="px-4 py-2.5 text-left font-semibold w-24">Tipo</th>
                          <th className="px-4 py-2.5 text-left font-semibold w-20">Duração</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {detailed!.items!.map((item: any) => (
                          <tr key={item.id} className="hover:bg-accent/20 transition-colors">
                            <td className="px-4 py-2 tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                              {fmtDatetime(item.playedAt)}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1.5">
                                <Monitor className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="font-medium truncate max-w-[120px]">{item.screenName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 font-medium truncate max-w-[220px]" title={item.mediaName}>
                              {item.mediaName}
                            </td>
                            <td className="px-4 py-2">
                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 uppercase ${typeColor(item.mediaType)}`}>
                                {typeLabel(item.mediaType)}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-muted-foreground tabular-nums text-xs">
                              {fmtDuration(item.durationSeconds)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(detailed?.total ?? 0) > 500 && (
                    <p className="text-xs text-muted-foreground text-center py-3 border-t">
                      Mostrando os 500 mais recentes de {detailed!.total!.toLocaleString("pt-BR")} registros.
                      Exporte o CSV para ver todos.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
