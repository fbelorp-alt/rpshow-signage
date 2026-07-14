import { useState, useRef, useCallback, useEffect, useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Screen { id: string; name: string; location: string }
interface Campaign {
  id: string; name: string; screenId: string;
  startMin: number; endMin: number;
  color: string; bgColor: string; borderColor: string;
  playlist: string; client: string;
  startDate: string; endDate: string; // "YYYY-MM-DD"
}

type ViewMode = "dia" | "semana" | "mes" | "periodo";

// ── Mock Data ──────────────────────────────────────────────────────────────────
const SCREENS: Screen[] = [
  { id: "s1", name: "Painel Salão Principal", location: "Recepção" },
  { id: "s2", name: "Monitor CPU Tybox", location: "Sala de Espera" },
  { id: "s3", name: "Tela Danitro", location: "Corredor" },
  { id: "s4", name: "Showroom LED", location: "Vitrine" },
  { id: "s5", name: "Promoção / Caixa", location: "Caixa" },
];

const PALETTE = [
  { color: "text-teal-100",   bgColor: "rgba(20,184,166,0.85)",   borderColor: "#14b8a6" },
  { color: "text-violet-100", bgColor: "rgba(139,92,246,0.85)",   borderColor: "#8b5cf6" },
  { color: "text-amber-100",  bgColor: "rgba(245,158,11,0.85)",   borderColor: "#f59e0b" },
  { color: "text-blue-100",   bgColor: "rgba(59,130,246,0.85)",   borderColor: "#3b82f6" },
  { color: "text-rose-100",   bgColor: "rgba(244,63,94,0.85)",    borderColor: "#f43f5e" },
  { color: "text-emerald-100",bgColor: "rgba(16,185,129,0.85)",   borderColor: "#10b981" },
  { color: "text-orange-100", bgColor: "rgba(249,115,22,0.85)",   borderColor: "#f97316" },
];

const toMin = (h: number, m = 0) => h * 60 + m;
const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2,"0")}:${String(m % 60).padStart(2,"0")}`;

const BASE_DATE = "2026-07-"; // week of 13–19 July 2026
const initialCampaigns: Campaign[] = [
  { id:"c1", name:"Padaria",        screenId:"s1", startMin:toMin(20,5), endMin:toMin(20,10), ...PALETTE[0], playlist:"PADARIA",    client:"Grica Via Norte", startDate:`${BASE_DATE}13`, endDate:`${BASE_DATE}19` },
  { id:"c2", name:"Padaria",        screenId:"s2", startMin:toMin(20,5), endMin:toMin(20,10), ...PALETTE[0], playlist:"PADARIA",    client:"Grica Via Norte", startDate:`${BASE_DATE}13`, endDate:`${BASE_DATE}19` },
  { id:"c3", name:"Belão Festa",    screenId:"s1", startMin:toMin(8,0),  endMin:toMin(12,0),  ...PALETTE[1], playlist:"BELÃO",      client:"Belão Eventos",   startDate:`${BASE_DATE}14`, endDate:`${BASE_DATE}18` },
  { id:"c4", name:"Promo Almoço",   screenId:"s3", startMin:toMin(11,30),endMin:toMin(14,0),  ...PALETTE[2], playlist:"ALMOÇO",     client:"Açougue Central", startDate:`${BASE_DATE}13`, endDate:`${BASE_DATE}19` },
  { id:"c5", name:"Vitrine Tarde",  screenId:"s4", startMin:toMin(14,0), endMin:toMin(18,0),  ...PALETTE[3], playlist:"VITRINE",    client:"Loja Show",       startDate:`${BASE_DATE}13`, endDate:`${BASE_DATE}17` },
  { id:"c6", name:"Caixa Noite",    screenId:"s5", startMin:toMin(18,0), endMin:toMin(22,0),  ...PALETTE[4], playlist:"NOITE",      client:"Supermercado X",  startDate:`${BASE_DATE}13`, endDate:`${BASE_DATE}19` },
  { id:"c7", name:"Abertura Manha", screenId:"s2", startMin:toMin(7,0),  endMin:toMin(9,0),   ...PALETTE[5], playlist:"ABERTURA",   client:"Banco Alfa",      startDate:`${BASE_DATE}14`, endDate:`${BASE_DATE}19` },
  { id:"c8", name:"Intervalo",      screenId:"s3", startMin:toMin(20,5), endMin:toMin(20,30), ...PALETTE[1], playlist:"INTERVALO",  client:"Farmácia Total",  startDate:`${BASE_DATE}13`, endDate:`${BASE_DATE}15` },
  { id:"c9", name:"Acougue",        screenId:"s1", startMin:toMin(9,0),  endMin:toMin(11,0),  ...PALETTE[6], playlist:"ACOUGUE",    client:"Grica Via Norte", startDate:`${BASE_DATE}14`, endDate:`${BASE_DATE}14` },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const START_HOUR = 6, END_HOUR = 23, TOTAL_MIN = (END_HOUR - START_HOUR) * 60;
const LANE_H = 56, RULER_H = 38, LABEL_W = 172;

function minToX(min: number, totalW: number) { return ((min - START_HOUR * 60) / TOTAL_MIN) * totalW; }
function xToMin(x: number, totalW: number) { return Math.round((x / totalW) * TOTAL_MIN / 5) * 5 + START_HOUR * 60; }

function isoDateAdd(base: string, days: number): string {
  const d = new Date(base + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function datesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let cur = start;
  while (cur <= end) { dates.push(cur); cur = isoDateAdd(cur, 1); }
  return dates;
}

function fmtDay(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

function fmtDayShort(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" });
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

function fmtMonthYear(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

function campaignOnDate(c: Campaign, date: string): boolean {
  return c.startDate <= date && c.endDate >= date;
}

// ── Edit Modal ─────────────────────────────────────────────────────────────────
function EditModal({ campaign, screens, onSave, onDelete, onClose }: {
  campaign: Campaign; screens: Screen[];
  onSave: (c: Campaign) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const [name, setName]         = useState(campaign.name);
  const [screenId, setScreenId] = useState(campaign.screenId);
  const [client, setClient]     = useState(campaign.client);
  const [playlist, setPlaylist] = useState(campaign.playlist);
  const [start, setStart]       = useState(fmtMin(campaign.startMin));
  const [end, setEnd]           = useState(fmtMin(campaign.endMin));
  const [startDate, setSD]      = useState(campaign.startDate);
  const [endDate, setED]        = useState(campaign.endDate);

  function parseTime(s: string): number { const [h,m]=s.split(":").map(Number); return h*60+(m||0); }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#1a1f2e] border border-white/10 rounded-2xl w-[400px] shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full" style={{ background: campaign.borderColor }} />
            <h2 className="font-bold text-white text-sm">Editar Campanha</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none cursor-pointer bg-transparent border-none">×</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-1">Nome</label>
              <input value={name} onChange={e=>setName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-1">Cliente</label>
              <input value={client} onChange={e=>setClient(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 transition-colors" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-1">Playlist</label>
            <input value={playlist} onChange={e=>setPlaylist(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 transition-colors" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-1">Tela</label>
            <select value={screenId} onChange={e=>setScreenId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 cursor-pointer">
              {screens.map(s=><option key={s.id} value={s.id} className="bg-[#1a1f2e]">{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-1">Início</label>
              <input type="time" value={start} onChange={e=>setStart(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 [color-scheme:dark]" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-1">Fim</label>
              <input type="time" value={end} onChange={e=>setEnd(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 [color-scheme:dark]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-1">Data início</label>
              <input type="date" value={startDate} onChange={e=>setSD(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 [color-scheme:dark]" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-1">Data fim</label>
              <input type="date" value={endDate} onChange={e=>setED(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 [color-scheme:dark]" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={()=>{onDelete(campaign.id);onClose();}} className="px-3 py-2 rounded-lg text-xs font-semibold text-red-400 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 cursor-pointer transition-colors">Excluir</button>
          <div className="flex-1"/>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-white/60 border border-white/10 hover:bg-white/5 cursor-pointer transition-colors">Cancelar</button>
          <button onClick={()=>{onSave({...campaign,name,client,playlist,screenId,startMin:parseTime(start),endMin:parseTime(end),startDate,endDate});onClose();}} className="px-5 py-2 rounded-lg text-xs font-bold bg-teal-500 hover:bg-teal-400 text-white cursor-pointer transition-colors">Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ── DIA / SEMANA view (lane-based, drag-and-drop) ─────────────────────────────
function LaneView({ campaigns, screens, dates, onEdit, onUpdate }: {
  campaigns: Campaign[]; screens: Screen[]; dates: string[];
  onEdit: (c: Campaign) => void; onUpdate: (c: Campaign) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ startMin: number; endMin: number; screenId: string; date: string } | null>(null);
  const dragOffsetMin = useRef(0);
  const dragDuration  = useRef(0);

  const gridW = () => {
    const w = gridRef.current?.clientWidth ?? 1000;
    return (w - LABEL_W) / dates.length;
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left - LABEL_W;
    const relY = e.clientY - rect.top - RULER_H;
    const colW = gridW();
    const colIdx = Math.max(0, Math.min(Math.floor(relX / colW), dates.length - 1));
    const localX = relX - colIdx * colW;
    const rawMin = xToMin(localX, colW) - dragOffsetMin.current;
    const snapped = Math.max(START_HOUR*60, Math.min(Math.round(rawMin/5)*5, END_HOUR*60 - dragDuration.current));
    const laneIdx = Math.max(0, Math.min(Math.floor(relY / LANE_H), screens.length - 1));
    setDragPreview({ startMin: snapped, endMin: snapped + dragDuration.current, screenId: screens[laneIdx].id, date: dates[colIdx] });
  }, [dragging, screens, dates]);

  const handleMouseUp = useCallback(() => {
    if (!dragging || !dragPreview) { setDragging(null); setDragPreview(null); return; }
    const c = campaigns.find(x => x.id === dragging);
    if (c) onUpdate({ ...c, startMin: dragPreview.startMin, endMin: dragPreview.endMin, screenId: dragPreview.screenId, startDate: dragPreview.date, endDate: isoDateAdd(dragPreview.date, c.endDate === c.startDate ? 0 : new Date(c.endDate).getDate() - new Date(c.startDate).getDate()) });
    setDragging(null); setDragPreview(null);
  }, [dragging, dragPreview, campaigns]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  function startDrag(e: React.MouseEvent, c: Campaign, date: string) {
    e.preventDefault();
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    const colIdx = dates.indexOf(date);
    const colW = gridW();
    const relX = e.clientX - rect.left - LABEL_W - colIdx * colW;
    dragOffsetMin.current = xToMin(relX, colW) - c.startMin;
    dragDuration.current  = c.endMin - c.startMin;
    setDragging(c.id);
    setDragPreview({ startMin: c.startMin, endMin: c.endMin, screenId: c.screenId, date });
  }

  return (
    <div ref={gridRef} className="flex-1 overflow-auto" style={{ cursor: dragging ? "grabbing" : "default" }}>
      <div style={{ minWidth: dates.length > 1 ? 900 : 600 }}>
        {/* Ruler */}
        <div className="flex sticky top-0 z-10 bg-[#0f1117] border-b border-white/8" style={{ height: RULER_H }}>
          <div style={{ width: LABEL_W, flexShrink: 0 }} className="border-r border-white/8 flex items-end pb-1.5 px-3">
            <span className="text-[9px] text-white/20 uppercase tracking-wider">Tela</span>
          </div>
          <div className="flex flex-1">
            {dates.map(d => (
              <div key={d} className="flex-1 border-l border-white/6 relative">
                <div className="px-2 py-1">
                  <div className={`text-[11px] font-bold ${d === new Date().toISOString().slice(0,10) ? "text-teal-400" : "text-white/60"}`}>{fmtDayShort(d).toUpperCase()}</div>
                  <div className={`text-[10px] ${d === new Date().toISOString().slice(0,10) ? "text-teal-300" : "text-white/30"}`}>{fmtDate(d)}</div>
                </div>
                {/* Hour marks */}
                <div className="absolute inset-0 flex pt-1">
                  {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => (
                    <div key={i} className="absolute bottom-1 text-[9px] text-white/20 font-mono" style={{ left: `${(i/(END_HOUR-START_HOUR))*100}%` }}>
                      {String(START_HOUR + i).padStart(2,"0")}h
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lanes */}
        {screens.map((screen, laneIdx) => (
          <div key={screen.id} className="flex border-b border-white/5 group" style={{ height: LANE_H }}>
            <div style={{ width: LABEL_W, flexShrink: 0 }} className="border-r border-white/8 flex flex-col justify-center px-3 gap-0.5 group-hover:bg-white/[0.015]">
              <div className="text-[11px] font-semibold text-white/80 truncate">{screen.name}</div>
              <div className="text-[9px] text-white/30">{screen.location}</div>
            </div>
            <div className="flex flex-1">
              {dates.map(date => {
                const dayCams = campaigns.filter(c => c.screenId === screen.id && campaignOnDate(c, date));
                return (
                  <div key={date} className="flex-1 border-l border-white/5 relative" style={{ background: laneIdx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.008)" }}>
                    {/* Hour grid lines */}
                    {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                      <div key={i} className="absolute top-0 bottom-0 w-px bg-white/4" style={{ left: `${(i/(END_HOUR-START_HOUR))*100}%` }} />
                    ))}
                    {/* Today highlight */}
                    {date === new Date().toISOString().slice(0,10) && <div className="absolute inset-0 bg-teal-500/[0.03]" />}
                    {/* Campaign blocks */}
                    {dayCams.map(c => {
                      const isDragging = dragging === c.id && dragPreview?.date === date && dragPreview?.screenId === screen.id;
                      const dp = isDragging ? dragPreview! : null;
                      const sMin = dp ? dp.startMin : c.startMin;
                      const eMin = dp ? dp.endMin   : c.endMin;
                      const lPct = ((sMin - START_HOUR*60) / TOTAL_MIN) * 100;
                      const wPct = Math.max(((eMin - sMin) / TOTAL_MIN) * 100, 0.4);
                      const isGhost = dragging === c.id && !(dragPreview?.date === date && dragPreview?.screenId === screen.id);
                      return (
                        <div key={c.id}
                          onMouseDown={e => startDrag(e, c, date)}
                          onClick={() => { if (!dragging) onEdit(c); }}
                          className="absolute top-[5px] bottom-[5px] rounded-md cursor-grab active:cursor-grabbing transition-all overflow-hidden group/block"
                          style={{ left:`${lPct}%`, width:`${wPct}%`, background: isGhost ? "rgba(255,255,255,0.06)" : c.bgColor, borderLeft: `3px solid ${isGhost ? "rgba(255,255,255,0.12)" : c.borderColor}`, opacity: isGhost ? 0.3 : 1, zIndex: dragging === c.id ? 20 : 10 }}>
                          <div className="h-full px-1.5 flex flex-col justify-center overflow-hidden">
                            <div className="text-[9px] font-black text-white truncate leading-tight">{c.name}</div>
                            {(eMin - sMin) > 30 && <div className="text-[8px] text-white/70 truncate leading-tight">{fmtMin(sMin)}–{fmtMin(eMin)}</div>}
                          </div>
                        </div>
                      );
                    })}
                    {/* Drag ghost in different lane/date */}
                    {dragging && dragPreview?.date === date && dragPreview?.screenId === screen.id && (() => {
                      const orig = campaigns.find(x=>x.id===dragging);
                      if (!orig || (orig.screenId===screen.id && campaignOnDate(orig,date))) return null;
                      const lPct = ((dragPreview.startMin - START_HOUR*60) / TOTAL_MIN) * 100;
                      const wPct = Math.max(((dragPreview.endMin - dragPreview.startMin) / TOTAL_MIN) * 100, 0.4);
                      return <div className="absolute top-[5px] bottom-[5px] rounded-md border-2 border-dashed border-white/30" style={{ left:`${lPct}%`, width:`${wPct}%`, background: orig.bgColor, opacity: 0.7, zIndex: 20 }} />;
                    })()}
                    {/* Now line */}
                    {date === new Date().toISOString().slice(0,10) && (() => {
                      const nowMin = new Date().getHours()*60 + new Date().getMinutes();
                      if (nowMin < START_HOUR*60 || nowMin > END_HOUR*60) return null;
                      const pct = ((nowMin - START_HOUR*60) / TOTAL_MIN) * 100;
                      return <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 z-30" style={{ left:`${pct}%` }} />;
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ height: 32 }} />
      </div>
    </div>
  );
}

// ── MÊS view ──────────────────────────────────────────────────────────────────
function MonthView({ campaigns, onEdit, monthISO, onMonthChange }: {
  campaigns: Campaign[]; onEdit: (c: Campaign) => void;
  monthISO: string; onMonthChange: (d: number) => void;
}) {
  const d = new Date(monthISO + "-01T12:00:00Z");
  const year = d.getUTCFullYear(), month = d.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, month, 1));
  const lastDay  = new Date(Date.UTC(year, month+1, 0));
  const startWd  = (firstDay.getUTCDay() + 6) % 7; // Monday=0
  const daysInMonth = lastDay.getUTCDate();

  const cells: Array<string | null> = [];
  for (let i=0; i<startWd; i++) cells.push(null);
  for (let i=1; i<=daysInMonth; i++) cells.push(`${year}-${String(month+1).padStart(2,"0")}-${String(i).padStart(2,"0")}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date().toISOString().slice(0,10);

  return (
    <div className="flex-1 overflow-auto px-4 py-3">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={()=>onMonthChange(-1)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer text-white/60 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h3 className="text-sm font-bold text-white capitalize">{fmtMonthYear(monthISO + "-01")}</h3>
        <button onClick={()=>onMonthChange(1)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer text-white/60 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1.5">
        {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d=>(
          <div key={d} className="text-center text-[10px] font-bold text-white/30 uppercase tracking-wider py-1">{d}</div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="rounded-lg bg-white/2 aspect-square" />;
          const dayCams = campaigns.filter(c => campaignOnDate(c, date));
          const isToday = date === today;
          return (
            <div key={date} className={`rounded-xl p-1.5 flex flex-col gap-1 min-h-[80px] border transition-colors ${isToday ? "border-teal-500/50 bg-teal-500/8" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"}`}>
              <div className={`text-[11px] font-bold text-right pr-0.5 ${isToday ? "text-teal-400" : "text-white/40"}`}>
                {parseInt(date.slice(8))}
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayCams.slice(0, 3).map(c => (
                  <button key={c.id} onClick={()=>onEdit(c)}
                    className="rounded px-1 py-0.5 text-left text-[8px] font-bold text-white truncate cursor-pointer hover:brightness-110 transition-all"
                    style={{ background: c.bgColor }}>
                    {c.name}
                  </button>
                ))}
                {dayCams.length > 3 && (
                  <div className="text-[8px] text-white/40 px-1">+{dayCams.length-3} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PERÍODO view ───────────────────────────────────────────────────────────────
function PeriodView({ campaigns, screens, onEdit }: {
  campaigns: Campaign[]; screens: Screen[]; onEdit: (c: Campaign) => void;
}) {
  const [from, setFrom] = useState("2026-07-13");
  const [to,   setTo]   = useState("2026-07-19");
  const dates = useMemo(() => datesInRange(from, to).slice(0, 31), [from, to]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Period picker */}
      <div className="px-4 py-3 border-b border-white/8 flex items-center gap-3 flex-wrap">
        <span className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Período</span>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white [color-scheme:dark] outline-none focus:border-teal-500" />
          <span className="text-white/30 text-xs">→</span>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white [color-scheme:dark] outline-none focus:border-teal-500" />
        </div>
        <span className="text-[10px] text-white/30">{dates.length} dia{dates.length!==1?"s":""} selecionado{dates.length!==1?"s":""}</span>

        {/* Campaign count badges */}
        <div className="ml-auto flex gap-2">
          {(() => {
            const total = campaigns.filter(c => c.startDate <= to && c.endDate >= from).length;
            return <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-bold">{total} campanhas no período</span>;
          })()}
        </div>
      </div>

      {/* Gantt-style rows */}
      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: Math.max(800, dates.length * 48 + 200) }}>
          {/* Date ruler */}
          <div className="flex sticky top-0 z-10 bg-[#0f1117] border-b border-white/8" style={{ height: 40 }}>
            <div style={{ width: 200, flexShrink: 0 }} className="border-r border-white/8 flex items-center px-3">
              <span className="text-[9px] text-white/20 uppercase tracking-wider">Tela / Campanha</span>
            </div>
            <div className="flex flex-1">
              {dates.map(d => (
                <div key={d} className={`flex-1 border-l border-white/6 flex flex-col items-center justify-center ${d === new Date().toISOString().slice(0,10) ? "bg-teal-500/10" : ""}`} style={{ minWidth: 44 }}>
                  <div className={`text-[8px] font-bold ${d === new Date().toISOString().slice(0,10) ? "text-teal-400" : "text-white/40"}`}>{fmtDayShort(d).slice(0,3).toUpperCase()}</div>
                  <div className={`text-[9px] font-mono ${d === new Date().toISOString().slice(0,10) ? "text-teal-300" : "text-white/25"}`}>{d.slice(8)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Per-screen gantt rows */}
          {screens.map((screen, si) => {
            const screenCams = campaigns.filter(c => c.screenId === screen.id && c.startDate <= to && c.endDate >= from);
            return (
              <div key={screen.id}>
                {/* Screen header row */}
                <div className="flex border-b border-white/8 bg-white/[0.02]" style={{ height: 28 }}>
                  <div style={{ width: 200, flexShrink: 0 }} className="border-r border-white/8 flex items-center px-3 gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-500/60 shrink-0" />
                    <span className="text-[10px] font-semibold text-white/70 truncate">{screen.name}</span>
                  </div>
                  <div className="flex flex-1">
                    {dates.map(d=>(
                      <div key={d} className={`flex-1 border-l border-white/4 ${d===new Date().toISOString().slice(0,10)?"bg-teal-500/5":si%2===0?"":"bg-white/[0.01]"}`} style={{ minWidth:44 }} />
                    ))}
                  </div>
                </div>
                {/* Campaign rows */}
                {screenCams.map(c => (
                  <div key={c.id} className="flex border-b border-white/4" style={{ height: 32 }}>
                    <div style={{ width: 200, flexShrink: 0 }} className="border-r border-white/6 flex items-center px-3 pl-6 gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ background: c.borderColor }} />
                      <span className="text-[10px] text-white/60 truncate">{c.name}</span>
                      <span className="text-[8px] text-white/25 ml-auto shrink-0">{fmtMin(c.startMin)}</span>
                    </div>
                    <div className="flex flex-1 relative items-center">
                      {dates.map(d=>(
                        <div key={d} className={`flex-1 border-l border-white/4 h-full ${d===new Date().toISOString().slice(0,10)?"bg-teal-500/5":""}`} style={{ minWidth:44 }} />
                      ))}
                      {/* Campaign bar */}
                      {(() => {
                        const clampStart = from > c.startDate ? from : c.startDate;
                        const clampEnd   = to < c.endDate ? to : c.endDate;
                        const startIdx = dates.indexOf(clampStart);
                        const endIdx   = dates.indexOf(clampEnd);
                        if (startIdx < 0 || endIdx < 0) return null;
                        const totalCols = dates.length;
                        const left = (startIdx / totalCols) * 100;
                        const width = ((endIdx - startIdx + 1) / totalCols) * 100;
                        return (
                          <button onClick={()=>onEdit(c)}
                            className="absolute top-[6px] bottom-[6px] rounded-md text-[8px] font-bold text-white px-1.5 overflow-hidden cursor-pointer hover:brightness-110 transition-all truncate"
                            style={{ left:`${left}%`, width:`${width}%`, background: c.bgColor, borderLeft: `2px solid ${c.borderColor}`, minWidth: 24 }}>
                            {c.name}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                ))}
                {screenCams.length === 0 && (
                  <div className="flex border-b border-white/3" style={{ height: 28 }}>
                    <div style={{ width: 200, flexShrink: 0 }} className="border-r border-white/5 flex items-center px-6">
                      <span className="text-[9px] text-white/20 italic">sem campanhas</span>
                    </div>
                    <div className="flex flex-1">
                      {dates.map(d=><div key={d} className="flex-1 border-l border-white/3" style={{ minWidth:44 }} />)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function VisualScheduler() {
  const [view, setView]           = useState<ViewMode>("semana");
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [editing, setEditing]     = useState<Campaign | null>(null);
  const [weekStart, setWeekStart] = useState("2026-07-13"); // Monday
  const [dayISO, setDayISO]       = useState("2026-07-14");
  const [monthISO, setMonthISO]   = useState("2026-07");

  // Compute dates shown depending on view
  const viewDates = useMemo(() => {
    if (view === "dia")    return [dayISO];
    if (view === "semana") return Array.from({ length: 7 }, (_, i) => isoDateAdd(weekStart, i));
    return [];
  }, [view, dayISO, weekStart]);

  function shiftView(dir: number) {
    if (view === "dia")    setDayISO(isoDateAdd(dayISO, dir));
    if (view === "semana") setWeekStart(isoDateAdd(weekStart, dir * 7));
    if (view === "mes") {
      const d = new Date(monthISO + "-01T12:00:00Z");
      d.setUTCMonth(d.getUTCMonth() + dir);
      setMonthISO(d.toISOString().slice(0, 7));
    }
  }

  function periodLabel() {
    if (view === "dia")    return fmtDay(dayISO);
    if (view === "semana") return `${fmtDate(weekStart)} – ${fmtDate(isoDateAdd(weekStart,6))} · ${new Date(weekStart+"T12:00:00Z").getFullYear()}`;
    if (view === "mes")    return "";
    return "Escolha o período";
  }

  const newCampaign: Campaign = {
    id: `new-${Date.now()}`, name: "Nova Campanha", screenId: "s1",
    startMin: toMin(9,0), endMin: toMin(10,0),
    ...PALETTE[campaigns.length % PALETTE.length],
    playlist: "", client: "",
    startDate: view==="dia" ? dayISO : weekStart,
    endDate:   view==="dia" ? dayISO : isoDateAdd(weekStart, 6),
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col select-none overflow-hidden" style={{ fontFamily:"system-ui,sans-serif", height:"100vh" }}>

      {/* ── Top Bar ── */}
      <div className="border-b border-white/8 bg-[#141822] px-4 py-2.5 flex items-center gap-3 shrink-0">
        {/* Logo / Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-white">Agendamento Visual</span>
        </div>

        {/* View tabs */}
        <div className="flex gap-0.5 bg-white/5 rounded-xl p-1 shrink-0">
          {(["dia","semana","mes","periodo"] as ViewMode[]).map(v=>(
            <button key={v} onClick={()=>setView(v)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all capitalize ${view===v?"bg-teal-500 text-white shadow-sm":"text-white/50 hover:text-white"}`}>
              {v==="dia"?"Dia":v==="semana"?"Semana":v==="mes"?"Mês":"Período"}
            </button>
          ))}
        </div>

        {/* Nav arrows + label (hidden in período) */}
        {view !== "periodo" && (
          <div className="flex items-center gap-2">
            <button onClick={()=>shiftView(-1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer text-white/60 hover:text-white transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={()=>{setWeekStart(getMonday(new Date())); setDayISO(new Date().toISOString().slice(0,10));}}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-teal-400 border border-teal-500/30 hover:bg-teal-500/10 cursor-pointer transition-colors">
              Hoje
            </button>
            <button onClick={()=>shiftView(1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer text-white/60 hover:text-white transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <span className="text-[11px] text-white/50 font-medium ml-1">{periodLabel()}</span>
          </div>
        )}

        {/* Stats */}
        <div className="ml-auto flex items-center gap-3 text-[10px] shrink-0">
          <span className="text-white/30"><span className="text-teal-400 font-bold">{campaigns.length}</span> campanhas</span>
          <span className="text-white/30"><span className="text-white/60 font-bold">{SCREENS.length}</span> telas</span>
          <div className="flex items-center gap-1 text-white/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            {new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
          </div>
          <button onClick={()=>setEditing(newCampaign)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-teal-500 hover:bg-teal-400 text-white cursor-pointer transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nova
          </button>
        </div>
      </div>

      {/* ── Hint bar ── */}
      {(view==="dia"||view==="semana") && (
        <div className="px-4 py-1.5 flex items-center gap-4 border-b border-white/4 text-[9px] text-white/25 shrink-0">
          <span className="flex items-center gap-1">⠿ Arraste para mover</span>
          <span>· Clique para editar</span>
          <span>· Arraste vertical para trocar de tela</span>
          <span>· Arraste horizontal para mudar horário ou dia</span>
        </div>
      )}

      {/* ── Content ── */}
      {(view==="dia"||view==="semana") && (
        <LaneView
          campaigns={campaigns} screens={SCREENS} dates={viewDates}
          onEdit={setEditing}
          onUpdate={c=>setCampaigns(p=>p.map(x=>x.id===c.id?c:x))}
        />
      )}
      {view==="mes" && (
        <MonthView
          campaigns={campaigns} onEdit={setEditing}
          monthISO={monthISO}
          onMonthChange={dir=>{
            const d = new Date(monthISO+"-01T12:00:00Z");
            d.setUTCMonth(d.getUTCMonth()+dir);
            setMonthISO(d.toISOString().slice(0,7));
          }}
        />
      )}
      {view==="periodo" && (
        <PeriodView campaigns={campaigns} screens={SCREENS} onEdit={setEditing} />
      )}

      {/* ── Edit Modal ── */}
      {editing && (
        <EditModal
          campaign={editing} screens={SCREENS}
          onSave={c=>setCampaigns(p=>p.some(x=>x.id===c.id)?p.map(x=>x.id===c.id?c:x):[...p,c])}
          onDelete={id=>setCampaigns(p=>p.filter(x=>x.id!==id))}
          onClose={()=>setEditing(null)}
        />
      )}
    </div>
  );
}
