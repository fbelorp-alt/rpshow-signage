import { useState } from "react";
import { Link } from "wouter";
import {
  useListScreens,
  useCreateScreen,
  useDeleteScreen,
  getListScreensQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Monitor, Search, Plus, MoreVertical, MapPin, Hash, PlaySquare } from "lucide-react";

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
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  location: z.string().optional(),
});

type ScreenFormValues = z.infer<typeof formSchema>;

export default function Screens() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: screens, isLoading } = useListScreens();
  const createScreen = useCreateScreen();
  const deleteScreen = useDeleteScreen();

  const form = useForm<ScreenFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", location: "" },
  });

  const onSubmit = (data: ScreenFormValues) => {
    createScreen.mutate(
      { data: { name: data.name, location: data.location, clientId: 0 } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListScreensQueryKey() });
          setIsCreateOpen(false);
          form.reset();
          toast({ title: "Tela registrada com sucesso!" });
        },
        onError: () => {
          toast({ title: "Erro ao registrar tela", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Remover esta tela?")) {
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
    }
  };

  const filteredScreens = screens?.filter(screen =>
    screen.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    screen.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Minhas Telas</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas TV boxes e dispositivos.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 gap-2">
              <Plus className="w-4 h-4" />
              Nova Tela
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Nova Tela</DialogTitle>
              <DialogDescription>
                Adicione uma TV box à plataforma. Um código de pareamento será gerado automaticamente.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do dispositivo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: TV Recepção" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localização (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Parede principal da recepção" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createScreen.isPending}>
                    {createScreen.isPending ? "Registrando..." : "Registrar Tela"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card p-4 rounded-lg border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-transparent border-0 shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : filteredScreens?.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-lg border border-dashed">
          <Monitor className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">Nenhuma tela encontrada</h3>
          <p className="text-muted-foreground mt-1">Registre sua primeira TV box para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredScreens?.map(screen => (
            <Card key={screen.id} className="hover-elevate transition-all duration-200 group cursor-pointer" onClick={() => window.location.href = `/screens/${screen.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Monitor className="w-6 h-6" />
                      </div>
                      <div className={cn(
                        "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card",
                        screen.status === 'online' ? "bg-emerald-500" :
                        screen.status === 'offline' ? "bg-destructive" :
                        "bg-muted-foreground"
                      )} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors">
                        {screen.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5 capitalize">{screen.status}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.location.href = `/screens/${screen.id}` }}>
                        Ver Detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(`/player/${screen.code}`, '_blank') }}>
                        Abrir Player
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(screen.id); }}
                      >
                        Remover Tela
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-md">
                  <div>
                    <div className="flex items-center text-xs text-muted-foreground mb-1">
                      <Hash className="w-3 h-3 mr-1" /> Código
                    </div>
                    <code className="text-sm font-mono font-medium tracking-wider bg-background px-1.5 py-0.5 rounded border">
                      {screen.code}
                    </code>
                  </div>
                  <div>
                    <div className="flex items-center text-xs text-muted-foreground mb-1">
                      <MapPin className="w-3 h-3 mr-1" /> Localização
                    </div>
                    <p className="text-sm font-medium truncate">{screen.location || "—"}</p>
                  </div>
                </div>

                {screen.activePlaylistName && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <PlaySquare className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Exibindo:</span>
                    <span className="font-medium truncate">{screen.activePlaylistName}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
