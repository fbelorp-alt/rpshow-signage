import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useListScreens,
  useListPlaylists,
  useCreateSchedule,
  getListSchedulesQueryKey,
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
              <Input
                value={fSerial}
                onChange={(e) => setFSerial(e.target.value.toUpperCase())}
                placeholder="Ex: 748E0291ECB45A73"
                className="font-mono"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Escaneie o QR Code na tela do aparelho ou anote o ID exibido no app RPSHOW TV
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

  const [fSerial, setFSerial] = useState("");
  const [fName, setFName] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fScreenCode, setFScreenCode] = useState("");
  const [fNotes, setFNotes] = useState("");

  const { data: devices = [], isLoading, refetch, isFetching } = useQuery<Device[]>({
    queryKey: ["devices"],
    queryFn: async () => {
      const r = await fetch("/api/devices", { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar dispositivos");
      return r.json();
    },
    refetchInterval: 30_000,
  });

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
      toast({ title: "Dispositivo cadastrado!" });
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
      toast({ title: "Dispositivo atualizado!" });
      qc.invalidateQueries({ queryKey: ["devices"] });
      setEditDevice(null);
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/devices/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Erro ao remover");
    },
    onSuccess: () => {
      toast({ title: "Dispositivo removido" });
      qc.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
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

  function resetForm() {
    setFSerial(""); setFName(""); setFLocation(""); setFScreenCode(""); setFNotes("");
  }

  function openEdit(d: Device) {
    setEditDevice(d);
    setFSerial(d.serial);
    setFName(d.name ?? "");
    setFLocation(d.location ?? "");
    setFScreenCode(d.screenCode ?? "");
    setFNotes(d.notes ?? "");
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
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(d)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => deleteMutation.mutate(d.id)} disabled={deleteMutation.isPending}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cadastrar Dispositivo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Serial / ID do Dispositivo *</Label>
              <Input value={fSerial} onChange={(e) => setFSerial(e.target.value.toUpperCase())} placeholder="Ex: 748E0291ECB45A73" className="font-mono" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Nome do dispositivo" />
            </div>
            <div className="space-y-1.5">
              <Label>Localização</Label>
              <Input value={fLocation} onChange={(e) => setFLocation(e.target.value)} placeholder="Localização" />
            </div>
            <div className="space-y-1.5">
              <Label>Código da Tela</Label>
              <Input value={fScreenCode} onChange={(e) => setFScreenCode(e.target.value.toUpperCase())} placeholder="Código da tela" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="Observações" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); resetForm(); }}>Cancelar</Button>
            <Button
              onClick={() => addMutation.mutate({ serial: fSerial, name: fName || undefined, location: fLocation || undefined, screenCode: fScreenCode || undefined, notes: fNotes || undefined })}
              disabled={!fSerial.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? "Cadastrando…" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog (admin) */}
      <Dialog open={!!editDevice} onOpenChange={(o) => { if (!o) setEditDevice(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Dispositivo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Serial / ID do Dispositivo</Label>
              <Input value={fSerial} onChange={(e) => setFSerial(e.target.value.toUpperCase())} className="font-mono" />
              <p className="text-xs text-muted-foreground">Deve ser exatamente o código exibido na TV/LED</p>
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Nome do dispositivo" />
            </div>
            <div className="space-y-1.5">
              <Label>Localização</Label>
              <Input value={fLocation} onChange={(e) => setFLocation(e.target.value)} placeholder="Localização" />
            </div>
            <div className="space-y-1.5">
              <Label>Código da Tela</Label>
              <Input value={fScreenCode} onChange={(e) => setFScreenCode(e.target.value.toUpperCase())} placeholder="Código da tela" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="Observações" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDevice(null)}>Cancelar</Button>
            <Button
              onClick={() => editDevice && updateMutation.mutate({
                id: editDevice.id,
                body: { serial: fSerial || undefined, name: fName || null, location: fLocation || null, screenCode: fScreenCode || null, notes: fNotes || null },
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
// ROOT — escolhe a view conforme o papel do usuário
// ─────────────────────────────────────────────────────────────────────────────
export default function DevicesPage() {
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  return isAdmin ? <AdminDevicesView /> : <OperatorDevicesView />;
}
