import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMedia,
  useListScreens,
  useCreatePlaylist,
  useAddPlaylistItem,
  useCreateSchedule,
  getListSchedulesQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Zap, ChevronRight, ChevronLeft, Film, Monitor, CalendarDays,
  Check, Loader2, Image, Globe, Video, Clock as ClockIcon,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function todayBRT() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

function mediaTypeIcon(type?: string | null) {
  if (type === "video") return <Video className="w-3 h-3" />;
  if (type === "image") return <Image className="w-3 h-3" />;
  if (type === "youtube" || type === "youtube_playlist") return <Film className="w-3 h-3 text-red-400" />;
  return <Globe className="w-3 h-3" />;
}

function mediaTypeLabel(type?: string | null) {
  const map: Record<string, string> = {
    video: "Vídeo", image: "Imagem", youtube: "YouTube",
    youtube_playlist: "YouTube PL", web_channel: "Web", clock: "Relógio",
    weather: "Clima", rss: "RSS",
  };
  return map[type ?? ""] ?? type ?? "Mídia";
}

// ─── types ───────────────────────────────────────────────────────────────────

interface WizardForm {
  selectedMediaIds: number[];
  name: string;
  clientName: string;
  selectedScreenIds: number[];
  startAt: string;
  endAt: string;
  startTime: string;
  endTime: string;
}

const EMPTY_FORM: WizardForm = {
  selectedMediaIds: [],
  name: "",
  clientName: "",
  selectedScreenIds: [],
  startAt: "",
  endAt: "",
  startTime: "",
  endTime: "",
};

// ─── component ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function QuickCampaignWizard({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allMedia = [] } = useListMedia();
  const { data: screens = [] } = useListScreens();

  const createPlaylist = useCreatePlaylist();
  const addItem = useAddPlaylistItem();
  const createSchedule = useCreateSchedule();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");

  function reset() {
    setStep(1);
    setForm(EMPTY_FORM);
    setMediaSearch("");
    setSubmitting(false);
  }

  function close(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  // ── Step navigation ───────────────────────────────────────────────────────

  function canGoNext() {
    if (step === 1) return form.selectedMediaIds.length > 0;
    if (step === 2) return form.name.trim().length > 0 && form.selectedScreenIds.length > 0 && !!form.startAt && !!form.endAt;
    return true;
  }

  function handleNext() {
    if (canGoNext()) setStep(s => s + 1);
  }

  // ── Submission ────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);

    try {
      // 1. Create playlist
      const playlist = await createPlaylist.mutateAsync({
        data: { name: form.name.trim() },
      });

      // 2. Add each media item to playlist
      const selectedMedia = allMedia.filter(m => form.selectedMediaIds.includes(m.id));
      await Promise.all(
        selectedMedia.map((m, idx) =>
          addItem.mutateAsync({
            id: playlist.id,
            data: {
              mediaId: m.id,
              durationSeconds: (m as any).durationSeconds ?? 15,
              mediaType: (m as any).type ?? "video",
              mediaUrl: (m as any).url ?? "",
              mediaName: m.name ?? "",
              position: idx,
            } as any,
          })
        )
      );

      // 3. Create schedule(s) — one per screen batch
      const data: any = {
        name: form.name.trim(),
        clientName: form.clientName.trim() || undefined,
        playlistId: playlist.id,
        screenIds: form.selectedScreenIds,
        active: true,
        startAt: form.startAt,
        endAt: form.endAt,
      };
      if (form.startTime) data.startTime = form.startTime;
      if (form.endTime) data.endTime = form.endTime;

      await createSchedule.mutateAsync({ data });

      queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
      toast({ title: `Campanha criada em ${form.selectedScreenIds.length} tela${form.selectedScreenIds.length > 1 ? "s" : ""}!` });
      close(false);
    } catch {
      toast({ title: "Erro ao criar campanha", variant: "destructive" });
      setSubmitting(false);
    }
  }

  // ── Toggle helpers ────────────────────────────────────────────────────────

  function toggleMedia(id: number) {
    setForm(p => ({
      ...p,
      selectedMediaIds: p.selectedMediaIds.includes(id)
        ? p.selectedMediaIds.filter(x => x !== id)
        : [...p.selectedMediaIds, id],
    }));
  }

  function toggleScreen(id: number) {
    setForm(p => ({
      ...p,
      selectedScreenIds: p.selectedScreenIds.includes(id)
        ? p.selectedScreenIds.filter(x => x !== id)
        : [...p.selectedScreenIds, id],
    }));
  }

  // ── Filtered media ────────────────────────────────────────────────────────

  const filteredMedia = allMedia.filter(m =>
    !mediaSearch || (m.name ?? "").toLowerCase().includes(mediaSearch.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const today = todayBRT();

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/50 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-primary" />
            </div>
            Campanha Rápida
          </DialogTitle>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mt-3">
            {[
              { n: 1, label: "Mídia", icon: Film },
              { n: 2, label: "Configurar", icon: CalendarDays },
              { n: 3, label: "Confirmar", icon: Check },
            ].map(({ n, label, icon: Icon }, i, arr) => (
              <div key={n} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                    step === n ? "bg-primary text-primary-foreground" :
                    step > n ? "bg-emerald-500/80 text-white" :
                    "bg-muted/50 text-muted-foreground"
                  )}>
                    {step > n ? <Check className="w-3 h-3" /> : n}
                  </div>
                  <span className={cn("text-xs font-medium hidden sm:block", step === n ? "text-foreground" : "text-muted-foreground")}>
                    {label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div className={cn("h-px w-6 transition-all", step > n ? "bg-emerald-500/60" : "bg-border/50")} />
                )}
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* ── Step 1: Mídia ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Selecione uma ou mais mídias da biblioteca para esta campanha.
              </p>
              <Input
                className="h-8 text-xs"
                placeholder="Buscar mídia…"
                value={mediaSearch}
                onChange={e => setMediaSearch(e.target.value)}
              />
              {form.selectedMediaIds.length > 0 && (
                <p className="text-xs text-primary font-semibold">
                  {form.selectedMediaIds.length} mídia{form.selectedMediaIds.length > 1 ? "s" : ""} selecionada{form.selectedMediaIds.length > 1 ? "s" : ""}
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredMedia.map(m => {
                  const selected = form.selectedMediaIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMedia(m.id)}
                      className={cn(
                        "relative text-left rounded-lg border p-2.5 transition-all hover:border-primary/50",
                        selected
                          ? "border-primary bg-primary/8 ring-1 ring-primary/40"
                          : "border-border/50 bg-muted/10 hover:bg-muted/30"
                      )}
                    >
                      {selected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-primary-foreground" />
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mb-1">
                        {mediaTypeIcon((m as any).type)}
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-border/40">
                          {mediaTypeLabel((m as any).type)}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium leading-tight line-clamp-2">{m.name}</p>
                    </button>
                  );
                })}
              </div>
              {filteredMedia.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  {allMedia.length === 0 ? "Nenhuma mídia na biblioteca. Faça upload primeiro." : "Nenhuma mídia encontrada."}
                </p>
              )}
            </div>
          )}

          {/* ── Step 2: Configurar ────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Nome da campanha *</label>
                <Input
                  className="h-9 text-sm"
                  placeholder="Ex: Black Friday Boticário"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>

              {/* Client */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Marca / Cliente</label>
                <Input
                  className="h-9 text-sm"
                  placeholder="Ex: O Boticário, Fiat…"
                  value={form.clientName}
                  onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Início *</label>
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    min={today}
                    value={form.startAt}
                    onChange={e => setForm(p => ({ ...p, startAt: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Término *</label>
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    min={form.startAt || today}
                    value={form.endAt}
                    onChange={e => setForm(p => ({ ...p, endAt: e.target.value }))}
                  />
                </div>
              </div>

              {/* Time window (optional) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Horário início</label>
                  <Input
                    type="time"
                    className="h-9 text-sm"
                    value={form.startTime}
                    onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Horário término</label>
                  <Input
                    type="time"
                    className="h-9 text-sm"
                    value={form.endTime}
                    onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                  />
                </div>
              </div>

              {/* Screens */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  Telas *
                  {form.selectedScreenIds.length > 0 && (
                    <span className="ml-2 text-primary font-semibold">
                      {form.selectedScreenIds.length} selecionada{form.selectedScreenIds.length > 1 ? "s" : ""}
                    </span>
                  )}
                </label>
                <div className="rounded-lg border border-border/60 bg-muted/10 max-h-44 overflow-y-auto divide-y divide-border/30">
                  {screens.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Nenhuma tela cadastrada</p>
                  ) : (
                    screens.map(sc => {
                      const sel = form.selectedScreenIds.includes(sc.id);
                      return (
                        <button
                          key={sc.id}
                          onClick={() => toggleScreen(sc.id)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors",
                            sel ? "bg-primary/10 text-primary" : "hover:bg-muted/30"
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                            sel ? "bg-primary border-primary" : "border-border/60"
                          )}>
                            {sel && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                          </div>
                          <Monitor className="w-3 h-3 shrink-0 opacity-60" />
                          <span className="flex-1 truncate font-medium">{sc.name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{sc.code}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Confirmar ─────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Confirme os detalhes antes de criar a campanha.</p>

              <div className="rounded-lg border border-border/50 bg-muted/10 divide-y divide-border/30 text-sm">
                {/* Campaign name */}
                <div className="flex items-start gap-3 px-4 py-3">
                  <Zap className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Campanha</p>
                    <p className="font-semibold text-sm">{form.name}</p>
                    {form.clientName && <p className="text-xs text-muted-foreground">{form.clientName}</p>}
                  </div>
                </div>

                {/* Dates */}
                <div className="flex items-start gap-3 px-4 py-3">
                  <CalendarDays className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Período</p>
                    <p className="text-sm">
                      {form.startAt ? new Date(form.startAt + "T12:00").toLocaleDateString("pt-BR") : "—"}
                      {" → "}
                      {form.endAt ? new Date(form.endAt + "T12:00").toLocaleDateString("pt-BR") : "—"}
                    </p>
                    {(form.startTime || form.endTime) && (
                      <p className="text-xs text-muted-foreground">
                        <ClockIcon className="w-3 h-3 inline mr-1 opacity-60" />
                        {form.startTime || "00:00"} – {form.endTime || "23:59"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Screens */}
                <div className="flex items-start gap-3 px-4 py-3">
                  <Monitor className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">
                      Telas ({form.selectedScreenIds.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {screens.filter(s => form.selectedScreenIds.includes(s.id)).map(s => (
                        <Badge key={s.id} variant="outline" className="text-[10px] px-1.5 py-0">{s.name}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Media */}
                <div className="flex items-start gap-3 px-4 py-3">
                  <Film className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">
                      Mídias ({form.selectedMediaIds.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {allMedia.filter(m => form.selectedMediaIds.includes(m.id)).map(m => (
                        <Badge key={m.id} variant="outline" className="text-[10px] px-1.5 py-0">{m.name}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border/50 shrink-0 flex-row justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => step > 1 ? setStep(s => s - 1) : close(false)}
            disabled={submitting}
          >
            {step > 1 ? <><ChevronLeft className="w-3.5 h-3.5 mr-1" />Voltar</> : "Cancelar"}
          </Button>

          {step < 3 ? (
            <Button size="sm" onClick={handleNext} disabled={!canGoNext()}>
              Próximo
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Criando…</>
              ) : (
                <><Check className="w-3.5 h-3.5 mr-1.5" />Criar Campanha</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
