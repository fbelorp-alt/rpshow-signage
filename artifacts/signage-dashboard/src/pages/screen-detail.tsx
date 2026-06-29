import { useState } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetScreen,
  useListSchedules,
  useUpdateScreen,
  useListPlaylists,
  getGetScreenQueryKey,
  getListScreensQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Monitor, ArrowLeft, MapPin, Hash, Clock, PlaySquare, Copy,
  ExternalLink, ListVideo, CheckCircle2, ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function ScreenDetail() {
  const [, params] = useRoute("/screens/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: screen, isLoading: screenLoading } = useGetScreen(id, {
    query: { enabled: !!id, queryKey: getGetScreenQueryKey(id) },
  });

  const { data: schedules, isLoading: schedulesLoading } = useListSchedules(
    { screenId: id },
    { query: { enabled: !!id, queryKey: ["listSchedules", id] } }
  );

  const { data: playlists } = useListPlaylists();
  const updateScreen = useUpdateScreen();

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [savedPlaylistId, setSavedPlaylistId] = useState<number | null | undefined>(undefined);
  const [selectedTimezone, setSelectedTimezone] = useState<string>("");
  const [savedTimezone, setSavedTimezone] = useState<string | undefined>(undefined);

  const effectiveDefaultId = savedPlaylistId !== undefined ? savedPlaylistId : screen?.defaultPlaylistId;
  const displayValue = effectiveDefaultId ? String(effectiveDefaultId) : "";
  const effectiveTimezone = savedTimezone !== undefined ? savedTimezone : (screen as any)?.timezone ?? "America/Sao_Paulo";

  const BRAZIL_TIMEZONES = [
    { value: "America/Sao_Paulo",    label: "Brasília / SP / RJ (BRT −3h)" },
    { value: "America/Manaus",       label: "Manaus / AM (AMT −4h)" },
    { value: "America/Belem",        label: "Belém / PA / MA (BRT −3h, sem verão)" },
    { value: "America/Fortaleza",    label: "Fortaleza / CE (BRT −3h)" },
    { value: "America/Recife",       label: "Recife / PE (BRT −3h)" },
    { value: "America/Cuiaba",       label: "Cuiabá / MT (AMT −4h)" },
    { value: "America/Porto_Velho",  label: "Porto Velho / RO (AMT −4h)" },
    { value: "America/Boa_Vista",    label: "Boa Vista / RR (AMT −4h)" },
    { value: "America/Rio_Branco",   label: "Rio Branco / AC (ACT −5h)" },
    { value: "America/Noronha",      label: "Fernando de Noronha (FNT −2h)" },
  ];

  const handleSaveTimezone = () => {
    const tz = selectedTimezone || effectiveTimezone;
    updateScreen.mutate(
      { id, data: { timezone: tz } },
      {
        onSuccess: () => {
          setSavedTimezone(tz);
          queryClient.invalidateQueries({ queryKey: getGetScreenQueryKey(id) });
          toast({ title: "Fuso horário salvo! O relógio na TV vai ajustar." });
          setSelectedTimezone("");
        },
        onError: () => toast({ title: "Erro ao salvar fuso horário", variant: "destructive" }),
      }
    );
  };

  const handleSaveDefault = () => {
    const newId = (selectedPlaylistId && selectedPlaylistId !== "none") ? Number(selectedPlaylistId) : null;
    updateScreen.mutate(
      { id, data: { defaultPlaylistId: newId } },
      {
        onSuccess: () => {
          setSavedPlaylistId(newId);
          queryClient.invalidateQueries({ queryKey: getGetScreenQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListScreensQueryKey() });
          toast({ title: newId ? "Playlist padrão salva! A tela já vai tocar 24h." : "Playlist padrão removida." });
          setSelectedPlaylistId("");
        },
        onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
      }
    );
  };

  if (screenLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32 mb-6" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 md:col-span-2 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!screen) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-semibold">Tela não encontrada</h2>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/screens">Voltar para Telas</Link>
        </Button>
      </div>
    );
  }

  const playerUrl = `${window.location.origin}/player/${screen.code}`;

  const defaultPlaylistName =
    (playlists ?? []).find((p: any) => p.id === effectiveDefaultId)?.name ??
    screen.defaultPlaylistName;

  return (
    <div className="space-y-8">
      {/* Back */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground -ml-2">
          <Link href="/screens">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Minhas Telas
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b pb-6">
        <div className="flex items-start gap-4">
          <div className="relative mt-1">
            <div className="w-16 h-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Monitor className="w-8 h-8" />
            </div>
            <div className={cn(
              "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-background",
              screen.status === "online" ? "bg-emerald-500" :
              screen.status === "offline" ? "bg-destructive" :
              "bg-muted-foreground"
            )} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{screen.name}</h1>
            <div className="flex items-center gap-3 mt-2 text-muted-foreground text-sm">
              {screen.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {screen.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Hash className="w-4 h-4" />
                <code className="font-mono">{screen.code}</code>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(playerUrl);
              toast({ title: "URL do player copiada!" });
            }}
            className="gap-2"
          >
            <Copy className="w-4 h-4" />
            Copiar URL
          </Button>
          <Button asChild className="gap-2">
            <a href={`/player/${screen.code}`} target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4" />
              Abrir Player
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: connection info + default playlist */}
        <div className="flex flex-col gap-4">
          {/* Connection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conexão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border text-center">
                <p className="text-xs text-muted-foreground mb-1">Código de Pareamento</p>
                <code className="text-3xl font-mono font-bold tracking-widest text-primary">
                  {screen.code}
                </code>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm border-b pb-2">
                  <span className="text-muted-foreground">Status</span>
                  <span className={cn(
                    "font-medium capitalize",
                    screen.status === "online" ? "text-emerald-500" :
                    screen.status === "offline" ? "text-destructive" :
                    "text-muted-foreground"
                  )}>
                    {screen.status === "online" ? "Online" : screen.status === "offline" ? "Offline" : "Desconhecido"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm border-b pb-2">
                  <span className="text-muted-foreground">Último sinal</span>
                  <span className="font-medium text-right">
                    {screen.lastSeen ? new Date(screen.lastSeen).toLocaleString("pt-BR") : "Nunca"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Cadastrada em</span>
                  <span className="font-medium">{new Date(screen.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Default Playlist */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ListVideo className="w-4 h-4 text-primary" />
                Playlist Padrão (24h)
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Toca o tempo todo. Campanhas agendadas sobrepõem automaticamente no horário configurado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {effectiveDefaultId ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-sm font-medium text-emerald-400 truncate">{defaultPlaylistName ?? "—"}</span>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                  Nenhuma playlist padrão definida. A tela ficará em branco fora dos horários de campanha.
                </div>
              )}

              <div className="space-y-2">
                <select
                  value={selectedPlaylistId}
                  onChange={(e) => setSelectedPlaylistId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Selecione a lista de reprodução...</option>
                  <option value="none">— Remover playlist padrão —</option>
                  {(playlists ?? []).map((p: any) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Button
                  className="w-full"
                  disabled={!selectedPlaylistId || updateScreen.isPending}
                  onClick={handleSaveDefault}
                >
                  {updateScreen.isPending ? "Salvando..." : "Salvar Playlist Padrão"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Timezone */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Fuso Horário do Relógio
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Define a hora exibida no widget de relógio. Corrige TVs com hora errada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border text-sm">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-mono text-xs text-muted-foreground truncate">{effectiveTimezone}</span>
              </div>
              <div className="space-y-2">
                <select
                  value={selectedTimezone}
                  onChange={(e) => setSelectedTimezone(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Selecione o fuso horário...</option>
                  {BRAZIL_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
                <Button
                  className="w-full"
                  disabled={!selectedTimezone || updateScreen.isPending}
                  onClick={handleSaveTimezone}
                >
                  {updateScreen.isPending ? "Salvando..." : "Salvar Fuso Horário"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: schedules (campaigns) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Campanhas Agendadas</CardTitle>
              <CardDescription className="text-xs">
                Sobrepõem a playlist padrão nos horários configurados
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/schedules">Gerenciar</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {schedulesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : schedules && schedules.length > 0 ? (
              <div className="space-y-3">
                {schedules.map((schedule: any) => (
                  <div
                    key={schedule.id}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border transition-colors",
                      schedule.active ? "bg-card hover:bg-accent/50" : "bg-muted/50 opacity-70"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <PlaySquare className={cn("w-5 h-5 mt-0.5 shrink-0", schedule.active ? "text-primary" : "text-muted-foreground")} />
                      <div>
                        <Link
                          href={`/playlists/${schedule.playlistId}`}
                          className="font-medium hover:underline hover:text-primary transition-colors"
                        >
                          {schedule.playlistName}
                        </Link>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {schedule.startTime || "00:00"} – {schedule.endTime || "23:59"}
                          </span>
                          {schedule.daysOfWeek && (
                            <span>· Dias: {schedule.daysOfWeek}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge variant={schedule.active ? "default" : "secondary"} className="shrink-0">
                      {schedule.active ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-foreground">Nenhuma campanha agendada</p>
                <p className="text-sm mt-1">
                  {effectiveDefaultId
                    ? "A playlist padrão roda 24h. Adicione campanhas para horários específicos."
                    : "Defina uma playlist padrão ao lado ou crie uma campanha."}
                </p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href="/schedules">Nova Campanha</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
