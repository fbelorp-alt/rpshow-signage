import { useState } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetClient,
  useListScreens,
  useListPlaylists,
  getGetClientQueryKey,
  getListScreensQueryKey,
  getListPlaylistsQueryKey,
} from "@workspace/api-client-react";
import {
  Building2, MapPin, Monitor, ListVideo, Phone, User, Activity,
  Clock, ArrowLeft, Navigation, Wifi, WifiOff, Signal, AlertCircle,
  ExternalLink, Camera, Map,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "geral" | "telas" | "locais" | "playlists";

function StatusIcon({ status }: { status: string }) {
  if (status === "online") return <Wifi className="w-3.5 h-3.5 text-emerald-500" />;
  if (status === "offline") return <WifiOff className="w-3.5 h-3.5 text-destructive" />;
  return <Signal className="w-3.5 h-3.5 text-muted-foreground" />;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn(
      "text-[10px] font-semibold uppercase tracking-wide",
      status === "online" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      status === "offline" && "bg-destructive/10 text-destructive border-destructive/20",
      status === "never" && "bg-muted text-muted-foreground",
    )}>
      {status === "online" ? "Online" : status === "offline" ? "Offline" : "Nunca conectou"}
    </Badge>
  );
}

function LocationCard({ screen }: { screen: any }) {
  const [imgError, setImgError] = useState(false);
  const hasLocation = !!(screen.location?.trim());
  const mapsEmbedUrl = hasLocation
    ? `https://maps.google.com/maps?q=${encodeURIComponent(screen.location)}&output=embed&zoom=15`
    : null;
  const mapsLinkUrl = hasLocation
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(screen.location)}`
    : null;

  return (
    <Card className="overflow-hidden border border-border/60 hover:border-primary/30 transition-all duration-200 group">
      <div className="relative">
        {/* Mapa embutido */}
        <div className="relative w-full h-44 bg-muted overflow-hidden">
          {mapsEmbedUrl ? (
            <iframe
              src={mapsEmbedUrl}
              className="w-full h-full border-0 pointer-events-none"
              loading="lazy"
              title={`Mapa - ${screen.name}`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
              <Map className="w-10 h-10" />
              <span className="text-xs">Sem localização cadastrada</span>
            </div>
          )}

          {/* Badge status sobreposta */}
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-sm">
            <StatusIcon status={screen.status} />
            <span className={cn(
              "text-[10px] font-semibold",
              screen.status === "online" ? "text-emerald-600" :
              screen.status === "offline" ? "text-destructive" : "text-muted-foreground"
            )}>
              {screen.status === "online" ? "Online" : screen.status === "offline" ? "Offline" : "Inativo"}
            </span>
          </div>

          {/* Abrir no Google Maps */}
          {mapsLinkUrl && (
            <a
              href={mapsLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-2 left-2 flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-sm hover:bg-background transition-colors"
              title="Abrir no Google Maps"
            >
              <ExternalLink className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-medium text-primary">Maps</span>
            </a>
          )}
        </div>

        {/* Foto do painel (screenshot) */}
        <div className="relative w-full h-28 bg-black overflow-hidden border-t border-border/40">
          {screen.lastScreenshot && !imgError ? (
            <img
              src={screen.lastScreenshot}
              alt={`Painel ${screen.name}`}
              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/30">
              <Camera className="w-8 h-8" />
              <span className="text-[10px]">Sem foto do painel</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-2 left-2 right-2">
            <p className="text-xs font-semibold text-white truncate">{screen.name}</p>
            {screen.resolution && (
              <p className="text-[10px] text-white/60">{screen.resolution}</p>
            )}
          </div>
        </div>
      </div>

      <CardContent className="p-3 space-y-2">
        {/* Endereço */}
        <div className="flex items-start gap-2">
          <Navigation className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-foreground leading-snug">
            {screen.location || <span className="text-muted-foreground italic">Endereço não informado</span>}
          </p>
        </div>

        {/* Link para detalhe da tela */}
        <Link href={`/screens/${screen.id}`}>
          <button className="w-full mt-1 text-[11px] text-primary hover:text-primary/80 font-medium flex items-center justify-center gap-1 py-1 rounded-md hover:bg-primary/5 transition-colors border border-primary/20">
            <Monitor className="w-3 h-3" />
            Ver detalhes da tela
          </button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function ClientDetail() {
  const [, params] = useRoute("/clients/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const [activeTab, setActiveTab] = useState<Tab>("geral");

  const { data: client, isLoading: clientLoading } = useGetClient(id, {
    query: { enabled: !!id, queryKey: getGetClientQueryKey(id) },
  });

  const { data: screens = [], isLoading: screensLoading } = useListScreens({ clientId: id }, {
    query: { enabled: !!id, queryKey: getListScreensQueryKey({ clientId: id }) },
  });

  const { data: playlists = [], isLoading: playlistsLoading } = useListPlaylists({ clientId: id }, {
    query: { enabled: !!id, queryKey: getListPlaylistsQueryKey({ clientId: id }) },
  });

  const screensArr = (screens as any[]) ?? [];
  const playlistsArr = (playlists as any[]) ?? [];
  const screensWithLocation = screensArr.filter((s: any) => s.location?.trim());

  if (clientLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32 mb-6" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold">Cliente não encontrado</h2>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/clients">Voltar para Clientes</Link>
        </Button>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "geral", label: "Visão Geral" },
    { id: "telas", label: "Telas", count: screensArr.length },
    { id: "locais", label: "Locais", count: screensWithLocation.length },
    { id: "playlists", label: "Playlists", count: playlistsArr.length },
  ];

  return (
    <div className="space-y-0 -m-4 sm:-m-6">

      {/* ── CABEÇALHO ── */}
      <div className="bg-card border-b border-border px-6 pt-5 pb-0">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground -ml-2 mb-3">
            <Link href="/clients">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Clientes
            </Link>
          </Button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight truncate">{(client as any).name}</h1>
                {!(client as any).active && (
                  <Badge variant="secondary">Inativo</Badge>
                )}
                {(client as any).segment && (
                  <Badge variant="outline" className="font-normal text-xs">{(client as any).segment}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                {(client as any).cnpj && <span>CNPJ: {(client as any).cnpj}</span>}
                <span className="flex items-center gap-1">
                  <Monitor className="w-3.5 h-3.5" />
                  {screensArr.length} tela{screensArr.length !== 1 ? "s" : ""}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  "ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
                  activeTab === tab.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTEÚDO ── */}
      <div className="px-6 py-6">

        {/* ── ABA: VISÃO GERAL ── */}
        {activeTab === "geral" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Contato */}
            <Card>
              <CardContent className="p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" /> Informações de Contato
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <User className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Responsável</p>
                      <p className="text-sm">{(client as any).contactName || "Não informado"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Phone className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Telefone</p>
                      <p className="text-sm">{(client as any).contactPhone || "Não informado"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Endereço</p>
                      <p className="text-sm">{(client as any).address || "Não informado"}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resumo de telas */}
            <Card>
              <CardContent className="p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-primary" /> Resumo de Telas
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Total", value: screensArr.length, color: "text-foreground" },
                    { label: "Online", value: screensArr.filter((s: any) => s.status === "online").length, color: "text-emerald-600" },
                    { label: "Offline", value: screensArr.filter((s: any) => s.status === "offline").length, color: "text-destructive" },
                    { label: "Com localização", value: screensWithLocation.length, color: "text-primary" },
                  ].map(item => (
                    <div key={item.label} className="rounded-lg border border-border/60 p-3 text-center">
                      <p className={cn("text-2xl font-black tabular-nums", item.color)}>{item.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Ações rápidas */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <p className="text-sm font-semibold text-foreground">Ações Rápidas</p>
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveTab("locais")}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Navigation className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">Ver Locais</p>
                      <p className="text-[10px] text-muted-foreground">{screensWithLocation.length} com endereço</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab("telas")}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Monitor className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">Gerenciar Telas</p>
                      <p className="text-[10px] text-muted-foreground">{screensArr.length} tela{screensArr.length !== 1 ? "s" : ""} cadastrada{screensArr.length !== 1 ? "s" : ""}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab("playlists")}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <ListVideo className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">Playlists</p>
                      <p className="text-[10px] text-muted-foreground">{playlistsArr.length} playlist{playlistsArr.length !== 1 ? "s" : ""}</p>
                    </div>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── ABA: TELAS ── */}
        {activeTab === "telas" && (
          <div className="space-y-3">
            {screensLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
            ) : screensArr.length > 0 ? (
              screensArr.map((screen: any) => (
                <Link key={screen.id} href={`/screens/${screen.id}`}>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card hover:bg-accent/40 hover:border-primary/20 transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        screen.status === "online" ? "bg-emerald-500/10" :
                        screen.status === "offline" ? "bg-destructive/10" : "bg-muted"
                      )}>
                        <Monitor className={cn("w-4 h-4",
                          screen.status === "online" ? "text-emerald-600" :
                          screen.status === "offline" ? "text-destructive" : "text-muted-foreground"
                        )} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{screen.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          {screen.location ? (
                            <><Navigation className="w-2.5 h-2.5" />{screen.location}</>
                          ) : (
                            <span className="italic">Sem endereço</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={screen.status} />
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <Monitor className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma tela cadastrada para este cliente</p>
              </div>
            )}
          </div>
        )}

        {/* ── ABA: LOCAIS ── */}
        {activeTab === "locais" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Navigation className="w-4 h-4 text-primary" />
              <span>Locais das telas cadastradas para <strong className="text-foreground">{(client as any).name}</strong></span>
            </div>

            {screensLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
              </div>
            ) : screensWithLocation.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {screensWithLocation.map((screen: any) => (
                  <LocationCard key={screen.id} screen={screen} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
                <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Nenhuma tela com localização</p>
                <p className="text-xs mt-1 max-w-xs mx-auto">
                  Cadastre o endereço nas telas vinculadas a este cliente para visualizá-las aqui.
                </p>
                <button
                  onClick={() => setActiveTab("telas")}
                  className="mt-4 text-xs text-primary hover:underline"
                >
                  Ver telas cadastradas →
                </button>
              </div>
            )}

            {/* Telas sem localização */}
            {!screensLoading && screensArr.length > screensWithLocation.length && (
              <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border/40 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">{screensArr.length - screensWithLocation.length} tela{screensArr.length - screensWithLocation.length !== 1 ? "s" : ""}</strong> sem endereço cadastrado.
                  Acesse os detalhes de cada tela para adicionar a localização.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── ABA: PLAYLISTS ── */}
        {activeTab === "playlists" && (
          <div className="space-y-3">
            {playlistsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : playlistsArr.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {playlistsArr.map((playlist: any) => (
                  <Link key={playlist.id} href={`/playlists/${playlist.id}`}>
                    <div className="p-4 rounded-xl border border-border/60 bg-card hover:bg-accent/40 hover:border-primary/20 transition-all cursor-pointer group">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <ListVideo className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{playlist.name}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Activity className="w-3 h-3" />
                              {playlist.itemCount} itens
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {Math.round((playlist.totalDurationSeconds || 0) / 60)} min
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <ListVideo className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma playlist criada para este cliente</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
