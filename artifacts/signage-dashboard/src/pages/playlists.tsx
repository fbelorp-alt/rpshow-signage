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
  Plus, Search, Film, Trash2, ListVideo, Monitor, Send, Wifi, WifiOff,
  CheckSquare, Square, PlaySquare, Tv, LayoutPanelLeft,
} from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const RESOLUTION_PRESETS = [
  { label: "TV Full HD — 1920×1080", value: "1920x1080", w: 1920, h: 1080, vertical: false },
  { label: "TV Vertical — 1080×1920", value: "1080x1920", w: 1080, h: 1920, vertical: true },
  { label: "LED Vertical 3×6 — 576×1152", value: "576x1152", w: 576, h: 1152, vertical: true },
  { label: "LED Horizontal — 1152×576", value: "1152x576", w: 1152, h: 576, vertical: false },
  { label: "LED Vertical P4 — 768×1536", value: "768x1536", w: 768, h: 1536, vertical: true },
  { label: "Personalizado", value: "custom", w: null, h: null, vertical: false },
] as const;

function getResolutionLabel(w?: number | null, h?: number | null) {
  if (!w || !h) return "1920×1080";
  const preset = RESOLUTION_PRESETS.find(p => p.w === w && p.h === h);
  return preset && preset.value !== "custom" ? `${w}×${h}` : `${w}×${h}`;
}

function isVertical(w?: number | null, h?: number | null) {
  return !!h && !!w && h > w;
}

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
  const [resolutionPreset, setResolutionPreset] = useState("1920x1080");
  const [customW, setCustomW] = useState("1920");
  const [customH, setCustomH] = useState("1080");
  const [publishPlaylist, setPublishPlaylist] = useState<{ id: number; name: string } | null>(null);
  const [selectedScreenIds, setSelectedScreenIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

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

  const getResolution = () => {
    const preset = RESOLUTION_PRESETS.find(p => p.value === resolutionPreset);
    if (preset && preset.value !== "custom" && preset.w && preset.h) {
      return { w: preset.w, h: preset.h };
    }
    return { w: parseInt(customW) || 1920, h: parseInt(customH) || 1080 };
  };

  const onSubmit = (data: PlaylistFormValues) => {
    const { w, h } = getResolution();
    createPlaylist.mutate(
      { data: { name: data.name, resolutionWidth: w, resolutionHeight: h } },
      {
        onSuccess: (newPlaylist) => {
          queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
          setIsCreateOpen(false);
          form.reset();
          setResolutionPreset("1920x1080");
          setCustomW("1920");
          setCustomH("1080");
          toast({ title: "Playlist criada!" });
          window.location.href = `/playlists/${newPlaylist.id}`;
        },
        onError: () => toast({ title: "Erro ao criar playlist", variant: "destructive" }),
      }
    );
  };

  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    if (!publishPlaylist || selectedScreenIds.size === 0) return;
    setIsPublishing(true);
    const screenArr = Array.from(selectedScreenIds);
    let errors = 0;

    // Publica o rascunho atual antes de atribuir às telas
    try {
      const pubRes = await fetch(`/api/playlists/${publishPlaylist.id}/publish`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!pubRes.ok) {
        setIsPublishing(false);
        toast({ title: "Erro ao publicar conteúdo", variant: "destructive" });
        return;
      }
    } catch {
      setIsPublishing(false);
      toast({ title: "Erro ao publicar conteúdo", variant: "destructive" });
      return;
    }

    for (const screenId of screenArr) {
      await new Promise<void>((resolve) => {
        createSchedule.mutate(
          { data: { playlistId: publishPlaylist.id, screenId, active: true, startTime: "00:00", endTime: "23:59", daysOfWeek: "0,1,2,3,4,5,6" } },
          { onSuccess: () => resolve(), onError: () => { errors++; resolve(); } }
        );
      });
    }
    setIsPublishing(false);
    queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["screens"] });
    setPublishPlaylist(null);
    setSelectedScreenIds(new Set());
    if (errors === 0) {
      toast({ title: `"${publishPlaylist.name}" atribuída e publicada em ${screenArr.length} tela${screenArr.length > 1 ? "s" : ""}!` });
    } else {
      toast({ title: `Atribuída com ${errors} erro(s)`, variant: "destructive" });
    }
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

                  {/* Resolução / Formato do painel */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Formato do painel</label>
                    <Select value={resolutionPreset} onValueChange={setResolutionPreset}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RESOLUTION_PRESETS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            <span className="flex items-center gap-2">
                              {p.value === "custom" ? (
                                <LayoutPanelLeft className="w-3.5 h-3.5 text-muted-foreground" />
                              ) : p.vertical ? (
                                <div className="w-2.5 h-4 rounded-[2px] border border-current opacity-60 inline-block" />
                              ) : (
                                <div className="w-4 h-2.5 rounded-[2px] border border-current opacity-60 inline-block" />
                              )}
                              {p.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {resolutionPreset === "custom" && (
                      <div className="flex items-center gap-2 pt-1">
                        <Input
                          placeholder="Largura px"
                          value={customW}
                          onChange={(e) => setCustomW(e.target.value.replace(/\D/g, ""))}
                          className="w-28 text-center"
                        />
                        <span className="text-muted-foreground text-sm shrink-0">×</span>
                        <Input
                          placeholder="Altura px"
                          value={customH}
                          onChange={(e) => setCustomH(e.target.value.replace(/\D/g, ""))}
                          className="w-28 text-center"
                        />
                        <span className="text-xs text-muted-foreground shrink-0">pixels</span>
                      </div>
                    )}

                    {resolutionPreset !== "custom" && (() => {
                      const { w, h } = getResolution();
                      const vert = isVertical(w, h);
                      return (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          {vert ? <LayoutPanelLeft className="w-3 h-3 rotate-90" /> : <Tv className="w-3 h-3" />}
                          {vert ? "Vertical" : "Horizontal"} · {w}×{h} px
                        </p>
                      );
                    })()}
                  </div>

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
        <div className="overflow-x-auto">
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

                    {/* Orientação / Resolução */}
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        const w = (playlist as any).resolutionWidth;
                        const h = (playlist as any).resolutionHeight;
                        const vert = isVertical(w, h);
                        return (
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${vert ? "bg-violet-500/10 text-violet-500" : "bg-sky-500/10 text-sky-500"}`}>
                            {vert
                              ? <LayoutPanelLeft className="w-3 h-3 rotate-90" />
                              : <Tv className="w-3 h-3" />}
                            {getResolutionLabel(w, h)}
                          </span>
                        );
                      })()}
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
                            setSelectedScreenIds(new Set());
                            setPublishPlaylist({ id: playlist.id, name: playlist.name });
                          }}
                        >
                          Atribuir
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
        </div>

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
        onOpenChange={(open) => { if (!open) { setPublishPlaylist(null); setSelectedScreenIds(new Set()); } }}
      >
        <DialogContent className="max-w-3xl w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4" /> Atribuir à Tela
            </DialogTitle>
            <DialogDescription>
              Selecione uma ou mais telas para exibir <strong>{publishPlaylist?.name}</strong>. O rascunho atual será publicado e rodará 24h por dia.
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
                {/* Select all header */}
                <div
                  className="flex items-center gap-3 px-4 py-2.5 bg-muted/40 border-b cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => {
                    if (selectedScreenIds.size === screens.length) {
                      setSelectedScreenIds(new Set());
                    } else {
                      setSelectedScreenIds(new Set(screens.map(s => s.id)));
                    }
                  }}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${selectedScreenIds.size === screens.length ? "bg-primary border-primary" : selectedScreenIds.size > 0 ? "bg-primary/50 border-primary" : "border-muted-foreground/40"}`}>
                    {selectedScreenIds.size > 0 && <div className="w-2 h-0.5 bg-white rounded" />}
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {selectedScreenIds.size === screens.length ? "Desmarcar todas" : "Selecionar todas"} ({screens.length})
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {screens.map((s) => {
                    const isOnline = s.status === "online";
                    const isSelected = selectedScreenIds.has(s.id);
                    const activePl = (s as typeof s & { activePlaylistName?: string | null }).activePlaylistName;
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b last:border-0 transition-colors ${isSelected ? "bg-primary/10" : "hover:bg-muted/30"}`}
                        onClick={() => {
                          const next = new Set(selectedScreenIds);
                          if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                          setSelectedScreenIds(next);
                        }}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                          {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <Monitor className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{s.name}</p>
                          {activePl && (
                            <p className="text-xs text-muted-foreground truncate">Atual: {activePl}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isOnline ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              <Wifi className="w-3 h-3" /> Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/60 bg-muted/40 px-2 py-0.5 rounded-full">
                              <WifiOff className="w-3 h-3" /> Offline
                            </span>
                          )}
                          {s.location && <span className="text-xs text-muted-foreground hidden sm:block">{s.location}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="items-center">
            {selectedScreenIds.size > 0 && (
              <span className="text-xs text-muted-foreground mr-auto">
                {selectedScreenIds.size} tela{selectedScreenIds.size > 1 ? "s" : ""} selecionada{selectedScreenIds.size > 1 ? "s" : ""}
              </span>
            )}
            <Button variant="outline" onClick={() => { setPublishPlaylist(null); setSelectedScreenIds(new Set()); }}>
              Cancelar
            </Button>
            <Button
              onClick={handlePublish}
              disabled={selectedScreenIds.size === 0 || isPublishing}
              className="gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              {isPublishing ? "Atribuindo..." : `Atribuir e publicar${selectedScreenIds.size > 1 ? ` em ${selectedScreenIds.size} telas` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
