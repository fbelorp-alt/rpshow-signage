import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Play, Pause, Heart, Plus, Search, Radio, Music, 
  Volume2, Globe, ListFilter, AlertTriangle, Loader2, Video 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useListPlaylists } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

interface RadioStation {
  stationuuid: string;
  name: string;
  url: string;
  urlResolved: string;
  favicon?: string | null;
  tags?: string | null;
  country?: string | null;
  language?: string | null;
  codec?: string | null;
  bitrate?: number | null;
}

interface VisualItem {
  id: number;
  title: string;
  previewUrl: string;
  videoUrl: string;
  author: string;
  sourceUrl: string;
}

const fetchCatalog = async (params: Record<string, string>): Promise<RadioStation[]> => {
  const query = new URLSearchParams(params);
  const res = await fetch(`/api/radios/catalog?${query.toString()}`);
  if (!res.ok) throw new Error("Falha ao carregar catálogo");
  return res.json();
};

const fetchFavorites = async (): Promise<RadioStation[]> => {
  const res = await fetch("/api/radios/favorites");
  if (!res.ok) throw new Error("Falha ao carregar favoritos");
  return res.json();
};

const toggleFavoriteApi = async (station: RadioStation, isFavorite: boolean) => {
  const res = await fetch("/api/radios/favorites", {
    method: isFavorite ? "DELETE" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(isFavorite ? { stationUuid: station.stationuuid } : { station }),
  });
  if (!res.ok) throw new Error("Falha ao atualizar favorito");
};

const addToPlaylistApi = async (station: RadioStation, playlistId: number) => {
  const res = await fetch("/api/radios/add-to-playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ station, playlistId }),
  });
  if (!res.ok) throw new Error("Falha ao adicionar à playlist");
};

const fetchVisuals = async (search: string): Promise<VisualItem[]> => {
  const res = await fetch(`/api/radios/visuals?search=${encodeURIComponent(search || "relaxing nature landscapes")}`);
  if (!res.ok) throw new Error("Falha ao carregar vídeos");
  return res.json();
};

const addVisualToPlaylistApi = async (visual: VisualItem, playlistId: number) => {
  const res = await fetch("/api/radios/add-visual-to-playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...visual, playlistId }),
  });
  if (!res.ok) throw new Error("Falha ao adicionar vídeo à playlist");
};

export default function Radios() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"catalog" | "favorites" | "visuals">("catalog");
  
  const [search, setSearch] = useState("");
  const [visualSearch, setVisualSearch] = useState("");
  const [country, setCountry] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("");

  const debouncedSearch = useDebounce(search, 500);
  const debouncedVisualSearch = useDebounce(visualSearch, 500);
  const debouncedCountry = useDebounce(country, 500);
  const debouncedGenre = useDebounce(genre, 500);
  const debouncedLanguage = useDebounce(language, 500);

  const [playingStation, setPlayingStation] = useState<RadioStation | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [stationToAdd, setStationToAdd] = useState<RadioStation | null>(null);
  const [visualToAdd, setVisualToAdd] = useState<VisualItem | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");

  const { data: catalog = [], isLoading: isLoadingCatalog, isError: isErrorCatalog } = useQuery({
    queryKey: ["radios", "catalog", debouncedSearch, debouncedCountry, debouncedGenre, debouncedLanguage],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (debouncedCountry) params.country = debouncedCountry;
      if (debouncedGenre) params.tag = debouncedGenre;
      if (debouncedLanguage) params.language = debouncedLanguage;
      return fetchCatalog(params);
    },
    enabled: activeTab === "catalog",
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["radios", "favorites"],
    queryFn: fetchFavorites,
  });

  const { data: visuals = [], isLoading: isLoadingVisuals, isError: isErrorVisuals } = useQuery({
    queryKey: ["radios", "visuals", debouncedVisualSearch],
    queryFn: () => fetchVisuals(debouncedVisualSearch),
    enabled: activeTab === "visuals",
  });

  const { data: playlists } = useListPlaylists();

  const favoriteIds = useMemo(() => new Set(favorites.map(f => f.stationuuid)), [favorites]);

  const favoriteMutation = useMutation({
    mutationFn: ({ station, isFav }: { station: RadioStation; isFav: boolean }) => toggleFavoriteApi(station, isFav),
    onMutate: async ({ station, isFav }) => {
      await queryClient.cancelQueries({ queryKey: ["radios", "favorites"] });
      const previousFavorites = queryClient.getQueryData<RadioStation[]>(["radios", "favorites"]) || [];
      
      queryClient.setQueryData<RadioStation[]>(["radios", "favorites"], old => {
        if (!old) return [];
        if (isFav) return old.filter(f => f.stationuuid !== station.stationuuid);
        return [...old, station];
      });
      return { previousFavorites };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(["radios", "favorites"], context?.previousFavorites);
      toast({ title: "Erro ao favoritar", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["radios", "favorites"] });
    },
  });

  const addToPlaylistMutation = useMutation({
    mutationFn: ({ station, pId }: { station: RadioStation; pId: number }) => addToPlaylistApi(station, pId),
    onSuccess: () => {
      toast({ title: "Rádio adicionada à playlist com sucesso!" });
      setPlaylistModalOpen(false);
      setStationToAdd(null);
      setVisualToAdd(null);
      setSelectedPlaylistId("");
    },
    onError: () => {
      toast({ title: "Erro ao adicionar à playlist", variant: "destructive" });
    },
  });

  const addVisualToPlaylistMutation = useMutation({
    mutationFn: ({ visual, pId }: { visual: VisualItem; pId: number }) => addVisualToPlaylistApi(visual, pId),
    onSuccess: () => {
      toast({ title: "Cenário adicionado à playlist com sucesso!" });
      setPlaylistModalOpen(false);
      setStationToAdd(null);
      setVisualToAdd(null);
      setSelectedPlaylistId("");
    },
    onError: () => {
      toast({ title: "Erro ao adicionar cenário à playlist", variant: "destructive" });
    },
  });

  const displayedStations = useMemo(() => {
    if (activeTab === "catalog") return catalog;

    return favorites.filter(s => {
      const matchSearch = !debouncedSearch || (s.name && s.name.toLowerCase().includes(debouncedSearch.toLowerCase())) || 
                          (s.tags && s.tags.toLowerCase().includes(debouncedSearch.toLowerCase()));
      const matchCountry = !debouncedCountry || (s.country && s.country.toLowerCase().includes(debouncedCountry.toLowerCase()));
      const matchLanguage = !debouncedLanguage || (s.language && s.language.toLowerCase().includes(debouncedLanguage.toLowerCase()));
      const matchGenre = !debouncedGenre || (s.tags && s.tags.toLowerCase().includes(debouncedGenre.toLowerCase()));
      
      return matchSearch && matchCountry && matchLanguage && matchGenre;
    });
  }, [activeTab, catalog, favorites, debouncedSearch, debouncedCountry, debouncedLanguage, debouncedGenre]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handlePlay = (station: RadioStation) => {
    if (playingStation?.stationuuid === station.stationuuid) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      setPlayingStation(station);
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (playingStation && audioRef.current) {
      audioRef.current.src = playingStation.urlResolved || playingStation.url;
      audioRef.current.play().catch(e => {
        console.error("Audio playback error:", e);
        setIsPlaying(false);
        toast({ title: "Não foi possível reproduzir a rádio", variant: "destructive" });
      });
    }
  }, [playingStation]);

  const handleToggleFavorite = (station: RadioStation) => {
    const isFav = favoriteIds.has(station.stationuuid);
    favoriteMutation.mutate({ station, isFav });
  };

  const handleOpenPlaylistModal = (station: RadioStation) => {
    setStationToAdd(station);
    setVisualToAdd(null);
    setPlaylistModalOpen(true);
  };

  const handleOpenVisualPlaylistModal = (visual: VisualItem) => {
    setVisualToAdd(visual);
    setStationToAdd(null);
    setPlaylistModalOpen(true);
  };

  const handleAddToPlaylist = () => {
    if (!selectedPlaylistId) return;
    if (stationToAdd) {
      addToPlaylistMutation.mutate({ station: stationToAdd, pId: parseInt(selectedPlaylistId, 10) });
    } else if (visualToAdd) {
      addVisualToPlaylistMutation.mutate({ visual: visualToAdd, pId: parseInt(selectedPlaylistId, 10) });
    }
  };

  if (activeTab === "catalog" && isLoadingCatalog && !debouncedSearch && !debouncedCountry && !debouncedGenre && !debouncedLanguage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] text-muted-foreground gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-lg">Sintonizando frequências...</p>
      </div>
    );
  }

  if (activeTab === "catalog" && isErrorCatalog) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] text-muted-foreground gap-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <p className="text-lg">Não foi possível carregar o catálogo de rádios.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none -z-10" />

      <div className="p-6 md:p-8 flex-1 overflow-y-auto pb-32">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
              <Radio className="w-8 h-8 text-primary" />
              Rádios Online
            </h1>
            <p className="text-muted-foreground mt-2 text-lg max-w-xl">
              Descubra estações do mundo todo e adicione trilhas sonoras envolventes às suas telas.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-8">
          <TabsList className="bg-muted/50 border border-border/50 h-12 p-1">
            <TabsTrigger value="catalog" className="h-full px-6 text-sm font-semibold rounded-md data-[state=active]:bg-background data-[state=active]:shadow-md transition-all">
              Catálogo Global
            </TabsTrigger>
            <TabsTrigger value="favorites" className="h-full px-6 text-sm font-semibold rounded-md data-[state=active]:bg-background data-[state=active]:shadow-md transition-all">
              <Heart className="w-4 h-4 mr-2" />
              Minhas Favoritas
            </TabsTrigger>
            <TabsTrigger value="visuals" className="h-full px-6 text-sm font-semibold rounded-md data-[state=active]:bg-background data-[state=active]:shadow-md transition-all">
              <Video className="w-4 h-4 mr-2" />
              Cenários Relaxantes
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === "visuals" ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-4 mb-4 bg-card/40 p-4 rounded-xl border border-border/50 backdrop-blur-sm">
              <div className="flex-1 min-w-[280px] relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Buscar tema de cenário (ex: nature, city, rain)..." 
                  value={visualSearch}
                  onChange={e => setVisualSearch(e.target.value)}
                  className="pl-10 h-12 bg-background border-border/50 text-base rounded-lg"
                />
              </div>
            </div>

            {isLoadingVisuals ? (
              <div className="py-20 text-center flex flex-col items-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <h3 className="text-xl font-bold text-foreground">Buscando cenários...</h3>
              </div>
            ) : isErrorVisuals ? (
              <div className="py-20 text-center flex flex-col items-center">
                <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
                <h3 className="text-xl font-bold text-foreground">Não foi possível carregar os cenários</h3>
                <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Tentar novamente</Button>
              </div>
            ) : visuals.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Video className="w-10 h-10 text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Nenhum cenário encontrado</h3>
                <p className="text-muted-foreground mt-2">Tente buscar por outro termo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {visuals.map((visual: VisualItem) => (
                  <div key={visual.id} className="group relative bg-card hover:bg-card/80 border border-border/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1">
                    <div className="relative aspect-video bg-muted/30 overflow-hidden">
                      <img 
                        src={visual.previewUrl} 
                        alt={visual.title} 
                        className="w-full h-full object-cover relative z-10 transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity z-20" />
                      
                      <div className="absolute bottom-3 left-3 right-3 z-30">
                        <h3 className="font-bold text-white text-sm line-clamp-1">{visual.title}</h3>
                        <p className="text-xs text-white/80 line-clamp-1 flex items-center gap-1 mt-0.5">
                          <span>Vídeo por <a href={visual.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-white transition-colors" onClick={e => e.stopPropagation()}>{visual.author}</a> no Pexels</span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="p-4 flex items-center justify-end">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 px-3 text-primary hover:text-primary hover:bg-primary/10"
                        onClick={() => handleOpenVisualPlaylistModal(visual)}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Adicionar à Playlist
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-4 mb-8 bg-card/40 p-4 rounded-xl border border-border/50 backdrop-blur-sm">
              <div className="flex-1 min-w-[280px] relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Buscar rádio..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10 h-12 bg-background border-border/50 text-base rounded-lg"
                />
              </div>
              
              <div className="flex-1 min-w-[150px] relative">
                <ListFilter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Gênero" 
                  value={genre}
                  onChange={e => setGenre(e.target.value)}
                  className="pl-9 h-12 bg-background border-border/50 rounded-lg"
                />
              </div>

              <div className="flex-1 min-w-[150px] relative">
                <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="País" 
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="pl-9 h-12 bg-background border-border/50 rounded-lg"
                />
              </div>

              <div className="flex-1 min-w-[150px] relative">
                <Input 
                  placeholder="Idioma" 
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="px-4 h-12 bg-background border-border/50 rounded-lg"
                />
              </div>
            </div>

            {displayedStations.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center">
                {isLoadingCatalog && activeTab === "catalog" ? (
                  <>
                    <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                    <h3 className="text-xl font-bold text-foreground">Buscando estações...</h3>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                      <Radio className="w-10 h-10 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">Nenhuma rádio encontrada</h3>
                    <p className="text-muted-foreground mt-2">Ajuste seus filtros para ver mais resultados.</p>
                    {(search || country || genre || language) && (
                      <Button 
                        variant="outline" 
                        className="mt-6"
                        onClick={() => { setSearch(""); setCountry(""); setGenre(""); setLanguage(""); }}
                      >
                        Limpar filtros
                      </Button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {displayedStations.map(station => {
                  const isFav = favoriteIds.has(station.stationuuid);
                  const isThisPlaying = playingStation?.stationuuid === station.stationuuid && isPlaying;
                  
                  return (
                    <div key={station.stationuuid} className="group relative bg-card hover:bg-card/80 border border-border/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1">
                      <div className="relative aspect-square bg-muted/30 p-6 flex flex-col items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary via-background to-background pointer-events-none" />
                        
                        {station.favicon ? (
                          <img 
                            src={station.favicon} 
                            alt={station.name} 
                            className="w-full h-full object-contain drop-shadow-md relative z-10 transition-transform duration-500 group-hover:scale-105"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={cn("w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center", station.favicon ? "hidden" : "flex")}>
                          <Music className="w-10 h-10 text-primary/60" />
                        </div>

                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px] z-20">
                          <button 
                            onClick={() => handlePlay(station)}
                            className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-primary/30"
                          >
                            {isThisPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 ml-1 fill-current" />}
                          </button>
                        </div>

                        <div className="absolute top-3 right-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleToggleFavorite(station)}
                            className="p-2.5 rounded-full bg-background/90 backdrop-blur text-foreground hover:text-red-500 hover:bg-background transition-colors shadow-sm"
                          >
                            <Heart className={cn("w-4 h-4", isFav && "fill-red-500 text-red-500")} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="p-4 flex-1 flex flex-col border-t border-border/30">
                        <h3 className="font-bold text-base line-clamp-1 group-hover:text-primary transition-colors" title={station.name}>{station.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1 capitalize">
                          {[station.country, station.language].filter(Boolean).join(" • ")}
                        </p>
                        
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex gap-1.5 flex-wrap">
                            {station.bitrate ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted/60 font-medium">
                                {station.bitrate} kbps
                              </Badge>
                            ) : null}
                          </div>
                          
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10 ml-auto"
                            onClick={() => handleOpenPlaylistModal(station)}
                          >
                            <Plus className="w-4 h-4 mr-1" /> Adicionar
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {playingStation && (
        <div className="absolute bottom-0 inset-x-0 h-24 bg-card/95 backdrop-blur-xl border-t border-border shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.3)] z-40 flex items-center px-6 md:px-8 animate-in slide-in-from-bottom-full duration-300">
          <div className="flex items-center gap-4 w-1/3">
            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
              {playingStation.favicon ? (
                <img src={playingStation.favicon} alt="" className="w-full h-full object-cover" />
              ) : (
                <Radio className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-foreground line-clamp-1">{playingStation.name}</h4>
              <p className="text-sm text-muted-foreground line-clamp-1 capitalize">{playingStation.country}</p>
            </div>
            <button 
              onClick={() => handleToggleFavorite(playingStation)}
              className="p-2 ml-2 hover:bg-muted rounded-full transition-colors hidden sm:block"
            >
              <Heart className={cn("w-5 h-5", favoriteIds.has(playingStation.stationuuid) ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => handlePlay(playingStation)}
                className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-1 fill-current" />}
              </button>
            </div>
            {isPlaying && (
              <div className="flex items-center gap-1 h-3 mt-1">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                  <div 
                    key={i} 
                    className="w-1 bg-primary rounded-full animate-pulse" 
                    style={{ 
                      height: `${Math.max(30, Math.random() * 100)}%`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: '0.5s'
                    }} 
                  />
                ))}
              </div>
            )}
          </div>

          <div className="w-1/3 flex items-center justify-end gap-3">
            <Volume2 className="w-5 h-5 text-muted-foreground hidden sm:block" />
            <input 
              type="range" 
              min="0" max="1" step="0.01" 
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-24 sm:w-32 accent-primary hidden sm:block"
            />
            <Button 
              size="sm"
              onClick={() => handleOpenPlaylistModal(playingStation)}
              className="ml-4 gap-2 hidden md:flex"
            >
              <Plus className="w-4 h-4" /> Adicionar à Playlist
            </Button>
          </div>
        </div>
      )}

      <audio 
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      <Dialog open={playlistModalOpen} onOpenChange={setPlaylistModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar à Playlist</DialogTitle>
            <DialogDescription>
              Escolha a playlist onde deseja inserir {stationToAdd ? (
                <>a rádio <strong>{stationToAdd.name}</strong></>
              ) : visualToAdd ? (
                <>o cenário <strong>{visualToAdd.title}</strong></>
              ) : ""}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6">
            <Select value={selectedPlaylistId} onValueChange={setSelectedPlaylistId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma playlist..." />
              </SelectTrigger>
              <SelectContent>
                {playlists?.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPlaylistModalOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleAddToPlaylist} 
              disabled={!selectedPlaylistId || addToPlaylistMutation.isPending || addVisualToPlaylistMutation.isPending}
            >
              {addToPlaylistMutation.isPending || addVisualToPlaylistMutation.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}