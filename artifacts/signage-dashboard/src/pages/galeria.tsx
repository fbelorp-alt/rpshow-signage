import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListScreens, useRequestUploadUrl } from "@workspace/api-client-react";
import {
  Monitor, Wifi, WifiOff, Camera, Upload, Loader2,
  MapPin, User, Search, Image,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Client { id: number; name: string; segment: string | null; }

function statusColor(status: string) {
  if (status === "online") return "bg-emerald-500";
  if (status === "offline") return "bg-red-500";
  return "bg-muted-foreground/40";
}

function StatusDot({ status }: { status: string }) {
  return (
    <span className={cn("inline-block w-2 h-2 rounded-full shrink-0", statusColor(status))} />
  );
}

function ScreenCard({ screen, onPhotoUpload, uploading }: {
  screen: any;
  onPhotoUpload: (screen: any, file: File) => void;
  uploading: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const photo = screen.photoUrl || screen.lastScreenshot || null;
  const isOnline = screen.status === "online";

  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden flex flex-col group hover:border-primary/40 hover:shadow-lg transition-all">
      {/* Cover photo */}
      <div
        className={cn(
          "relative cursor-pointer",
          dragOver && "ring-2 ring-primary ring-inset"
        )}
        style={{ height: 160 }}
        onClick={() => !uploading && fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault(); setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onPhotoUpload(screen, f);
        }}
      >
        {photo ? (
          <img src={photo} alt={screen.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted/30 flex flex-col items-center justify-center gap-2">
            <Monitor className="w-10 h-10 text-muted-foreground/20" />
            <p className="text-[11px] text-muted-foreground/40">Sem foto</p>
          </div>
        )}

        {/* Upload overlay */}
        <div className={cn(
          "absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 transition-opacity",
          uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          {uploading
            ? <Loader2 className="w-6 h-6 text-white animate-spin" />
            : <>
                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  {photo ? <Camera className="w-4 h-4 text-white" /> : <Upload className="w-4 h-4 text-white" />}
                </div>
                <p className="text-[11px] text-white/80 font-medium">{photo ? "Trocar foto" : "Adicionar foto"}</p>
              </>
          }
        </div>

        {/* Status badge */}
        <div className={cn(
          "absolute top-2 left-2 flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm",
          isOnline ? "bg-emerald-600/80" : "bg-black/50"
        )}>
          {isOnline
            ? <Wifi className="w-2.5 h-2.5" />
            : <WifiOff className="w-2.5 h-2.5" />}
          {isOnline ? "Online" : "Offline"}
        </div>

        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { onPhotoUpload(screen, f); } e.target.value = ""; }} />
      </div>

      {/* Card body */}
      <div className="p-3.5 flex flex-col gap-1.5 flex-1">
        <h3 className="font-bold text-sm leading-tight truncate">{screen.name}</h3>
        {screen.location && (
          <div className="flex items-start gap-1 text-[11px] text-muted-foreground">
            <MapPin className="w-3 h-3 shrink-0 mt-px text-primary/50" />
            <span className="truncate">{screen.location.split(",")[0]}</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-auto">
          <span className="font-mono text-[10px] bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground/70">{screen.code}</span>
        </div>
      </div>
    </div>
  );
}

export default function Galeria() {
  const [search, setSearch] = useState("");
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const requestUploadUrl = useRequestUploadUrl();

  const { data: screensRaw = [], isLoading: loadingScreens } = useListScreens();
  const screens = (screensRaw as any[]);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-gallery"],
    queryFn: () => fetch("/api/clients", { credentials: "include" }).then(r => r.json()),
  });

  const clientMap = new Map<number, string>(clients.map(c => [c.id, c.name]));

  const filtered = screens.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.location ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (clientMap.get(s.clientId) ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Group by clientId
  const groups = new Map<string, any[]>();
  for (const s of filtered) {
    const key = s.clientId ? String(s.clientId) : "__sem_cliente__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  async function handlePhotoUpload(screen: any, file: File) {
    setUploadingId(screen.id);
    try {
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
        data: { name: `screen-photo-${screen.id}-${Date.now()}.${file.name.split(".").pop()}`, size: file.size, contentType: file.type },
      });
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

      const publicUrl = `/api/storage/files/${objectPath}`;
      await fetch(`/api/screens/${screen.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: publicUrl }),
      });

      queryClient.invalidateQueries({ queryKey: ["screens"] });
      toast({ title: "Foto atualizada!" });
    } catch {
      toast({ title: "Erro ao enviar foto", variant: "destructive" });
    } finally {
      setUploadingId(null);
    }
  }

  const totalOnline = screens.filter(s => s.status === "online").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        icon={Image}
        title="Galeria de Telas"
        description={`${screens.length} tela${screens.length !== 1 ? "s" : ""} · ${totalOnline} online`}
        actions={
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar tela, local ou cliente..."
              className="pl-8 h-8 text-sm" />
          </div>
        }
      />

      {loadingScreens ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <Monitor className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nenhuma tela encontrada</p>
        </div>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([clientKey, groupScreens]) => {
            const clientName = clientKey === "__sem_cliente__"
              ? "Sem cliente"
              : (clientMap.get(Number(clientKey)) ?? `Cliente #${clientKey}`);
            const onlineCount = groupScreens.filter(s => s.status === "online").length;

            return (
              <div key={clientKey}>
                {/* Client header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-sm leading-tight">{clientName}</h2>
                    <p className="text-[11px] text-muted-foreground">
                      {groupScreens.length} tela{groupScreens.length !== 1 ? "s" : ""} · {onlineCount} online
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusDot status={onlineCount > 0 ? "online" : "offline"} />
                    <span className="text-[11px] text-muted-foreground">{onlineCount}/{groupScreens.length}</span>
                  </div>
                </div>

                {/* Screen cards grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {groupScreens.map(screen => (
                    <ScreenCard
                      key={screen.id}
                      screen={screen}
                      onPhotoUpload={handlePhotoUpload}
                      uploading={uploadingId === screen.id}
                    />
                  ))}
                </div>

                <div className="border-b border-border/30 mt-8" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
