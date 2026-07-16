import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useGetScreen,
  useListSchedules,
  useUpdateScreen,
  useListPlaylists,
  getGetScreenQueryKey,
  getListScreensQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Monitor, ArrowLeft, MapPin, Hash, Clock, PlaySquare, Copy,
  ExternalLink, ListVideo, CheckCircle2, ChevronDown, Power,
  Sun, Trash2, Plus, Zap, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

export default function ScreenDetail() {
  const [location] = useLocation();
  const idMatch = location.match(/^\/screens\/(\d+)/);
  const id = idMatch ? parseInt(idMatch[1], 10) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  const backHref = isAdmin ? "/users" : "/screens";
  const backLabel = isAdmin ? "Clientes" : "Minhas Telas";

  const { data: screen, isLoading: screenLoading } = useGetScreen(id, {
    query: { enabled: !!id, queryKey: getGetScreenQueryKey(id) },
  });

  const { data: schedules, isLoading: schedulesLoading } = useListSchedules(
    { screenId: id },
    { query: { enabled: !!id, queryKey: ["listSchedules", id] } }
  );

  const { data: playlists } = useListPlaylists();
  const updateScreen = useUpdateScreen();

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [savedPlaylistId, setSavedPlaylistId] = useState<number | null | undefined>(undefined);
  const [selectedTimezone, setSelectedTimezone] = useState<string>("");
  const [savedTimezone, setSavedTimezone] = useState<string | undefined>(undefined);
  const [locationInput, setLocationInput] = useState<string>("");
  const [savedLocation, setSavedLocation] = useState<string | undefined>(undefined);
  // ── Power weekly schedule ───────────────────────────────────────────────────
  type PwWindow = { on: string; off: string };
  type PwDay    = { day: number; active: boolean; windows: PwWindow[] };
  const DAYS_INFO = [
    { short: "Dom", day: 0 }, { short: "Seg", day: 1 }, { short: "Ter", day: 2 },
    { short: "Qua", day: 3 }, { short: "Qui", day: 4 }, { short: "Sex", day: 5 },
    { short: "Sáb", day: 6 },
  ] as const;
  const defaultPwSched = (): PwDay[] =>
    DAYS_INFO.map(d => ({ day: d.day, active: true, windows: [{ on: "08:00", off: "18:00" }] }));
  const PW_PRESETS = [
    { label: "Comércio Seg–Sex", sched: [
        { day: 0, active: false, windows: [{ on: "08:00", off: "18:00" }] },
        { day: 1, active: true,  windows: [{ on: "08:00", off: "18:00" }] },
        { day: 2, active: true,  windows: [{ on: "08:00", off: "18:00" }] },
        { day: 3, active: true,  windows: [{ on: "08:00", off: "18:00" }] },
        { day: 4, active: true,  windows: [{ on: "08:00", off: "18:00" }] },
        { day: 5, active: true,  windows: [{ on: "08:00", off: "18:00" }] },
        { day: 6, active: true,  windows: [{ on: "08:00", off: "14:00" }] },
      ] as PwDay[] },
    { label: "Shopping", sched: [
        { day: 0, active: true, windows: [{ on: "12:00", off: "20:00" }] },
        { day: 1, active: true, windows: [{ on: "10:00", off: "22:00" }] },
        { day: 2, active: true, windows: [{ on: "10:00", off: "22:00" }] },
        { day: 3, active: true, windows: [{ on: "10:00", off: "22:00" }] },
        { day: 4, active: true, windows: [{ on: "10:00", off: "22:00" }] },
        { day: 5, active: true, windows: [{ on: "10:00", off: "22:00" }] },
        { day: 6, active: true, windows: [{ on: "10:00", off: "22:00" }] },
      ] as PwDay[] },
    { label: "Com pausa almoço", sched: [
        { day: 0, active: false, windows: [] },
        { day: 1, active: true, windows: [{ on: "08:00", off: "12:00" }, { on: "13:30", off: "18:00" }] },
        { day: 2, active: true, windows: [{ on: "08:00", off: "12:00" }, { on: "13:30", off: "18:00" }] },
        { day: 3, active: true, windows: [{ on: "08:00", off: "12:00" }, { on: "13:30", off: "18:00" }] },
        { day: 4, active: true, windows: [{ on: "08:00", off: "12:00" }, { on: "13:30", off: "18:00" }] },
        { day: 5, active: true, windows: [{ on: "08:00", off: "12:00" }, { on: "13:30", off: "18:00" }] },
        { day: 6, active: false, windows: [] },
      ] as PwDay[] },
    { label: "24h / 7 dias", sched:
        DAYS_INFO.map(d => ({ day: d.day, active: true, windows: [] })) as PwDay[] },
  ];
  const [pwSched, setPwSched]   = useState<PwDay[]>(defaultPwSched());
  const [pwDirty, setPwDirty]   = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [panelWInput, setPanelWInput] = useState<string>("");
  const [panelHInput, setPanelHInput] = useState<string>("");
  const [panelRotation, setPanelRotation] = useState<number>(0);
  const [savedPanelW, setSavedPanelW] = useState<number | null | undefined>(undefined);
  const [savedPanelH, setSavedPanelH] = useState<number | null | undefined>(undefined);
  const [savedPanelRot, setSavedPanelRot] = useState<number | undefined>(undefined);

  // ── Brightness schedules ────────────────────────────────────────────────────
  const [bsSlots, setBsSlots] = useState<any[]>([]);
  const [bsLoading, setBsLoading] = useState(true);
  const [bsNewStart, setBsNewStart] = useState("06:00");
  const [bsNewEnd, setBsNewEnd] = useState("18:00");
  const [bsNewLevel, setBsNewLevel] = useState(70);
  const [bsNewLabel, setBsNewLabel] = useState("");
  const [bsNewDays, setBsNewDays] = useState<number[]>([0,1,2,3,4,5,6]);
  const [bsAdding, setBsAdding] = useState(false);
  const [bsApplying, setBsApplying] = useState(false);
  const [bsRefresh, setBsRefresh] = useState(0);

  // ── Manual brightness (apply now) ──────────────────────────────────────────
  const [manualBrightness, setManualBrightness] = useState(80);
  const [applyingBrightness, setApplyingBrightness] = useState(false);
  const [brightnessSent, setBrightnessSent] = useState(false);

  const BS_PRESETS = [
    { key: "vnox",      label: "Padrão VNnox" },
    { key: "sol",       label: "Externo (Sol)" },
    { key: "shopping",  label: "Vitrine/Shopping" },
    { key: "economico", label: "Econômico" },
  ];
  const BS_DAYS = [["D","Dom",0],["S","Seg",1],["T","Ter",2],["Q","Qua",3],["Q","Qui",4],["S","Sex",5],["S","Sáb",6]] as const;

  const effectiveDefaultId = savedPlaylistId !== undefined ? savedPlaylistId : screen?.defaultPlaylistId;
  const displayValue = effectiveDefaultId ? String(effectiveDefaultId) : "";
  const effectiveTimezone = savedTimezone !== undefined ? savedTimezone : (screen as any)?.timezone ?? "America/Sao_Paulo";

  const BRAZIL_TIMEZONES = [
    { value: "America/Sao_Paulo",    label: "Brasília / SP / RJ (BRT −3h)" },
    { value: "America/Manaus",       label: "Manaus / AM (AMT −4h)" },
    { value: "America/Belem",        label: "Belém / PA / MA (BRT −3h, sem verão)" },
    { value: "America/Fortaleza",    label: "Fortaleza / CE (BRT −3h)" },
    { value: "America/Recife",       label: "Recife / PE (BRT −3h)" },
    { value: "America/Cuiaba",       label: "Cuiabá / MT (AMT −4h)" },
    { value: "America/Porto_Velho",  label: "Porto Velho / RO (AMT −4h)" },
    { value: "America/Boa_Vista",    label: "Boa Vista / RR (AMT −4h)" },
    { value: "America/Rio_Branco",   label: "Rio Branco / AC (ACT −5h)" },
    { value: "America/Noronha",      label: "Fernando de Noronha (FNT −2h)" },
  ];

  const effectiveLocation = savedLocation !== undefined ? savedLocation : screen?.location ?? "";

  const handleSaveLocation = () => {
    const loc = locationInput.trim();
    updateScreen.mutate(
      { id, data: { location: loc } },
      {
        onSuccess: () => {
          setSavedLocation(loc);
          queryClient.invalidateQueries({ queryKey: getGetScreenQueryKey(id) });
          toast({ title: "Localização salva!" });
          setLocationInput("");
        },
        onError: () => toast({ title: "Erro ao salvar localização", variant: "destructive" }),
      }
    );
  };

  const handleSaveTimezone = () => {
    const tz = selectedTimezone || effectiveTimezone;
    updateScreen.mutate(
      { id, data: { timezone: tz } },
      {
        onSuccess: () => {
          setSavedTimezone(tz);
          queryClient.invalidateQueries({ queryKey: getGetScreenQueryKey(id) });
          toast({ title: "Fuso horário salvo! O relógio na TV vai ajustar." });
          setSelectedTimezone("");
        },
        onError: () => toast({ title: "Erro ao salvar fuso horário", variant: "destructive" }),
      }
    );
  };

  const effectivePanelW   = savedPanelW   !== undefined ? savedPanelW   : (screen as any)?.panelWidth   ?? null;
  const effectivePanelH   = savedPanelH   !== undefined ? savedPanelH   : (screen as any)?.panelHeight  ?? null;
  const effectivePanelRot = savedPanelRot !== undefined ? savedPanelRot : (screen as any)?.panelRotation ?? 0;

  // Pre-populate panel inputs + power schedule when screen data loads
  useEffect(() => {
    if (!screen) return;
    const pw = (screen as any)?.panelWidth;
    const ph = (screen as any)?.panelHeight;
    const pr = (screen as any)?.panelRotation ?? 0;
    if (pw != null && panelWInput === "") setPanelWInput(String(pw));
    if (ph != null && panelHInput === "") setPanelHInput(String(ph));
    setPanelRotation(pr);
    // Load power schedule JSON
    const json = (screen as any)?.powerScheduleJson as string | null | undefined;
    if (json) {
      try {
        const parsed = JSON.parse(json);
        const normalized: PwDay[] = DAYS_INFO.map(d => {
          const entry = parsed.find((e: any) => e.day === d.day);
          if (!entry) return { day: d.day, active: false, windows: [{ on: "08:00", off: "18:00" }] };
          // v2 has windows[], v1 has on/off at root
          if (Array.isArray(entry.windows)) return { day: d.day, active: entry.active, windows: entry.windows };
          return { day: d.day, active: entry.active, windows: (entry.on && entry.off) ? [{ on: entry.on, off: entry.off }] : [] };
        });
        setPwSched(normalized);
        setPwDirty(false);
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const handleSavePanelRes = () => {
    const w = panelWInput.trim() ? parseInt(panelWInput.trim(), 10) : null;
    const h = panelHInput.trim() ? parseInt(panelHInput.trim(), 10) : null;
    if ((panelWInput.trim() && !w) || (panelHInput.trim() && !h)) {
      toast({ title: "Informe números inteiros válidos.", variant: "destructive" }); return;
    }
    updateScreen.mutate(
      { id, data: { panelWidth: w, panelHeight: h, panelRotation } as any },
      {
        onSuccess: () => {
          setSavedPanelW(w); setSavedPanelH(h); setSavedPanelRot(panelRotation);
          queryClient.invalidateQueries({ queryKey: getGetScreenQueryKey(id) });
          const rotLabel = panelRotation !== 0 ? ` · rotação ${panelRotation}°` : "";
          toast({ title: w && h ? `Resolução ${w}×${h}${rotLabel} salva!` : "Resolução removida — modo TV/fullscreen." });
          setPanelWInput(""); setPanelHInput("");
        },
        onError: () => toast({ title: "Erro ao salvar resolução", variant: "destructive" }),
      }
    );
  };

  const handleSavePowerSchedule = () => {
    setPwSaving(true);
    updateScreen.mutate(
      { id, data: { powerScheduleJson: JSON.stringify(pwSched) } as any },
      {
        onSuccess: () => {
          setPwDirty(false);
          queryClient.invalidateQueries({ queryKey: getGetScreenQueryKey(id) });
          toast({ title: "Horário de funcionamento salvo!" });
        },
        onError: () => toast({ title: "Erro ao salvar horário", variant: "destructive" }),
        onSettled: () => setPwSaving(false),
      }
    );
  };
  const handleClearPowerSchedule = () => {
    updateScreen.mutate(
      { id, data: { powerScheduleJson: null, powerOnTime: null, powerOffTime: null } as any },
      {
        onSuccess: () => {
          setPwSched(defaultPwSched()); setPwDirty(false);
          queryClient.invalidateQueries({ queryKey: getGetScreenQueryKey(id) });
          toast({ title: "Agendamento removido — tela sempre ligada 24h." });
        },
        onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
      }
    );
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setBsLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/screens/${id}/brightness-schedules`, { credentials: "include" });
        if (res.ok && !cancelled) setBsSlots(await res.json());
      } catch {}
      if (!cancelled) setBsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, bsRefresh]);

  const addBsSlot = async () => {
    if (!bsNewStart || !bsNewEnd || bsNewDays.length === 0) return;
    setBsAdding(true);
    try {
      await fetch(`/api/screens/${id}/brightness-schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ startTime: bsNewStart, endTime: bsNewEnd, brightness: bsNewLevel, label: bsNewLabel || undefined, days: [...bsNewDays].sort((a, b) => a - b).join(",") }),
      });
      setBsRefresh(r => r + 1);
      setBsNewLabel("");
      toast({ title: "Horário de brilho adicionado!" });
    } catch { toast({ title: "Erro ao adicionar", variant: "destructive" }); }
    setBsAdding(false);
  };

  const deleteBsSlot = async (slotId: number) => {
    try {
      await fetch(`/api/screens/${id}/brightness-schedules/${slotId}`, { method: "DELETE", credentials: "include" });
      setBsRefresh(r => r + 1);
      toast({ title: "Horário removido." });
    } catch { toast({ title: "Erro ao remover", variant: "destructive" }); }
  };

  const applyManualBrightness = async () => {
    setApplyingBrightness(true);
    setBrightnessSent(false);
    try {
      const res = await fetch(`/api/screens/${id}/brightness`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ brightness: manualBrightness }),
      });
      if (!res.ok) throw new Error();
      setBrightnessSent(true);
      setTimeout(() => setBrightnessSent(false), 3000);
      toast({ title: "Brilho enviado!", description: `A tela receberá o comando no próximo heartbeat (~10s).` });
    } catch {
      toast({ title: "Erro ao enviar brilho", variant: "destructive" });
    }
    setApplyingBrightness(false);
  };

  const applyBsPreset = async (presetKey: string, presetLabel: string) => {
    setBsApplying(true);
    try {
      await fetch(`/api/screens/${id}/brightness-schedules/preset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ preset: presetKey }),
      });
      setBsRefresh(r => r + 1);
      toast({ title: `Perfil "${presetLabel}" aplicado!` });
    } catch { toast({ title: "Erro ao aplicar perfil", variant: "destructive" }); }
    setBsApplying(false);
  };

  const handleSaveDefault = () => {
    const newId = (selectedPlaylistId && selectedPlaylistId !== "none") ? Number(selectedPlaylistId) : null;
    updateScreen.mutate(
      { id, data: { defaultPlaylistId: newId } },
      {
        onSuccess: () => {
          setSavedPlaylistId(newId);
          queryClient.invalidateQueries({ queryKey: getGetScreenQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListScreensQueryKey() });
          toast({ title: newId ? "Playlist padrão salva! A tela já vai tocar 24h." : "Playlist padrão removida." });
          setSelectedPlaylistId("");
        },
        onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
      }
    );
  };

  if (screenLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32 mb-6" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 md:col-span-2 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!screen) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-semibold">Tela não encontrada</h2>
        <Button asChild className="mt-4" variant="outline">
          <Link href={backHref}>Voltar para {backLabel}</Link>
        </Button>
      </div>
    );
  }

  const playerUrl = `${window.location.origin}/player/${screen.code}`;

  const defaultPlaylistName =
    (playlists ?? []).find((p: any) => p.id === effectiveDefaultId)?.name ??
    screen.defaultPlaylistName;

  return (
    <div className="space-y-8">
      {/* Back */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground -ml-2">
          <Link href={backHref}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            {backLabel}
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b pb-6">
        <div className="flex items-start gap-4">
          <div className="relative mt-1">
            <div className="w-16 h-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Monitor className="w-8 h-8" />
            </div>
            <div className={cn(
              "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-background",
              screen.status === "online" ? "bg-emerald-500" :
              screen.status === "offline" ? "bg-destructive" :
              "bg-muted-foreground"
            )} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{screen.name}</h1>
            <div className="flex items-center gap-3 mt-2 text-muted-foreground text-sm">
              {screen.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {screen.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Hash className="w-4 h-4" />
                <code className="font-mono">{screen.code}</code>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(playerUrl);
              toast({ title: "URL do player copiada!" });
            }}
            className="gap-2"
          >
            <Copy className="w-4 h-4" />
            Copiar URL
          </Button>
          <Button asChild className="gap-2">
            <a href={`/player/${screen.code}`} target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4" />
              Abrir Player
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: connection info + default playlist */}
        <div className="flex flex-col gap-4">
          {/* Connection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conexão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border text-center">
                <p className="text-xs text-muted-foreground mb-1">Código de Pareamento</p>
                <code className="text-3xl font-mono font-bold tracking-widest text-primary">
                  {screen.code}
                </code>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm border-b pb-2">
                  <span className="text-muted-foreground">Status</span>
                  <span className={cn(
                    "font-medium capitalize",
                    screen.status === "online" ? "text-emerald-500" :
                    screen.status === "offline" ? "text-destructive" :
                    "text-muted-foreground"
                  )}>
                    {screen.status === "online" ? "Online" : screen.status === "offline" ? "Offline" : "Desconhecido"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm border-b pb-2">
                  <span className="text-muted-foreground">Último sinal</span>
                  <span className="font-medium text-right">
                    {screen.lastSeen ? new Date(screen.lastSeen).toLocaleString("pt-BR") : "Nunca"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Cadastrada em</span>
                  <span className="font-medium">{new Date(screen.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Default Playlist */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ListVideo className="w-4 h-4 text-primary" />
                Playlist Padrão (24h)
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Toca o tempo todo. Campanhas agendadas sobrepõem automaticamente no horário configurado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {effectiveDefaultId ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-sm font-medium text-emerald-400 truncate">{defaultPlaylistName ?? "—"}</span>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                  Nenhuma playlist padrão definida. A tela ficará em branco fora dos horários de campanha.
                </div>
              )}

              <div className="space-y-2">
                <Select value={selectedPlaylistId} onValueChange={setSelectedPlaylistId}>
                  <SelectTrigger className="w-full h-9 text-sm bg-[#1a1f2e] border-white/15 text-white">
                    <SelectValue placeholder="Selecione a lista de reprodução..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1f2e] border-white/10 text-white">
                    <SelectItem value="" className="text-sm text-white/50 focus:bg-white/8 focus:text-white">Selecione a lista de reprodução...</SelectItem>
                    <SelectItem value="none" className="text-sm text-white/80 focus:bg-white/8 focus:text-white">— Remover playlist padrão —</SelectItem>
                    {(playlists ?? []).map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)} className="text-sm text-white/80 focus:bg-white/8 focus:text-white">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  disabled={!selectedPlaylistId || updateScreen.isPending}
                  onClick={handleSaveDefault}
                >
                  {updateScreen.isPending ? "Salvando..." : "Salvar Playlist Padrão"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Timezone */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Fuso Horário do Relógio
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Define a hora exibida no widget de relógio. Corrige TVs com hora errada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border text-sm">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-mono text-xs text-muted-foreground truncate">{effectiveTimezone}</span>
              </div>
              <div className="space-y-2">
                <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                  <SelectTrigger className="w-full h-9 text-sm bg-[#1a1f2e] border-white/15 text-white">
                    <SelectValue placeholder="Selecione o fuso horário..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1f2e] border-white/10 text-white">
                    <SelectItem value="" className="text-sm text-white/50 focus:bg-white/8 focus:text-white">Selecione o fuso horário...</SelectItem>
                    {BRAZIL_TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value} className="text-sm text-white/80 focus:bg-white/8 focus:text-white">{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  disabled={!selectedTimezone || updateScreen.isPending}
                  onClick={handleSaveTimezone}
                >
                  {updateScreen.isPending ? "Salvando..." : "Salvar Fuso Horário"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* LED Panel Resolution */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="w-4 h-4 text-primary" />
                Resolução do Painel LED
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Digite os pixels <strong>físicos</strong> do painel (ex: 168 × 168). O app converte automaticamente para a densidade do dispositivo. Use a mesma resolução configurada no NovaLCT. Deixe em branco para TVs (fullscreen automático).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(effectivePanelW && effectivePanelH) ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border text-sm">
                  <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    Canvas LED: <strong>{effectivePanelW} × {effectivePanelH} px</strong>
                    {effectivePanelRot !== 0 && <span className="ml-1 text-primary">· {effectivePanelRot}° rotação</span>}
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground">
                  Modo TV — fullscreen (sem resolução fixa).
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Largura (px)</label>
                  <Input
                    type="number"
                    value={panelWInput}
                    onChange={e => setPanelWInput(e.target.value)}
                    className="h-9 text-sm bg-[#1a1f2e] border-white/15 text-white"
                    placeholder={effectivePanelW ? String(effectivePanelW) : "ex: 768"}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Altura (px)</label>
                  <Input
                    type="number"
                    value={panelHInput}
                    onChange={e => setPanelHInput(e.target.value)}
                    className="h-9 text-sm bg-[#1a1f2e] border-white/15 text-white"
                    placeholder={effectivePanelH ? String(effectivePanelH) : "ex: 384"}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Rotação do canvas</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {([0, 90, 180, 270] as const).map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => setPanelRotation(deg)}
                      className={`h-9 rounded-lg text-sm font-medium border transition-all ${
                        panelRotation === deg
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-[#1a1f2e] text-white/60 border-white/15 hover:border-primary/50 hover:text-white"
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground pt-0.5">
                  Use 90° ou 270° para painéis montados na horizontal com device em portrait.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={(!panelWInput && !panelHInput) || updateScreen.isPending}
                  onClick={handleSavePanelRes}
                >
                  {updateScreen.isPending ? "Salvando..." : "Salvar Resolução"}
                </Button>
                {(effectivePanelW || effectivePanelH) && (
                  <Button
                    variant="outline"
                    className="text-xs"
                    disabled={updateScreen.isPending}
                    onClick={() => { setPanelWInput(""); setPanelHInput(""); setPanelRotation(0); updateScreen.mutate({ id, data: { panelWidth: null, panelHeight: null, panelRotation: 0 } as any }, { onSuccess: () => { setSavedPanelW(null); setSavedPanelH(null); setSavedPanelRot(0); queryClient.invalidateQueries({ queryKey: getGetScreenQueryKey(id) }); toast({ title: "Modo TV (fullscreen) restaurado." }); } }); }}
                  >
                    Remover
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Power Schedule */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Power className="w-4 h-4 text-primary" />
                Horário de Funcionamento
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Defina quando a tela deve ligar e desligar em cada dia da semana.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Presets rápidos */}
              <div>
                <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Perfis rápidos</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PW_PRESETS.map(p => (
                    <Button key={p.label} variant="outline" size="sm"
                      className="text-xs h-8 justify-start gap-1.5"
                      onClick={() => { setPwSched(p.sched); setPwDirty(true); }}>
                      <Zap className="w-3 h-3 shrink-0" /> {p.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Grade semanal */}
              <div className="space-y-1.5">
                {DAYS_INFO.map(({ short, day }) => {
                  const entry = pwSched.find(e => e.day === day) ?? { day, active: false, windows: [{ on: "08:00", off: "18:00" }] };
                  const setEntry = (patch: Partial<typeof entry>) => {
                    setPwSched(prev => prev.map(e => e.day === day ? { ...e, ...patch } : e));
                    setPwDirty(true);
                  };
                  return (
                    <div key={day} className={`rounded-lg border px-3 py-2 transition-colors ${entry.active ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20 opacity-60"}`}>
                      <div className="flex items-start gap-2.5">
                        {/* Toggle switch */}
                        <button type="button" onClick={() => setEntry({ active: !entry.active })}
                          className={`mt-0.5 w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${entry.active ? "bg-primary" : "bg-muted-foreground/30"}`}>
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${entry.active ? "left-4" : "left-0.5"}`} />
                        </button>
                        {/* Day label */}
                        <span className="text-xs font-semibold w-7 pt-0.5 flex-shrink-0">{short}</span>
                        {/* Content */}
                        {entry.active ? (
                          <div className="flex-1 space-y-1.5">
                            {entry.windows.length === 0 ? (
                              <span className="text-xs text-muted-foreground">Ligada o dia todo</span>
                            ) : (
                              entry.windows.map((w, wi) => (
                                <div key={wi} className="flex items-center gap-1.5 flex-wrap">
                                  {wi > 0 && <span className="text-[10px] text-muted-foreground w-full -mb-0.5 pl-0.5">+ janela</span>}
                                  <input type="time" value={w.on}
                                    onChange={e => setEntry({ windows: entry.windows.map((ww, i) => i === wi ? { ...ww, on: e.target.value } : ww) })}
                                    className="h-7 text-xs bg-background border border-border rounded px-1.5 text-foreground w-[88px]" />
                                  <span className="text-[10px] text-muted-foreground">→</span>
                                  <input type="time" value={w.off}
                                    onChange={e => setEntry({ windows: entry.windows.map((ww, i) => i === wi ? { ...ww, off: e.target.value } : ww) })}
                                    className="h-7 text-xs bg-background border border-border rounded px-1.5 text-foreground w-[88px]" />
                                  {entry.windows.length > 1 && (
                                    <button type="button" onClick={() => setEntry({ windows: entry.windows.filter((_, i) => i !== wi) })}
                                      className="text-muted-foreground hover:text-destructive transition-colors">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        ) : (
                          <span className="flex-1 text-xs text-muted-foreground pt-0.5">Desligada</span>
                        )}
                        {/* Botão + janela (pausa almoço etc.) */}
                        {entry.active && entry.windows.length < 3 && (
                          <button type="button" title="Adicionar janela (ex: pausa almoço)"
                            onClick={() => setEntry({ windows: [...entry.windows, { on: "13:30", off: "18:00" }] })}
                            className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button className="w-full" disabled={!pwDirty || pwSaving} onClick={handleSavePowerSchedule}>
                {pwSaving ? "Salvando..." : "Salvar Horário de Funcionamento"}
              </Button>
              <button type="button" onClick={handleClearPowerSchedule}
                className="w-full text-xs text-muted-foreground hover:text-foreground text-center transition-colors">
                Remover agendamento (ligar 24h sempre)
              </button>
            </CardContent>
          </Card>

          {/* Brightness Schedule */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sun className="w-4 h-4 text-primary" />
                Estratégia de Brilho
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Brilho automático por horário. Sobrepõe o ajuste manual quando ativo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Brilho manual imediato */}
              <div className="rounded-xl border bg-muted/30 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Brilho Manual</p>
                  <span className={cn(
                    "text-base font-bold tabular-nums leading-none",
                    manualBrightness <= 20 ? "text-slate-400" :
                    manualBrightness <= 50 ? "text-amber-400" :
                    manualBrightness <= 80 ? "text-yellow-400" : "text-orange-400"
                  )}>{manualBrightness}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                  <Slider
                    min={0} max={100} step={5}
                    value={[manualBrightness]}
                    onValueChange={([v]) => setManualBrightness(v)}
                    className="flex-1"
                  />
                  <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                </div>
                <div className="flex gap-1.5">
                  {[25, 50, 75, 100].map(p => (
                    <button key={p} type="button" onClick={() => setManualBrightness(p)}
                      className={cn(
                        "flex-1 text-[10px] py-1 rounded-md border transition-all",
                        manualBrightness === p
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-400 font-semibold"
                          : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/60"
                      )}>
                      {p}%
                    </button>
                  ))}
                </div>
                <Button
                  size="sm" className={cn("w-full gap-2 h-8 text-xs", brightnessSent && "bg-emerald-600 hover:bg-emerald-600")}
                  onClick={applyManualBrightness}
                  disabled={applyingBrightness}
                >
                  {applyingBrightness ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando…</>
                  ) : brightnessSent ? (
                    <><CheckCircle2 className="w-3.5 h-3.5" /> Enviado!</>
                  ) : (
                    <><Sun className="w-3.5 h-3.5" /> Aplicar Brilho Agora</>
                  )}
                </Button>
              </div>

              <div>
                <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Perfis rápidos</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {BS_PRESETS.map(p => (
                    <Button key={p.key} variant="outline" size="sm" className="text-xs h-8 justify-start gap-1.5"
                      onClick={() => applyBsPreset(p.key, p.label)} disabled={bsApplying}>
                      <Zap className="w-3 h-3 shrink-0" /> {p.label}
                    </Button>
                  ))}
                </div>
              </div>
              {bsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : bsSlots.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Horários ativos</p>
                  {bsSlots.map((slot: any) => (
                    <div key={slot.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: `hsl(${slot.brightness * 1.3},80%,50%)` }} />
                        <span className="font-mono font-medium">{slot.startTime}–{slot.endTime}</span>
                        <span className="font-bold text-primary">{slot.brightness}%</span>
                        {slot.label && <span className="text-muted-foreground italic">{slot.label}</span>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => deleteBsSlot(slot.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground text-center">
                  Sem horários — brilho pelo slider manual.
                </div>
              )}
              <div className="space-y-2.5 border-t pt-3">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Adicionar horário manual</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Início</label>
                    <Input type="time" value={bsNewStart} onChange={e => setBsNewStart(e.target.value)}
                      className="h-8 text-xs bg-[#1a1f2e] border-white/15 text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Fim</label>
                    <Input type="time" value={bsNewEnd} onChange={e => setBsNewEnd(e.target.value)}
                      className="h-8 text-xs bg-[#1a1f2e] border-white/15 text-white" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Brilho: <strong>{bsNewLevel}%</strong></label>
                  <input type="range" min="0" max="100" value={bsNewLevel}
                    onChange={e => setBsNewLevel(Number(e.target.value))}
                    className="w-full accent-primary" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Dias da semana</label>
                  <div className="flex gap-1">
                    {BS_DAYS.map(([abbr, full, dayNum]) => (
                      <button key={dayNum} type="button" title={full}
                        className={`flex-1 text-[9px] py-1 rounded border transition-colors font-medium ${bsNewDays.includes(dayNum) ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-muted-foreground hover:bg-muted/80"}`}
                        onClick={() => setBsNewDays(d => d.includes(dayNum) ? d.filter(x => x !== dayNum) : [...d, dayNum])}>
                        {abbr}
                      </button>
                    ))}
                  </div>
                </div>
                <Input placeholder="Etiqueta opcional (ex: Diurno, Vitrine...)" value={bsNewLabel}
                  onChange={e => setBsNewLabel(e.target.value)}
                  className="h-8 text-xs bg-[#1a1f2e] border-white/15 text-white" />
                <Button className="w-full h-8 text-xs" onClick={addBsSlot}
                  disabled={!bsNewStart || !bsNewEnd || bsNewDays.length === 0 || bsAdding}>
                  <Plus className="w-3 h-3 mr-1" />
                  {bsAdding ? "Adicionando..." : "Adicionar Horário"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Localização do Aparelho
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Endereço ou ponto de referência onde a TV está instalada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {effectiveLocation && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-xs text-muted-foreground leading-snug">{effectiveLocation}</span>
                </div>
              )}
              <div className="space-y-2">
                <Input
                  placeholder={effectiveLocation || "Ex: Rua das Flores, 123 — Recepção"}
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  className="h-9 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveLocation()}
                />
                <Button
                  className="w-full"
                  disabled={!locationInput.trim() || updateScreen.isPending}
                  onClick={handleSaveLocation}
                >
                  {updateScreen.isPending ? "Salvando..." : "Salvar Localização"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: schedules (campaigns) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Campanhas Agendadas</CardTitle>
              <CardDescription className="text-xs">
                Sobrepõem a playlist padrão nos horários configurados
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/schedules">Gerenciar</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {schedulesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : schedules && schedules.length > 0 ? (
              <div className="space-y-3">
                {schedules.map((schedule: any) => (
                  <div
                    key={schedule.id}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border transition-colors",
                      schedule.active ? "bg-card hover:bg-accent/50" : "bg-muted/50 opacity-70"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <PlaySquare className={cn("w-5 h-5 mt-0.5 shrink-0", schedule.active ? "text-primary" : "text-muted-foreground")} />
                      <div>
                        <Link
                          href={`/playlists/${schedule.playlistId}`}
                          className="font-medium hover:underline hover:text-primary transition-colors"
                        >
                          {schedule.playlistName}
                        </Link>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {schedule.startTime || "00:00"} – {schedule.endTime || "23:59"}
                          </span>
                          {schedule.daysOfWeek && (
                            <span>· Dias: {schedule.daysOfWeek}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge variant={schedule.active ? "default" : "secondary"} className="shrink-0">
                      {schedule.active ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-foreground">Nenhuma campanha agendada</p>
                <p className="text-sm mt-1">
                  {effectiveDefaultId
                    ? "A playlist padrão roda 24h. Adicione campanhas para horários específicos."
                    : "Defina uma playlist padrão ao lado ou crie uma campanha."}
                </p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href="/schedules">Nova Campanha</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
