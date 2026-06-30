import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

export interface AppDef {
  id: string;
  name: string;
  description: string;
  color: string;
  textColor?: string;
  monogram: string;
  popular?: boolean;
  badge?: string;
}

export const APPS: AppDef[] = [
  { id: "canva",            name: "Canva",             description: "Exiba seus designs do Canva em tela cheia",       color: "#7D2AE7", monogram: "C",  popular: true },
  { id: "youtube_playlist", name: "YouTube Playlist",  description: "Playlist de vídeos em sequência automática",     color: "#FF0000", monogram: "YP", popular: true },
  { id: "google_slides",    name: "Google Slides",     description: "Apresentação que atualiza automaticamente",       color: "#FBBC05", textColor: "#333", monogram: "GS", popular: true },
  { id: "spotify",          name: "Spotify",           description: "Playlists e músicas de fundo",                   color: "#1DB954", monogram: "Sp", popular: true },
  { id: "instagram",        name: "Instagram",         description: "Publicação pública do Instagram",                color: "#C13584", monogram: "Ig" },
  { id: "tiktok",           name: "TikTok",            description: "Vídeos públicos do TikTok",                      color: "#010101", monogram: "TT" },
  { id: "youtube",          name: "YouTube",           description: "Vídeo individual em loop silencioso",             color: "#FF0000", monogram: "YT" },
  { id: "pluto_tv",         name: "Pluto TV",          description: "Canais ao vivo do Pluto TV",                     color: "#00b4d8", monogram: "Pℓ" },
  { id: "web_channel",      name: "Site / URL",        description: "Qualquer site, link ou URL personalizada",       color: "#3B82F6", monogram: "W"  },
];

function AppIcon({ app, size = "md" }: { app: AppDef; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-10 h-10 text-sm", md: "w-12 h-12 text-base", lg: "w-14 h-14 text-lg" };
  return (
    <div
      style={{ backgroundColor: app.color }}
      className={cn("rounded-xl flex items-center justify-center shrink-0 font-bold shadow-md", sizes[size])}
    >
      <span style={{ color: app.textColor ?? "#fff" }}>{app.monogram}</span>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectApp: (appId: string) => void;
}

export function AppGallery({ open, onOpenChange, onSelectApp }: Props) {
  const [query, setQuery] = useState("");

  const filtered = APPS.filter((a) =>
    !query || a.name.toLowerCase().includes(query.toLowerCase()) || a.description.toLowerCase().includes(query.toLowerCase())
  );
  const popular = filtered.filter((a) => a.popular);
  const all = filtered;

  const pick = (id: string) => {
    onOpenChange(false);
    onSelectApp(id);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setQuery(""); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg">Adicionar Conteúdo</DialogTitle>
          <DialogDescription>
            Escolha um aplicativo ou tipo de conteúdo para exibir nas suas telas.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar aplicativos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="overflow-y-auto flex-1 pr-1 space-y-6">
          {/* Popular */}
          {!query && popular.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">⭐ Populares</p>
              <div className="grid grid-cols-2 gap-3">
                {popular.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => pick(app.id)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-left group"
                  >
                    <AppIcon app={app} size="md" />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{app.name}</div>
                      <div className="text-xs text-muted-foreground leading-snug mt-0.5 truncate">{app.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All apps */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {query ? `Resultados (${filtered.length})` : "Todos os Aplicativos"}
            </p>
            <div className="grid grid-cols-4 gap-3">
              {all.map((app) => (
                <button
                  key={app.id}
                  onClick={() => pick(app.id)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group"
                >
                  <AppIcon app={app} size="lg" />
                  <div className="text-xs font-medium text-center text-foreground group-hover:text-primary transition-colors leading-tight">
                    {app.name}
                  </div>
                </button>
              ))}
              {all.length === 0 && (
                <div className="col-span-4 text-center text-muted-foreground text-sm py-8">
                  Nenhum aplicativo encontrado para "<span className="italic">{query}</span>"
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
