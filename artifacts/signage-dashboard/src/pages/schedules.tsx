import { useState, useMemo } from "react";
import {
  useListSchedules,
  useCreateSchedule,
  useDeleteSchedule,
  useUpdateSchedule,
  useListScreens,
  useListPlaylists,
  getListSchedulesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// ─── Constants ───────────────────────────────────────────────────────────────
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const CELL_H = 48;
const HOUR_W = 52;
const COLORS = [
  { bg: "bg-blue-500/25",    border: "border-blue-400/60",    text: "text-blue-300",    dot: "bg-blue-400"    },
  { bg: "bg-emerald-500/25", border: "border-emerald-400/60", text: "text-emerald-300", dot: "bg-emerald-400" },
  { bg: "bg-orange-500/25",  border: "border-orange-400/60",  text: "text-orange-300",  dot: "bg-orange-400"  },
  { bg: "bg-purple-500/25",  border: "border-purple-400/60",  text: "text-purple-300",  dot: "bg-purple-400"  },
  { bg: "bg-pink-500/25",    border: "border-pink-400/60",    text: "text-pink-300",    dot: "bg-pink-400"    },
  { bg: "bg-yellow-500/25",  border: "border-yellow-400/60",  text: "text-yellow-300",  dot: "bg-yellow-400"  },
  { bg: "bg-cyan-500/25",    border: "border-cyan-400/60",    text: "text-cyan-300",    dot: "bg-cyan-400"    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeToHour(t?: string | null): number {
  if (!t) return 0;
  return parseInt(t.split(":")[0], 10);
}

function parseDays(s?: string | null): number[] {
  if (!s) return [0, 1, 2, 3, 4, 5, 6];
  return s.split(",").map(Number).filter(n => !isNaN(n));
}

function getWeekDates(offset = 0): Date[] {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface CalCampaign {
  id: number;
  name: string;
  playlistName: string;
  playlistId: number;
  startHour: number;
  endHour: number;
  days: number[];
  colorIdx: number;
  isDefault: boolean;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Schedules() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filterScreenId, setFilterScreenId] = useState<string>("");

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", playlistId: "", startTime: "08:00", endTime: "22:00", days: [] as number[],
  });

  const { data: schedulesRaw, isLoading } = useListSchedules();
  const { data: screens } = useListScreens();
  const { data: playlists } = useListPlaylists();
  const createSchedule = useCreateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const updateSchedule = useUpdateSchedule();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Form state
  const [form, setForm] = useState({
    name: "",
    playlistId: "",
    startTime: "08:00",
    endTime: "22:00",
    days: [1, 2, 3, 4, 5] as number[],
    startAt: "",
    endAt: "",
  });

  // Resolved screen filter
  const effectiveScreenId = filterScreenId || (screens?.[0]?.id ? String(screens[0].id) : "");

  // Map raw schedules → calendar campaigns
  const campaigns = useMemo<CalCampaign[]>(() => {
    const list = schedulesRaw ?? [];
    const filtered = effectiveScreenId
      ? list.filter(s => String(s.screenId) === effectiveScreenId)
      : list;

    return filtered.map((s, idx) => {
      const startHour = timeToHour(s.startTime);
      const endHour   = timeToHour(s.endTime);
      const days      = parseDays(s.daysOfWeek);
      const isAllDay  = startHour === 0 && (endHour === 0 || endHour === 23) && days.length === 7;
      return {
        id:          s.id,
        name:        s.name ?? "Agendamento",
        playlistName: s.playlistName ?? "—",
        playlistId:  s.playlistId,
        startHour,
        endHour:     endHour === 0 ? 24 : endHour,
        days,
        colorIdx:    idx % COLORS.length,
        isDefault:   isAllDay,
      };
    });
  }, [schedulesRaw, effectiveScreenId]);

  const defaultCampaign = campaigns.find(c => c.isDefault);
  const campaignBlocks  = campaigns.filter(c => !c.isDefault);
  const selectedCam     = campaigns.find(c => c.id === selectedId);

  const dates = getWeekDates(weekOffset);
  const monthLabel = dates[3].toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  function toggleDay(d: number) {
    setForm(p => ({
      ...p,
      days: p.days.includes(d) ? p.days.filter(x => x !== d) : [...p.days, d],
    }));
  }

  function resetForm() {
    setForm({ name: "", playlistId: "", startTime: "08:00", endTime: "22:00", days: [1,2,3,4,5], startAt: "", endAt: "" });
  }

  function handleCreate() {
    if (!form.name.trim() || !form.playlistId || !effectiveScreenId) {
      toast({ title: "Preencha nome e playlist", variant: "destructive" });
      return;
    }
    if (form.days.length === 0) {
      toast({ title: "Selecione ao menos um dia", variant: "destructive" });
      return;
    }
    const [sh, sm] = form.startTime.split(":").map(Number);
    const [eh, em] = form.endTime.split(":").map(Number);
    if (sh * 60 + sm >= eh * 60 + em) {
      toast({ title: "Horário de fim deve ser após o início", variant: "destructive" });
      return;
    }
    const payload = {
      name:        form.name.trim(),
      screenId:    Number(effectiveScreenId),
      playlistId:  Number(form.playlistId),
      startTime:   form.startTime,
      endTime:     form.endTime,
      daysOfWeek:  form.days.join(","),
      active:      true,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createSchedule.mutate({ data: payload as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
        setShowAdd(false);
        resetForm();
        toast({ title: "Campanha criada!" });
      },
      onError: () => toast({ title: "Erro ao criar campanha", variant: "destructive" }),
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Excluir esta campanha?")) return;
    deleteSchedule.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
        if (selectedId === id) { setSelectedId(null); setEditMode(false); }
        toast({ title: "Campanha excluída" });
      },
      onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
    });
  }

  function startEdit(cam: CalCampaign) {
    setEditForm({
      name: cam.name,
      playlistId: String(cam.playlistId),
      startTime: String(cam.startHour).padStart(2, "0") + ":00",
      endTime:   cam.endHour === 24 ? "00:00" : String(cam.endHour).padStart(2, "0") + ":00",
      days:      [...cam.days],
    });
    setEditMode(true);
  }

  function toggleEditDay(d: number) {
    setEditForm(p => ({
      ...p,
      days: p.days.includes(d) ? p.days.filter(x => x !== d) : [...p.days, d],
    }));
  }

  function handleUpdate() {
    if (!selectedId) return;
    if (!editForm.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (editForm.days.length === 0) {
      toast({ title: "Selecione ao menos um dia", variant: "destructive" });
      return;
    }
    const [sh, sm] = editForm.startTime.split(":").map(Number);
    const [eh, em] = editForm.endTime.split(":").map(Number);
    if (sh * 60 + sm >= eh * 60 + em) {
      toast({ title: "Horário de fim deve ser após o início", variant: "destructive" });
      return;
    }
    updateSchedule.mutate(
      {
        id: selectedId,
        data: {
          name:       editForm.name.trim(),
          playlistId: Number(editForm.playlistId) || undefined,
          startTime:  editForm.startTime,
          endTime:    editForm.endTime,
          daysOfWeek: editForm.days.join(","),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          setEditMode(false);
          toast({ title: "Campanha atualizada!" });
        },
        onError: () => toast({ title: "Erro ao atualizar campanha", variant: "destructive" }),
      }
    );
  }

  function getCamsForDayHour(dayIdx: number, hour: number): CalCampaign[] {
    return campaignBlocks.filter(
      c => c.days.includes(dayIdx) && c.startHour <= hour && c.endHour > hour
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#0d0f17] text-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 bg-[#12141c] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Tela</span>
          {isLoading ? (
            <div className="h-7 w-32 bg-white/8 rounded-lg animate-pulse" />
          ) : (
            <select
              value={effectiveScreenId}
              onChange={e => { setFilterScreenId(e.target.value); setSelectedId(null); }}
              className="text-sm font-semibold bg-white/8 border border-white/12 rounded-lg px-3 py-1.5 text-white outline-none cursor-pointer hover:bg-white/12 transition-colors"
            >
              {screens?.map(s => (
                <option key={s.id} value={String(s.id)}>📺 {s.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(p => p - 1)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors text-lg"
          >‹</button>
          <span className="text-sm font-semibold text-white min-w-[160px] text-center capitalize">
            {monthLabel}
          </span>
          <button
            onClick={() => setWeekOffset(p => p + 1)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors text-lg"
          >›</button>
          <button
            onClick={() => setWeekOffset(0)}
            className="ml-1 text-xs px-2.5 py-1 rounded-lg border border-white/15 text-white/60 hover:text-white hover:bg-white/8 transition-colors"
          >Hoje</button>
        </div>

        <button
          onClick={() => { resetForm(); setShowAdd(true); }}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors"
        >
          <span className="text-base leading-none">+</span> Nova Campanha
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Calendar */}
        <div className="flex-1 overflow-auto">
          {/* Day headers */}
          <div className="flex sticky top-0 z-20 bg-[#12141c] border-b border-white/8">
            <div style={{ width: HOUR_W, minWidth: HOUR_W }} />
            {dates.map((d, i) => {
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div key={i} className="flex-1 text-center py-2 border-l border-white/5">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">{DAY_LABELS[i]}</div>
                  <div className={`text-base font-bold mt-0.5 w-8 h-8 mx-auto rounded-full flex items-center justify-center ${isToday ? "bg-blue-600 text-white" : "text-white/80"}`}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Default playlist row */}
          <div className="flex border-b border-white/8 bg-white/2">
            <div style={{ width: HOUR_W, minWidth: HOUR_W }} className="text-[9px] text-white/25 flex items-center justify-center uppercase tracking-wider shrink-0">Padrão</div>
            {dates.map((_, i) => (
              <div key={i} className="flex-1 border-l border-white/5 py-1.5 px-1">
                <div className="text-[10px] font-medium text-white/35 text-center truncate">
                  {defaultCampaign?.playlistName ?? "—"}
                </div>
              </div>
            ))}
          </div>

          {/* Hour grid */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-white/30 text-sm">Carregando agenda…</div>
          ) : (
            HOURS.map(hour => (
              <div key={hour} className="flex" style={{ height: CELL_H }}>
                <div
                  style={{ width: HOUR_W, minWidth: HOUR_W }}
                  className="text-[10px] text-white/25 flex items-start justify-center pt-1 shrink-0 border-r border-white/5"
                >
                  {String(hour).padStart(2, "0")}:00
                </div>
                {dates.map((_, dayIdx) => {
                  const cams = getCamsForDayHour(dayIdx, hour);
                  return (
                    <div
                      key={dayIdx}
                      className="flex-1 border-l border-white/5 border-t border-white/5 relative"
                      style={{ height: CELL_H }}
                    >
                      {cams.map(cam => {
                        if (cam.startHour !== hour) return null;
                        const c = COLORS[cam.colorIdx % COLORS.length];
                        const spanH = (cam.endHour - cam.startHour) * CELL_H;
                        if (spanH <= 0) return null;
                        return (
                          <div
                            key={cam.id}
                            onClick={() => setSelectedId(selectedId === cam.id ? null : cam.id)}
                            className={`absolute inset-x-0.5 rounded-lg border cursor-pointer transition-all ${c.bg} ${c.border} ${selectedId === cam.id ? "ring-1 ring-white/30" : ""}`}
                            style={{ top: 1, height: spanH - 2, zIndex: 10 }}
                          >
                            <div className="px-1.5 pt-1 overflow-hidden h-full">
                              <div className={`text-[10px] font-bold truncate ${c.text}`}>{cam.name}</div>
                              <div className="text-[9px] text-white/45 truncate">{cam.playlistName}</div>
                              <div className="text-[9px] text-white/30">
                                {String(cam.startHour).padStart(2,"0")}:00–{String(cam.endHour).padStart(2,"0")}:00
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Right panel */}
        <div className="w-64 border-l border-white/8 bg-[#12141c] flex flex-col overflow-hidden shrink-0">
          {selectedCam ? (
            <div className="flex flex-col h-full">
              {/* Panel header */}
              <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between shrink-0">
                <span className="text-xs font-semibold text-white/80">
                  {editMode ? "Editar Campanha" : "Campanha"}
                </span>
                <button
                  onClick={() => { setSelectedId(null); setEditMode(false); }}
                  className="text-white/30 hover:text-white/70 text-xl leading-none"
                >×</button>
              </div>

              {editMode ? (
                /* ── EDIT FORM ── */
                <>
                  <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                    {/* Name */}
                    <div>
                      <label className="text-[10px] text-white/35 uppercase tracking-wider mb-1 block">Nome</label>
                      <input
                        autoFocus
                        value={editForm.name}
                        onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                        className="w-full bg-white/6 border border-white/12 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/25 outline-none focus:border-blue-500/60 transition-colors"
                      />
                    </div>
                    {/* Playlist */}
                    <div>
                      <label className="text-[10px] text-white/35 uppercase tracking-wider mb-1 block">Playlist</label>
                      <select
                        value={editForm.playlistId}
                        onChange={e => setEditForm(p => ({ ...p, playlistId: e.target.value }))}
                        className="w-full bg-white/6 border border-white/12 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500/60 transition-colors"
                      >
                        <option value="">— manter atual —</option>
                        {playlists?.map(pl => (
                          <option key={pl.id} value={String(pl.id)}>{pl.name}</option>
                        ))}
                      </select>
                    </div>
                    {/* Times */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-white/35 uppercase tracking-wider mb-1 block">Início</label>
                        <input
                          type="time"
                          value={editForm.startTime}
                          onChange={e => setEditForm(p => ({ ...p, startTime: e.target.value }))}
                          className="w-full bg-white/6 border border-white/12 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500/60 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/35 uppercase tracking-wider mb-1 block">Fim</label>
                        <input
                          type="time"
                          value={editForm.endTime}
                          onChange={e => setEditForm(p => ({ ...p, endTime: e.target.value }))}
                          className="w-full bg-white/6 border border-white/12 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500/60 transition-colors"
                        />
                      </div>
                    </div>
                    {/* Days */}
                    <div>
                      <label className="text-[10px] text-white/35 uppercase tracking-wider mb-1.5 block">Dias</label>
                      <div className="flex gap-1">
                        {DAY_LABELS.map((d, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => toggleEditDay(i)}
                            className={`flex-1 py-1 text-[9px] font-bold rounded border transition-all ${editForm.days.includes(i) ? "bg-blue-600 border-blue-500 text-white" : "bg-white/5 border-white/10 text-white/35 hover:bg-white/10"}`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 border-t border-white/8 space-y-2 shrink-0">
                    <button
                      onClick={handleUpdate}
                      disabled={updateSchedule.isPending}
                      className="w-full text-xs py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition-colors"
                    >
                      {updateSchedule.isPending ? "Salvando…" : "Salvar alterações"}
                    </button>
                    <button
                      onClick={() => setEditMode(false)}
                      className="w-full text-xs py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                /* ── VIEW MODE ── */
                <>
                  <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                    <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full ${COLORS[selectedCam.colorIdx % COLORS.length].bg} ${COLORS[selectedCam.colorIdx % COLORS.length].text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${COLORS[selectedCam.colorIdx % COLORS.length].dot}`} />
                      {selectedCam.name}
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-white/35 uppercase tracking-wider">Playlist</div>
                      <div className="text-sm font-medium text-white/80">{selectedCam.playlistName}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-white/35 uppercase tracking-wider">Horário</div>
                      <div className="text-sm font-medium text-white/80">
                        {String(selectedCam.startHour).padStart(2,"0")}:00 → {String(selectedCam.endHour).padStart(2,"0")}:00
                      </div>
                      {selectedCam.endHour <= selectedCam.startHour && (
                        <div className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/25 rounded px-2 py-1 mt-1">
                          ⚠️ Horário inválido — clique em Editar para corrigir
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-white/35 uppercase tracking-wider">Dias</div>
                      <div className="flex flex-wrap gap-1">
                        {DAY_LABELS.map((d, i) => (
                          <span key={i} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedCam.days.includes(i) ? "bg-blue-600 text-white" : "bg-white/5 text-white/25"}`}>{d}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 border-t border-white/8 space-y-2 shrink-0">
                    <button
                      onClick={() => startEdit(selectedCam)}
                      className="w-full text-xs py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/35 text-blue-300 font-semibold transition-colors"
                    >
                      ✏️ Editar campanha
                    </button>
                    <button
                      onClick={() => handleDelete(selectedCam.id)}
                      className="w-full text-xs py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 transition-colors"
                    >
                      Excluir campanha
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b border-white/8">
                <span className="text-xs font-semibold text-white/60">Campanhas ({campaignBlocks.length})</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {/* Default playlist */}
                <div className="px-3 py-2.5 border-b border-white/5">
                  <div className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Playlist Padrão</div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
                    <span className="text-xs text-white/60 truncate">{defaultCampaign?.playlistName ?? "—"}</span>
                  </div>
                  <div className="text-[9px] text-white/25 mt-0.5">Roda fora das campanhas</div>
                </div>

                {campaignBlocks.length === 0 && (
                  <div className="px-4 py-6 text-center text-white/25 text-xs">
                    Nenhuma campanha.<br />Clique em "+ Nova Campanha"
                  </div>
                )}

                {campaignBlocks.map(cam => {
                  const c = COLORS[cam.colorIdx % COLORS.length];
                  return (
                    <button
                      key={cam.id}
                      onClick={() => setSelectedId(cam.id)}
                      className={`w-full text-left px-3 py-2.5 border-b border-white/5 hover:bg-white/4 transition-colors ${selectedId === cam.id ? "bg-white/6" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                        <span className="text-xs font-medium text-white/80 truncate">{cam.name}</span>
                      </div>
                      <div className="text-[9px] text-white/35 mt-0.5 ml-4 truncate">{cam.playlistName}</div>
                      <div className="text-[9px] text-white/25 ml-4">
                        {String(cam.startHour).padStart(2,"0")}h–{String(cam.endHour).padStart(2,"0")}h · {cam.days.map(d => DAY_LABELS[d]).join(", ")}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bg-[#12141c] border border-white/12 rounded-2xl w-[420px] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white">Nova Campanha</h2>
              <button onClick={() => setShowAdd(false)} className="text-white/30 hover:text-white/70 text-xl">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Nome da campanha *</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Promoção Café, Ofertas Fim de Semana…"
                  className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-blue-500/60 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Playlist *</label>
                <select
                  value={form.playlistId}
                  onChange={e => setForm(p => ({ ...p, playlistId: e.target.value }))}
                  className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/60 transition-colors"
                >
                  <option value="">Selecionar playlist…</option>
                  {playlists?.map(pl => (
                    <option key={pl.id} value={String(pl.id)}>{pl.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Início</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                    className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/60 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Fim</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                    className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/60 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Repetir nos dias</label>
                <div className="flex gap-1.5">
                  {DAY_LABELS.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${form.days.includes(i) ? "bg-blue-600 border-blue-500 text-white" : "bg-white/5 border-white/10 text-white/35 hover:bg-white/10"}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2 rounded-xl border border-white/12 text-sm text-white/60 hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={createSchedule.isPending}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-semibold text-white transition-colors"
              >
                {createSchedule.isPending ? "Salvando…" : "Salvar Campanha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
