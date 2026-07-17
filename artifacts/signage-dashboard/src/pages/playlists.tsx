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
  Plus, Search, Film, Trash2, ListVideo, Monitor, Send, Wifi, WifiOff, AlertTriangle,
  CheckSquare, Square, PlaySquare, Tv, LayoutPanelLeft, Clock, CheckCircle2,
  FileEdit, BarChart2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
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

function isVertical(w?: number | null, h?: number | null) {
  return !!h && !!w && h > w;
}

const formSchema = z.object({ name: z.string().min(1, "Nome é obrigatório") });
type PlaylistFormValues = z.infer<typeof formSchema>;

function formatDuration(seconds: number) {
  if (!seconds || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m`;
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

function screenResolution(s: { panelWidth?: number | null; panelHeight?: number | null; resolution?: string | null }): { w: number; h: number } {
  if (s.panelWidth && s.panelHeight && s.panelWidth > 0 && s.panelHeight > 0) {
    return { w: s.panelWidth, h: s.panelHeight };
  }
  if (s.resolution) {
    const parts = s.resolution.toLowerCase().replace("x", "×").split("×");
    const w = parseInt(parts[0] ?? "0");
    const h = parseInt(parts[1] ?? "0");
    if (w > 0 && h > 0) return { w, h };
  }
  return { w: 1920, h: 1080 };
}

export default function Playlists() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [resolutionPreset, setResolutionPreset] = useState("1920x1080");
  const [customW, setCustomW] = useState("1920");
  const [customH, setCustomH] = useState("1080");
  const [selectedScreenForCreate, setSelectedScreenForCreate] = useState<string>("none");
  const [publishPlaylist, setPublishPlaylist] = useState<{ id: number; name: string } | null>(null);
  const [selectedScreenIds, setSelectedScreenIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: playlists, isLoading } = useListPlaylists(
    {},
    { query: { queryKey: getListPlaylistsQueryKey(), refetchInterval: 30_000 } }
  );
  const { data: screens, isLoading: screensLoading } = useListScreens(
    {},
    { query: { queryKey: ["screens"], enabled: !!publishPlaylist || isCreateOpen } }
  );
  const createPlaylist = useCreatePlaylist();
  const deletePlaylist = useDeletePlaylist();
  const createSchedule = useCreateSchedule();

  const form = useForm<PlaylistFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  const handleScreenForCreateChange = (value: string) => {
    setSelectedScreenForCreate(value);
    if (value === "none" || !screens) return;
    const screen = screens.find(s => String(s.id) === value);
    if (!screen) return;
    const { w, h } = screenResolution(screen as any);
    const matchingPreset = RESOLUTION_PRESETS.find(p => p.w === w && p.h === h);
    if (matchingPreset) {
      setResolutionPreset(matchingPreset.value);
    } else {
      setCustomW(String(w));
      setCustomH(String(h));
      setResolutionPreset("custom");
    }
  };

  const getResolution = () => {
    const preset = RESOLUTION_PRESETS.find(p => p.value === resolutionPreset);
    if (preset && preset.value !== "custom" && preset.w && preset.h) {
      return { w: preset.w, h: preset.h };
    }
    return { w: parseInt(customW) || 1920, h: parseInt(customH) || 1080 };
  };

  const resetCreateModal = () => {
    form.reset();
    setResolutionPreset("1920x1080");
    setCustomW("1920");
    setCustomH("1080");
    setSelectedScreenForCreate("none");
  };

  const onSubmit = (data: PlaylistFormValues) => {
    const { w, h } = getResolution();
    createPlaylist.mutate(
      { data: { name: data.name, resolutionWidth: w, resolutionHeight: h } },
      {
        onSuccess: (newPlaylist) => {
          queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
          setIsCreateOpen(false);
          resetCreateModal();
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

    try {
      const schedRes = await fetch(`/api/schedules`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistId: publishPlaylist.id,
          screenIds: screenArr,
          active: true,
          startTime: "00:00",
          endTime: "23:59",
          daysOfWeek: "0,1,2,3,4,5,6",
        }),
      });
      const schedData = await schedRes.json().catch(() => ({}));
      if (!schedRes.ok) {
        toast({ title: schedData?.error || "Erro ao atribuir à tela", variant: "destructive" });
        setIsPublishing(false);
        return;
      }
    } catch {
      toast({ title: "Erro ao atribuir à tela", variant: "destructive" });
      setIsPublishing(false);
      return;
    }

    setIsPublishing(false);
    await queryClient.refetchQueries({ queryKey: getListPlaylistsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["screens"] });
    const name = publishPlaylist.name;
    setPublishPlaylist(null);
    setSelectedScreenIds(new Set());
    toast({ title: `"${name}" publicada em ${screenArr.length} tela${screenArr.length > 1 ? "s" : ""}!` });
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
  const totalDuration = playlists?.reduce((s, p) => s + ((p as any).totalDurationSeconds ?? 0), 0) ?? 0;
  const totalScreens = playlists?.reduce((s, p) => s + ((p as any).screenCount ?? 0), 0) ?? 0;
  const publishedCount = playlists?.filter(p => !!(p as any).publishedAt).length ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        icon={PlaySquare}
        title="Playlists"
        description={isLoading ? "Carregando..." : `${playlists?.length ?? 0} playlist${(playlists?.length ?? 0) !== 1 ? "s" : ""} cadastradas`}
        actions={
          <>
            <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); resetCreateModal(); }}>
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

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                        Tela de destino
                        <span className="text-xs font-normal text-muted-foreground">(preenche a resolução)</span>
                      </label>
                      <Select value={selectedScreenForCreate} onValueChange={handleScreenForCreateChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar tela..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground">— Sem tela específica —</span>
                          </SelectItem>
                          {screensLoading && (
                            <SelectItem value="__loading__" disabled>Carregando telas...</SelectItem>
                          )}
                          {screens?.map((s) => {
                            const { w, h } = screenResolution(s as any);
                            const vert = isVertical(w, h);
                            return (
                              <SelectItem key={s.id} value={String(s.id)}>
                                <span className="flex items-center gap-2">
                                  {vert
                                    ? <div className="w-2.5 h-4 rounded-[2px] border border-current opacity-60 inline-block shrink-0" />
                                    : <div className="w-4 h-2.5 rounded-[2px] border border-current opacity-60 inline-block shrink-0" />
                                  }
                                  <span className="font-medium">{s.name}</span>
                                  <span className="text-muted-foreground text-xs">{w}×{h}px</span>
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Formato do painel</label>
                      <Select value={resolutionPreset} onValueChange={(v) => { setResolutionPreset(v); }}>
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

                      {(() => {
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
          </>
        }
      />

      {/* Stats summary */}
      {!isLoading && (playlists?.length ?? 0) > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: PlaySquare,  label: "Total",        value: String(playlists?.length ?? 0), bg: "bg-primary/10",  iconColor: "text-primary"     },
            { icon: CheckCircle2,label: "Publicadas",   value: String(publishedCount),          bg: "bg-emerald-100", iconColor: "text-emerald-600"  },
            { icon: Film,        label: "Mídias",       value: String(totalItems),              bg: "bg-sky-100",     iconColor: "text-sky-600"      },
            { icon: Clock,       label: "Duração total",value: formatDuration(totalDuration),   bg: "bg-amber-100",   iconColor: "text-amber-600"    },
          ].map(({ icon: Icon, label, value, bg, iconColor }) => (
            <div key={label} className="rounded-2xl p-4 flex items-center justify-between gap-4 border border-border bg-card shadow-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-1 text-muted-foreground">{label}</p>
                <p className="text-3xl font-black tabular-nums tracking-tight text-foreground">{value}</p>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                <Icon className={`w-6 h-6 ${iconColor}`} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search + bulk bar */}
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
                <th className="px-3 py-3 text-left w-[76px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</span>
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome da Playlist</span>
                </th>
                <th className="px-4 py-3 text-center w-[110px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
                </th>
                <th className="px-4 py-3 text-center w-[90px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mídias</span>
                </th>
                <th className="px-4 py-3 text-center w-[90px] hidden md:table-cell">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duração</span>
                </th>
                <th className="px-4 py-3 text-center w-[80px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Telas</span>
                </th>
                <th className="px-4 py-3 text-center w-[130px] hidden lg:table-cell">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Atualizado</span>
                </th>
                <th className="px-4 py-3 text-right w-[180px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-3 text-center"><Skeleton className="w-4 h-4 mx-auto rounded" /></td>
                    <td className="px-3 py-3"><Skeleton className="w-[60px] h-[34px] rounded" /></td>
                    <td className="px-4 py-3 space-y-1.5"><Skeleton className="h-4 w-44" /><Skeleton className="h-3 w-24" /></td>
                    <td className="px-4 py-3 text-center"><Skeleton className="h-5 w-20 mx-auto rounded-full" /></td>
                    <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-8 mx-auto" /></td>
                    <td className="px-4 py-3 text-center hidden md:table-cell"><Skeleton className="h-4 w-12 mx-auto" /></td>
                    <td className="px-4 py-3 text-center"><Skeleton className="h-5 w-10 mx-auto rounded-full" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-3 w-24 mx-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-36 ml-auto" /></td>
                  </tr>
                ))
              ) : (filtered?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 px-4">
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
                  const p = playlist as typeof playlist & {
                    screenCount?: number;
                    createdAt?: string;
                    publishedAt?: string | null;
                    resolutionWidth?: number;
                    resolutionHeight?: number;
                    totalDurationSeconds?: number;
                  };
                  const thumb = resolveThumb(playlist.thumbnailUrl);
                  const sc = p.screenCount ?? 0;
                  const onlineSc = (p as any).onlineScreenCount ?? 0;
                  const offlineSc = sc - onlineSc;
                  type ScreenDetail = { name: string; code: string; online: boolean; lastSeen: string | null; currentMedia: string | null };
                  const screenDetails: ScreenDetail[] = (() => {
                    const raw = (p as any).screenDetails;
                    if (!raw) return [];
                    try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return []; }
                  })();
                  const isChecked = selectedIds.has(playlist.id);
                  const vert = isVertical(p.resolutionWidth, p.resolutionHeight);
                  const isPublished = !!p.publishedAt;
                  const dur = p.totalDurationSeconds ?? 0;
                  const resW = p.resolutionWidth ?? 1920;
                  const resH = p.resolutionHeight ?? 1080;

                  // Thumbnail proportions: portrait panels get taller cell
                  const thumbW = vert ? 34 : 60;
                  const thumbH = vert ? 60 : 34;

                  return (
                    <tr
                      key={playlist.id}
                      className={`border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer group ${isChecked ? "bg-primary/5" : ""}`}
                      onClick={() => (window.location.href = `/playlists/${playlist.id}`)}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3 text-center" onClick={(e) => { e.stopPropagation(); toggleSelect(playlist.id); }}>
                        <div className={`w-4 h-4 rounded border-2 mx-auto flex items-center justify-center transition-colors cursor-pointer ${isChecked ? "bg-primary border-primary" : "border-muted-foreground/30 hover:border-primary/60"}`}>
                          {isChecked && <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                      </td>

                      {/* Thumbnail */}
                      <td className="px-3 py-2.5">
                        <div
                          className="relative rounded border border-border bg-black overflow-hidden flex-shrink-0 mx-auto"
                          style={{ width: thumbW, height: thumbH }}
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
                              <Film className="w-3.5 h-3.5 text-muted-foreground opacity-40" />
                            </div>
                          )}
                          {playlist.itemCount > 0 && (
                            <div className="absolute bottom-0.5 right-0.5 bg-black/75 text-white text-[8px] font-bold px-1 py-px rounded leading-none tabular-nums">
                              {playlist.itemCount}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Name + resolução */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/playlists/${playlist.id}`}
                          className="font-semibold hover:text-primary transition-colors leading-tight block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {playlist.name}
                        </Link>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${vert ? "bg-violet-500/10 text-violet-500" : "bg-sky-500/10 text-sky-500"}`}>
                            {vert
                              ? <LayoutPanelLeft className="w-2.5 h-2.5 rotate-90" />
                              : <Tv className="w-2.5 h-2.5" />}
                            {resW}×{resH}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        {isPublished ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Publicada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-medium bg-muted text-muted-foreground">
                            <FileEdit className="w-3 h-3" />
                            Rascunho
                          </span>
                        )}
                      </td>

                      {/* Mídias */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-bold tabular-nums text-sm">{playlist.itemCount}</span>
                          <span className="text-[10px] text-muted-foreground">mídias</span>
                        </div>
                      </td>

                      {/* Duração */}
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-bold tabular-nums text-sm text-amber-600 dark:text-amber-400">
                            {dur > 0 ? formatDuration(dur) : "—"}
                          </span>
                          {dur > 0 && <span className="text-[10px] text-muted-foreground">total</span>}
                        </div>
                      </td>

                      {/* Telas — simple count */}
                      <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        {sc === 0 ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-bold tabular-nums text-sm">{sc}</span>
                            {sc > 0 && (
                              <div className="flex items-center gap-1">
                                {onlineSc > 0 && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-emerald-500">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    {onlineSc}
                                  </span>
                                )}
                                {offlineSc > 0 && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/50">
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                                    {offlineSc}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Atualizado */}
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatDate(p.publishedAt ?? p.createdAt)}
                          </span>
                          {p.publishedAt && (
                            <span className="text-[10px] text-emerald-500">publicado</span>
                          )}
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-3 text-xs font-medium">
                          <button
                            className="flex items-center gap-1 text-primary hover:text-primary/70 transition-colors whitespace-nowrap"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedScreenIds(new Set());
                              setPublishPlaylist({ id: playlist.id, name: playlist.name });
                            }}
                          >
                            <Send className="w-3 h-3" /> Publicar
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
      </div>

      {/* Publish Modal */}
      <Dialog open={!!publishPlaylist} onOpenChange={(o) => { if (!o) { setPublishPlaylist(null); setSelectedScreenIds(new Set()); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              Publicar "{publishPlaylist?.name}"
            </DialogTitle>
            <DialogDescription>
              Selecione as telas que vão exibir esta playlist imediatamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {screensLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !screens?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tela cadastrada.</p>
            ) : (
              screens.map((s) => {
                const checked = selectedScreenIds.has(s.id);
                const online = (s as any).status === "online";
                return (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                      {checked && <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => {
                        setSelectedScreenIds(prev => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        });
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{(s as any).location || "Sem localização"}</p>
                    </div>
                    <span
                      title={online ? "Online" : "Offline"}
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${online ? "bg-emerald-500 shadow-[0_0_6px_1px_rgba(16,185,129,0.6)]" : "bg-red-500"}`}
                    />
                  </label>
                );
              })
            )}
          </div>

          {/* Aviso quando telas offline estão selecionadas */}
          {(() => {
            const offlineSelected = screens?.filter(s => {
              if (!selectedScreenIds.has(s.id)) return false;
              return (s as any).status !== "online";
            }) ?? [];
            return offlineSelected.length > 0 ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-500">
                    ⚠️ {offlineSelected.length} tela{offlineSelected.length > 1 ? "s" : ""} offline — o conteúdo pode não aparecer!
                  </p>
                  <p className="text-xs text-amber-500/80 mt-0.5">
                    O agendamento será salvo, mas o conteúdo só será exibido quando {offlineSelected.length > 1 ? "as telas voltarem" : "a tela voltar"} a conectar à internet:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {offlineSelected.map(s => (
                      <li key={s.id} className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                        <WifiOff className="w-3 h-3 flex-shrink-0" />
                        {s.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null;
          })()}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setPublishPlaylist(null); setSelectedScreenIds(new Set()); }}>
              Cancelar
            </Button>
            <Button
              onClick={handlePublish}
              disabled={selectedScreenIds.size === 0 || isPublishing}
              className="gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              {isPublishing ? "Publicando..." : `Publicar em ${selectedScreenIds.size} tela${selectedScreenIds.size !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
