import { useState } from "react";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const COLORS = [
  { bg: "bg-blue-500/25", border: "border-blue-400/60", text: "text-blue-300", dot: "bg-blue-400" },
  { bg: "bg-emerald-500/25", border: "border-emerald-400/60", text: "text-emerald-300", dot: "bg-emerald-400" },
  { bg: "bg-orange-500/25", border: "border-orange-400/60", text: "text-orange-300", dot: "bg-orange-400" },
  { bg: "bg-purple-500/25", border: "border-purple-400/60", text: "text-purple-300", dot: "bg-purple-400" },
  { bg: "bg-pink-500/25", border: "border-pink-400/60", text: "text-pink-300", dot: "bg-pink-400" },
  { bg: "bg-yellow-500/25", border: "border-yellow-400/60", text: "text-yellow-300", dot: "bg-yellow-400" },
];

interface Campaign {
  id: number;
  name: string;
  playlist: string;
  startHour: number;
  endHour: number;
  days: number[];
  colorIdx: number;
}

const SAMPLE: Campaign[] = [
  { id: 1, name: "Promoção Café", playlist: "Café da Manhã", startHour: 7, endHour: 10, days: [1,2,3,4,5], colorIdx: 0 },
  { id: 2, name: "Promoção Arroz", playlist: "Ofertas Grãos", startHour: 11, endHour: 13, days: [1,3,5], colorIdx: 1 },
  { id: 3, name: "Almoço Especial", playlist: "Padaria & Frios", startHour: 11, endHour: 14, days: [2,4,6], colorIdx: 2 },
  { id: 4, name: "Happy Hour", playlist: "Bebidas & Petiscos", startHour: 17, endHour: 20, days: [5,6], colorIdx: 3 },
  { id: 5, name: "Fim de Semana", playlist: "Promo Weekend", startHour: 9, endHour: 21, days: [0,6], colorIdx: 4 },
];

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function AgendaCalendar() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [campaigns, setCampaigns] = useState<Campaign[]>(SAMPLE);
  const [selected, setSelected] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: "", playlist: "", startHour: 8, endHour: 10, days: [1,2,3,4,5] });
  const [defaultPlaylist] = useState("Playlist Principal");

  const dates = getWeekDates(weekOffset);
  const monthLabel = dates[0].toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const CELL_H = 48;
  const HOUR_W = 52;

  const getCampaignsForDayHour = (dayIdx: number, hour: number) =>
    campaigns.filter(c => c.days.includes(dayIdx) && c.startHour <= hour && c.endHour > hour);

  const toggleDay = (d: number) => {
    setNewCampaign(p => ({
      ...p,
      days: p.days.includes(d) ? p.days.filter(x => x !== d) : [...p.days, d],
    }));
  };

  const addCampaign = () => {
    if (!newCampaign.name.trim()) return;
    setCampaigns(p => [...p, {
      id: Date.now(),
      name: newCampaign.name,
      playlist: newCampaign.playlist || "Sem playlist",
      startHour: newCampaign.startHour,
      endHour: newCampaign.endHour,
      days: newCampaign.days,
      colorIdx: p.length % COLORS.length,
    }]);
    setNewCampaign({ name: "", playlist: "", startHour: 8, endHour: 10, days: [1,2,3,4,5] });
    setShowAdd(false);
  };

  const removeCampaign = (id: number) => {
    setCampaigns(p => p.filter(c => c.id !== id));
    if (selected === id) setSelected(null);
  };

  const selectedCampaign = campaigns.find(c => c.id === selected);

  return (
    <div className="min-h-screen bg-[#0d0f17] text-white flex flex-col font-sans" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 bg-[#12141c] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Tela</span>
          <select className="text-sm font-semibold bg-white/8 border border-white/12 rounded-lg px-3 py-1.5 text-white outline-none cursor-pointer hover:bg-white/12 transition-colors">
            <option>📺 SJ TV</option>
            <option>📺 Vitrine Entrada</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(p => p-1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors text-lg">‹</button>
          <span className="text-sm font-semibold text-white min-w-[160px] text-center capitalize">{monthLabel}</span>
          <button onClick={() => setWeekOffset(p => p+1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors text-lg">›</button>
          <button onClick={() => setWeekOffset(0)} className="ml-1 text-xs px-2.5 py-1 rounded-lg border border-white/15 text-white/60 hover:text-white hover:bg-white/8 transition-colors">Hoje</button>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors"
        >
          <span className="text-base leading-none">+</span> Nova Campanha
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Calendar grid */}
        <div className="flex-1 overflow-auto">
          {/* Day headers */}
          <div className="flex sticky top-0 z-20 bg-[#12141c] border-b border-white/8">
            <div style={{ width: HOUR_W, minWidth: HOUR_W }} />
            {dates.map((d, i) => {
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div key={i} className="flex-1 text-center py-2 border-l border-white/5">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">{DAYS[i]}</div>
                  <div className={`text-base font-bold mt-0.5 w-8 h-8 mx-auto rounded-full flex items-center justify-center transition-colors ${isToday ? "bg-blue-600 text-white" : "text-white/80"}`}>
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
                <div className="text-[10px] font-medium text-white/35 text-center truncate">{defaultPlaylist}</div>
              </div>
            ))}
          </div>

          {/* Hour rows */}
          {HOURS.map(hour => (
            <div key={hour} className="flex" style={{ height: CELL_H }}>
              <div style={{ width: HOUR_W, minWidth: HOUR_W }} className="text-[10px] text-white/25 flex items-start justify-center pt-1 shrink-0 border-r border-white/5">
                {String(hour).padStart(2,"0")}:00
              </div>
              {dates.map((_, dayIdx) => {
                const cams = getCampaignsForDayHour(dayIdx, hour);
                const isFirstHour = (cam: Campaign) => cam.startHour === hour;
                return (
                  <div
                    key={dayIdx}
                    className="flex-1 border-l border-white/5 border-t border-white/5 relative"
                    style={{ height: CELL_H }}
                  >
                    {cams.map(cam => {
                      const c = COLORS[cam.colorIdx % COLORS.length];
                      const isFirst = isFirstHour(cam);
                      const spanH = (cam.endHour - cam.startHour) * CELL_H;
                      if (!isFirst) return null;
                      return (
                        <div
                          key={cam.id}
                          onClick={() => setSelected(selected === cam.id ? null : cam.id)}
                          className={`absolute inset-x-0.5 rounded-lg border cursor-pointer transition-all ${c.bg} ${c.border} ${selected === cam.id ? "ring-1 ring-white/30" : ""}`}
                          style={{ top: 0, height: spanH - 2, zIndex: 10, marginTop: 1 }}
                        >
                          <div className="px-1.5 pt-1 overflow-hidden h-full">
                            <div className={`text-[10px] font-bold truncate ${c.text}`}>{cam.name}</div>
                            <div className="text-[9px] text-white/45 truncate">{cam.playlist}</div>
                            <div className="text-[9px] text-white/30">{String(cam.startHour).padStart(2,"0")}:00–{String(cam.endHour).padStart(2,"0")}:00</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Right panel — campaign detail or list */}
        <div className="w-64 border-l border-white/8 bg-[#12141c] flex flex-col overflow-hidden shrink-0">
          {selectedCampaign ? (
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                <span className="text-xs font-semibold text-white/80">Campanha</span>
                <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white/70 text-lg leading-none">×</button>
              </div>
              <div className="p-4 space-y-3 flex-1">
                <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full ${COLORS[selectedCampaign.colorIdx % COLORS.length].bg} ${COLORS[selectedCampaign.colorIdx % COLORS.length].text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${COLORS[selectedCampaign.colorIdx % COLORS.length].dot}`} />
                  {selectedCampaign.name}
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] text-white/35 uppercase tracking-wider">Playlist</div>
                  <div className="text-sm font-medium text-white/80">{selectedCampaign.playlist}</div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] text-white/35 uppercase tracking-wider">Horário</div>
                  <div className="text-sm font-medium text-white/80">
                    {String(selectedCampaign.startHour).padStart(2,"0")}:00 → {String(selectedCampaign.endHour).padStart(2,"0")}:00
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] text-white/35 uppercase tracking-wider">Dias</div>
                  <div className="flex flex-wrap gap-1">
                    {DAYS.map((d, i) => (
                      <span key={i} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedCampaign.days.includes(i) ? "bg-blue-600 text-white" : "bg-white/5 text-white/25"}`}>{d}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-white/8 flex gap-2">
                <button className="flex-1 text-xs py-2 rounded-lg bg-white/8 hover:bg-white/12 text-white/70 transition-colors">Editar</button>
                <button onClick={() => removeCampaign(selectedCampaign.id)} className="flex-1 text-xs py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 transition-colors">Excluir</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b border-white/8">
                <span className="text-xs font-semibold text-white/60">Campanhas ({campaigns.length})</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {/* Default playlist */}
                <div className="px-3 py-2.5 border-b border-white/5">
                  <div className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Playlist Padrão</div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
                    <span className="text-xs text-white/60 truncate">{defaultPlaylist}</span>
                  </div>
                  <div className="text-[9px] text-white/25 mt-0.5">Roda fora das campanhas</div>
                </div>

                {campaigns.map(cam => {
                  const c = COLORS[cam.colorIdx % COLORS.length];
                  return (
                    <button
                      key={cam.id}
                      onClick={() => setSelected(cam.id)}
                      className={`w-full text-left px-3 py-2.5 border-b border-white/5 hover:bg-white/4 transition-colors ${selected === cam.id ? "bg-white/6" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                        <span className="text-xs font-medium text-white/80 truncate">{cam.name}</span>
                      </div>
                      <div className="text-[9px] text-white/35 mt-0.5 ml-4 truncate">{cam.playlist}</div>
                      <div className="text-[9px] text-white/25 ml-4">
                        {String(cam.startHour).padStart(2,"0")}h–{String(cam.endHour).padStart(2,"0")}h · {cam.days.map(d => DAYS[d]).join(", ")}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add campaign modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-[#12141c] border border-white/12 rounded-2xl w-[420px] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white">Nova Campanha</h2>
              <button onClick={() => setShowAdd(false)} className="text-white/30 hover:text-white/70 text-xl">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Nome da campanha *</label>
                <input
                  autoFocus
                  value={newCampaign.name}
                  onChange={e => setNewCampaign(p => ({...p, name: e.target.value}))}
                  placeholder="Ex: Promoção Café, Ofertas Fim de Semana…"
                  className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-blue-500/60 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Playlist</label>
                <select className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/60 transition-colors">
                  <option>Café da Manhã</option>
                  <option>Ofertas Grãos</option>
                  <option>Padaria & Frios</option>
                  <option>Bebidas & Petiscos</option>
                  <option>Playlist Principal</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Início</label>
                  <input type="time" defaultValue="08:00" className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/60 transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Fim</label>
                  <input type="time" defaultValue="10:00" className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/60 transition-colors" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Repetir nos dias</label>
                <div className="flex gap-1.5">
                  {DAYS.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${newCampaign.days.includes(i) ? "bg-blue-600 border-blue-500 text-white" : "bg-white/5 border-white/10 text-white/35 hover:bg-white/10"}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Período (opcional)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input type="date" className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white/60 outline-none focus:border-blue-500/60 transition-colors" />
                  </div>
                  <div>
                    <input type="date" className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white/60 outline-none focus:border-blue-500/60 transition-colors" placeholder="Sem data fim" />
                  </div>
                </div>
                <p className="text-[9px] text-white/25 mt-1">Deixe em branco para repetir indefinidamente</p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-xl border border-white/12 text-sm text-white/60 hover:bg-white/5 transition-colors">Cancelar</button>
              <button onClick={addCampaign} className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white transition-colors">Salvar Campanha</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
