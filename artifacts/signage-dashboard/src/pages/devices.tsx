import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useListScreens,
  useListPlaylists,
  useCreateSchedule,
  getListSchedulesQueryKey,
  getListScreensQueryKey,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Cpu,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  MonitorSmartphone,
  AlertCircle,
  Info,
  Pencil,
  Send,
  Film,
  PlaySquare,
  BarChart2,
  ExternalLink,
  ScanLine,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { StatusBadge, TagCell, PowerScheduleCell, formatLastSeen, formatFullDate, timeAgo } from "./screens";

interface Device {
  id: number;
  serial: string;
  name: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  screenCode: string | null;
  userId: string | null;
  operatorName?: string | null;
  createdAt: string;
  approvedAt: string | null;
  screenId?: number | null;
  screenStatus?: "online" | "offline" | "unknown" | null;
  resolution?: string | null;
  activePlaylistName?: string | null;
  lastPlay?: { mediaName: string; playedAt: string } | null;
  playsToday?: number;
  tags?: string | null;
  powerScheduleJson?: string | null;
  screenLastSeen?: string | null;
  screenTimezone?: string | null;
  screenPowerOnTime?: string | null;
  screenPowerOffTime?: string | null;
  screenPanelWidth?: number | null;
  screenPanelHeight?: number | null;
}

interface Screen {
  id: number;
  name: string;
  code: string;
}

function statusBadge(status: string) {
  if (status === "approved")
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Aprovado</Badge>;
  if (status === "rejected")
    return <Badge className="bg-red-100 text-red-700 border-red-200">Rejeitado</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pendente</Badge>;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATOR VIEW — auto-cadastro simplificado
// ─────────────────────────────────────────────────────────────────────────────
function OperatorDevicesView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [search, setSearch] = useState("");
  const [publishDevice, setPublishDevice] = useState<Device | null>(null);
  const [publishPlaylistId, setPublishPlaylistId] = useState<string>("");

  const [fSerial, setFSerial] = useState("");
  const [fName, setFName] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fScreenCode, setFScreenCode] = useState("");

  // QR scanner
  const [scanOpen, setScanOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopScan = useCallback(() => {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setScanOpen(false);
  }, []);

  const startScan = useCallback(async () => {
    if (!("BarcodeDetector" in window)) {
      toast({ title: "QR scan não suportado neste navegador", description: "Use Chrome no Android ou desktop.", variant: "destructive" });
      return;
    }
    setScanOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      await new Promise(r => setTimeout(r, 200));
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      // @ts-ignore
      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const raw = codes[0].rawValue as string;
            let serial = raw;
            try { const u = new URL(raw); serial = u.searchParams.get("serial") ?? raw; } catch { /* not URL */ }
            setFSerial(serial.toUpperCase());
            stopScan();
            setAddOpen(true);
            toast({ title: "✅ QR lido!", description: `Serial: ${serial.toUpperCase()}` });
          }
        } catch { /* frame not ready */ }
      }, 400);
    } catch {
      toast({ title: "Câmera não disponível", variant: "destructive" });
      setScanOpen(false);
    }
  }, [stopScan, toast]);

  // Auto-open form pre-filled when ?serial= is in the URL (from QR scan)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const serial = params.get("serial");
    if (serial) {
      setFSerial(serial.toUpperCase());
      setAddOpen(true);
      // Clean the URL so refreshing doesn't re-open the modal
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data: devices = [], isLoading, refetch, isFetching } = useQuery<Device[]>({
    queryKey: ["devices"],
    queryFn: async () => {
      const r = await fetch("/api/devices", { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: screensData } = useListScreens();
  const screens: Screen[] = (screensData as any) ?? [];

  const { data: playlistsData } = useListPlaylists(
    {},
    { query: { queryKey: ["playlists"], enabled: !!publishDevice } }
  );
  const playlists = (playlistsData as any) ?? [];
  const createSchedule = useCreateSchedule();

  function screenName(code: string | null) {
    if (!code) return null;
    const s = screens.find((sc) => sc.code === code);
    return s ? s.name : code;
  }

  function handlePublishToDevice() {
    if (!publishDevice?.screenCode || !publishPlaylistId) return;
    const screen = screens.find((sc) => sc.code === publishDevice.screenCode);
    if (!screen) return;
    createSchedule.mutate(
      {
        data: {
          playlistId: parseInt(publishPlaylistId),
          screenId: screen.id,
          active: true,
          startTime: "00:00",
          endTime: "23:59",
          daysOfWeek: "0,1,2,3,4,5,6",
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          qc.invalidateQueries({ queryKey: ["screens"] });
          setPublishDevice(null);
          setPublishPlaylistId("");
          toast({ title: "Playlist publicada na tela! Aparece na TV em instantes." });
        },
        onError: () => toast({ title: "Erro ao publicar playlist", variant: "destructive" }),
      }
    );
  }

  function resetForm() {
    setFSerial(""); setFName(""); setFLocation(""); setFScreenCode("");
  }

  function openEdit(d: Device) {
    setEditDevice(d);
    setFSerial(d.serial);
    setFName(d.name ?? "");
    setFLocation(d.location ?? "");
    setFScreenCode(d.screenCode ?? "");
  }

  const addMutation = useMutation({
    mutationFn: async (body: object) => {
      const r = await fetch("/api/devices", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error((e as any).error ?? "Erro ao cadastrar");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Aparelho cadastrado! Aguardando aprovação do administrador." });
      qc.invalidateQueries({ queryKey: ["devices"] });
      setAddOpen(false); resetForm();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: object }) => {
      const r = await fetch(`/api/devices/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Erro ao atualizar");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Aparelho atualizado!" });
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: getListScreensQueryKey() });
      setEditDevice(null);
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/devices/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error((e as any).error ?? "Erro ao remover");
      }
    },
    onSuccess: () => {
      toast({ title: "Aparelho removido" });
      qc.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });


  const filtered = devices.filter((d) =>
    !search ||
    d.serial.toLowerCase().includes(search.toLowerCase()) ||
    (d.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (d.location ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const pending = devices.filter((d) => d.status === "pending").length;
  const approved = devices.filter((d) => d.status === "approved").length;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <MonitorSmartphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Meus Aparelhos</h1>
            <p className="text-sm text-muted-foreground">Cadastre e gerencie seus dispositivos LED/TV</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setAddOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Cadastrar Aparelho
          </Button>
        </div>
      </div>

      {/* How-to banner if no devices yet */}
      {devices.length === 0 && !isLoading && (
        <div className="border border-border bg-muted/60 rounded-lg p-4 flex gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-sm">
            <p className="font-semibold text-white">Como cadastrar seu aparelho:</p>
            <ol className="list-decimal list-inside space-y-1 text-white/90">
              <li>Instale o APK <strong>RPSHOW TV</strong> no dispositivo LED/TV Box</li>
              <li>Na tela de pareamento do app, escaneie o <strong>QR Code</strong> com o celular — ou anote o ID exibido na tela</li>
              <li>Clique em <strong>Cadastrar Aparelho</strong> acima, informe o ID + nome + local</li>
              <li>Aguarde a aprovação do administrador (normalmente em até 24h)</li>
            </ol>
          </div>
        </div>
      )}

      {/* KPIs */}
      {devices.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: devices.length, color: "text-foreground" },
            { label: "Aguardando aprovação", value: pending, color: "text-amber-500" },
            { label: "Ativos", value: approved, color: "text-emerald-500" },
          ].map(({ label, value, color }) => (
            <div key={label} className="border rounded-lg p-4 bg-card">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <span className={`text-2xl font-bold ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      {devices.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por serial, nome ou local…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="border rounded-lg flex items-center justify-center p-16 text-muted-foreground gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : filtered.length > 0 ? (
        <div className="border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial / ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Tela Vinculada</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastrado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id} className="even:bg-white/10 hover:bg-white/[0.13] transition-colors">
                  <TableCell className="font-mono font-semibold text-sm">{d.serial}</TableCell>
                  <TableCell className="text-sm">{d.name ?? <span className="text-muted-foreground italic">—</span>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.location ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {d.screenCode
                      ? <span className="text-primary">{screenName(d.screenCode)}</span>
                      : <span className="text-muted-foreground italic text-xs">Não vinculado</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {statusBadge(d.status)}
                      {d.status === "pending" && (
                        <span className="text-[10px] text-amber-500/80">Aguardando admin</span>
                      )}
                      {d.status === "rejected" && (
                        <span className="text-[10px] text-red-500/80">Contate o suporte</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(d.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 flex-nowrap">
                      {d.status === "approved" && d.screenCode && (
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1 bg-primary/90 hover:bg-primary"
                          onClick={() => { setPublishPlaylistId(""); setPublishDevice(d); }}
                        >
                          <Send className="w-3 h-3" /> Publicar Playlist
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => openEdit(d)}>
                        <Pencil className="w-3 h-3" /> Editar
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50/10"
                        onClick={() => {
                          if (!window.confirm(`Remover o aparelho "${d.name ?? d.serial}"? Esta ação não pode ser desfeita.`)) return;
                          deleteMutation.mutate(d.id);
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) { setAddOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MonitorSmartphone className="w-5 h-5 text-primary" />
              Cadastrar Aparelho
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Número de Série *</Label>
              <div className="flex gap-2">
                <Input
                  value={fSerial}
                  onChange={(e) => setFSerial(e.target.value.toUpperCase())}
                  placeholder="Ex: 748E0291ECB45A73"
                  className="font-mono flex-1"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={startScan}
                  title="Escanear QR Code com a câmera"
                  className="shrink-0"
                >
                  <ScanLine className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Digite o ID exibido na tela do aparelho ou clique em <ScanLine className="inline w-3 h-3 mx-0.5" /> para escanear o QR Code com a câmera
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Nome do aparelho</Label>
              <Input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Ex: LED Recepção, TV Sala de Espera" />
            </div>
            <div className="space-y-1.5">
              <Label>Localização</Label>
              <Input value={fLocation} onChange={(e) => setFLocation(e.target.value)} placeholder="Ex: Loja Centro — Parede Frontal" />
            </div>
            <div className="space-y-1.5">
              <Label>Vincular a uma tela (opcional)</Label>
              <Select value={fScreenCode} onValueChange={setFScreenCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma tela…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma (vincular depois)</SelectItem>
                  {screens.map((sc) => (
                    <SelectItem key={sc.id} value={sc.code}>{sc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Define qual conteúdo o aparelho vai exibir</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); resetForm(); }}>Cancelar</Button>
            <Button
              onClick={() => addMutation.mutate({ serial: fSerial, name: fName || undefined, location: fLocation || undefined, screenCode: fScreenCode || undefined })}
              disabled={!fSerial.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? "Cadastrando…" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Scanner Modal */}
      {scanOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-4">
          <div className="text-white text-sm font-medium">Aponte a câmera para o QR Code do aparelho</div>
          <div className="relative rounded-xl overflow-hidden border-2 border-primary" style={{ width: 320, height: 320 }}>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <div className="absolute inset-0 border-[3px] border-primary/60 rounded-xl pointer-events-none" />
            <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-md" />
            <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-md" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-md" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-md" />
          </div>
          <Button variant="outline" onClick={stopScan} className="gap-2 text-white border-white/30 hover:bg-white/10">
            <X className="w-4 h-4" /> Cancelar
          </Button>
        </div>
      )}

      {/* Publish Playlist Dialog */}
      <Dialog open={!!publishDevice} onOpenChange={(o) => { if (!o) { setPublishDevice(null); setPublishPlaylistId(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4" /> Publicar Playlist no Aparelho
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Selecione a playlist para exibir em <strong>{publishDevice?.name ?? publishDevice?.serial}</strong>. O conteúdo vai rodar 24h por dia.
            </p>
            {playlists.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg">
                <Film className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Nenhuma playlist cadastrada. Crie uma em <strong>Playlists</strong>.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                {playlists.map((p: any) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b last:border-0 transition-colors ${publishPlaylistId === String(p.id) ? "bg-primary/10" : "hover:bg-muted/30"}`}
                    onClick={() => setPublishPlaylistId(String(p.id))}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${publishPlaylistId === String(p.id) ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                      {publishPlaylistId === String(p.id) && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <Film className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.itemCount ?? 0} mídias</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPublishDevice(null); setPublishPlaylistId(""); }}>Cancelar</Button>
            <Button
              onClick={handlePublishToDevice}
              disabled={!publishPlaylistId || createSchedule.isPending}
            >
              <Send className="w-3 h-3 mr-1.5" />
              {createSchedule.isPending ? "Publicando…" : "Publicar na TV"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDevice} onOpenChange={(o) => { if (!o) setEditDevice(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Aparelho</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Número de Série</Label>
              <Input
                value={fSerial}
                onChange={(e) => setFSerial(e.target.value.toUpperCase())}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Deve ser exatamente o código do aparelho</p>
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Nome do aparelho" />
            </div>
            <div className="space-y-1.5">
              <Label>Localização</Label>
              <Input value={fLocation} onChange={(e) => setFLocation(e.target.value)} placeholder="Localização" />
            </div>
            <div className="space-y-1.5">
              <Label>Tela vinculada</Label>
              <Select value={fScreenCode} onValueChange={setFScreenCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma tela…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {screens.map((sc) => (
                    <SelectItem key={sc.id} value={sc.code}>{sc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDevice(null)}>Cancelar</Button>
            <Button
              onClick={() => editDevice && updateMutation.mutate({
                id: editDevice.id,
                body: { serial: fSerial || undefined, name: fName || null, location: fLocation || null, screenCode: fScreenCode || null },
              })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN VIEW — gestão completa de todos os dispositivos
// ─────────────────────────────────────────────────────────────────────────────
function AdminDevicesView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [confirmDeleteDeviceId, setConfirmDeleteDeviceId] = useState<number | null>(null);

  const [fSerial, setFSerial] = useState("");
  const [fName, setFName] = useState("");
  const [fScreenCode, setFScreenCode] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fOperatorId, setFOperatorId] = useState("");
  const [fEditLocation, setFEditLocation] = useState("");
  // Address via CEP
  const [fCep, setFCep] = useState("");
  const [fLogradouro, setFLogradouro] = useState("");
  const [fNumero, setFNumero] = useState("");
  const [fComplemento, setFComplemento] = useState("");
  const [fBairro, setFBairro] = useState("");
  const [fCidade, setFCidade] = useState("");
  const [fUf, setFUf] = useState("");
  const [fCepLoading, setFCepLoading] = useState(false);
  const [fCepError, setFCepError] = useState("");
  // Screen config
  const [fTimezone, setFTimezone] = useState("America/Sao_Paulo");
  const [fPowerOn, setFPowerOn] = useState("");
  const [fPowerOff, setFPowerOff] = useState("");
  const [fPanelW, setFPanelW] = useState("");
  const [fPanelH, setFPanelH] = useState("");

  const fLocation = [
    fLogradouro && fNumero ? `${fLogradouro}, ${fNumero}` : fLogradouro || "",
    fComplemento,
    fBairro,
    fCidade && fUf ? `${fCidade}/${fUf}` : fCidade || fUf,
    fCep ? `CEP ${fCep}` : "",
  ].filter(Boolean).join(", ");

  async function lookupAdminCep(raw: string) {
    const cep = raw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setFCepLoading(true); setFCepError("");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) { setFCepError("CEP não encontrado."); return; }
      setFLogradouro(data.logradouro ?? "");
      setFBairro(data.bairro ?? "");
      setFCidade(data.localidade ?? "");
      setFUf(data.uf ?? "");
    } catch { setFCepError("Erro ao buscar CEP. Verifique sua conexão."); }
    finally { setFCepLoading(false); }
  }

  const { data: devices = [], isLoading, refetch, isFetching } = useQuery<Device[]>({
    queryKey: ["devices"],
    queryFn: async () => {
      const r = await fetch("/api/devices", { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar dispositivos");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: operators = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["admin-operators-list"],
    queryFn: async () => {
      const r = await fetch("/api/admin/operators", { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return (data ?? []).map((o: any) => ({ id: o.id, name: o.name }));
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: {
      serial: string; name: string; location: string;
      timezone: string; powerOn: string; powerOff: string;
      panelW: string; panelH: string;
      screenCode: string; notes: string; operatorId: string;
    }) => {
      let code = data.screenCode;
      if (!code) {
        const screenBody: Record<string, unknown> = {
          name: data.name || "Nova Tela",
          location: data.location || undefined,
          timezone: data.timezone || "America/Sao_Paulo",
          powerOnTime: data.powerOn || null,
          powerOffTime: data.powerOff || null,
          panelWidth: data.panelW ? parseInt(data.panelW, 10) : null,
          panelHeight: data.panelH ? parseInt(data.panelH, 10) : null,
        };
        if (data.operatorId) screenBody.assignedUserId = data.operatorId;
        const screenResp = await fetch("/api/screens", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(screenBody),
        });
        if (!screenResp.ok) throw new Error("Erro ao criar tela");
        const screen = await screenResp.json();
        code = screen.code;
      }
      const devBody: Record<string, unknown> = {
        serial: data.serial,
        name: data.name || undefined,
        location: data.location || undefined,
        screenCode: code || undefined,
        notes: data.notes || undefined,
      };
      if (data.operatorId) devBody.assignedUserId = data.operatorId;
      const devResp = await fetch("/api/devices", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(devBody),
      });
      if (!devResp.ok) {
        const e = await devResp.json().catch(() => ({}));
        throw new Error((e as any).error ?? "Erro ao cadastrar dispositivo");
      }
      return devResp.json();
    },
    onSuccess: () => {
      toast({ title: "Dispositivo cadastrado!" });
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: getListScreensQueryKey() });
      setAddOpen(false); resetForm();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, screenId, body, screenBody }: {
      id: number;
      screenId?: number | null;
      body: object;
      screenBody?: object;
    }) => {
      const r = await fetch(`/api/devices/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Erro ao atualizar dispositivo");
      if (screenId && screenBody && Object.keys(screenBody).length > 0) {
        await fetch(`/api/screens/${screenId}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(screenBody),
        });
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Dispositivo atualizado!" });
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: getListScreensQueryKey() });
      setEditDevice(null);
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/devices/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!r.ok) throw new Error("Erro ao aprovar");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Dispositivo aprovado! O APK será liberado em até 30s." });
      qc.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: () => toast({ title: "Erro ao aprovar", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/devices/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (!r.ok) throw new Error("Erro ao rejeitar");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Dispositivo rejeitado." });
      qc.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: () => toast({ title: "Erro ao rejeitar", variant: "destructive" }),
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: async ({ deviceId, screenId }: { deviceId: number; screenId?: number | null }) => {
      // Se tem tela vinculada, deleta a tela primeiro
      if (screenId) {
        const del = await fetch(`/api/screens/${screenId}`, { method: "DELETE", credentials: "include" });
        if (!del.ok) {
          const e = await del.json().catch(() => ({}));
          throw new Error((e as any).error ?? "Erro ao excluir tela");
        }
      }
      // Deleta o dispositivo
      const r = await fetch(`/api/devices/${deviceId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error((e as any).error ?? "Erro ao excluir dispositivo");
      }
    },
    onSuccess: () => {
      setConfirmDeleteDeviceId(null);
      toast({ title: "Dispositivo excluído. O APK precisará se registrar novamente." });
      qc.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (err: Error) => {
      setConfirmDeleteDeviceId(null);
      toast({ title: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setFSerial(""); setFName(""); setFScreenCode(""); setFNotes(""); setFOperatorId("");
    setFCep(""); setFLogradouro(""); setFNumero(""); setFComplemento("");
    setFBairro(""); setFCidade(""); setFUf(""); setFCepError(""); setFCepLoading(false);
    setFTimezone("America/Sao_Paulo"); setFPowerOn(""); setFPowerOff("");
    setFPanelW(""); setFPanelH("");
  }

  function openEdit(d: Device) {
    setEditDevice(d);
    setFSerial(d.serial);
    setFName(d.name ?? "");
    setFEditLocation(d.location ?? "");
    setFScreenCode(d.screenCode ?? "");
    setFNotes(d.notes ?? "");
    setFOperatorId(d.userId ?? "");
    setFTimezone(d.screenTimezone ?? "America/Sao_Paulo");
    setFPowerOn(d.screenPowerOnTime ?? "");
    setFPowerOff(d.screenPowerOffTime ?? "");
    setFPanelW(d.screenPanelWidth ? String(d.screenPanelWidth) : "");
    setFPanelH(d.screenPanelHeight ? String(d.screenPanelHeight) : "");
  }

  const filtered = devices.filter((d) => {
    const matchSearch =
      !search ||
      d.serial.toLowerCase().includes(search.toLowerCase()) ||
      (d.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (d.location ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (d.userId ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    all: devices.length,
    pending: devices.filter((d) => d.status === "pending").length,
    approved: devices.filter((d) => d.status === "approved").length,
    rejected: devices.filter((d) => d.status === "rejected").length,
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Dispositivos</h1>
            <p className="text-sm text-muted-foreground">Gerencie e aprove os aparelhos de todos os clientes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setAddOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Cadastrar Dispositivo
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.all, icon: Cpu, color: "text-foreground" },
          { label: "Pendentes", value: counts.pending, icon: Clock, color: "text-amber-600" },
          { label: "Aprovados", value: counts.approved, icon: CheckCircle, color: "text-emerald-600" },
          { label: "Rejeitados", value: counts.rejected, icon: XCircle, color: "text-red-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="border rounded-lg p-4 bg-card">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <span className={`text-2xl font-bold ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Pending alert */}
      {counts.pending > 0 && (
        <div className="border border-amber-500/30 bg-amber-500/10 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span><strong>{counts.pending}</strong> aparelho(s) aguardando sua aprovação</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por serial, nome, local ou cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos ({counts.all})</SelectItem>
            <SelectItem value="pending">Pendentes ({counts.pending})</SelectItem>
            <SelectItem value="approved">Aprovados ({counts.approved})</SelectItem>
            <SelectItem value="rejected">Rejeitados ({counts.rejected})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-16 text-muted-foreground gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 gap-3 text-muted-foreground">
            <Cpu className="w-10 h-10 opacity-30" />
            <p className="text-sm font-medium">
              {devices.length === 0 ? "Nenhum dispositivo cadastrado" : "Nenhum resultado"}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Serial / ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Cód. Tela</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastrado em</TableHead>
                <TableHead>Online/Offline</TableHead>
                <TableHead>Resolução</TableHead>
                <TableHead>Playlist Ativa</TableHead>
                <TableHead>Tocando Agora</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Liga/Desliga</TableHead>
                <TableHead>Último Sinal</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id} className="even:bg-white/10 hover:bg-white/[0.13] transition-colors">
                  <TableCell className="text-sm truncate max-w-[140px]">
                    {d.operatorName
                      ? <span className="font-medium">{d.operatorName}</span>
                      : d.userId
                        ? <span className="text-muted-foreground font-mono text-xs">{d.userId.slice(0, 12)}…</span>
                        : <span className="text-muted-foreground italic text-xs">sem dono</span>}
                  </TableCell>
                  <TableCell className="font-mono font-semibold text-sm">{d.serial}</TableCell>
                  <TableCell className="text-sm">{d.name ?? <span className="text-muted-foreground italic">—</span>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.location ?? "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{d.screenCode ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{statusBadge(d.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(d.createdAt)}</TableCell>
                  <TableCell>
                    {d.screenId ? <StatusBadge status={d.screenStatus ?? "unknown"} /> : <span className="text-muted-foreground/40 text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    {d.resolution ? (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                        <MonitorSmartphone className="w-3 h-3 shrink-0" />
                        {d.resolution.replace(/(\d+\.\d+)/g, (n: string) => String(Math.round(Number(n))))}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.activePlaylistName ? (
                      <span className="flex items-center gap-1.5 text-primary text-sm">
                        <PlaySquare className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[140px]">{d.activePlaylistName}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    {d.lastPlay ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", d.screenStatus === "online" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30")} />
                          <span className="text-xs truncate text-foreground/80">{d.lastPlay.mediaName}</span>
                        </div>
                        <div className="flex items-center gap-2 pl-3">
                          <span className="text-[10px] text-muted-foreground font-mono">{timeAgo(d.lastPlay.playedAt)}</span>
                          {(d.playsToday ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5 text-[9px] text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded">
                              <BarChart2 className="w-2 h-2" />{d.playsToday} hoje
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/30 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.screenId ? (
                      <TagCell screenId={d.screenId} tagsRaw={d.tags ?? null} onSaved={() => qc.invalidateQueries({ queryKey: ["devices"] })} />
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="group">
                    {d.screenId ? (
                      <PowerScheduleCell screenId={d.screenId} powerScheduleJson={d.powerScheduleJson ?? null} onSaved={() => qc.invalidateQueries({ queryKey: ["devices"] })} />
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.screenId ? (
                      <span className="flex items-center gap-1.5 text-muted-foreground cursor-default text-xs" title={formatFullDate(d.screenLastSeen ?? null)}>
                        <Clock className="w-3.5 h-3.5" />
                        {formatLastSeen(d.screenLastSeen ?? null)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 flex-nowrap">
                      {d.status === "pending" && (
                        <>
                          <Button size="sm" variant="outline"
                            className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            onClick={() => approveMutation.mutate(d.id)} disabled={approveMutation.isPending}>
                            <CheckCircle className="w-3 h-3 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline"
                            className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => rejectMutation.mutate(d.id)} disabled={rejectMutation.isPending}>
                            <XCircle className="w-3 h-3 mr-1" /> Rejeitar
                          </Button>
                        </>
                      )}
                      {d.status === "rejected" && (
                        <Button size="sm" variant="outline"
                          className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                          onClick={() => approveMutation.mutate(d.id)} disabled={approveMutation.isPending}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Aprovar
                        </Button>
                      )}
                      {d.screenId && (
                        <Link href={`/screens/${d.screenId}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                            <ExternalLink className="w-3 h-3" /> Detalhes
                          </Button>
                        </Link>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setConfirmDeleteDeviceId(null); openEdit(d); }}>
                        Editar
                      </Button>
                      {confirmDeleteDeviceId !== d.id ? (
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 gap-1"
                          onClick={() => setConfirmDeleteDeviceId(d.id)}
                        >
                          <Trash2 className="w-3 h-3" /> Excluir
                        </Button>
                      ) : (
                        <span className="flex items-center gap-1">
                          <span className="text-xs text-red-700 font-medium whitespace-nowrap">Confirmar?</span>
                          <Button size="sm" variant="destructive" className="h-6 text-xs px-2"
                            disabled={deleteDeviceMutation.isPending}
                            onClick={() => deleteDeviceMutation.mutate({ deviceId: d.id, screenId: d.screenId })}>
                            {deleteDeviceMutation.isPending ? "..." : "Sim"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs px-2"
                            onClick={() => setConfirmDeleteDeviceId(null)}>
                            Não
                          </Button>
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add Dialog (admin) */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) { setAddOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5" /> Cadastrar Dispositivo
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">Configure tudo de uma vez — o que não souber agora pode deixar em branco.</p>
          </DialogHeader>

          {/* Aparelho */}
          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aparelho</p>
            <div className="space-y-1">
              <Label>Android ID da TV Box <span className="text-destructive">*</span></Label>
              <Input value={fSerial} onChange={(e) => setFSerial(e.target.value.toUpperCase())} placeholder="Ex: 748E0291ECB45A73" className="font-mono" autoFocus />
              <p className="text-xs text-muted-foreground">Exibido na tela da TV quando o app RPShow inicia.</p>
            </div>
          </div>

          <div className="border-t my-1" />

          {/* Identificação */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identificação</p>
            <div className="space-y-1">
              <Label>Nome da tela <span className="text-destructive">*</span></Label>
              <Input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Ex: TV Recepção, LED Sala de Espera" />
            </div>
            <div className="space-y-3">
              <Label>Endereço <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="CEP (somente números)"
                    value={fCep}
                    maxLength={9}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
                      const fmt = raw.length > 5 ? `${raw.slice(0,5)}-${raw.slice(5)}` : raw;
                      setFCep(fmt);
                      if (raw.length === 8) lookupAdminCep(raw);
                    }}
                  />
                </div>
                {fCepLoading && <div className="flex items-center px-2"><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
              </div>
              {fCepError && <p className="text-xs text-destructive">{fCepError}</p>}
              <div className="flex gap-2">
                <Input className="flex-1" placeholder="Logradouro" value={fLogradouro} onChange={(e) => setFLogradouro(e.target.value)} />
                <Input className="w-24" placeholder="Nº" value={fNumero} onChange={(e) => setFNumero(e.target.value)} />
              </div>
              <Input placeholder="Complemento (Sala, Apto, etc.) — opcional" value={fComplemento} onChange={(e) => setFComplemento(e.target.value)} />
              <div className="flex gap-2">
                <Input className="flex-1" placeholder="Bairro" value={fBairro} onChange={(e) => setFBairro(e.target.value)} />
                <Input className="flex-1" placeholder="Cidade" value={fCidade} onChange={(e) => setFCidade(e.target.value)} />
                <Input className="w-16 uppercase" placeholder="UF" maxLength={2} value={fUf} onChange={(e) => setFUf(e.target.value.toUpperCase())} />
              </div>
              {fLocation && <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">📍 {fLocation}</p>}
            </div>
          </div>

          <div className="border-t my-1" />

          {/* Display */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Display</p>
            <div className="space-y-1">
              <Label>Fuso horário</Label>
              <Select value={fTimezone} onValueChange={setFTimezone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[
                    { value: "America/Sao_Paulo", label: "Brasília / SP / RJ (BRT −3h)" },
                    { value: "America/Manaus", label: "Manaus / AM (AMT −4h)" },
                    { value: "America/Belem", label: "Belém / PA / MA (BRT −3h)" },
                    { value: "America/Fortaleza", label: "Fortaleza / CE (BRT −3h)" },
                    { value: "America/Recife", label: "Recife / PE (BRT −3h)" },
                    { value: "America/Cuiaba", label: "Cuiabá / MT (AMT −4h)" },
                    { value: "America/Porto_Velho", label: "Porto Velho / RO (AMT −4h)" },
                    { value: "America/Boa_Vista", label: "Boa Vista / RR (AMT −4h)" },
                    { value: "America/Rio_Branco", label: "Rio Branco / AC (ACT −5h)" },
                    { value: "America/Noronha", label: "Fernando de Noronha (FNT −2h)" },
                  ].map((tz) => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resolução do painel <span className="text-muted-foreground">(opcional)</span></Label>
              <Select
                value={fPanelW && fPanelH ? (["1920x1080","1080x1920","576x1152","1152x576","768x1536"].includes(`${fPanelW}x${fPanelH}`) ? `${fPanelW}x${fPanelH}` : "custom") : ""}
                onValueChange={(v) => {
                  const map: Record<string, [string, string]> = { "1920x1080":["1920","1080"],"1080x1920":["1080","1920"],"576x1152":["576","1152"],"1152x576":["1152","576"],"768x1536":["768","1536"],"custom":[fPanelW,fPanelH],"":[" "," "] };
                  const [w, h] = map[v] ?? ["", ""];
                  setFPanelW(w); setFPanelH(h);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar formato..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Automático (sem restrição)</SelectItem>
                  <SelectItem value="1920x1080">📺 TV Full HD — 1920×1080</SelectItem>
                  <SelectItem value="1080x1920">📱 TV Vertical — 1080×1920</SelectItem>
                  <SelectItem value="576x1152">🟥 LED P5 Vertical 3×6 — 576×1152</SelectItem>
                  <SelectItem value="1152x576">🟥 LED P5 Horizontal — 1152×576</SelectItem>
                  <SelectItem value="768x1536">🟥 LED P4 Vertical — 768×1536</SelectItem>
                  <SelectItem value="custom">✏️ Personalizado</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Input value={fPanelW} onChange={(e) => setFPanelW(e.target.value.replace(/\D/g,""))} placeholder="Largura px" className="w-28 text-center" />
                <span className="text-muted-foreground text-sm">×</span>
                <Input value={fPanelH} onChange={(e) => setFPanelH(e.target.value.replace(/\D/g,""))} placeholder="Altura px" className="w-28 text-center" />
              </div>
              <p className="text-xs text-muted-foreground">Deixe vazio se não souber — pode ajustar depois.</p>
            </div>
          </div>

          <div className="border-t my-1" />

          {/* Horário */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Horário de funcionamento <span className="text-muted-foreground font-normal normal-case">(opcional)</span></p>
            <div className="flex items-center gap-4">
              <div className="space-y-1 flex-1">
                <Label>Ligar às</Label>
                <Input type="time" value={fPowerOn} onChange={(e) => setFPowerOn(e.target.value)} />
              </div>
              <div className="space-y-1 flex-1">
                <Label>Desligar às</Label>
                <Input type="time" value={fPowerOff} onChange={(e) => setFPowerOff(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">A TV liga e desliga automaticamente nos horários definidos.</p>
          </div>

          <div className="border-t my-1" />

          {/* Admin-only */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Administrador</p>
            <div className="space-y-1.5">
              <Label>Cliente <span className="text-muted-foreground text-xs font-normal">(vincular ao dono da tela)</span></Label>
              <Select value={fOperatorId || "__none__"} onValueChange={v => setFOperatorId(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem cliente (deixar pendente)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem cliente</SelectItem>
                  {operators.map(op => (
                    <SelectItem key={op.id} value={String(op.id)}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Se selecionar um cliente, o dispositivo já fica aprovado e vinculado a ele.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Código da Tela <span className="text-muted-foreground text-xs font-normal">(deixe vazio para criar automaticamente)</span></Label>
              <Input value={fScreenCode} onChange={(e) => setFScreenCode(e.target.value.toUpperCase())} placeholder="Ex: ABCD1234" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="Observações internas" />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => { setAddOpen(false); resetForm(); }}>Cancelar</Button>
            <Button
              onClick={() => addMutation.mutate({ serial: fSerial, name: fName, location: fLocation, timezone: fTimezone, powerOn: fPowerOn, powerOff: fPowerOff, panelW: fPanelW, panelH: fPanelH, screenCode: fScreenCode, notes: fNotes, operatorId: fOperatorId })}
              disabled={!fSerial.trim() || !fName.trim() || fCep.replace(/\D/g,"").length !== 8 || addMutation.isPending}
            >
              {addMutation.isPending ? "Cadastrando…" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog (admin) — formulário completo igual ao Cadastrar */}
      <Dialog open={!!editDevice} onOpenChange={(o) => { if (!o) { setEditDevice(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5" /> Editar Dispositivo
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Atualize os dados do aparelho e da tela vinculada.
            </p>
          </DialogHeader>

          {/* Aparelho */}
          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aparelho</p>
            <div className="space-y-1">
              <Label>Android ID da TV Box</Label>
              <Input value={fSerial} onChange={(e) => setFSerial(e.target.value.toUpperCase())} placeholder="Ex: 748E0291ECB45A73" className="font-mono" />
              <p className="text-xs text-muted-foreground">Exibido na tela da TV quando o app RPShow inicia.</p>
            </div>
          </div>

          <div className="border-t my-1" />

          {/* Identificação */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identificação</p>
            <div className="space-y-1">
              <Label>Nome da tela <span className="text-destructive">*</span></Label>
              <Input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Ex: TV Recepção, LED Sala de Espera" />
            </div>
            <div className="space-y-1">
              <Label>Endereço / Localização</Label>
              <Input
                value={fEditLocation}
                onChange={(e) => setFEditLocation(e.target.value)}
                placeholder="Ex: Rua das Flores, 123, Centro, São Paulo/SP"
              />
              <p className="text-xs text-muted-foreground">Ou use o CEP abaixo para preencher automaticamente:</p>
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="CEP (somente números)"
                    value={fCep}
                    maxLength={9}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
                      const fmt = raw.length > 5 ? `${raw.slice(0,5)}-${raw.slice(5)}` : raw;
                      setFCep(fmt);
                      if (raw.length === 8) {
                        lookupAdminCep(raw).then(() => {
                          // After lookup, assemble and set fEditLocation from components
                        });
                      }
                    }}
                  />
                </div>
                {fCepLoading && <div className="flex items-center px-2"><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
              </div>
              {fCepError && <p className="text-xs text-destructive">{fCepError}</p>}
              {fLogradouro && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                  📍 {fLocation}
                </p>
              )}
            </div>
          </div>

          <div className="border-t my-1" />

          {/* Display */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Display</p>
            <div className="space-y-1">
              <Label>Fuso horário</Label>
              <Select value={fTimezone} onValueChange={setFTimezone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[
                    { value: "America/Sao_Paulo", label: "Brasília / SP / RJ (BRT −3h)" },
                    { value: "America/Manaus", label: "Manaus / AM (AMT −4h)" },
                    { value: "America/Belem", label: "Belém / PA / MA (BRT −3h)" },
                    { value: "America/Fortaleza", label: "Fortaleza / CE (BRT −3h)" },
                    { value: "America/Recife", label: "Recife / PE (BRT −3h)" },
                    { value: "America/Cuiaba", label: "Cuiabá / MT (AMT −4h)" },
                    { value: "America/Porto_Velho", label: "Porto Velho / RO (AMT −4h)" },
                    { value: "America/Boa_Vista", label: "Boa Vista / RR (AMT −4h)" },
                    { value: "America/Rio_Branco", label: "Rio Branco / AC (ACT −5h)" },
                    { value: "America/Noronha", label: "Fernando de Noronha (FNT −2h)" },
                  ].map((tz) => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resolução do painel <span className="text-muted-foreground">(opcional)</span></Label>
              <Select
                value={fPanelW && fPanelH ? (["1920x1080","1080x1920","576x1152","1152x576","768x1536"].includes(`${fPanelW}x${fPanelH}`) ? `${fPanelW}x${fPanelH}` : "custom") : ""}
                onValueChange={(v) => {
                  const map: Record<string, [string, string]> = { "1920x1080":["1920","1080"],"1080x1920":["1080","1920"],"576x1152":["576","1152"],"1152x576":["1152","576"],"768x1536":["768","1536"],"custom":[fPanelW,fPanelH],"":[" "," "] };
                  const [w, h] = map[v] ?? ["", ""];
                  setFPanelW(w); setFPanelH(h);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar formato..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Automático (sem restrição)</SelectItem>
                  <SelectItem value="1920x1080">📺 TV Full HD — 1920×1080</SelectItem>
                  <SelectItem value="1080x1920">📱 TV Vertical — 1080×1920</SelectItem>
                  <SelectItem value="576x1152">🟥 LED P5 Vertical 3×6 — 576×1152</SelectItem>
                  <SelectItem value="1152x576">🟥 LED P5 Horizontal — 1152×576</SelectItem>
                  <SelectItem value="768x1536">🟥 LED P4 Vertical — 768×1536</SelectItem>
                  <SelectItem value="custom">✏️ Personalizado</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Input value={fPanelW} onChange={(e) => setFPanelW(e.target.value.replace(/\D/g,""))} placeholder="Largura px" className="w-28 text-center" />
                <span className="text-muted-foreground text-sm">×</span>
                <Input value={fPanelH} onChange={(e) => setFPanelH(e.target.value.replace(/\D/g,""))} placeholder="Altura px" className="w-28 text-center" />
              </div>
              <p className="text-xs text-muted-foreground">Deixe vazio se não souber — pode ajustar depois.</p>
            </div>
          </div>

          <div className="border-t my-1" />

          {/* Horário */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Horário de funcionamento <span className="text-muted-foreground font-normal normal-case">(opcional)</span></p>
            <div className="flex items-center gap-4">
              <div className="space-y-1 flex-1">
                <Label>Ligar às</Label>
                <Input type="time" value={fPowerOn} onChange={(e) => setFPowerOn(e.target.value)} />
              </div>
              <div className="space-y-1 flex-1">
                <Label>Desligar às</Label>
                <Input type="time" value={fPowerOff} onChange={(e) => setFPowerOff(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">A TV liga e desliga automaticamente nos horários definidos.</p>
          </div>

          <div className="border-t my-1" />

          {/* Admin-only */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Administrador</p>
            <div className="space-y-1.5">
              <Label>Cliente <span className="text-muted-foreground text-xs font-normal">(dono da tela)</span></Label>
              <Select value={fOperatorId || "__none__"} onValueChange={v => setFOperatorId(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem cliente</SelectItem>
                  {operators.map(op => (
                    <SelectItem key={op.id} value={String(op.id)}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Código da Tela <span className="text-muted-foreground text-xs font-normal">(código de pareamento)</span></Label>
              <Input value={fScreenCode} onChange={(e) => setFScreenCode(e.target.value.toUpperCase())} placeholder="Ex: ABCD1234" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="Observações internas" />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setEditDevice(null)}>Cancelar</Button>
            <Button
              disabled={!fName.trim() || updateMutation.isPending}
              onClick={() => {
                if (!editDevice) return;
                const locationToSave = fLogradouro ? fLocation : fEditLocation;
                updateMutation.mutate({
                  id: editDevice.id,
                  screenId: editDevice.screenId,
                  body: {
                    serial: fSerial || undefined,
                    name: fName || null,
                    location: locationToSave || null,
                    screenCode: fScreenCode || null,
                    notes: fNotes || null,
                    ...(fOperatorId ? { assignedUserId: fOperatorId } : {}),
                  },
                  screenBody: {
                    name: fName || null,
                    ...(fTimezone ? { timezone: fTimezone } : {}),
                    powerOnTime: fPowerOn || null,
                    powerOffTime: fPowerOff || null,
                    panelWidth: fPanelW ? parseInt(fPanelW, 10) : null,
                    panelHeight: fPanelH ? parseInt(fPanelH, 10) : null,
                  },
                });
              }}
            >
              {updateMutation.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT — escolhe a view conforme o papel do usuário
// ─────────────────────────────────────────────────────────────────────────────
export default function DevicesPage() {
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  return isAdmin ? <AdminDevicesView /> : <OperatorDevicesView />;
}
