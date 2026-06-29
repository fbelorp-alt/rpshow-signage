import { useState, useRef, useCallback, useEffect } from "react";
import {
  Trash2, Lock, Unlock, ChevronUp, ChevronDown,
  Clock, CloudSun, Rss as RssIcon, Globe, Film, Image as ImageIcon,
  AlignLeft, Plus, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CanvasLayer {
  id: string;
  mediaId?: number;
  type: "media" | "text";
  mediaType?: string | null;
  mediaUrl?: string | null;
  mediaName?: string | null;
  x: number; y: number; w: number; h: number;
  fixed: boolean;
  durationSeconds?: number;
  objectFit?: "contain" | "cover" | "fill";
  zIndex: number;
  visible: boolean;
  locked: boolean;
  textContent?: string;
  textColor?: string;
  textSize?: number;
  textBg?: string;
}

export interface CanvasData { version: 2; layers: CanvasLayer[]; }

export function parseCanvasData(json?: string | null): CanvasData {
  if (!json) return { version: 2, layers: [] };
  try {
    const p = JSON.parse(json);
    if (p?.version === 2 && Array.isArray(p.layers)) return p;
  } catch {}
  return { version: 2, layers: [] };
}

export function serializeCanvasData(data: CanvasData): string {
  return JSON.stringify(data);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/objects/")) return `/api/storage${url}`;
  return url;
}

export interface MediaItem {
  id: number; name: string; type: string; url: string; durationSeconds?: number | null;
}

function makeLayerId() {
  return `L${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function mediaToLayer(media: MediaItem, count: number): CanvasLayer {
  const isWidget = ["clock", "weather", "weather_forecast", "rss"].includes(media.type);
  return {
    id: makeLayerId(), mediaId: media.id, type: "media",
    mediaType: media.type, mediaUrl: media.url, mediaName: media.name,
    x: 5 + (count % 4) * 3, y: 5 + Math.floor(count / 4) * 3,
    w: isWidget ? 25 : 60, h: isWidget ? 20 : 60,
    fixed: isWidget, durationSeconds: media.durationSeconds ?? 10,
    objectFit: "contain", zIndex: count + 1, visible: true, locked: false,
  };
}

export function makeTextLayer(count: number): CanvasLayer {
  return {
    id: makeLayerId(), type: "text", mediaType: "text", mediaName: "Texto",
    x: 10, y: 10, w: 40, h: 15, fixed: true,
    zIndex: count + 1, visible: true, locked: false,
    textContent: "Seu texto aqui", textColor: "#ffffff", textSize: 32, textBg: "transparent",
  };
}

// ─── Clock widget ─────────────────────────────────────────────────────────────

function ClockDisplay() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center bg-black text-white overflow-hidden pointer-events-none"
      style={{ containerType: "size" }}
    >
      <div className="font-mono font-bold" style={{ fontSize: "clamp(8px, 7cqw, 64px)", lineHeight: 1 }}>
        {time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" })}
      </div>
      <div className="text-white/50 capitalize mt-1" style={{ fontSize: "clamp(5px, 2cqw, 16px)", lineHeight: 1 }}>
        {time.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" })}
      </div>
    </div>
  );
}

// ─── Layer content renderer ───────────────────────────────────────────────────

function LayerContent({ layer }: { layer: CanvasLayer }) {
  const src = resolveUrl(layer.mediaUrl);
  const t = layer.mediaType ?? layer.type;

  if (t === "clock") return <ClockDisplay />;

  if (t === "video" && src) return (
    <video key={src} src={src} className="w-full h-full pointer-events-none"
      style={{ objectFit: layer.objectFit ?? "contain" }} autoPlay muted loop playsInline />
  );
  if (t === "image" && src) return (
    <img key={src} src={src} alt={layer.mediaName ?? ""} className="w-full h-full pointer-events-none"
      style={{ objectFit: layer.objectFit ?? "contain" }} />
  );
  if (t === "web_channel" && src) return (
    <iframe src={src} className="w-full h-full pointer-events-none" style={{ border: "none" }} title={layer.mediaName ?? ""} />
  );
  if (t === "weather" || t === "weather_forecast") return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-sky-900 to-blue-950 text-white pointer-events-none overflow-hidden"
      style={{ containerType: "size" }}>
      <div style={{ fontSize: "clamp(14px, 10cqw, 64px)" }}>⛅</div>
      <div className="font-bold" style={{ fontSize: "clamp(8px, 4cqw, 28px)", lineHeight: 1.2 }}>— °C</div>
      <div className="text-white/60 truncate px-2 text-center" style={{ fontSize: "clamp(5px, 1.8cqw, 12px)" }}>{layer.mediaUrl ?? "Cidade"}</div>
    </div>
  );
  if (t === "rss") return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white pointer-events-none overflow-hidden"
      style={{ containerType: "size" }}>
      <RssIcon style={{ width: "clamp(12px, 8cqw, 40px)", height: "clamp(12px, 8cqw, 40px)" }} className="text-orange-400" />
      <div className="text-center px-2 mt-1 text-white/50 truncate" style={{ fontSize: "clamp(5px, 1.8cqw, 11px)" }}>{layer.mediaName ?? "RSS"}</div>
    </div>
  );
  if (t === "text") return (
    <div className="w-full h-full flex items-center justify-center pointer-events-none overflow-hidden p-2"
      style={{
        background: layer.textBg === "transparent" ? "transparent" : (layer.textBg ?? "transparent"),
        color: layer.textColor ?? "#fff",
        fontSize: layer.textSize ?? 32,
      }}>
      <span className="text-center leading-tight break-words">{layer.textContent ?? "Texto"}</span>
    </div>
  );
  return (
    <div className="w-full h-full flex items-center justify-center bg-white/5 pointer-events-none">
      <ImageIcon className="w-8 h-8 text-white/20" />
    </div>
  );
}

// ─── Resize handles ───────────────────────────────────────────────────────────

const HANDLES = ["n","ne","e","se","s","sw","w","nw"] as const;
type HandleDir = typeof HANDLES[number];

const CURSORS: Record<HandleDir, string> = {
  n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
  ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize",
};

const HPOS: Record<HandleDir, React.CSSProperties> = {
  n:  { top: -5, left: "50%", transform: "translateX(-50%)" },
  s:  { bottom: -5, left: "50%", transform: "translateX(-50%)" },
  e:  { right: -5, top: "50%", transform: "translateY(-50%)" },
  w:  { left: -5, top: "50%", transform: "translateY(-50%)" },
  ne: { top: -5, right: -5 },
  nw: { top: -5, left: -5 },
  se: { bottom: -5, right: -5 },
  sw: { bottom: -5, left: -5 },
};

// ─── Draggable / resizable layer box ─────────────────────────────────────────

function LayerBox({ layer, selected, canvasRef, onSelect, onChange }: {
  layer: CanvasLayer;
  selected: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onChange: (p: Partial<CanvasLayer>) => void;
}) {
  const drag = useRef<{
    sMX: number; sMY: number;
    sX: number; sY: number; sW: number; sH: number;
    mode: "move" | HandleDir;
  } | null>(null);

  const startDrag = useCallback((e: React.MouseEvent, mode: "move" | HandleDir) => {
    if (layer.locked) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    const rect = canvasRef.current?.getBoundingClientRect() ?? { width: 1, height: 1 };
    drag.current = { sMX: e.clientX, sMY: e.clientY, sX: layer.x, sY: layer.y, sW: layer.w, sH: layer.h, mode };

    const onMove = (me: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = ((me.clientX - d.sMX) / rect.width) * 100;
      const dy = ((me.clientY - d.sMY) / rect.height) * 100;

      if (d.mode === "move") {
        onChange({
          x: Math.max(0, Math.min(100 - d.sW, d.sX + dx)),
          y: Math.max(0, Math.min(100 - d.sH, d.sY + dy)),
        });
        return;
      }

      let nx = d.sX, ny = d.sY, nw = d.sW, nh = d.sH;
      if (d.mode.includes("e")) nw = Math.max(5, d.sW + dx);
      if (d.mode.includes("s")) nh = Math.max(5, d.sH + dy);
      if (d.mode.includes("w")) { nw = Math.max(5, d.sW - dx); nx = d.sX + (d.sW - nw); }
      if (d.mode.includes("n")) { nh = Math.max(5, d.sH - dy); ny = d.sY + (d.sH - nh); }
      onChange({ x: Math.max(0, nx), y: Math.max(0, ny), w: nw, h: nh });
    };

    const onUp = () => {
      drag.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [layer, onChange, onSelect, canvasRef]);

  if (!layer.visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: `${layer.x}%`, top: `${layer.y}%`,
        width: `${layer.w}%`, height: `${layer.h}%`,
        zIndex: layer.zIndex,
        outline: selected ? "2px solid #3b82f6" : "none",
        outlineOffset: 1,
        cursor: layer.locked ? "default" : "move",
        boxSizing: "border-box",
      }}
      onMouseDown={(e) => startDrag(e, "move")}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <LayerContent layer={layer} />

      {selected && !layer.locked && HANDLES.map((dir) => (
        <div
          key={dir}
          style={{
            ...HPOS[dir],
            position: "absolute",
            width: 10, height: 10,
            background: "#3b82f6",
            border: "2px solid white",
            borderRadius: 2,
            cursor: CURSORS[dir],
            zIndex: 10,
          }}
          onMouseDown={(e) => startDrag(e, dir)}
        />
      ))}

      {selected && (
        <div
          className="absolute flex items-center gap-1 text-[9px] font-bold text-white bg-blue-600 px-1.5 py-0.5 rounded-sm pointer-events-none whitespace-nowrap"
          style={{ top: -20, left: 0, zIndex: 20 }}
        >
          {layer.mediaName ?? layer.type}
          {layer.fixed && <span className="text-blue-200 ml-1">FIXO</span>}
        </div>
      )}
    </div>
  );
}

// ─── Layer icon ───────────────────────────────────────────────────────────────

function LayerIcon({ type }: { type?: string | null }) {
  if (type === "video") return <Film className="w-3 h-3 text-purple-400 shrink-0" />;
  if (type === "web_channel") return <Globe className="w-3 h-3 text-blue-400 shrink-0" />;
  if (type === "clock") return <Clock className="w-3 h-3 text-white/60 shrink-0" />;
  if (type === "weather" || type === "weather_forecast") return <CloudSun className="w-3 h-3 text-sky-400 shrink-0" />;
  if (type === "rss") return <RssIcon className="w-3 h-3 text-orange-400 shrink-0" />;
  if (type === "text") return <AlignLeft className="w-3 h-3 text-yellow-400 shrink-0" />;
  return <ImageIcon className="w-3 h-3 text-emerald-400 shrink-0" />;
}

// ─── Main CanvasEditor ────────────────────────────────────────────────────────

export function CanvasEditor({ data, onChange, onAddMedia }: {
  data: CanvasData;
  onChange: (d: CanvasData) => void;
  onAddMedia: () => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const layers = data.layers;
  const sel = layers.find((l) => l.id === selectedId) ?? null;

  const upd = useCallback((id: string, p: Partial<CanvasLayer>) => {
    onChange({ ...data, layers: layers.map((l) => l.id === id ? { ...l, ...p } : l) });
  }, [data, layers, onChange]);

  const del = useCallback((id: string) => {
    setSelectedId((prev) => prev === id ? null : prev);
    onChange({ ...data, layers: layers.filter((l) => l.id !== id) });
  }, [data, layers, onChange]);

  const reorder = useCallback((id: string, dir: 1 | -1) => {
    const idx = layers.findIndex((l) => l.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= layers.length) return;
    const next = [...layers];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    next.forEach((l, i) => { l.zIndex = i + 1; });
    onChange({ ...data, layers: next });
  }, [data, layers, onChange]);

  const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── Canvas area ── */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden p-6"
        style={{ background: "repeating-conic-gradient(#141620 0% 25%, #0d0f18 0% 50%) 0 0 / 20px 20px" }}
        onClick={() => setSelectedId(null)}
      >
        <div
          ref={canvasRef}
          className="relative bg-black shadow-2xl overflow-hidden select-none"
          style={{
            aspectRatio: "16/9",
            maxWidth: "100%",
            maxHeight: "100%",
            width: "min(100%, calc((100vh - 200px) * 16/9))",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 25px 60px rgba(0,0,0,0.8)",
          }}
        >
          {layers.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 gap-3 pointer-events-none">
              <div className="text-5xl">🖼</div>
              <p className="text-sm font-medium">Canvas vazio</p>
              <p className="text-xs">Use o botão + à direita para adicionar elementos</p>
            </div>
          )}
          {sorted.map((l) => (
            <LayerBox
              key={l.id}
              layer={l}
              selected={selectedId === l.id}
              canvasRef={canvasRef}
              onSelect={() => setSelectedId(l.id)}
              onChange={(p) => upd(l.id, p)}
            />
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="w-[280px] border-l border-white/8 bg-[#0e1018] flex flex-col shrink-0">

        {/* Layer list header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/8 bg-[#111320] shrink-0">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
            Camadas ({layers.length})
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => {
                const tl = makeTextLayer(layers.length);
                onChange({ ...data, layers: [...layers, tl] });
                setSelectedId(tl.id);
              }}
              className="w-6 h-6 rounded flex items-center justify-center bg-yellow-500/15 hover:bg-yellow-500/30 text-yellow-400 transition-colors"
              title="Adicionar texto"
            >
              <AlignLeft className="w-3 h-3" />
            </button>
            <button
              onClick={onAddMedia}
              className="w-6 h-6 rounded flex items-center justify-center bg-blue-500/15 hover:bg-blue-500/30 text-blue-400 transition-colors"
              title="Adicionar mídia da biblioteca"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Layer list */}
        <div className="overflow-y-auto" style={{ flex: sel ? "0 0 auto" : "1", maxHeight: sel ? "42%" : undefined }}>
          {layers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 px-4 text-center">
              <p className="text-xs text-white/25">Nenhuma camada ainda</p>
              <button
                onClick={onAddMedia}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" /> Adicionar mídia
              </button>
            </div>
          ) : (
            <div className="py-1">
              {[...layers].reverse().map((l) => {
                const isSel = selectedId === l.id;
                return (
                  <div
                    key={l.id}
                    onClick={() => setSelectedId(l.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group",
                      isSel ? "bg-blue-500/15 border-r-2 border-blue-500" : "hover:bg-white/4"
                    )}
                  >
                    <LayerIcon type={l.mediaType} />
                    <span className={cn("flex-1 text-xs truncate min-w-0", isSel ? "text-white" : "text-white/60")}>
                      {l.mediaName ?? l.type}
                    </span>
                    {l.fixed && (
                      <span className="text-[8px] font-bold text-blue-400/70 bg-blue-500/10 px-1 rounded shrink-0">FIXO</span>
                    )}
                    {l.locked && <Lock className="w-2.5 h-2.5 text-amber-400/60 shrink-0" />}
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); upd(l.id, { visible: !l.visible }); }}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/30 hover:text-white"
                        title={l.visible ? "Ocultar" : "Mostrar"}
                      >
                        {l.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-white/20" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); del(l.id); }}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-white/30 hover:text-red-400"
                        title="Remover"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Properties panel for selected layer */}
        {sel && (
          <div className="flex-1 border-t border-white/8 overflow-y-auto bg-[#0a0c12]">
            <div className="px-3 py-2 border-b border-white/6 flex items-center justify-between bg-[#0e1018] sticky top-0 z-10">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Propriedades</span>
              <div className="flex gap-1">
                <button
                  onClick={() => reorder(sel.id, -1)}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/30 hover:text-white"
                  title="Descer camada"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                <button
                  onClick={() => reorder(sel.id, 1)}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/30 hover:text-white"
                  title="Subir camada"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => upd(sel.id, { locked: !sel.locked })}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/30 hover:text-white"
                  title={sel.locked ? "Desbloquear" : "Bloquear"}
                >
                  {sel.locked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="p-3 space-y-3">

              {/* X Y W H */}
              <div>
                <p className="text-[10px] text-white/30 mb-1.5">Posição & Tamanho (%)</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["x","y","w","h"] as const).map((f) => (
                    <div key={f} className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded px-2 py-1">
                      <span className="text-[10px] text-white/30 w-3 shrink-0">{f.toUpperCase()}</span>
                      <input
                        type="number" step={1}
                        value={Math.round(sel[f])}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v)) upd(sel.id, { [f]: Math.max(0, v) });
                        }}
                        className="flex-1 w-full bg-transparent text-[11px] text-white font-mono text-right focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Fixed toggle */}
              <div className="flex items-center justify-between py-0.5">
                <div>
                  <p className="text-[10px] text-white/60">Elemento fixo</p>
                  <p className="text-[9px] text-white/25 mt-0.5">Sempre visível (não rotaciona)</p>
                </div>
                <button
                  onClick={() => upd(sel.id, { fixed: !sel.fixed })}
                  className={cn("relative w-9 h-5 rounded-full transition-colors shrink-0", sel.fixed ? "bg-blue-500" : "bg-white/15")}
                >
                  <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", sel.fixed ? "translate-x-4" : "translate-x-0.5")} />
                </button>
              </div>

              {/* Object fit */}
              {(sel.mediaType === "image" || sel.mediaType === "video") && (
                <div>
                  <p className="text-[10px] text-white/30 mb-1.5">Encaixe</p>
                  <div className="grid grid-cols-3 gap-1">
                    {(["contain","cover","fill"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => upd(sel.id, { objectFit: v })}
                        className={cn("py-1.5 rounded text-[9px] font-bold border transition-all",
                          sel.objectFit === v
                            ? "bg-blue-500/20 border-blue-400/40 text-blue-300"
                            : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                        )}
                      >
                        {v === "contain" ? "Ajustar" : v === "cover" ? "Preencher" : "Esticar"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Text properties */}
              {sel.mediaType === "text" && (
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-white/30 mb-1">Conteúdo</p>
                    <textarea
                      value={sel.textContent ?? ""}
                      onChange={(e) => upd(sel.id, { textContent: e.target.value })}
                      rows={3}
                      className="w-full bg-white/8 border border-white/10 rounded px-2 py-1.5 text-xs text-white resize-none focus:outline-none focus:border-blue-400/50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-[10px] text-white/30 mb-1">Tamanho px</p>
                      <input
                        type="number" min={8} max={300}
                        value={sel.textSize ?? 32}
                        onChange={(e) => upd(sel.id, { textSize: Number(e.target.value) })}
                        className="w-full bg-white/8 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-blue-400/50"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 mb-1">Cor texto</p>
                      <input
                        type="color"
                        value={sel.textColor ?? "#ffffff"}
                        onChange={(e) => upd(sel.id, { textColor: e.target.value })}
                        className="w-10 h-8 rounded cursor-pointer border border-white/10 bg-transparent"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 mb-1">Fundo</p>
                      <input
                        type="color"
                        value={sel.textBg === "transparent" ? "#000000" : (sel.textBg ?? "#000000")}
                        onChange={(e) => upd(sel.id, { textBg: e.target.value })}
                        className="w-10 h-8 rounded cursor-pointer border border-white/10 bg-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Duration (non-fixed, non-video) */}
              {!sel.fixed && sel.mediaType !== "video" && (
                <div>
                  <p className="text-[10px] text-white/30 mb-1.5">Duração (s)</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min={1} max={120}
                      value={sel.durationSeconds ?? 10}
                      onChange={(e) => upd(sel.id, { durationSeconds: Number(e.target.value) })}
                      className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer"
                      style={{ accentColor: "#3b82f6" }}
                    />
                    <span className="text-xs text-white font-mono w-8 text-right">{sel.durationSeconds ?? 10}s</span>
                  </div>
                </div>
              )}

              {/* Visibility */}
              <div className="flex items-center justify-between py-0.5">
                <p className="text-[10px] text-white/60">Visível no preview</p>
                <button
                  onClick={() => upd(sel.id, { visible: !sel.visible })}
                  className={cn("relative w-9 h-5 rounded-full transition-colors", sel.visible ? "bg-blue-500" : "bg-white/15")}
                >
                  <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", sel.visible ? "translate-x-4" : "translate-x-0.5")} />
                </button>
              </div>

              {/* Delete */}
              <button
                onClick={() => del(sel.id)}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-red-400/70 hover:text-red-300 bg-red-500/8 hover:bg-red-500/15 border border-red-500/20 py-2 rounded-lg transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remover camada
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
