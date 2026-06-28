import { useState, useEffect } from "react";
import {
  useListScreens,
  useDeleteScreen,
  getListScreensQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Monitor, Search, Wifi, WifiOff, Clock, PlaySquare, Trash2, ExternalLink } from "lucide-react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

export default function Screens() {
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: screens, isLoading, refetch } = useListScreens();

  useEffect(() => {
    const interval = setInterval(() => { refetch(); }, 30_000);
    return () => clearInterval(interval);
  }, [refetch]);
  const deleteScreen = useDeleteScreen();

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

  const filteredScreens = screens?.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.location ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        ) : filteredScreens?.length === 0 ? (
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
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Localização</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Playlist Ativa</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Último Sinal</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredScreens?.map((screen, i) => (
                  <tr
                    key={screen.id}
                    className={cn(
                      "border-b last:border-0 hover:bg-muted/30 transition-colors",
                      i % 2 === 0 ? "" : "bg-muted/10"
                    )}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/screens/${screen.id}`} className="font-medium hover:text-primary transition-colors">
                        {screen.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={screen.status} />
                    </td>
                    <td className="px-4 py-3">
                      <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded tracking-wider">
                        {screen.code}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {screen.location || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {screen.activePlaylistName ? (
                        <span className="flex items-center gap-1.5 text-primary">
                          <PlaySquare className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[140px]">{screen.activePlaylistName}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
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
                          onClick={() => handleDelete(screen.id, screen.name)}
                          disabled={deleteScreen.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
