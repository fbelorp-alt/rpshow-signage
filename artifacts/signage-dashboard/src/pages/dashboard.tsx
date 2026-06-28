import { useGetDashboardStats, useGetDashboardActivity } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, ListVideo, Image as ImageIcon, Activity, CheckCircle2, Server, Radio, Database, Copy, Tv, PlayCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetDashboardActivity();
  const { user } = useAuth();
  const { toast } = useToast();

  const pairingCode = user?.pairingCode;

  const copyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    toast({ title: "Código copiado!" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tighter uppercase">Overview</h1>
          <p className="text-muted-foreground font-mono text-xs mt-2 tracking-widest uppercase">Network Status Control</p>
        </div>
        <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-3 py-1.5 rounded text-xs font-mono font-bold">
          <Radio className="w-4 h-4 animate-pulse" />
          LIVE BROADCASTING
        </div>
      </div>

      {/* Pairing Code Card */}
      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Tv className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Código de Pareamento das Telas
                </p>
                <p className="text-sm text-muted-foreground">
                  Insira este código em cada TVBox para conectar ao seu painel.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {pairingCode ? (
                <>
                  <code className="text-3xl font-black font-mono tracking-[0.3em] bg-background border-2 border-primary/40 px-5 py-2.5 rounded-lg text-primary shadow-inner">
                    {pairingCode}
                  </code>
                  <Button variant="outline" size="icon" onClick={copyCode} className="h-12 w-12 shrink-0">
                    <Copy className="w-5 h-5" />
                  </Button>
                </>
              ) : (
                <Skeleton className="h-12 w-40" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full rounded-none" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-sm border-l-4 border-l-emerald-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-mono font-bold uppercase text-muted-foreground">Telas</CardTitle>
              <Monitor className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{stats.totalScreens}</div>
              <div className="flex items-center gap-3 text-[10px] font-mono mt-1 tracking-wider uppercase">
                <span className="flex items-center text-emerald-600 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  {stats.onlineScreens} Online
                </span>
                <span className="flex items-center text-destructive font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive mr-1.5" />
                  {stats.totalScreens - stats.onlineScreens} Offline
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-sm border-l-4 border-l-secondary shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-mono font-bold uppercase text-muted-foreground">Playlists</CardTitle>
              <ListVideo className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{stats.totalPlaylists}</div>
              <p className="text-[10px] font-mono text-muted-foreground mt-1 tracking-wider uppercase">Sequências</p>
            </CardContent>
          </Card>

          <Card className="rounded-sm border-l-4 border-l-accent-foreground shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-mono font-bold uppercase text-muted-foreground">Mídias</CardTitle>
              <ImageIcon className="h-4 w-4 text-accent-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{stats.totalMedia}</div>
              <p className="text-[10px] font-mono text-muted-foreground mt-1 tracking-wider uppercase">Arquivos na biblioteca</p>
            </CardContent>
          </Card>

          <Card className="rounded-sm border-l-4 border-l-primary shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-mono font-bold uppercase text-muted-foreground">Exibições Hoje</CardTitle>
              <PlayCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{(stats as any).playsToday ?? 0}</div>
              <p className="text-[10px] font-mono text-muted-foreground mt-1 tracking-wider uppercase">Mídias reproduzidas</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-sm shadow-sm">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="uppercase tracking-tighter text-lg">Log de Atividade</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activityLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="divide-y">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                    <div className="bg-primary/10 p-2 rounded text-primary">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        <span className="font-bold uppercase text-xs mr-2 text-primary">{item.action}</span>
                        {item.entityType}: {item.entityName}
                      </p>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString("pt-BR", {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground font-mono text-sm uppercase tracking-widest">
                Nenhuma atividade recente
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-sm shadow-sm">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="uppercase tracking-tighter text-lg">Status do Sistema</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-bold uppercase tracking-tight">API Server</span>
                </div>
                <span className="flex items-center text-[10px] font-mono font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 uppercase tracking-widest">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Operacional
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-bold uppercase tracking-tight">Banco de Dados</span>
                </div>
                <span className="flex items-center text-[10px] font-mono font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 uppercase tracking-widest">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Conectado
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-bold uppercase tracking-tight">Storage</span>
                </div>
                <span className="flex items-center text-[10px] font-mono font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 uppercase tracking-widest">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Disponível
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
