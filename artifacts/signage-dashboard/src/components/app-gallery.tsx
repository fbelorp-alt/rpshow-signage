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
  category: "app" | "widget";
}

export const APPS: AppDef[] = [
  { id: "canva",            name: "Canva",             description: "Exiba seus designs do Canva em tela cheia",       color: "#7D2AE7", monogram: "C",  popular: true, category: "app" },
  { id: "youtube_playlist", name: "YouTube Playlist",  description: "Playlist de vídeos em sequência automática",     color: "#FF0000", monogram: "YP", popular: true, category: "app" },
  { id: "google_slides",    name: "Google Slides",     description: "Apresentação que atualiza automaticamente",       color: "#FBBC05", textColor: "#333", monogram: "GS", popular: true, category: "app" },
  { id: "youtube",          name: "YouTube",           description: "Vídeo individual em loop silencioso",             color: "#FF0000", monogram: "YT", category: "app" },
  { id: "web_channel",      name: "Canais Web",        description: "Qualquer site, URL ou canal ao vivo em tela cheia",  color: "#3B82F6", monogram: "W",  category: "app" },
];

export const WIDGETS: AppDef[] = [
  { id: "text",             name: "Texto",            description: "Texto personalizado com fontes e efeitos",    color: "#7c3aed", monogram: "T",  popular: true, category: "widget" },
  { id: "clock",            name: "Relógio",           description: "Hora digital com fuso horário",              color: "#374151", monogram: "🕐", popular: true, category: "widget" },
  { id: "weather",          name: "Clima",             description: "Temperatura e condições do tempo em tempo real", color: "#0369a1", monogram: "⛅", popular: true, category: "widget" },
  { id: "weather_forecast", name: "Previsão 5 dias",   description: "Previsão do tempo para os próximos 5 dias",  color: "#0c4a6e", monogram: "📡", popular: true, category: "widget" },
  { id: "date",             name: "Data",              description: "Data atual em destaque na tela",             color: "#1e3a5f", monogram: "📅", category: "widget" },
  { id: "qr_code",          name: "QR Code",           description: "Gera QR Code a partir de uma URL",          color: "#1a1a1a", monogram: "▦",  category: "widget" },
  { id: "rss",              name: "Ticker RSS",         description: "Notícias e textos em faixa deslizante",     color: "#7c2d12", monogram: "📰", category: "widget" },
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

  const q = query.toLowerCase();
  const filteredApps = APPS.filter((a) => !q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
  const filteredWidgets = WIDGETS.filter((a) => !q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
  const popular = APPS.filter((a) => a.popular);

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
            Escolha um aplicativo, integração ou widget para exibir nas suas telas.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="overflow-y-auto flex-1 pr-1 space-y-6">
          {/* Popular (hide when searching) */}
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
                      <div className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">{app.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Apps grid */}
          {filteredApps.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {query ? `Aplicativos (${filteredApps.length})` : "Todos os Aplicativos"}
              </p>
              <div className="grid grid-cols-4 gap-3">
                {filteredApps.map((app) => (
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
              </div>
            </div>
          )}

          {/* Widgets grid */}
          {filteredWidgets.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                🔧 {query ? `Widgets (${filteredWidgets.length})` : "Widgets Nativos"}
              </p>
              <div className="grid grid-cols-4 gap-3">
                {filteredWidgets.map((app) => (
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
              </div>
            </div>
          )}

          {filteredApps.length === 0 && filteredWidgets.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              Nenhum resultado para "<span className="italic">{query}</span>"
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
