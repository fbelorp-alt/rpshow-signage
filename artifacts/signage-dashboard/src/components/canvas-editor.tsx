import { useState, useRef, useCallback, useEffect } from "react";
import {
  Trash2, Lock, Unlock, ChevronUp, ChevronDown,
  Clock, CloudSun, Rss as RssIcon, Globe, Film, Image as ImageIcon,
  AlignLeft, Plus, Eye, EyeOff, Bold, Italic,
  AlignCenter, AlignRight, AlignJustify,
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
  // basic text
  textContent?: string;
  textColor?: string;
  textSize?: number;
  textBg?: string;
  // extended text
  textFont?: string;
  textBold?: boolean;
  textItalic?: boolean;
  textAlign?: "left" | "center" | "right";
  textEffect?: "none" | "shadow" | "outline" | "glow" | "gradient";
  textStrokeColor?: string;
  textShadowColor?: string;
  textGradientTo?: string;
  textBgOpacity?: number;
  textBgRadius?: number;
  textUppercase?: boolean;
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

// ─── Font options ─────────────────────────────────────────────────────────────

const FONTS = [
  // Google Fonts — loaded via index.html
  { label: "Bebas Neue",        value: "'Bebas Neue', Impact, sans-serif" },
  { label: "Anton",             value: "'Anton', Impact, sans-serif" },
  { label: "Oswald",            value: "'Oswald', sans-serif" },
  { label: "Fjalla One",        value: "'Fjalla One', sans-serif" },
  { label: "Exo 2",             value: "'Exo 2', sans-serif" },
  { label: "Montserrat",        value: "'Montserrat', sans-serif" },
  { label: "Poppins",           value: "'Poppins', sans-serif" },
  { label: "Raleway",           value: "'Raleway', sans-serif" },
  { label: "Nunito",            value: "'Nunito', sans-serif" },
  { label: "Open Sans",         value: "'Open Sans', sans-serif" },
  { label: "Roboto",            value: "'Roboto', sans-serif" },
  { label: "Lato",              value: "'Lato', sans-serif" },
  { label: "Ubuntu",            value: "'Ubuntu', sans-serif" },
  { label: "Permanent Marker",  value: "'Permanent Marker', cursive" },
  { label: "Pacifico",          value: "'Pacifico', cursive" },
  // System fonts
  { label: "Impact",            value: "Impact, 'Arial Black', sans-serif" },
  { label: "Arial",             value: "Arial, sans-serif" },
  { label: "Verdana",           value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS",      value: "'Trebuchet MS', sans-serif" },
  { label: "Georgia",           value: "Georgia, serif" },
  { label: "Times New Roman",   value: "'Times New Roman', serif" },
  { label: "Courier New",       value: "'Courier New', monospace" },
  { label: "Tahoma",            value: "Tahoma, sans-serif" },
  { label: "Comic Sans",        value: "'Comic Sans MS', cursive" },
];

// ─── Text presets ─────────────────────────────────────────────────────────────

interface TextPreset {
  label: string;
  emoji: string;
  patch: Partial<CanvasLayer>;
}

const TEXT_PRESETS: TextPreset[] = [
  {
    label: "Título Grande",
    emoji: "T",
    patch: {
      textContent: "TÍTULO PRINCIPAL",
      textFont: "'Bebas Neue', Impact, sans-serif",
      textSize: 96,
      textColor: "#ffffff",
      textBold: true,
      textItalic: false,
      textAlign: "center",
      textUppercase: true,
      textEffect: "shadow",
      textShadowColor: "#000000",
      textBg: "#000000",
      textBgOpacity: 0,
    },
  },
  {
    label: "Subtítulo",
    emoji: "S",
    patch: {
      textContent: "Subtítulo aqui",
      textFont: "'Montserrat', sans-serif",
      textSize: 48,
      textColor: "#ffffff",
      textBold: true,
      textItalic: false,
      textAlign: "center",
      textUppercase: false,
      textEffect: "none",
      textBg: "#000000",
      textBgOpacity: 0,
    },
  },
  {
    label: "Legenda Faixa",
    emoji: "L",
    patch: {
      textContent: "Legenda inferior",
      textFont: "'Open Sans', sans-serif",
      textSize: 28,
      textColor: "#ffffff",
      textBold: false,
      textItalic: false,
      textAlign: "center",
      textUppercase: false,
      textEffect: "none",
      textBg: "#000000",
      textBgOpacity: 75,
      textBgRadius: 0,
    },
  },
  {
    label: "Preço Destaque",
    emoji: "R$",
    patch: {
      textContent: "R$ 99,90",
      textFont: "'Bebas Neue', Impact, sans-serif",
      textSize: 120,
      textColor: "#ff3333",
      textBold: true,
      textItalic: false,
      textAlign: "center",
      textUppercase: false,
      textEffect: "gradient",
      textBg: "#000000",
      textBgOpacity: 0,
    },
  },
  {
    label: "Efeito Fogo",
    emoji: "🔥",
    patch: {
      textContent: "OFERTA QUENTE!",
      textFont: "'Oswald', sans-serif",
      textSize: 72,
      textColor: "#ff4400",
      textBold: true,
      textItalic: false,
      textAlign: "center",
      textUppercase: true,
      textEffect: "glow",
      textShadowColor: "#ff6600",
      textBg: "#000000",
      textBgOpacity: 0,
    },
  },
  {
    label: "Texto Elegante",
    emoji: "✨",
    patch: {
      textContent: "Texto elegante",
      textFont: "'Raleway', sans-serif",
      textSize: 56,
      textColor: "#ffd700",
      textBold: false,
      textItalic: true,
      textAlign: "center",
      textUppercase: false,
      textEffect: "gradient",
      textBg: "#000000",
      textBgOpacity: 0,
    },
  },
  {
    label: "Manuscrito",
    emoji: "✍",
    patch: {
      textContent: "Escrita à mão",
      textFont: "'Permanent Marker', cursive",
      textSize: 60,
      textColor: "#ffffff",
      textBold: false,
      textItalic: false,
      textAlign: "center",
      textUppercase: false,
      textEffect: "shadow",
      textShadowColor: "#333333",
      textBg: "#000000",
      textBgOpacity: 0,
    },
  },
  {
    label: "Neon LED",
    emoji: "💡",
    patch: {
      textContent: "NEON LIGHT",
      textFont: "'Exo 2', sans-serif",
      textSize: 72,
      textColor: "#00ffff",
      textBold: true,
      textItalic: false,
      textAlign: "center",
      textUppercase: true,
      textEffect: "glow",
      textShadowColor: "#00ccff",
      textBg: "#000000",
      textBgOpacity: 0,
    },
  },
];

// ─── Text effect presets ──────────────────────────────────────────────────────

type TextEffect =
  | "none" | "shadow" | "outline" | "glow" | "gradient"
  | "led" | "rainbow" | "fire" | "ice" | "gold" | "chrome";

interface TextStyleResult {
  textStyle: React.CSSProperties;
  wrapperFilter?: string;
}

function buildTextStyle(layer: CanvasLayer): TextStyleResult {
  const effect: TextEffect = (layer.textEffect as TextEffect) ?? "none";
  const color = layer.textColor ?? "#ffffff";
  const shadowColor = layer.textShadowColor ?? "#000000";
  const strokeColor = layer.textStrokeColor ?? "#000000";
  const gradientTo = layer.textGradientTo ?? "#ffcc00";

  const base: React.CSSProperties = {
    fontFamily: layer.textFont ?? "Impact, 'Arial Black', sans-serif",
    fontWeight: layer.textBold !== false ? "bold" : "normal",
    fontStyle: layer.textItalic ? "italic" : "normal",
    textAlign: layer.textAlign ?? "center",
    fontSize: layer.textSize ?? 48,
    lineHeight: 1.15,
    textTransform: layer.textUppercase ? "uppercase" : "none",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  };

  if (effect === "shadow") {
    return { textStyle: { ...base, color, textShadow: `3px 3px 6px ${shadowColor}, 1px 1px 0 ${shadowColor}` } };
  }
  if (effect === "outline") {
    return { textStyle: { ...base, color, WebkitTextStroke: `2px ${strokeColor}` } };
  }
  if (effect === "glow") {
    return {
      textStyle: {
        ...base, color,
        textShadow: `0 0 8px ${shadowColor}, 0 0 20px ${shadowColor}, 0 0 40px ${shadowColor}`,
      },
    };
  }
  if (effect === "gradient") {
    return {
      textStyle: {
        ...base,
        background: `linear-gradient(135deg, ${color} 0%, ${gradientTo} 100%)`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      },
    };
  }

  // ── New effects ────────────────────────────────────────────────────────────

  if (effect === "led") {
    const glowColor = layer.textShadowColor ?? "#4488ff";
    return {
      textStyle: {
        ...base,
        background: `linear-gradient(to bottom, #ffffff 0%, ${color} 35%, ${glowColor} 100%)`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        WebkitTextStroke: `1px rgba(255,255,255,0.4)`,
      },
      wrapperFilter: `drop-shadow(0 0 6px ${glowColor}) drop-shadow(0 0 18px ${glowColor}) drop-shadow(0 0 40px ${glowColor})`,
    };
  }

  if (effect === "rainbow") {
    return {
      textStyle: {
        ...base,
        background: "linear-gradient(to right, #ff0000 0%, #ff8800 20%, #ffee00 40%, #00cc44 55%, #0088ff 75%, #cc00ff 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      },
      wrapperFilter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
    };
  }

  if (effect === "fire") {
    return {
      textStyle: {
        ...base,
        background: "linear-gradient(to top, #cc0000 0%, #ff4400 30%, #ff9900 65%, #ffee00 85%, #ffffff 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      },
      wrapperFilter: "drop-shadow(0 0 8px rgba(255,80,0,0.9)) drop-shadow(0 4px 16px rgba(255,60,0,0.7))",
    };
  }

  if (effect === "ice") {
    return {
      textStyle: {
        ...base,
        background: "linear-gradient(to bottom, #ffffff 0%, #aaeeff 35%, #0099cc 70%, #003366 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      },
      wrapperFilter: "drop-shadow(0 0 8px rgba(0,200,255,0.9)) drop-shadow(0 0 20px rgba(0,150,255,0.6))",
    };
  }

  if (effect === "gold") {
    return {
      textStyle: {
        ...base,
        background: "linear-gradient(to bottom, #ffe066 0%, #ffd700 20%, #cc8800 45%, #ffe566 65%, #aa6600 80%, #ffd700 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        WebkitTextStroke: "1px rgba(150,90,0,0.4)",
      },
      wrapperFilter: "drop-shadow(1px 2px 4px rgba(0,0,0,0.7)) drop-shadow(0 0 10px rgba(255,180,0,0.4))",
    };
  }

  if (effect === "chrome") {
    return {
      textStyle: {
        ...base,
        background: "linear-gradient(to bottom, #ffffff 0%, #cccccc 15%, #888888 35%, #eeeeee 55%, #777777 75%, #ffffff 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        WebkitTextStroke: "1px rgba(255,255,255,0.3)",
      },
      wrapperFilter: "drop-shadow(1px 2px 5px rgba(0,0,0,0.8))",
    };
  }

  return { textStyle: { ...base, color } };
}

function buildBgStyle(layer: CanvasLayer): React.CSSProperties {
  const raw = layer.textBg;
  const opacity = (layer.textBgOpacity ?? 0) / 100;
  const radius = layer.textBgRadius ?? 0;
  if (!raw || raw === "transparent" || opacity === 0) {
    return { background: "transparent", borderRadius: radius };
  }
  // parse hex → rgba
  const hex = raw.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return { background: `rgba(${r},${g},${b},${opacity})`, borderRadius: radius };
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
    x: 10, y: 10, w: 50, h: 20, fixed: true,
    zIndex: count + 1, visible: true, locked: false,
    textContent: "SEU TEXTO AQUI",
    textColor: "#ffffff",
    textSize: 48,
    textFont: "Impact, 'Arial Black', sans-serif",
    textBold: true,
    textItalic: false,
    textAlign: "center",
    textEffect: "shadow",
    textShadowColor: "#000000",
    textStrokeColor: "#000000",
    textGradientTo: "#ffcc00",
    textBg: "#000000",
    textBgOpacity: 0,
    textBgRadius: 8,
    textUppercase: false,
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
  if (t === "youtube" && src) return (
    <iframe src={src} className="w-full h-full pointer-events-none" style={{ border: "none" }} title={layer.mediaName ?? ""} allow="autoplay; fullscreen" />
  );
  if (t === "pluto_tv" && src) return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#0d1b2a] to-[#1a2e44] text-white pointer-events-none overflow-hidden"
      style={{ containerType: "size" }}>
      <div style={{ fontSize: "clamp(12px, 8cqw, 40px)" }}>📺</div>
      <div className="font-bold text-[#00d4ff] text-center px-2" style={{ fontSize: "clamp(6px, 3cqw, 16px)", marginTop: "4px" }}>Pluto TV</div>
      <div className="text-white/50 truncate px-2 text-center" style={{ fontSize: "clamp(4px, 1.5cqw, 10px)" }}>{layer.mediaName ?? ""}</div>
    </div>
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
  if (t === "text") {
    const { textStyle, wrapperFilter } = buildTextStyle(layer);
    const bgStyle = buildBgStyle(layer);
    return (
      <div
        className="w-full h-full flex items-center justify-center pointer-events-none overflow-hidden p-2"
        style={bgStyle}
      >
        <span style={{ ...textStyle, filter: wrapperFilter }}>{layer.textContent ?? "Texto"}</span>
      </div>
    );
  }
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
  if (type === "youtube") return <span className="w-3 h-3 text-red-400 shrink-0 text-[10px] leading-none">▶</span>;
  if (type === "youtube_playlist") return <span className="w-3 h-3 text-red-300 shrink-0 text-[10px] leading-none">≡▶</span>;
  if (type === "pluto_tv") return <span className="w-3 h-3 text-cyan-400 shrink-0 text-[10px] leading-none">📺</span>;
  if (type === "canva") return <span className="w-3 h-3 text-purple-400 shrink-0 text-[10px] leading-none font-bold">C</span>;
  if (type === "google_slides") return <span className="w-3 h-3 text-yellow-400 shrink-0 text-[10px] leading-none font-bold">G</span>;
  if (type === "spotify") return <span className="w-3 h-3 text-green-400 shrink-0 text-[10px] leading-none">♫</span>;
  if (type === "instagram") return <span className="w-3 h-3 text-pink-400 shrink-0 text-[10px] leading-none">Ig</span>;
  if (type === "tiktok") return <span className="w-3 h-3 text-white/70 shrink-0 text-[10px] leading-none">TT</span>;
  if (type === "date") return <span className="w-3 h-3 text-blue-300 shrink-0 text-[10px] leading-none">📅</span>;
  if (type === "qr_code") return <span className="w-3 h-3 text-white/60 shrink-0 text-[10px] leading-none">▦</span>;
  if (type === "clock") return <Clock className="w-3 h-3 text-white/60 shrink-0" />;
  if (type === "weather" || type === "weather_forecast") return <CloudSun className="w-3 h-3 text-sky-400 shrink-0" />;
  if (type === "rss") return <RssIcon className="w-3 h-3 text-orange-400 shrink-0" />;
  if (type === "text") return <AlignLeft className="w-3 h-3 text-yellow-400 shrink-0" />;
  return <ImageIcon className="w-3 h-3 text-emerald-400 shrink-0" />;
}

// ─── Small toggle button ──────────────────────────────────────────────────────

function ToggleBtn({ active, onClick, title, children }: {
  active: boolean; onClick: () => void; title?: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "w-7 h-7 flex items-center justify-center rounded text-xs transition-all border",
        active
          ? "bg-blue-500/25 border-blue-400/50 text-blue-300"
          : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70"
      )}
    >
      {children}
    </button>
  );
}

// ─── Text effect presets UI ───────────────────────────────────────────────────

const EFFECTS: { value: TextEffect; label: string; emoji: string }[] = [
  { value: "none",     label: "Normal",   emoji: "A"  },
  { value: "shadow",   label: "Sombra",   emoji: "🌑" },
  { value: "outline",  label: "Contorno", emoji: "◻"  },
  { value: "glow",     label: "Brilho",   emoji: "✨" },
  { value: "gradient", label: "Degradê",  emoji: "🎨" },
  { value: "led",      label: "LED",      emoji: "💡" },
  { value: "rainbow",  label: "Arco-íris",emoji: "🌈" },
  { value: "fire",     label: "Fogo",     emoji: "🔥" },
  { value: "ice",      label: "Gelo",     emoji: "❄️" },
  { value: "gold",     label: "Dourado",  emoji: "🥇" },
  { value: "chrome",   label: "Cromado",  emoji: "🪞" },
];

// ─── Color presets ────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  "#ffffff", "#000000", "#f87171", "#fb923c",
  "#facc15", "#4ade80", "#22d3ee", "#60a5fa",
  "#a78bfa", "#f472b6", "#ff6600", "#00ffcc",
];

function ColorRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {COLOR_PRESETS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          style={{ background: c, width: 18, height: 18, borderRadius: 3, border: value === c ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.15)" }}
          title={c}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-[18px] h-[18px] rounded cursor-pointer border border-white/10 bg-transparent"
        title="Cor personalizada"
      />
    </div>
  );
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

  const isText = sel?.mediaType === "text";
  const effect: TextEffect = (sel?.textEffect as TextEffect) ?? "none";

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
        <div className="overflow-y-auto" style={{ flex: sel ? "0 0 auto" : "1", maxHeight: sel ? "36%" : undefined }}>
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

              {/* ── TEXT PROPERTIES ─────────────────────────────── */}
              {isText && (
                <div className="space-y-3">

                  {/* Text presets */}
                  <div>
                    <p className="text-[10px] text-white/30 mb-1.5">Estilos de texto</p>
                    <div className="grid grid-cols-2 gap-1">
                      {TEXT_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => upd(sel.id, preset.patch)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded border border-white/10 bg-white/4 hover:bg-white/10 hover:border-white/25 transition-all text-left group"
                        >
                          <span
                            className="text-[11px] font-black w-6 text-center shrink-0 leading-none"
                            style={{
                              fontFamily: preset.patch.textFont as string,
                              color: preset.patch.textColor as string ?? "#ffffff",
                            }}
                          >
                            {preset.emoji}
                          </span>
                          <span className="text-[9px] text-white/60 group-hover:text-white/90 leading-tight truncate">
                            {preset.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="border-t border-white/6 pt-2">
                    <p className="text-[10px] text-white/30 mb-1">Conteúdo</p>
                    <textarea
                      value={sel.textContent ?? ""}
                      onChange={(e) => upd(sel.id, { textContent: e.target.value })}
                      rows={3}
                      className="w-full bg-white/8 border border-white/10 rounded px-2 py-1.5 text-xs text-white resize-none focus:outline-none focus:border-blue-400/50"
                    />
                  </div>

                  {/* Font family — visual picker */}
                  <div>
                    <p className="text-[10px] text-white/30 mb-1">Fonte</p>
                    <div className="relative">
                      <div
                        className="w-full bg-[#1a1f2e] border border-white/15 text-white text-sm rounded px-2 py-1.5 cursor-pointer flex items-center justify-between"
                        style={{ fontFamily: sel.textFont ?? FONTS[0].value }}
                        onClick={(e) => {
                          const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                          if (next) next.style.display = next.style.display === "block" ? "none" : "block";
                        }}
                      >
                        <span>{FONTS.find(f => f.value === (sel.textFont ?? FONTS[0].value))?.label ?? "Fonte"}</span>
                        <span className="text-[9px] text-white/30 ml-1">▼</span>
                      </div>
                      <div
                        className="absolute z-50 left-0 right-0 top-full mt-0.5 max-h-52 overflow-y-auto rounded border border-white/15 bg-[#111320] shadow-xl"
                        style={{ display: "none" }}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          const btn = target.closest("[data-font]") as HTMLElement | null;
                          if (btn) {
                            upd(sel.id, { textFont: btn.dataset.font });
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }
                        }}
                      >
                        {FONTS.map((f) => (
                          <div
                            key={f.value}
                            data-font={f.value}
                            className="px-3 py-2 hover:bg-white/8 cursor-pointer flex items-center gap-2 group"
                          >
                            <span
                              className="text-sm text-white/80 group-hover:text-white flex-1 truncate"
                              style={{ fontFamily: f.value }}
                            >
                              {f.label}
                            </span>
                            <span className="text-[8px] text-white/20 shrink-0" style={{ fontFamily: f.value }}>
                              Abc
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Style row: Bold / Italic / Uppercase / Align */}
                  <div>
                    <p className="text-[10px] text-white/30 mb-1.5">Estilo & Alinhamento</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      <ToggleBtn active={sel.textBold !== false} onClick={() => upd(sel.id, { textBold: !sel.textBold })} title="Negrito">
                        <Bold className="w-3.5 h-3.5" />
                      </ToggleBtn>
                      <ToggleBtn active={!!sel.textItalic} onClick={() => upd(sel.id, { textItalic: !sel.textItalic })} title="Itálico">
                        <Italic className="w-3.5 h-3.5" />
                      </ToggleBtn>
                      <ToggleBtn active={!!sel.textUppercase} onClick={() => upd(sel.id, { textUppercase: !sel.textUppercase })} title="MAIÚSCULAS">
                        <span className="text-[10px] font-bold leading-none">AA</span>
                      </ToggleBtn>
                      <div className="w-px h-5 bg-white/10 mx-0.5" />
                      <ToggleBtn active={(sel.textAlign ?? "center") === "left"} onClick={() => upd(sel.id, { textAlign: "left" })} title="Esquerda">
                        <AlignJustify className="w-3.5 h-3.5" />
                      </ToggleBtn>
                      <ToggleBtn active={(sel.textAlign ?? "center") === "center"} onClick={() => upd(sel.id, { textAlign: "center" })} title="Centro">
                        <AlignCenter className="w-3.5 h-3.5" />
                      </ToggleBtn>
                      <ToggleBtn active={(sel.textAlign ?? "center") === "right"} onClick={() => upd(sel.id, { textAlign: "right" })} title="Direita">
                        <AlignRight className="w-3.5 h-3.5" />
                      </ToggleBtn>
                    </div>
                  </div>

                  {/* Font size */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-white/30">Tamanho</p>
                      <span className="text-[10px] text-white/50 font-mono">{sel.textSize ?? 48}px</span>
                    </div>
                    <input
                      type="range" min={8} max={300} step={2}
                      value={sel.textSize ?? 48}
                      onChange={(e) => upd(sel.id, { textSize: Number(e.target.value) })}
                      className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
                      style={{ accentColor: "#eab308" }}
                    />
                  </div>

                  {/* Text color */}
                  <div>
                    <p className="text-[10px] text-white/30 mb-1.5">Cor do texto</p>
                    <ColorRow value={sel.textColor ?? "#ffffff"} onChange={(c) => upd(sel.id, { textColor: c })} />
                  </div>

                  {/* Divider */}
                  <div className="border-t border-white/6 pt-2">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Efeitos</p>

                    {/* Effect presets — 4 cols to fit 11 options */}
                    <div className="grid grid-cols-4 gap-1 mb-2">
                      {EFFECTS.map((ef) => (
                        <button
                          key={ef.value}
                          onClick={() => upd(sel.id, { textEffect: ef.value as any })}
                          title={ef.label}
                          className={cn(
                            "flex flex-col items-center gap-0.5 py-1.5 rounded border text-center transition-all",
                            effect === ef.value
                              ? "bg-yellow-500/20 border-yellow-400/50 text-yellow-300"
                              : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70"
                          )}
                        >
                          <span className="text-sm leading-none">{ef.emoji}</span>
                          <span className="text-[8px] leading-none truncate w-full text-center px-0.5">{ef.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Shadow / Glow / LED color */}
                    {(effect === "shadow" || effect === "glow" || effect === "led") && (
                      <div className="mb-2">
                        <p className="text-[10px] text-white/30 mb-1.5">
                          {effect === "shadow" ? "Cor da sombra" : "Cor do brilho"}
                        </p>
                        <ColorRow
                          value={sel.textShadowColor ?? (effect === "led" ? "#4488ff" : "#000000")}
                          onChange={(c) => upd(sel.id, { textShadowColor: c })}
                        />
                      </div>
                    )}

                    {/* Outline color */}
                    {effect === "outline" && (
                      <div className="mb-2">
                        <p className="text-[10px] text-white/30 mb-1.5">Cor do contorno</p>
                        <ColorRow
                          value={sel.textStrokeColor ?? "#000000"}
                          onChange={(c) => upd(sel.id, { textStrokeColor: c })}
                        />
                      </div>
                    )}

                    {/* Gradient second color */}
                    {effect === "gradient" && (
                      <div className="mb-2">
                        <p className="text-[10px] text-white/30 mb-1.5">Segunda cor do degradê</p>
                        <ColorRow
                          value={sel.textGradientTo ?? "#ffcc00"}
                          onChange={(c) => upd(sel.id, { textGradientTo: c })}
                        />
                      </div>
                    )}

                    {/* Info for fixed-color effects */}
                    {(effect === "rainbow" || effect === "fire" || effect === "ice" || effect === "gold" || effect === "chrome") && (
                      <p className="text-[9px] text-white/25 mb-2 italic">
                        {effect === "rainbow" && "Arco-íris automático — cor do texto ignorada"}
                        {effect === "fire"    && "Gradiente vermelho→laranja→amarelo automático"}
                        {effect === "ice"     && "Gradiente azul gelo automático + brilho ciano"}
                        {effect === "gold"    && "Gradiente dourado metálico automático"}
                        {effect === "chrome"  && "Gradiente cromado metálico automático"}
                      </p>
                    )}
                  </div>

                  {/* Background */}
                  <div className="border-t border-white/6 pt-2 space-y-2">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Fundo</p>

                    <div>
                      <p className="text-[10px] text-white/30 mb-1.5">Cor do fundo</p>
                      <ColorRow value={sel.textBg === "transparent" ? "#000000" : (sel.textBg ?? "#000000")} onChange={(c) => upd(sel.id, { textBg: c })} />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-white/30">Opacidade do fundo</p>
                        <span className="text-[10px] text-white/50 font-mono">{sel.textBgOpacity ?? 0}%</span>
                      </div>
                      <input
                        type="range" min={0} max={100} step={5}
                        value={sel.textBgOpacity ?? 0}
                        onChange={(e) => upd(sel.id, { textBgOpacity: Number(e.target.value) })}
                        className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
                        style={{ accentColor: "#6366f1" }}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-white/30">Arredondamento</p>
                        <span className="text-[10px] text-white/50 font-mono">{sel.textBgRadius ?? 0}px</span>
                      </div>
                      <input
                        type="range" min={0} max={60} step={2}
                        value={sel.textBgRadius ?? 0}
                        onChange={(e) => upd(sel.id, { textBgRadius: Number(e.target.value) })}
                        className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
                        style={{ accentColor: "#6366f1" }}
                      />
                    </div>
                  </div>

                </div>
              )}
              {/* ── END TEXT PROPERTIES ─────────────────────────── */}

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
