import { useState, useRef, useCallback, useEffect } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Screen {
  id: string;
  name: string;
  location: string;
}

interface Campaign {
  id: string;
  name: string;
  screenId: string;
  startMin: number; // minutes from 00:00
  endMin: number;
  color: string;
  playlist: string;
  days: string[];
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

const SCREENS: Screen[] = [
  { id: "s1", name: "Painel - Salão Principal", location: "Recepção" },
  { id: "s2", name: "Monitor CPU Tybox", location: "Sala de Espera" },
  { id: "s3", name: "Tela Danitro", location: "Corredor" },
  { id: "s4", name: "Showroom LED", location: "Vitrine" },
  { id: "s5", name: "PROMOÇÃO", location: "Caixa" },
];

const COLORS = [
  "bg-teal-500 border-teal-400",
  "bg-violet-500 border-violet-400",
  "bg-amber-500 border-amber-400",
  "bg-blue-500 border-blue-400",
  "bg-rose-500 border-rose-400",
  "bg-emerald-500 border-emerald-400",
];

const toMin = (h: number, m = 0) => h * 60 + m;

const initialCampaigns: Campaign[] = [
  { id: "c1", name: "padaria", screenId: "s1", startMin: toMin(20, 5), endMin: toMin(20, 10), color: COLORS[0], playlist: "PADARIA", days: ["S","T","Q","Q","S","S","D"] },
  { id: "c2", name: "padaria", screenId: "s2", startMin: toMin(20, 5), endMin: toMin(20, 10), color: COLORS[0], playlist: "PADARIA", days: ["S","T","Q","Q","S","S","D"] },
  { id: "c3", name: "BELÃO", screenId: "s1", startMin: toMin(8, 0), endMin: toMin(12, 0), color: COLORS[1], playlist: "BELÃO FESTA", days: ["S","T","Q","Q","S"] },
  { id: "c4", name: "Promoção Almoço", screenId: "s3", startMin: toMin(11, 30), endMin: toMin(14, 0), color: COLORS[2], playlist: "ALMOÇO", days: ["S","T","Q","Q","S","S","D"] },
  { id: "c5", name: "Vitrine Tarde", screenId: "s4", startMin: toMin(14, 0), endMin: toMin(18, 0), color: COLORS[3], playlist: "VITRINE", days: ["S","T","Q","Q","S"] },
  { id: "c6", name: "Caixa Noite", screenId: "s5", startMin: toMin(18, 0), endMin: toMin(22, 0), color: COLORS[4], playlist: "NOITE", days: ["S","T","Q","Q","S","S","D"] },
  { id: "c7", name: "Abertura", screenId: "s2", startMin: toMin(7, 0), endMin: toMin(9, 0), color: COLORS[5], playlist: "ABERTURA", days: ["S","T","Q","Q","S"] },
  { id: "c8", name: "Intervalo", screenId: "s3", startMin: toMin(20, 5), endMin: toMin(20, 30), color: COLORS[1], playlist: "INTERVALO", days: ["S","T","Q","Q","S","S","D"] },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const START_HOUR = 6;
const END_HOUR = 23;
const TOTAL_MIN = (END_HOUR - START_HOUR) * 60;
const LANE_H = 52; // px per screen row
const RULER_H = 36;
const LABEL_W = 180;

function minToX(min: number, totalW: number): number {
  return ((min - START_HOUR * 60) / TOTAL_MIN) * totalW;
}
function xToMin(x: number, totalW: number): number {
  return Math.round((x / totalW) * TOTAL_MIN) + START_HOUR * 60;
}
function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

const DAY_LABELS = ["S","T","Q","Q","S","S","D"];

function EditModal({ campaign, screens, onSave, onDelete, onClose }: {
  campaign: Campaign;
  screens: Screen[];
  onSave: (c: Campaign) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(campaign.name);
  const [screenId, setScreenId] = useState(campaign.screenId);
  const [start, setStart] = useState(fmtMin(campaign.startMin));
  const [end, setEnd] = useState(fmtMin(campaign.endMin));
  const [days, setDays] = useState(campaign.days.map((_, i) => campaign.days[i] !== ""));
  const [playlist, setPlaylist] = useState(campaign.playlist);

  function parseTime(s: string): number {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + (m || 0);
  }

  function save() {
    onSave({ ...campaign, name, screenId, playlist, startMin: parseTime(start), endMin: parseTime(end), days: DAY_LABELS.map((d, i) => days[i] ? d : "") });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#1a1f2e] border border-white/10 rounded-2xl w-[380px] shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className={`w-3 h-3 rounded-full ${campaign.color.split(" ")[0]}`} />
            <h2 className="font-bold text-white text-sm">Editar Campanha</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none cursor-pointer bg-transparent border-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Name */}
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-1">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 transition-colors" />
          </div>

          {/* Playlist */}
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-1">Playlist</label>
            <input value={playlist} onChange={e => setPlaylist(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 transition-colors" />
          </div>

          {/* Screen */}
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-1">Tela</label>
            <select value={screenId} onChange={e => setScreenId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 cursor-pointer">
              {screens.map(s => <option key={s.id} value={s.id} className="bg-[#1a1f2e]">{s.name}</option>)}
            </select>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-1">Início</label>
              <input type="time" value={start} onChange={e => setStart(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 [color-scheme:dark]" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-1">Fim</label>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 [color-scheme:dark]" />
            </div>
          </div>

          {/* Days */}
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-1.5">Dias</label>
            <div className="flex gap-1">
              {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((d, i) => (
                <button key={i} onClick={() => setDays(prev => prev.map((v, j) => j === i ? !v : v))}
                  className={`flex-1 h-8 rounded text-[10px] font-bold cursor-pointer border transition-colors ${days[i] ? "bg-teal-500 border-teal-400 text-white" : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={() => { onDelete(campaign.id); onClose(); }}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-red-400 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 cursor-pointer transition-colors">
            Excluir
          </button>
          <div className="flex-1" />
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white/60 border border-white/10 bg-transparent hover:bg-white/5 cursor-pointer transition-colors">
            Cancelar
          </button>
          <button onClick={save}
            className="px-5 py-2 rounded-lg text-xs font-bold bg-teal-500 hover:bg-teal-400 text-white cursor-pointer transition-colors">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function VisualScheduler() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [dragging, setDragging] = useState<{ id: string; startMin: number; screenId: string } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ startMin: number; endMin: number; screenId: string } | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(2); // Wed by default (today-ish)
  const gridRef = useRef<HTMLDivElement>(null);
  const dragOffsetMin = useRef(0);
  const dragOrigDuration = useRef(0);

  const GRID_W = () => (gridRef.current?.clientWidth ?? 1000) - LABEL_W;

  // Mouse drag handlers
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left - LABEL_W;
    const relY = e.clientY - rect.top - RULER_H;

    const gw = GRID_W();
    const rawMin = xToMin(relX, gw) - dragOffsetMin.current;
    const startMin = Math.max(START_HOUR * 60, Math.min(rawMin, END_HOUR * 60 - dragOrigDuration.current));
    const endMin = startMin + dragOrigDuration.current;

    // Snap to nearest 5 min
    const snapped = Math.round(startMin / 5) * 5;
    const snappedEnd = snapped + dragOrigDuration.current;

    const laneIdx = Math.max(0, Math.min(Math.floor(relY / LANE_H), SCREENS.length - 1));
    const screenId = SCREENS[laneIdx]?.id ?? dragging.screenId;

    setDragPreview({ startMin: snapped, endMin: snappedEnd, screenId });
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    if (!dragging || !dragPreview) { setDragging(null); setDragPreview(null); return; }
    setCampaigns(prev => prev.map(c =>
      c.id === dragging.id
        ? { ...c, startMin: dragPreview.startMin, endMin: dragPreview.endMin, screenId: dragPreview.screenId }
        : c
    ));
    setDragging(null);
    setDragPreview(null);
  }, [dragging, dragPreview]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  function startDrag(e: React.MouseEvent, c: Campaign) {
    if (editing) return;
    e.preventDefault();
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = e.clientX - rect.left - LABEL_W;
    const gw = GRID_W();
    const clickMin = xToMin(relX, gw);
    dragOffsetMin.current = clickMin - c.startMin;
    dragOrigDuration.current = c.endMin - c.startMin;
    setDragging({ id: c.id, startMin: c.startMin, screenId: c.screenId });
    setDragPreview({ startMin: c.startMin, endMin: c.endMin, screenId: c.screenId });
  }

  const DAYS_SHORT = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

  const newCampaignTemplate: Campaign = {
    id: `c${Date.now()}`,
    name: "Nova Campanha",
    screenId: "s1",
    startMin: toMin(9, 0),
    endMin: toMin(10, 0),
    color: COLORS[campaigns.length % COLORS.length],
    playlist: "",
    days: DAY_LABELS,
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col select-none" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Top bar */}
      <div className="border-b border-white/8 bg-[#141822] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-white">Agendamento Visual</div>
            <div className="text-[10px] text-white/40">Semana de 13/07 – 19/07 de Julho, 2026</div>
          </div>
        </div>

        {/* Day tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {DAYS_SHORT.map((d, i) => (
            <button key={i} onClick={() => setSelectedDay(i)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${i === selectedDay ? "bg-teal-500 text-white" : "text-white/50 hover:text-white"}`}>
              {d}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white/60 border border-white/10 hover:bg-white/5 cursor-pointer">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            Lista
          </button>
          <button onClick={() => { setEditing(newCampaignTemplate); }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold bg-teal-500 hover:bg-teal-400 text-white cursor-pointer transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nova Campanha
          </button>
        </div>
      </div>

      {/* Drag hint */}
      <div className="px-5 py-2 flex items-center gap-4 border-b border-white/5 text-[10px] text-white/30">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded-sm bg-teal-500/40 border border-teal-400/30" />
          Arraste para mudar horário ou tela
        </span>
        <span>•</span>
        <span>Clique para editar</span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <span className="text-amber-400 font-bold">Cada linha = 1 tela</span>
          — sem sobreposição
        </span>
      </div>

      {/* Grid */}
      <div ref={gridRef} className="flex-1 overflow-auto relative" style={{ cursor: dragging ? "grabbing" : "default" }}>
        <div style={{ minWidth: 900 }}>
          {/* Ruler */}
          <div className="flex sticky top-0 z-10 bg-[#0f1117] border-b border-white/8" style={{ height: RULER_H }}>
            <div style={{ width: LABEL_W, flexShrink: 0 }} className="border-r border-white/8" />
            <div className="flex-1 relative">
              {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
                const h = START_HOUR + i;
                const pct = (i / (END_HOUR - START_HOUR)) * 100;
                return (
                  <div key={h} className="absolute top-0 h-full flex flex-col justify-end pb-1.5" style={{ left: `${pct}%` }}>
                    <div className="absolute top-0 bottom-0 w-px bg-white/6" />
                    <span className="text-[10px] text-white/30 pl-1 font-mono">{String(h).padStart(2, "0")}h</span>
                  </div>
                );
              })}
              {/* Current time indicator */}
              {(() => {
                const now = new Date();
                const nowMin = now.getHours() * 60 + now.getMinutes();
                if (nowMin < START_HOUR * 60 || nowMin > END_HOUR * 60) return null;
                const pct = ((nowMin - START_HOUR * 60) / TOTAL_MIN) * 100;
                return (
                  <div className="absolute top-0 bottom-0 z-20" style={{ left: `${pct}%` }}>
                    <div className="w-0.5 h-full bg-red-500/80" />
                    <div className="absolute -top-0.5 -left-1 w-2.5 h-2.5 rounded-full bg-red-500" />
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Lanes */}
          {SCREENS.map((screen, laneIdx) => {
            const laneCampaigns = campaigns.filter(c => c.screenId === screen.id);
            return (
              <div key={screen.id} className="flex border-b border-white/5 group" style={{ height: LANE_H }}>
                {/* Screen label */}
                <div style={{ width: LABEL_W, flexShrink: 0 }}
                  className="border-r border-white/8 flex flex-col justify-center px-3 gap-0.5 group-hover:bg-white/2">
                  <div className="text-[11px] font-semibold text-white/80 truncate">{screen.name}</div>
                  <div className="text-[9px] text-white/30">{screen.location}</div>
                </div>

                {/* Campaign blocks */}
                <div className="flex-1 relative" style={{ background: laneIdx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                  {/* Hour grid lines */}
                  {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 w-px bg-white/4" style={{ left: `${(i / (END_HOUR - START_HOUR)) * 100}%` }} />
                  ))}

                  {/* Campaigns in this lane */}
                  {laneCampaigns.map(c => {
                    const isDragging = dragging?.id === c.id;
                    const preview = isDragging && dragPreview && dragPreview.screenId === screen.id ? dragPreview : null;
                    const displayStart = preview ? preview.startMin : c.startMin;
                    const displayEnd = preview ? preview.endMin : c.endMin;

                    const leftPct = ((displayStart - START_HOUR * 60) / TOTAL_MIN) * 100;
                    const widthPct = ((displayEnd - displayStart) / TOTAL_MIN) * 100;

                    return (
                      <div
                        key={c.id}
                        onMouseDown={e => startDrag(e, c)}
                        onClick={() => { if (!dragging) setEditing(c); }}
                        className={`absolute top-2 bottom-2 rounded-lg border cursor-grab active:cursor-grabbing transition-opacity overflow-hidden group/block ${c.color} ${isDragging ? "opacity-40 shadow-none" : "opacity-90 hover:opacity-100 shadow-lg"}`}
                        style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%` }}
                        title={`${c.name}\n${fmtMin(c.startMin)} – ${fmtMin(c.endMin)}\n${c.playlist}`}
                      >
                        <div className="absolute inset-0 flex items-center px-2 gap-1.5">
                          {/* Drag handle dots */}
                          <div className="flex flex-col gap-0.5 opacity-60 shrink-0">
                            <div className="flex gap-0.5">
                              <div className="w-1 h-1 rounded-full bg-white/80" />
                              <div className="w-1 h-1 rounded-full bg-white/80" />
                            </div>
                            <div className="flex gap-0.5">
                              <div className="w-1 h-1 rounded-full bg-white/80" />
                              <div className="w-1 h-1 rounded-full bg-white/80" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold text-white truncate leading-tight">{c.name}</div>
                            <div className="text-[9px] text-white/70 truncate">{fmtMin(c.startMin)}–{fmtMin(c.endMin)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Drag preview ghost in THIS lane */}
                  {dragging && dragPreview && dragPreview.screenId === screen.id && dragging.screenId !== screen.id && (() => {
                    const leftPct = ((dragPreview.startMin - START_HOUR * 60) / TOTAL_MIN) * 100;
                    const widthPct = ((dragPreview.endMin - dragPreview.startMin) / TOTAL_MIN) * 100;
                    const orig = campaigns.find(c => c.id === dragging.id);
                    return (
                      <div className={`absolute top-2 bottom-2 rounded-lg border opacity-60 ${orig?.color ?? ""}`}
                        style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%` }}>
                        <div className="w-full h-full bg-white/20 rounded-lg border-2 border-white border-dashed" />
                      </div>
                    );
                  })()}

                  {/* Dragging block following cursor in same lane */}
                  {dragging && dragPreview && dragPreview.screenId === screen.id && dragging.screenId === screen.id && (() => {
                    const leftPct = ((dragPreview.startMin - START_HOUR * 60) / TOTAL_MIN) * 100;
                    const widthPct = ((dragPreview.endMin - dragPreview.startMin) / TOTAL_MIN) * 100;
                    const orig = campaigns.find(c => c.id === dragging.id);
                    return (
                      <div className={`absolute top-2 bottom-2 rounded-lg border opacity-95 shadow-2xl ${orig?.color ?? ""}`}
                        style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%`, zIndex: 20 }}>
                        <div className="absolute inset-0 flex items-center px-2 gap-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold text-white truncate">{orig?.name}</div>
                            <div className="text-[9px] text-white/80">{fmtMin(dragPreview.startMin)}–{fmtMin(dragPreview.endMin)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}

          {/* Bottom padding */}
          <div style={{ height: 40 }} />
        </div>
      </div>

      {/* Footer stats */}
      <div className="border-t border-white/8 bg-[#141822] px-5 py-2 flex items-center gap-6 text-[10px] text-white/30">
        <span><span className="text-teal-400 font-bold">{campaigns.length}</span> campanhas</span>
        <span><span className="text-white/60 font-bold">{SCREENS.length}</span> telas ativas</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Agora: {new Date().toLocaleTimeString("pt-BR")}</span>
        <span className="ml-auto text-white/20">Arrastar = mover campanha · Clique = editar</span>
      </div>

      {/* Edit modal */}
      {editing && (
        <EditModal
          campaign={editing}
          screens={SCREENS}
          onSave={c => setCampaigns(prev => prev.some(p => p.id === c.id) ? prev.map(p => p.id === c.id ? c : p) : [...prev, c])}
          onDelete={id => setCampaigns(prev => prev.filter(p => p.id !== id))}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
