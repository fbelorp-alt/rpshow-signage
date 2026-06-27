import { useState } from "react";
import {
  useListPlaylists,
  useCreatePlaylist,
  useDeletePlaylist,
  getListPlaylistsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ListVideo, Search, Plus, MoreVertical, Clock, Film } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
});

type PlaylistFormValues = z.infer<typeof formSchema>;

export default function Playlists() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: playlists, isLoading } = useListPlaylists();
  const createPlaylist = useCreatePlaylist();
  const deletePlaylist = useDeletePlaylist();

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
          toast({ title: "Playlist criada com sucesso!" });
          window.location.href = `/playlists/${newPlaylist.id}`;
        },
        onError: () => {
          toast({ title: "Erro ao criar playlist", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Deletar esta playlist? Os agendamentos que usam ela vão parar de funcionar.")) {
      deletePlaylist.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
            toast({ title: "Playlist deletada" });
          },
          onError: () => {
            toast({ title: "Erro ao deletar playlist", variant: "destructive" });
          },
        }
      );
    }
  };

  const filteredPlaylists = playlists?.filter(playlist =>
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Playlists</h1>
          <p className="text-muted-foreground mt-1">Crie e organize sequências de conteúdo.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 gap-2">
              <Plus className="w-4 h-4" />
              Nova Playlist
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Playlist</DialogTitle>
              <DialogDescription>
                Crie uma nova sequência de mídias para exibir nas suas telas.
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
                        <Input placeholder="Ex: Promoções Junho" {...field} />
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

      <div className="bg-card p-4 rounded-lg border">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar playlists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : filteredPlaylists?.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-lg border border-dashed">
          <ListVideo className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">Nenhuma playlist encontrada</h3>
          <p className="text-muted-foreground mt-1">Crie uma playlist para começar a organizar seu conteúdo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlaylists?.map(playlist => (
            <Card key={playlist.id} className="hover-elevate transition-all duration-200 group cursor-pointer" onClick={() => window.location.href = `/playlists/${playlist.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <ListVideo className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors">
                        {playlist.name}
                      </h3>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.location.href = `/playlists/${playlist.id}` }}>
                        Editar Playlist
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(playlist.id); }}
                      >
                        Deletar Playlist
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-6 pt-4 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Film className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{playlist.itemCount}</span>
                    <span className="text-muted-foreground">itens</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">
                      {Math.floor((playlist.totalDurationSeconds || 0) / 60)}:
                      {String((playlist.totalDurationSeconds || 0) % 60).padStart(2, '0')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
