import { useState, useRef } from "react";
import {
  useListMedia,
  useCreateMedia,
  useDeleteMedia,
  useUpdateMedia,
  useRequestUploadUrl,
  getListMediaQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Image as ImageIcon, Film, Search, Upload, Trash2, Pencil,
  Eye, LayoutGrid, List, Check, X, FolderOpen, ChevronRight,
} from "lucide-react";
import { ObjectUploader } from "@workspace/object-storage-web";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type ViewMode = "list" | "grid";
type TypeFilter = "all" | "image" | "video";

interface MediaItem {
  id: number;
  name: string;
  type: string;
  url: string;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  createdAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function MediaThumb({ url, type, className }: { url: string; type: string; className?: string }) {
  if (type === "video") {
    return (
      <div className={cn("bg-black/80 flex items-center justify-center", className)}>
        <Film className="w-1/3 h-1/3 min-w-3 min-h-3 text-white/40" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className={cn("object-cover", className)}
      loading="lazy"
    />
  );
}

function RenameInput({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(initialValue);
  return (
    <div className="flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
      <Input
        autoFocus
        className="h-6 text-xs px-1.5 py-0 w-40"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(val);
          if (e.key === "Escape") onCancel();
        }}
      />
      <button onClick={() => onSave(val)} className="p-0.5 text-primary hover:text-primary/80">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={onCancel} className="p-0.5 text-muted-foreground hover:text-foreground">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function MediaLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const objectPathMap = useRef(new Map<string, string>());

  const { data: media, isLoading } = useListMedia();
  const createMedia = useCreateMedia();
  const deleteMedia = useDeleteMedia();
  const updateMedia = useUpdateMedia();
  const requestUploadUrl = useRequestUploadUrl();

  const filtered = media?.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const counts = {
    all: media?.length ?? 0,
    image: media?.filter((m) => m.type === "image").length ?? 0,
    video: media?.filter((m) => m.type === "video").length ?? 0,
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Deletar "${name}"? Ela será removida de todas as playlists.`)) {
      deleteMedia.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
            toast({ title: "Mídia deletada" });
          },
          onError: () => toast({ title: "Erro ao deletar", variant: "destructive" }),
        }
      );
    }
  };

  const handleRename = (id: number, name: string) => {
    if (!name.trim()) { setRenamingId(null); return; }
    updateMedia.mutate(
      { id, data: { name: name.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
          setRenamingId(null);
          toast({ title: "Renomeado com sucesso" });
        },
        onError: () => toast({ title: "Erro ao renomear", variant: "destructive" }),
      }
    );
  };

  const sidebarItems: { label: string; value: TypeFilter; icon: React.ReactNode; count: number }[] = [
    { label: "Todas", value: "all", icon: <FolderOpen className="w-4 h-4" />, count: counts.all },
    { label: "Imagens", value: "image", icon: <ImageIcon className="w-4 h-4" />, count: counts.image },
    { label: "Vídeos", value: "video", icon: <Film className="w-4 h-4" />, count: counts.video },
  ];

  return (
    <div className="flex h-[calc(100vh-80px)] -mx-6 -mt-4 overflow-hidden">
      {/* ── LEFT SIDEBAR ── */}
      <div className="w-48 border-r bg-muted/20 flex flex-col shrink-0">
        <div className="px-3 py-3 border-b">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Meu Conteúdo
          </p>
        </div>
        <div className="p-2 space-y-0.5">
          {sidebarItems.map((item) => (
            <button
              key={item.value}
              onClick={() => setTypeFilter(item.value)}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors text-left",
                typeFilter === item.value
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent"
              )}
            >
              <span className="flex items-center gap-2 truncate">
                {item.icon}
                {item.label}
              </span>
              <span className={cn(
                "text-[10px] font-medium rounded-full px-1.5 py-0.5 min-w-[20px] text-center",
                typeFilter === item.value
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}>
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-card shrink-0 flex-wrap">
          <ObjectUploader
            maxNumberOfFiles={20}
            maxFileSize={104857600}
            onGetUploadParameters={async (file) => {
              const res = await requestUploadUrl.mutateAsync({
                data: {
                  name: file.name,
                  size: file.size ?? 0,
                  contentType: file.type ?? "application/octet-stream",
                },
              });
              objectPathMap.current.set(file.id, res.objectPath);
              return { method: "PUT" as const, url: res.uploadURL };
            }}
            onComplete={(result) => {
              result.successful?.forEach((file) => {
                const objectPath = objectPathMap.current.get(file.id);
                if (!objectPath) return;
                const isVideo = file.type?.startsWith("video/") ?? false;
                createMedia.mutate(
                  {
                    data: {
                      name: file.name,
                      type: isVideo ? "video" : "image",
                      url: objectPath,
                      durationSeconds: isVideo ? undefined : 10,
                    },
                  },
                  {
                    onSuccess: () =>
                      queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() }),
                  }
                );
              });
              if ((result.successful?.length ?? 0) > 0) {
                toast({ title: `${result.successful?.length} arquivo(s) enviado(s) com sucesso` });
              }
            }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Enviar Mídia
            </span>
          </ObjectUploader>

          <div className="h-5 w-px bg-border hidden sm:block" />

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
              title="Lista"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("grid")}
              title="Grade"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-4 px-2 py-2.5">
                  <Skeleton className="w-10 h-10 rounded shrink-0" />
                  <Skeleton className="h-4 flex-1 max-w-xs" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          ) : filtered?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-16">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <ImageIcon className="w-6 h-6 text-muted-foreground opacity-40" />
              </div>
              <h3 className="font-medium">Nenhuma mídia encontrada</h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                {searchQuery
                  ? "Tente outro termo de busca."
                  : "Clique em Enviar Mídia para começar."}
              </p>
            </div>
          ) : viewMode === "list" ? (
            /* ─── LIST VIEW ─── */
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left font-semibold w-8">
                    <input type="checkbox" className="rounded opacity-60" readOnly />
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold">Nome da Mídia</th>
                  <th className="px-4 py-2.5 text-left font-semibold w-24">Tipo</th>
                  <th className="px-4 py-2.5 text-left font-semibold w-24">Duração</th>
                  <th className="px-4 py-2.5 text-left font-semibold w-44">Criado em</th>
                  <th className="px-4 py-2.5 text-right font-semibold w-40">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered?.map((item) => (
                  <tr key={item.id} className="group hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2">
                      <input type="checkbox" className="rounded opacity-40" readOnly />
                    </td>

                    {/* Name + thumbnail */}
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded overflow-hidden border bg-muted shrink-0 flex items-center justify-center">
                          <MediaThumb url={item.url} type={item.type} className="w-full h-full" />
                        </div>
                        {renamingId === item.id ? (
                          <RenameInput
                            initialValue={item.name}
                            onSave={(v) => handleRename(item.id, v)}
                            onCancel={() => setRenamingId(null)}
                          />
                        ) : (
                          <span
                            className="font-medium truncate max-w-xs"
                            title={item.name}
                          >
                            {item.name}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-2">
                      <Badge variant="outline" className="text-[10px] uppercase px-1.5 py-0 font-medium">
                        {item.type}
                      </Badge>
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-2 text-muted-foreground text-xs tabular-nums">
                      {item.durationSeconds ? `${item.durationSeconds}s` : "—"}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-2 text-muted-foreground text-xs tabular-nums">
                      {formatDate(item.createdAt)}
                    </td>

                    {/* Actions — visible on hover */}
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => setRenamingId(item.id)}
                        >
                          <Pencil className="w-3 h-3" />
                          Renomear
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 hover:bg-accent"
                          onClick={() => setPreviewItem(item as MediaItem)}
                        >
                          <Eye className="w-3 h-3" />
                          Ver
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(item.id, item.name)}
                        >
                          <Trash2 className="w-3 h-3" />
                          Deletar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* ─── GRID VIEW ─── */
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filtered?.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-lg border bg-card overflow-hidden hover:shadow-md transition-all"
                >
                  <div className="aspect-square bg-muted overflow-hidden">
                    <MediaThumb url={item.url} type={item.type} className="w-full h-full" />
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs gap-1 w-full"
                      onClick={() => setPreviewItem(item as MediaItem)}
                    >
                      <Eye className="w-3 h-3" /> Ver
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs gap-1 w-full"
                      onClick={() => setRenamingId(item.id)}
                    >
                      <Pencil className="w-3 h-3" /> Renomear
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs gap-1 w-full"
                      onClick={() => handleDelete(item.id, item.name)}
                    >
                      <Trash2 className="w-3 h-3" /> Deletar
                    </Button>
                  </div>

                  <Badge className="absolute top-1.5 left-1.5 text-[9px] px-1 py-0 h-4 uppercase bg-black/60 border-0 text-white">
                    {item.type}
                  </Badge>

                  <div className="px-2 py-1.5 border-t">
                    {renamingId === item.id ? (
                      <RenameInput
                        initialValue={item.name}
                        onSave={(v) => handleRename(item.id, v)}
                        onCancel={() => setRenamingId(null)}
                      />
                    ) : (
                      <p className="text-xs font-medium truncate" title={item.name}>
                        {item.name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && (filtered?.length ?? 0) > 0 && (
          <div className="px-4 py-2 border-t bg-muted/20 flex items-center justify-between shrink-0 text-xs text-muted-foreground">
            <span>
              {filtered?.length} arquivo{(filtered?.length ?? 0) !== 1 ? "s" : ""}
              {typeFilter !== "all" ? ` · filtro: ${typeFilter}` : ""}
            </span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* ── PREVIEW DIALOG ── */}
      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-sm font-semibold truncate pr-8">
              {previewItem?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-black flex items-center justify-center" style={{ minHeight: 360 }}>
            {previewItem?.type === "video" ? (
              <video
                src={previewItem.url}
                controls
                autoPlay
                muted
                className="max-w-full max-h-[65vh] object-contain"
              />
            ) : previewItem ? (
              <img
                src={previewItem.url}
                alt={previewItem.name}
                className="max-w-full max-h-[65vh] object-contain"
              />
            ) : null}
          </div>
          <div className="px-4 py-2.5 border-t flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px] uppercase">{previewItem?.type}</Badge>
            {previewItem?.durationSeconds && <span>{previewItem.durationSeconds}s</span>}
            {previewItem?.createdAt && <span>· {formatDate(previewItem.createdAt)}</span>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
