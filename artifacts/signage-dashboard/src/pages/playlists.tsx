import { useState } from "react";
import {
  useListPlaylists,
  useCreatePlaylist,
  useDeletePlaylist,
  useListScreens,
  useCreateSchedule,
  getListPlaylistsQueryKey,
  getListSchedulesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link } from "wouter";
import { Plus, Search, Film, Clock, Trash2, Edit2, ListVideo, Monitor, Send, Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
});
type PlaylistFormValues = z.infer<typeof formSchema>;

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function resolveThumb(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/objects/")) return `/api/storage${url}`;
  return url;
}

export default function Playlists() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [publishPlaylist, setPublishPlaylist] = useState<{ id: number; name: string } | null>(null);
  const [selectedScreenId, setSelectedScreenId] = useState<string>("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: playlists, isLoading } = useListPlaylists();
  const { data: screens, isLoading: screensLoading } = useListScreens(
    {},
    { query: { queryKey: ["screens"], enabled: !!publishPlaylist } }
  );
  const createPlaylist = useCreatePlaylist();
  const deletePlaylist = useDeletePlaylist();
  const createSchedule = useCreateSchedule();

  const form = useForm<PlaylistFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  const onSubmit = (data: PlaylistFormValues) => {
    createPlaylist.mutate(
      { data: { name: data.name } },
      {
        onSuccess: (newPlaylist) => {
          queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
          setIsCreateOpen(false);
          form.reset();
          toast({ title: "Playlist criada!" });
          window.location.href = `/playlists/${newPlaylist.id}`;
        },
        onError: () => toast({ title: "Erro ao criar playlist", variant: "destructive" }),
      }
    );
  };

  const handlePublish = () => {
    if (!publishPlaylist || !selectedScreenId) return;
    createSchedule.mutate(
      {
        data: {
          playlistId: publishPlaylist.id,
          screenId: parseInt(selectedScreenId),
          active: true,
          startTime: "00:00",
          endTime: "23:59",
          daysOfWeek: "0,1,2,3,4,5,6",
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          setPublishPlaylist(null);
          setSelectedScreenId("");
          toast({ title: `"${publishPlaylist.name}" publicada na tela!` });
        },
        onError: () => toast({ title: "Erro ao publicar", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Deletar "${name}"? Os agendamentos que a usam vão parar.`)) {
      deletePlaylist.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
            toast({ title: "Playlist deletada" });
          },
          onError: () => toast({ title: "Erro ao deletar", variant: "destructive" }),
        }
      );
    }
  };

  const filtered = playlists?.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Playlists</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Crie e gerencie sequências de conteúdo para suas telas.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              Nova Playlist
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Playlist</DialogTitle>
              <DialogDescription>
                Uma sequência de mídias exibida nas suas telas em loop.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Playlist</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Promoções Julho" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createPlaylist.isPending}>
                    {createPlaylist.isPending ? "Criando..." : "Criar e Editar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar playlists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {!isLoading && (
          <span className="text-sm text-muted-foreground">
            {filtered?.length ?? 0} resultado{(filtered?.length ?? 0) !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        {/* Header row */}
        <div className="hidden md:grid grid-cols-[100px_1fr_110px_100px_120px_200px] gap-4 px-5 py-3 bg-muted/40 border-b">
          <div />
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome da Playlist</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Mídias</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Duração</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Telas Ativas</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Ações</div>
        </div>

        {isLoading ? (
          <div className="divide-y">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="grid grid-cols-[100px_1fr_110px_100px_120px_200px] gap-4 px-5 py-3 items-center">
                <Skeleton className="w-[88px] h-[50px] rounded" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-10 mx-auto" />
                <Skeleton className="h-4 w-16 mx-auto" />
                <Skeleton className="h-4 w-8 mx-auto" />
                <Skeleton className="h-8 w-40 ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered?.length === 0 ? (
          <div className="text-center py-16 px-4 flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <ListVideo className="w-6 h-6 text-muted-foreground opacity-50" />
            </div>
            <h3 className="font-medium">Nenhuma playlist encontrada</h3>
            <p className="text-muted-foreground text-sm mt-1 max-w-xs">
              {searchQuery ? "Tente outro termo de busca." : "Clique em Nova Playlist para começar."}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered?.map((playlist) => {
              const thumb = resolveThumb(playlist.thumbnailUrl);
              const sc = (playlist as typeof playlist & { screenCount?: number }).screenCount ?? 0;
              return (
                <div
                  key={playlist.id}
                  className="group grid grid-cols-[100px_1fr] md:grid-cols-[100px_1fr_110px_100px_120px_200px] gap-4 px-5 py-3 items-center hover:bg-accent/30 transition-colors cursor-pointer"
                  onClick={() => (window.location.href = `/playlists/${playlist.id}`)}
                >
                  {/* Thumbnail 16:9 */}
                  <div
                    className="relative rounded-md overflow-hidden flex-shrink-0 bg-black border border-white/10"
                    style={{ width: 88, height: 50 }}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-muted/60 to-muted/30">
                        <Film className="w-5 h-5 text-muted-foreground opacity-30" />
                      </div>
                    )}
                    {/* Item count badge */}
                    {playlist.itemCount > 0 && (
                      <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1 py-px rounded leading-none">
                        {playlist.itemCount}
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                      {playlist.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {playlist.itemCount} {playlist.itemCount === 1 ? "item" : "itens"}
                    </p>
                  </div>

                  {/* Media count */}
                  <div className="hidden md:flex items-center justify-center gap-1.5 text-sm">
                    <Film className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-medium tabular-nums">{playlist.itemCount}</span>
                  </div>

                  {/* Duration */}
                  <div className="hidden md:flex items-center justify-center gap-1.5 text-sm">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-mono font-medium">
                      {formatDuration(playlist.totalDurationSeconds ?? 0)}
                    </span>
                  </div>

                  {/* Screen count */}
                  <div className="hidden md:flex items-center justify-center gap-1.5 text-sm">
                    {sc > 0 ? (
                      <Badge variant="default" className="gap-1 text-xs px-2 py-0.5">
                        <Monitor className="w-3 h-3" />
                        {sc} tela{sc !== 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div
                    className="hidden md:flex items-center justify-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 px-2.5 text-xs gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedScreenId("");
                        setPublishPlaylist({ id: playlist.id, name: playlist.name });
                      }}
                    >
                      <Send className="w-3 h-3" />
                      Publicar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1.5"
                      asChild
                    >
                      <Link href={`/playlists/${playlist.id}`}>
                        <Edit2 className="w-3.5 h-3.5" />
                        Editar
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                      onClick={(e) => handleDelete(playlist.id, playlist.name, e)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Deletar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {!isLoading && (filtered?.length ?? 0) > 0 && (
          <div className="px-5 py-3 border-t bg-muted/20 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filtered?.length} playlist{(filtered?.length ?? 0) !== 1 ? "s" : ""} no total
            </span>
            <Badge variant="outline" className="text-xs font-normal">
              {playlists?.reduce((s, p) => s + (p.itemCount ?? 0), 0)} mídias
            </Badge>
          </div>
        )}
      </div>

      {/* ── PUBLICAR EM TELA dialog ── */}
      <Dialog
        open={!!publishPlaylist}
        onOpenChange={(open) => { if (!open) { setPublishPlaylist(null); setSelectedScreenId(""); } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4" /> Publicar na Tela
            </DialogTitle>
            <DialogDescription>
              Escolha em qual tela exibir <strong>{publishPlaylist?.name}</strong>. O conteúdo vai rodar 24h por dia, todos os dias.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Select value={selectedScreenId} onValueChange={setSelectedScreenId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar tela..." />
              </SelectTrigger>
              <SelectContent>
                {screensLoading ? (
                  <div className="p-2 text-sm text-muted-foreground">Carregando...</div>
                ) : screens?.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">Nenhuma tela cadastrada</div>
                ) : screens?.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    <span className="flex items-center gap-2">
                      <Monitor className="w-3.5 h-3.5" />
                      {s.name}
                      {s.code && <span className="text-xs text-muted-foreground font-mono">{s.code}</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPublishPlaylist(null); setSelectedScreenId(""); }}>
              Cancelar
            </Button>
            <Button
              onClick={handlePublish}
              disabled={!selectedScreenId || createSchedule.isPending}
              className="gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              {createSchedule.isPending ? "Publicando..." : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
