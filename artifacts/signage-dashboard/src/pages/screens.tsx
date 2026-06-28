import { useState, useEffect, useRef } from "react";
import {
  useListScreens,
  useDeleteScreen,
  useCreateScreen,
  useUpdateScreen,
  getListScreensQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Monitor, Search, Wifi, WifiOff, Clock, PlaySquare, Trash2, ExternalLink, Plus, Tag, Check, X, MonitorSmartphone } from "lucide-react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return "Nunca";
  const diff = Date.now() - new Date(lastSeen).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  return new Date(lastSeen).toLocaleDateString("pt-BR");
}

function formatFullDate(lastSeen: string | null): string {
  if (!lastSeen) return "Nunca";
  return new Date(lastSeen).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const TAG_COLORS = [
  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "bg-rose-500/20 text-rose-400 border-rose-500/30",
  "bg-sky-500/20 text-sky-400 border-sky-500/30",
];

function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function TagCell({ screenId, tagsRaw, onSaved }: { screenId: number; tagsRaw: string | null; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tagsRaw ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const updateScreen = useUpdateScreen();

  const tags = (tagsRaw ?? "").split(",").map(t => t.trim()).filter(Boolean);

  const handleSave = () => {
    const normalized = value.split(",").map(t => t.trim()).filter(Boolean).join(", ");
    updateScreen.mutate(
      { id: screenId, data: { tags: normalized || null } as any },
      { onSuccess: () => { setEditing(false); onSaved(); }, onError: () => setEditing(false) }
    );
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <Input
          ref={inputRef}
          autoFocus
          className="h-6 text-xs px-1.5 py-0 w-36"
          placeholder="tag1, tag2..."
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
        />
        <button onClick={handleSave} className="text-primary"><Check className="w-3 h-3" /></button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground"><X className="w-3 h-3" /></button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1 cursor-pointer group min-h-[20px]"
      onClick={() => { setValue(tagsRaw ?? ""); setEditing(true); }}
      title="Clique para editar tags"
    >
      {tags.length > 0 ? tags.map(t => (
        <span key={t} className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${tagColor(t)}`}>
          {t}
        </span>
      )) : (
        <span className="text-[10px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <Tag className="w-2.5 h-2.5" /> Adicionar
        </span>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "online") {
    return (
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-emerald-500 text-sm font-medium">Online</span>
      </span>
    );
  }
  if (status === "offline") {
    return (
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-destructive" />
        <span className="text-destructive text-sm font-medium">Offline</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-muted-foreground" />
      <span className="text-muted-foreground text-sm font-medium">Desconhecido</span>
    </span>
  );
}

type Screen = ReturnType<typeof useListScreens>["data"] extends (infer T)[] | undefined ? T : never;

function ScreenRow({ screen, onDelete, deleteIsPending, onTagSaved }: {
  screen: Screen;
  onDelete: (id: number, name: string) => void;
  deleteIsPending: boolean;
  onTagSaved: () => void;
}) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <Link href={`/screens/${screen.id}`} className="font-medium hover:text-primary transition-colors">
          {screen.name}
        </Link>
        {screen.location && (
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">{screen.location}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={screen.status} />
      </td>
      <td className="px-4 py-3">
        <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded tracking-wider">
          {screen.code}
        </code>
      </td>
      <td className="px-4 py-3">
        {(screen as any).resolution ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <MonitorSmartphone className="w-3 h-3 shrink-0" />
            {(screen as any).resolution}
          </span>
        ) : (
          <span className="text-muted-foreground/40 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {screen.activePlaylistName ? (
          <span className="flex items-center gap-1.5 text-primary">
            <PlaySquare className="w-3.5 h-3.5" />
            <span className="truncate max-w-[140px]">{screen.activePlaylistName}</span>
          </span>
        ) : screen.defaultPlaylistName ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <PlaySquare className="w-3.5 h-3.5 opacity-50" />
            <span className="truncate max-w-[140px] opacity-70">{screen.defaultPlaylistName}</span>
          </span>
        ) : (
          <span className="text-muted-foreground/40 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <TagCell
          screenId={screen.id}
          tagsRaw={(screen as any).tags ?? null}
          onSaved={onTagSaved}
        />
      </td>
      <td className="px-4 py-3">
        <span
          className="flex items-center gap-1.5 text-muted-foreground cursor-default"
          title={formatFullDate(screen.lastSeen ?? null)}
        >
          <Clock className="w-3.5 h-3.5" />
          {formatLastSeen(screen.lastSeen ?? null)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Link href={`/screens/${screen.id}`}>
            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              Detalhes
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(screen.id, screen.name)}
            disabled={deleteIsPending}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function Screens() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: screens, isLoading, refetch } = useListScreens();

  useEffect(() => {
    const interval = setInterval(() => { refetch(); }, 30_000);
    return () => clearInterval(interval);
  }, [refetch]);
  const deleteScreen = useDeleteScreen();
  const createScreen = useCreateScreen();

  const handleCreate = () => {
    if (!newName.trim()) return;
    createScreen.mutate(
      { data: { name: newName.trim(), location: newLocation.trim() || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListScreensQueryKey() });
          toast({ title: "Tela criada com sucesso!" });
          setShowCreate(false);
          setNewName("");
          setNewLocation("");
        },
        onError: () => {
          toast({ title: "Erro ao criar tela", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Remover a tela "${name}"?`)) return;
    deleteScreen.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListScreensQueryKey() });
          toast({ title: "Tela removida" });
        },
        onError: () => {
          toast({ title: "Erro ao remover tela", variant: "destructive" });
        },
      }
    );
  };

  const filtered = screens?.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.location ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const onlineScreens = filtered.filter((s) => s.status === "online");
  const offlineScreens = filtered.filter((s) => s.status !== "online");

  const onlineCount = screens?.filter((s) => s.status === "online").length ?? 0;
  const totalCount = screens?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Minhas Telas</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "Carregando..." : `${onlineCount} online · ${totalCount} total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
            <Wifi className="w-3 h-3" /> {onlineCount} online
          </Badge>
          <Badge variant="outline" className="gap-1.5 text-muted-foreground">
            <WifiOff className="w-3 h-3" /> {totalCount - onlineCount} offline
          </Badge>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Tela
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border">
        <div className="p-4 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, código ou local..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Monitor className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="text-lg font-medium">Nenhuma tela encontrada</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Pareie sua primeira TV box pelo código de pareamento no painel inicial.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome da Tela</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Código</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Resolução</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Playlist Ativa</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tags</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Último Sinal</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {/* ── ONLINE ── */}
                {onlineScreens.length > 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-2 bg-emerald-500/8 border-b border-emerald-500/20">
                      <span className="flex items-center gap-2 text-[11px] font-bold text-emerald-500 uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Online — {onlineScreens.length} {onlineScreens.length === 1 ? "tela" : "telas"}
                      </span>
                    </td>
                  </tr>
                )}
                {onlineScreens.map((screen) => (
                  <ScreenRow
                    key={screen.id}
                    screen={screen}
                    onDelete={handleDelete}
                    deleteIsPending={deleteScreen.isPending}
                    onTagSaved={() => queryClient.invalidateQueries({ queryKey: getListScreensQueryKey() })}
                  />
                ))}

                {/* ── OFFLINE ── */}
                {offlineScreens.length > 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-2 bg-muted/20 border-b border-muted/40">
                      <span className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                        Offline — {offlineScreens.length} {offlineScreens.length === 1 ? "tela" : "telas"}
                      </span>
                    </td>
                  </tr>
                )}
                {offlineScreens.map((screen) => (
                  <ScreenRow
                    key={screen.id}
                    screen={screen}
                    onDelete={handleDelete}
                    deleteIsPending={deleteScreen.isPending}
                    onTagSaved={() => queryClient.invalidateQueries({ queryKey: getListScreensQueryKey() })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tela</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="screen-name">Nome da tela *</Label>
              <Input
                id="screen-name"
                placeholder="Ex: Loja Centro, Recepção..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="screen-location">Localização (opcional)</Label>
              <Input
                id="screen-location"
                placeholder="Ex: Av. Paulista, 1000"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || createScreen.isPending}>
              {createScreen.isPending ? "Criando..." : "Criar Tela"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
