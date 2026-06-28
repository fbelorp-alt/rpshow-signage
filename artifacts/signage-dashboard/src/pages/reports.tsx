import { useGetReportSummary, useListPlayHistory } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PlayCircle, TrendingUp, Calendar, Clock, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: number | string; icon: React.ElementType; sub?: string }) {
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

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover shadow-md px-3 py-2 text-sm">
      <p className="font-medium">{label}</p>
      <p className="text-primary font-bold">{payload[0].value} exibições</p>
    </div>
  );
}

export default function Reports() {
  const { data: summary, isLoading: loadingSummary } = useGetReportSummary();
  const { data: history, isLoading: loadingHistory } = useListPlayHistory({ limit: 50 });

  const chartData = summary?.playsByDay?.map((d) => ({
    date: d.date.slice(5),
    count: d.count,
  })) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground text-sm mt-1">Histórico de exibição de mídias nas suas telas</p>
      </div>

      {/* Stats */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Hoje" value={summary?.playsToday ?? 0} icon={Clock} sub="exibições no dia" />
          <StatCard label="Esta Semana" value={summary?.playsThisWeek ?? 0} icon={Calendar} sub="exibições na semana" />
          <StatCard label="Este Mês" value={summary?.playsThisMonth ?? 0} icon={TrendingUp} sub="exibições no mês" />
          <StatCard label="Total Geral" value={summary?.totalPlays ?? 0} icon={PlayCircle} sub="exibições desde o início" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Exibições — Últimos 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSummary ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
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

        {/* Top media */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top 10 Mídias</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSummary ? (
              <div className="space-y-2">
                {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-7" />)}
              </div>
            ) : (summary?.topMedia?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma exibição ainda</p>
            ) : (
              <div className="space-y-1.5">
                {summary!.topMedia!.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-xs text-muted-foreground tabular-nums shrink-0">{i + 1}.</span>
                    <span className="flex-1 truncate font-medium" title={item.mediaName}>{item.mediaName}</span>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 shrink-0 ${typeColor(item.mediaType)}`}>
                      {typeLabel(item.mediaType)}
                    </Badge>
                    <span className="tabular-nums text-xs font-bold text-primary shrink-0">{item.playCount}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Histórico Recente</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingHistory ? (
            <div className="p-4 space-y-2">
              {[1,2,3,4,5,6].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : (history?.items?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <PlayCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="font-medium text-sm">Nenhuma exibição registrada ainda</p>
              <p className="text-xs text-muted-foreground mt-1">As exibições aparecerão aqui assim que o player começar a rodar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-2.5 text-left font-semibold">Tela</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Mídia</th>
                    <th className="px-4 py-2.5 text-left font-semibold w-24">Tipo</th>
                    <th className="px-4 py-2.5 text-left font-semibold w-20">Duração</th>
                    <th className="px-4 py-2.5 text-left font-semibold w-40">Exibido em</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history!.items!.map((item: any) => (
                    <tr key={item.id} className="hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <Monitor className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate max-w-[140px]">{item.screenName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 truncate max-w-[200px] font-medium">{item.mediaName}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 uppercase ${typeColor(item.mediaType)}`}>
                          {typeLabel(item.mediaType)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground tabular-nums text-xs">
                        {item.durationSeconds ? `${item.durationSeconds}s` : "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground tabular-nums text-xs">
                        {item.playedAt
                          ? new Date(item.playedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
