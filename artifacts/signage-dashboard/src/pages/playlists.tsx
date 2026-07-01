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
import {
  Plus, Search, Film, Clock, Trash2, Edit2, ListVideo, Monitor, Send, Wifi, WifiOff,
  CheckSquare, Square, PlaySquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({ name: z.string().min(1, "Nome é obrigatório") });
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

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function Playlists() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [publishPlaylist, setPublishPlaylist] = useState<{ id: number; name: string } | null>(null);
  const [selectedScreenId, setSelectedScreenId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!confirm(`Deletar ${ids.length} playlist${ids.length !== 1 ? "s" : ""}? Os agendamentos que as usam vão parar.`)) return;
    for (const id of ids) {
      await new Promise<void>((resolve) => {
        deletePlaylist.mutate({ id }, { onSuccess: () => resolve(), onError: () => resolve() });
      });
    }
    queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
    setSelectedIds(new Set());
    toast({ title: `${ids.length} playlist${ids.length !== 1 ? "s" : ""} deletada${ids.length !== 1 ? "s" : ""}` });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === (filtered?.length ?? 0)) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered?.map(p => p.id) ?? []));
    }
  };

  const filtered = playlists?.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalItems = playlists?.reduce((s, p) => s + (p.itemCount ?? 0), 0) ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Playlists</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading
              ? "Carregando..."
              : `${playlists?.length ?? 0} playlist${(playlists?.length ?? 0) !== 1 ? "s" : ""} · ${totalItems} mídias`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Film className="w-3 h-3" /> {totalItems} mídias
          </Badge>
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
      </div>

      {/* Search */}
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

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">
          <span className="text-sm text-destructive font-medium">
            {selectedIds.size} playlist{selectedIds.size !== 1 ? "s" : ""} selecionada{selectedIds.size !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" className="h-7 text-xs gap-1.5" onClick={handleBulkDelete}>
              <Trash2 className="w-3 h-3" /> Excluir selecionadas
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-3 w-10 text-center">
                <button
                  onClick={toggleSelectAll}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Selecionar todos"
                >
                  {selectedIds.size > 0 && selectedIds.size === (filtered?.length ?? 0)
                    ? <CheckSquare className="w-4 h-4 text-primary" />
                    : <Square className="w-4 h-4" />}
                </button>
              </th>
              <th className="px-4 py-3 text-left w-[72px]">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome da Playlist</span>
              </th>
              <th className="px-4 py-3 text-center w-[80px]">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo</span>
              </th>
              <th className="px-4 py-3 text-center w-[80px]">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mídias</span>
              </th>
              <th className="px-4 py-3 text-center w-[100px]">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Telas</span>
              </th>
              <th className="px-4 py-3 text-center w-[140px] hidden lg:table-cell">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Atualizado</span>
              </th>
              <th className="px-4 py-3 text-right w-[200px]">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-3 py-3 text-center"><Skeleton className="w-4 h-4 mx-auto rounded" /></td>
                  <td className="px-4 py-3"><Skeleton className="w-[56px] h-[32px] rounded" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                  <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-8 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-10 mx-auto" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-24 mx-auto" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-8 w-36 ml-auto" /></td>
                </tr>
              ))
            ) : (filtered?.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16 px-4">
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                      <ListVideo className="w-6 h-6 text-muted-foreground opacity-50" />
                    </div>
                    <h3 className="font-medium">Nenhuma playlist encontrada</h3>
                    <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                      {searchQuery ? "Tente outro termo de busca." : "Clique em Nova Playlist para começar."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered?.map((playlist) => {
                const thumb = resolveThumb(playlist.thumbnailUrl);
                const sc = (playlist as typeof playlist & { screenCount?: number }).screenCount ?? 0;
                const createdAt = (playlist as typeof playlist & { createdAt?: string }).createdAt;
                const isChecked = selectedIds.has(playlist.id);
                return (
                  <tr
                    key={playlist.id}
                    className={`border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${isChecked ? "bg-primary/5" : ""}`}
                    onClick={() => (window.location.href = `/playlists/${playlist.id}`)}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3 text-center" onClick={(e) => { e.stopPropagation(); toggleSelect(playlist.id); }}>
                      <div className={`w-4 h-4 rounded border-2 mx-auto flex items-center justify-center transition-colors cursor-pointer ${isChecked ? "bg-primary border-primary" : "border-muted-foreground/30 hover:border-muted-foreground/60"}`}>
                        {isChecked && <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                    </td>

                    {/* Thumbnail */}
                    <td className="px-4 py-2">
                      <div
                        className="relative rounded border border-border bg-black overflow-hidden flex-shrink-0"
                        style={{ width: 56, height: 32 }}
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
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/60 to-muted/30">
                            <Film className="w-4 h-4 text-muted-foreground opacity-30" />
                          </div>
                        )}
                        {playlist.itemCount > 0 && (
                          <div className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[8px] font-bold px-1 py-px rounded leading-none">
                            {playlist.itemCount}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/playlists/${playlist.id}`}
                        className="font-medium hover:text-primary transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {playlist.name}
                      </Link>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                        <PlaySquare className="w-3 h-3" /> Regular
                      </span>
                    </td>

                    {/* Media count */}
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center gap-1.5 text-xs">
                        <Film className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium tabular-nums">{playlist.itemCount}</span>
                      </span>
                    </td>

                    {/* Screen count */}
                    <td className="px-4 py-3 text-center">
                      {sc > 0 ? (
                        <Badge variant="default" className="gap-1 text-xs px-2 py-0.5">
                          <Monitor className="w-3 h-3" />
                          {sc}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    {/* Updated at */}
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(createdAt)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-3 text-xs font-medium">
                        <button
                          className="text-primary hover:text-primary/70 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedScreenId("");
                            setPublishPlaylist({ id: playlist.id, name: playlist.name });
                          }}
                        >
                          Publicar
                        </button>
                        <Link
                          href={`/playlists/${playlist.id}`}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Editar
                        </Link>
                        <button
                          className="text-destructive hover:text-destructive/70 transition-colors"
                          onClick={(e) => handleDelete(playlist.id, playlist.name, e)}
                        >
                          Deletar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Footer */}
        {!isLoading && (filtered?.length ?? 0) > 0 && (
          <div className="px-5 py-3 border-t bg-muted/20 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filtered?.length} playlist{(filtered?.length ?? 0) !== 1 ? "s" : ""} no total
            </span>
            <Badge variant="outline" className="text-xs font-normal">
              {totalItems} mídias
            </Badge>
          </div>
        )}
      </div>

      {/* Publicar em tela dialog */}
      <Dialog
        open={!!publishPlaylist}
        onOpenChange={(open) => { if (!open) { setPublishPlaylist(null); setSelectedScreenId(""); } }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4" /> Publicar na Tela
            </DialogTitle>
            <DialogDescription>
              Selecione a tela para exibir <strong>{publishPlaylist?.name}</strong>. O conteúdo vai rodar 24h por dia, todos os dias.
            </DialogDescription>
          </DialogHeader>

          <div className="py-1">
            {screensLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />)}
              </div>
            ) : !screens?.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhuma tela cadastrada. Adicione uma tela em <strong>Minhas Telas</strong>.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="px-3 py-2 w-8"></th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome da Tela</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Resolução</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Playlist Atual</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Local</th>
                    </tr>
                  </thead>
                  <tbody>
                    {screens.map((s) => {
                      const isOnline = s.status === "online";
                      const isSelected = selectedScreenId === String(s.id);
                      const activePl = (s as typeof s & { activePlaylistName?: string | null }).activePlaylistName;
                      return (
                        <tr
                          key={s.id}
                          className={`border-b last:border-0 cursor-pointer transition-colors ${isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/30"}`}
                          onClick={() => setSelectedScreenId(String(s.id))}
                        >
                          <td className="px-3 py-3 text-center">
                            <div className={`w-4 h-4 rounded-full border-2 mx-auto flex items-center justify-center ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Monitor className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium">{s.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {isOnline ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                <Wifi className="w-3 h-3" /> Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                                <WifiOff className="w-3 h-3" /> Offline
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center hidden sm:table-cell">
                            <span className="text-xs font-mono text-muted-foreground">
                              {s.resolution ?? "—"}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {activePl ? (
                              <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full max-w-[140px] truncate">
                                <PlaySquare className="w-3 h-3 shrink-0" />
                                <span className="truncate">{activePl}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50 italic">Nenhuma</span>
                            )}
                          </td>
                          <td className="px-3 py-3 hidden md:table-cell">
                            <span className="text-xs text-muted-foreground">{s.location ?? "—"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
