import { useState, useRef, useCallback, useEffect } from "react";
import { toPng } from "html-to-image";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  useRequestUploadUrl,
  useCreateMedia,
  useListMedia,
  getListMediaQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, Type, ImageIcon, Trash2, Bold, Italic,
  AlignLeft, AlignCenter, AlignRight, Save, Layers,
  Loader2, Palette, RotateCcw, Square, CircleDot, Copy,
  BringToFront, SendToBack, Lock, Unlock, Download,
  AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
  AlignStartVertical, AlignEndVertical, AlignStartHorizontal, AlignEndHorizontal,
  Wand2, Film, Play, Pause, Images, Plus, X, Redo2,
  ZoomIn, ZoomOut, Move, Sliders, Sparkles, Sun,
} from "lucide-react";

// ── Nano-id helper ─────────────────────────────────────────────────────────────
const nid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExportRes {
  label: string;
  w: number;
  h: number;
  custom?: boolean;
}

// V3: expanded transition union
type SceneTransition =
  | "none" | "fade"
  | "slideLeft" | "slideRight" | "slideUp" | "slideDown"
  | "zoom"
  | "wipeLeft" | "wipeRight"
  | "circle"
  | "colorBlock";

// V3: expanded animation union
type AnimationType =
  | "none" | "fadeIn"
  | "slideLeft" | "slideRight" | "slideUp" | "slideDown"
  | "zoomIn" | "zoomOut"
  | "bounce"
  | "pop"
  | "blurIn"
  | "typewriter";

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface ImgFilter {
  brightness?: number;   // 50–150, default 100
  contrast?: number;
  saturate?: number;
  preset?: "none" | "natural" | "warm" | "cold";
}

interface CanvasElem {
  id: string;
  type: "text" | "image" | "rect" | "ellipse";
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  text: string;
  src: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textDecoration: "none" | "underline";
  textAlign: "left" | "center" | "right";
  letterSpacing: number;
  lineHeight: number;
  shadow: boolean;
  bgColor: string;
  opacity: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  borderRadius: number;
  locked: boolean;
  animation?: AnimationType;
  animDelay?: number;
  animDuration?: number;    // V3: 0.3–2s
  animLoop?: boolean;       // V3: loop in preview
  flipX?: boolean;          // V3
  flipY?: boolean;          // V3
  imgFilter?: ImgFilter;    // V3: only for type===image
  // Text outline (V2)
  textStrokeColor?: string;
  textStrokeWidth?: number;
}

interface Scene {
  id: string;          // V2 — stable key
  bg: string;
  bgImage: string;
  bgVideo?: string;
  elements: CanvasElem[];
  duration?: number;
  transition?: SceneTransition;  // V3: expanded
  transitionMs?: number;         // V3: now free number 300–2000
  transitionDir?: "left" | "right" | "up" | "down"; // V3
  transitionColor?: string;      // V3: for colorBlock
  kenBurns?: "off" | "zoomIn" | "zoomOut" | "panLeft" | "panRight"; // V3: +pan
  kenBurnsIntensity?: 1.05 | 1.08 | 1.12;
  mediaFit?: "cover" | "contain" | "fill";
  mediaPosition?: "center" | "top" | "bottom" | "left" | "right";
  mediaZoom?: number;
  mediaPanX?: number;
  mediaPanY?: number;
}

interface ProjectConfig {
  name: string;
  res: ExportRes;
  durationSeconds: number;
}

interface HistorySnap {
  scenes: Scene[];
  idx: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RESOLUTIONS: ExportRes[] = [
  { label: "Full HD — 1920 × 1080", w: 1920, h: 1080 },
  { label: "HD — 1280 × 720", w: 1280, h: 720 },
  { label: "4K UHD — 3840 × 2160", w: 3840, h: 2160 },
  { label: "Vertical Full HD — 1080 × 1920", w: 1080, h: 1920 },
  { label: "Vertical HD — 720 × 1280", w: 720, h: 1280 },
  { label: "Quadrado — 1080 × 1080", w: 1080, h: 1080 },
  { label: "LED — 960 × 540", w: 960, h: 540 },
  { label: "LED — 800 × 600", w: 800, h: 600 },
  { label: "LED — 640 × 480", w: 640, h: 480 },
  { label: "Personalizado", w: 0, h: 0, custom: true },
];

const DURATION_OPTIONS = [3, 5, 8, 10, 15, 20, 30];

const FONTS = [
  { label: "Padrão (Inter)", value: "Inter, sans-serif" },
  { label: "Montserrat", value: "Montserrat, sans-serif" },
  { label: "Oswald", value: "Oswald, sans-serif" },
  { label: "Poppins", value: "Poppins, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Bebas Neue", value: "'Bebas Neue', sans-serif" },
  { label: "Anton", value: "Anton, sans-serif" },
  { label: "Raleway", value: "Raleway, sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Impact", value: "Impact, sans-serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
];

const BG_PRESETS = [
  { label: "Noite", value: "linear-gradient(135deg,#0f172a,#1e3a5f)" },
  { label: "Promoção", value: "linear-gradient(135deg,#f97316,#dc2626)" },
  { label: "Frescor", value: "linear-gradient(135deg,#0891b2,#1d4ed8)" },
  { label: "Sucesso", value: "linear-gradient(135deg,#059669,#0891b2)" },
  { label: "Premium", value: "linear-gradient(135deg,#4c1d95,#1e1b4b)" },
  { label: "Sol", value: "linear-gradient(135deg,#f59e0b,#f97316)" },
  { label: "Rosa", value: "linear-gradient(135deg,#be185d,#7c3aed)" },
  { label: "Cinza", value: "linear-gradient(135deg,#1f2937,#374151)" },
  { label: "Preto", value: "#111111" },
  { label: "Branco", value: "#ffffff" },
];

const GRADIENT_PRESETS = [
  { label: "Noite Azul",   value: "linear-gradient(135deg,#0f172a,#1e3a5f)" },
  { label: "Fogo",         value: "linear-gradient(135deg,#f97316,#dc2626)" },
  { label: "Oceano",       value: "linear-gradient(135deg,#0891b2,#1d4ed8)" },
  { label: "Floresta",     value: "linear-gradient(135deg,#059669,#0891b2)" },
  { label: "Roxo Escuro",  value: "linear-gradient(135deg,#4c1d95,#1e1b4b)" },
  { label: "Âmbar",        value: "linear-gradient(135deg,#f59e0b,#f97316)" },
  { label: "Rosa Roxo",    value: "linear-gradient(135deg,#be185d,#7c3aed)" },
  { label: "Grafite",      value: "linear-gradient(135deg,#1f2937,#374151)" },
  { label: "Aurora",       value: "linear-gradient(135deg,#6366f1,#ec4899)" },
  { label: "Menta",        value: "linear-gradient(135deg,#10b981,#3b82f6)" },
  { label: "Nascer Sol",   value: "linear-gradient(135deg,#f43f5e,#f97316,#fbbf24)" },
  { label: "Galáxia",      value: "linear-gradient(135deg,#0f0c29,#302b63,#24243e)" },
  { label: "Cyber",        value: "linear-gradient(135deg,#00f260,#0575e6)" },
  { label: "Vinho",        value: "linear-gradient(135deg,#3d0000,#8b0000)" },
  { label: "Gelo",         value: "linear-gradient(135deg,#e0f2fe,#bfdbfe)" },
  { label: "Carvão",       value: "linear-gradient(135deg,#111111,#2d2d2d)" },
];

const TEXT_COLORS = [
  "#ffffff", "#f0f4ff", "#fef3c7", "#fde68a",
  "#fdba74", "#f87171", "#34d399", "#60a5fa",
  "#111111", "#1e293b", "#dc2626", "#16a34a",
];

// V3: expanded animation options
const ANIM_OPTIONS: { label: string; value: AnimationType; emoji: string }[] = [
  { label: "Nenhuma",      value: "none",       emoji: "—" },
  { label: "Fade In",      value: "fadeIn",     emoji: "◌" },
  { label: "Slide ←",      value: "slideLeft",  emoji: "←" },
  { label: "Slide →",      value: "slideRight", emoji: "→" },
  { label: "Slide ↑",      value: "slideUp",    emoji: "↑" },
  { label: "Slide ↓",      value: "slideDown",  emoji: "↓" },
  { label: "Zoom In",      value: "zoomIn",     emoji: "⊕" },
  { label: "Zoom Out",     value: "zoomOut",    emoji: "⊖" },
  { label: "Bounce",       value: "bounce",     emoji: "⤵" },
  { label: "Pop",          value: "pop",        emoji: "💥" },
  { label: "Blur In",      value: "blurIn",     emoji: "✳" },
  { label: "Máquina",      value: "typewriter", emoji: "⌨" },
];

// V3: transition presets with labels + emoji
const TRANS_PRESETS: { value: SceneTransition; label: string; icon: string }[] = [
  { value: "none",       label: "Corte",     icon: "✂" },
  { value: "fade",       label: "Fade",      icon: "◌" },
  { value: "slideLeft",  label: "Slide ←",   icon: "←" },
  { value: "slideRight", label: "Slide →",   icon: "→" },
  { value: "slideUp",    label: "Slide ↑",   icon: "↑" },
  { value: "slideDown",  label: "Slide ↓",   icon: "↓" },
  { value: "zoom",       label: "Zoom",      icon: "⊕" },
  { value: "wipeLeft",   label: "Wipe ←",    icon: "▶" },
  { value: "wipeRight",  label: "Wipe →",    icon: "◀" },
  { value: "circle",     label: "Círculo",   icon: "●" },
  { value: "colorBlock", label: "Bloco Cor", icon: "■" },
];

// Badge label for transition in timeline
const TRANS_BADGE: Record<SceneTransition, string> = {
  none: "✂", fade: "F", slideLeft: "←", slideRight: "→",
  slideUp: "↑", slideDown: "↓", zoom: "Z",
  wipeLeft: "W←", wipeRight: "W→", circle: "◉", colorBlock: "■",
};

const DEFAULT_SCENE = (): Scene => ({
  id: nid(),
  bg: "linear-gradient(135deg,#0f172a,#1e3a5f)",
  bgImage: "",
  bgVideo: "",
  elements: [],
  transition: "fade",
  transitionMs: 500,
  transitionColor: "#0d1117",
  kenBurns: "off",
  kenBurnsIntensity: 1.08,
  mediaFit: "cover",
  mediaPosition: "center",
  mediaZoom: 100,
  mediaPanX: 0,
  mediaPanY: 0,
});

function makePhotoScene(imageUrl: string): Scene {
  return { ...DEFAULT_SCENE(), bgImage: imageUrl, bg: "#000000", duration: 4 };
}

function newElem(type: CanvasElem["type"]): CanvasElem {
  const isShape = type === "rect" || type === "ellipse";
  return {
    id: nid(),
    type,
    x: 50, y: 50,
    w: isShape ? 30 : 70,
    h: isShape ? 20 : 0,
    rotation: 0,
    text: type === "text" ? "Novo texto" : "",
    src: "",
    fontSize: 5,
    fontFamily: "Inter, sans-serif",
    color: "#ffffff",
    fontWeight: "normal",
    fontStyle: "normal",
    textDecoration: "none",
    textAlign: "center",
    letterSpacing: 0,
    lineHeight: 1.25,
    shadow: false,
    bgColor: "",
    opacity: 1,
    fillColor: isShape ? "#3b82f6" : "",
    strokeColor: "#ffffff",
    strokeWidth: 0,
    borderRadius: type === "ellipse" ? 50 : 0,
    locked: false,
    animation: "none",
    animDelay: 0,
    animDuration: 0.75,
    animLoop: false,
    flipX: false,
    flipY: false,
    textStrokeColor: "#000000",
    textStrokeWidth: 0,
  };
}

// V3: build CSS filter string from ImgFilter
function buildElemFilter(f?: ImgFilter): string {
  if (!f) return "";
  const parts: string[] = [];
  if (f.preset === "warm")    parts.push("sepia(25%) saturate(130%) brightness(105%)");
  if (f.preset === "cold")    parts.push("hue-rotate(20deg) saturate(85%) brightness(98%)");
  if (f.preset === "natural") parts.push("contrast(108%) brightness(103%) saturate(105%)");
  if (f.brightness !== undefined && f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
  if (f.contrast  !== undefined && f.contrast  !== 100)  parts.push(`contrast(${f.contrast}%)`);
  if (f.saturate  !== undefined && f.saturate  !== 100)  parts.push(`saturate(${f.saturate}%)`);
  return parts.join(" ");
}

// ── Template data ──────────────────────────────────────────────────────────────
const TEMPLATES: { name: string; emoji: string; scene: Omit<Scene, "id"> }[] = [
  {
    name: "Promoção", emoji: "🔥",
    scene: {
      bg: "linear-gradient(135deg,#f97316,#dc2626)", bgImage: "", transition: "fade", transitionMs: 500, transitionColor: "#0d1117", kenBurns: "off", kenBurnsIntensity: 1.08, mediaFit: "cover", mediaPosition: "center", mediaZoom: 100, mediaPanX: 0, mediaPanY: 0,
      elements: [
        { id: "a1", type: "text", src: "", x: 50, y: 22, w: 85, h: 0, rotation: 0, text: "🔥 PROMOÇÃO ESPECIAL", fontSize: 8, fontFamily: "Oswald, sans-serif", color: "#ffffff", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 2, lineHeight: 1.2, shadow: true, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false, animation: "pop", animDelay: 0, animDuration: 0.75, animLoop: false },
        { id: "a2", type: "text", src: "", x: 50, y: 44, w: 80, h: 0, rotation: 0, text: "ATÉ 50% DE DESCONTO", fontSize: 6, fontFamily: "Oswald, sans-serif", color: "#fff7ed", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 3, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false, animation: "slideUp", animDelay: 0.2, animDuration: 0.75, animLoop: false },
        { id: "a3", type: "text", src: "", x: 50, y: 65, w: 72, h: 0, rotation: 0, text: "Oferta por tempo limitado. Aproveite já!", fontSize: 3.5, fontFamily: "Inter, sans-serif", color: "#ffedd5", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.3, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false, animation: "fadeIn", animDelay: 0.4, animDuration: 0.75, animLoop: false },
      ],
    },
  },
  {
    name: "Destaque", emoji: "⭐",
    scene: {
      bg: "linear-gradient(135deg,#1e3a5f,#1e1b4b)", bgImage: "", transition: "fade", transitionMs: 500, transitionColor: "#0d1117", kenBurns: "off", kenBurnsIntensity: 1.08, mediaFit: "cover", mediaPosition: "center", mediaZoom: 100, mediaPanX: 0, mediaPanY: 0,
      elements: [
        { id: "b1", type: "text", src: "", x: 50, y: 20, w: 80, h: 0, rotation: 0, text: "⭐ NOVIDADE", fontSize: 4, fontFamily: "Montserrat, sans-serif", color: "#fbbf24", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 4, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false, animation: "blurIn", animDelay: 0, animDuration: 0.75, animLoop: false },
        { id: "b2", type: "text", src: "", x: 50, y: 42, w: 88, h: 0, rotation: 0, text: "Conheça o Nosso Produto", fontSize: 7, fontFamily: "Montserrat, sans-serif", color: "#f0f4ff", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.2, shadow: true, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false, animation: "zoomIn", animDelay: 0.3, animDuration: 0.75, animLoop: false },
        { id: "b3", type: "text", src: "", x: 50, y: 64, w: 70, h: 0, rotation: 0, text: "Qualidade e inovação para você.", fontSize: 3.5, fontFamily: "Raleway, sans-serif", color: "#93c5fd", fontWeight: "normal", fontStyle: "italic", textDecoration: "none", textAlign: "center", letterSpacing: 1, lineHeight: 1.3, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false, animation: "slideLeft", animDelay: 0.5, animDuration: 0.75, animLoop: false },
      ],
    },
  },
  {
    name: "Cardápio", emoji: "🍽️",
    scene: {
      bg: "linear-gradient(135deg,#1c0a00,#3b1200)", bgImage: "", transition: "wipeLeft", transitionMs: 500, transitionColor: "#0d1117", kenBurns: "off", kenBurnsIntensity: 1.08, mediaFit: "cover", mediaPosition: "center", mediaZoom: 100, mediaPanX: 0, mediaPanY: 0,
      elements: [
        { id: "c1", type: "text", src: "", x: 50, y: 15, w: 80, h: 0, rotation: 0, text: "🍽️ CARDÁPIO DO DIA", fontSize: 5.5, fontFamily: "Oswald, sans-serif", color: "#fbbf24", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 3, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false, animation: "slideDown", animDelay: 0, animDuration: 0.75, animLoop: false },
        { id: "c2", type: "text", src: "", x: 50, y: 38, w: 75, h: 0, rotation: 0, text: "Prato Principal\nArroz, feijão e frango grelhado", fontSize: 4, fontFamily: "Inter, sans-serif", color: "#fef3c7", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.5, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false, animation: "fadeIn", animDelay: 0.3, animDuration: 0.75, animLoop: false },
        { id: "c3", type: "text", src: "", x: 50, y: 70, w: 60, h: 0, rotation: 0, text: "R$ 29,90", fontSize: 8, fontFamily: "Oswald, sans-serif", color: "#34d399", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 1, lineHeight: 1.2, shadow: true, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false, animation: "pop", animDelay: 0.6, animDuration: 0.75, animLoop: false },
      ],
    },
  },
  {
    name: "Evento", emoji: "📅",
    scene: {
      bg: "linear-gradient(135deg,#4c1d95,#6366f1)", bgImage: "", transition: "circle", transitionMs: 800, transitionColor: "#4c1d95", kenBurns: "off", kenBurnsIntensity: 1.08, mediaFit: "cover", mediaPosition: "center", mediaZoom: 100, mediaPanX: 0, mediaPanY: 0,
      elements: [
        { id: "d1", type: "text", src: "", x: 50, y: 18, w: 80, h: 0, rotation: 0, text: "📅 EVENTO ESPECIAL", fontSize: 4.5, fontFamily: "Montserrat, sans-serif", color: "#e0e7ff", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 3, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false, animation: "typewriter", animDelay: 0, animDuration: 1.2, animLoop: false },
        { id: "d2", type: "text", src: "", x: 50, y: 42, w: 88, h: 0, rotation: 0, text: "Nome do Evento\nData e Local", fontSize: 6, fontFamily: "Poppins, sans-serif", color: "#ffffff", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.4, shadow: true, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false, animation: "zoomIn", animDelay: 0.5, animDuration: 0.75, animLoop: false },
        { id: "d3", type: "text", src: "", x: 50, y: 72, w: 70, h: 0, rotation: 0, text: "Inscreva-se agora!", fontSize: 3.5, fontFamily: "Inter, sans-serif", color: "#c7d2fe", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 1, lineHeight: 1.3, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false, animation: "slideUp", animDelay: 0.8, animDuration: 0.75, animLoop: false },
      ],
    },
  },
];

const BLANK_TEMPLATE = { name: "Em branco", emoji: "⬜", scene: { bg: "linear-gradient(135deg,#0f172a,#1e3a5f)", bgImage: "", elements: [] as CanvasElem[], transition: "fade" as SceneTransition, transitionMs: 500, transitionColor: "#0d1117", kenBurns: "off" as const, kenBurnsIntensity: 1.08 as const, mediaFit: "cover" as const, mediaPosition: "center" as const, mediaZoom: 100, mediaPanX: 0, mediaPanY: 0 } };
const ALL_TEMPLATES = [BLANK_TEMPLATE, ...TEMPLATES];

// ── ColorDot ──────────────────────────────────────────────────────────────────
function ColorDot({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn("w-6 h-6 rounded-full border-2 transition-all hover:scale-110 shrink-0", selected ? "border-primary" : "border-transparent")}
      style={{ background: color }} />
  );
}

// ── Template preview ──────────────────────────────────────────────────────────
function TemplatePreview({ template }: { template: typeof ALL_TEMPLATES[0] }) {
  const bg = template.scene.bg;
  const previews: Record<string, React.ReactNode> = {
    "Promoção": (
      <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 px-2" style={{ background: bg }}>
        <div className="text-[8px] font-black text-white tracking-wide">🔥 PROMOÇÃO ESPECIAL</div>
        <div className="text-[11px] font-black text-orange-200">50% OFF</div>
        <div className="text-[6px] text-orange-100/70">Oferta por tempo limitado</div>
      </div>
    ),
    "Destaque": (
      <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 px-2" style={{ background: bg }}>
        <div className="text-[6px] font-bold text-yellow-400 tracking-widest">⭐ NOVIDADE</div>
        <div className="text-[10px] font-bold text-blue-100 text-center">Conheça o Produto</div>
        <div className="text-[6px] text-blue-300 italic">Qualidade e inovação</div>
      </div>
    ),
    "Cardápio": (
      <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 px-2" style={{ background: bg }}>
        <div className="text-[6px] font-bold text-yellow-400 tracking-wider">🍽️ CARDÁPIO</div>
        <div className="text-[8px] text-amber-100 text-center leading-tight">Prato Principal</div>
        <div className="text-[11px] font-black text-emerald-400">R$ 29,90</div>
      </div>
    ),
    "Evento": (
      <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 px-2" style={{ background: bg }}>
        <div className="text-[6px] font-bold text-indigo-200 tracking-wider">📅 EVENTO</div>
        <div className="text-[9px] font-bold text-white text-center leading-tight">Nome do Evento</div>
        <div className="text-[6px] text-indigo-300">Inscreva-se!</div>
      </div>
    ),
  };
  return (
    <div className="w-full h-full overflow-hidden" style={{ background: bg }}>
      {previews[template.name] ?? (
        <div className="w-full h-full flex items-center justify-center" style={{ background: bg }}>
          <span className="text-2xl">{template.emoji}</span>
        </div>
      )}
    </div>
  );
}

// ── NewProjectScreen ──────────────────────────────────────────────────────────
function NewProjectScreen({
  onStart,
  onQuickVideo,
}: {
  onStart: (cfg: ProjectConfig, scene: Scene) => void;
  onQuickVideo: (cfg: ProjectConfig, scenes: Scene[]) => void;
}) {
  const [selectedTpl, setSelectedTpl] = useState<typeof ALL_TEMPLATES[0] | null>(null);
  const [name, setName] = useState("");
  const [resIdx, setResIdx] = useState(0);
  const [customW, setCustomW] = useState(1920);
  const [customH, setCustomH] = useState(1080);
  const [durationSeconds, setDurationSeconds] = useState(15);

  const res = RESOLUTIONS[resIdx];
  const isCustom = !!res.custom;
  const finalRes = isCustom ? { label: `Personalizado — ${customW}×${customH}`, w: customW, h: customH } : res;

  function handleSelectTemplate(tpl: typeof ALL_TEMPLATES[0]) {
    setSelectedTpl(tpl);
    if (!name) setName(tpl.name === "Em branco" ? `Mídia ${new Date().toLocaleDateString("pt-BR")}` : tpl.name);
  }

  function handleCreate() {
    if (!selectedTpl || !name.trim()) return;
    if (isCustom && (customW < 100 || customH < 100)) return;
    const scene: Scene = { ...DEFAULT_SCENE(), ...selectedTpl.scene };
    onStart({ name: name.trim(), res: finalRes, durationSeconds }, scene);
  }

  function handleQuickVideo() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files ?? []).slice(0, 12);
      if (files.length < 1) return;
      const projectName = name.trim() || `Vídeo ${new Date().toLocaleDateString("pt-BR")}`;
      const cfg: ProjectConfig = { name: projectName, res: finalRes, durationSeconds };
      const scenes: Scene[] = [];
      let loaded = 0;
      files.forEach((file, idx) => {
        const url = URL.createObjectURL(file);
        scenes[idx] = makePhotoScene(url);
        loaded++;
        if (loaded === files.length) onQuickVideo(cfg, scenes);
      });
    };
    input.click();
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
        <Link href="/media">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-8 text-xs">
            <ChevronLeft className="w-3.5 h-3.5" /> Biblioteca
          </Button>
        </Link>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <Film className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm text-white">Mídia Edit V3</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-auto">
        <div className="px-8 pt-8 pb-6">
          <h1 className="text-2xl font-bold text-white mb-1">
            {selectedTpl ? `Template: ${selectedTpl.emoji} ${selectedTpl.name}` : "Escolha um template"}
          </h1>
          <p className="text-sm text-white/40">
            {selectedTpl ? "Configure as opções abaixo e clique em Criar Projeto." : "Clique em um template para começar. Você pode editar tudo depois."}
          </p>
        </div>
        <div className="px-8 pb-2">
          <button onClick={handleQuickVideo}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-cyan-500/40 hover:border-cyan-400/70 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all text-left group">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/25 transition-colors">
              <Images className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <div className="font-semibold text-white text-sm flex items-center gap-2">
                📸 Vídeo rápido (fotos)
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-medium">NOVO</span>
              </div>
              <div className="text-xs text-white/40 mt-0.5">Selecione 2–12 fotos → cria 1 cena por foto com transições, duração e Ken Burns</div>
            </div>
          </button>
        </div>
        <div className="px-8 pb-4">
          <p className="text-xs text-white/30 mb-3">Ou use um template:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {ALL_TEMPLATES.map(tpl => {
              const isSelected = selectedTpl?.name === tpl.name;
              return (
                <button key={tpl.name} onClick={() => handleSelectTemplate(tpl)}
                  className={cn("group relative rounded-xl overflow-hidden border-2 transition-all duration-200 text-left",
                    isSelected ? "border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.3)]" : "border-white/5 hover:border-white/20")}>
                  <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                    <div className="absolute inset-0"><TemplatePreview template={tpl} /></div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                    <div className={cn("absolute inset-0 bg-blue-500/0 flex items-center justify-center transition-all", !isSelected && "group-hover:bg-blue-500/10")}>
                      {!isSelected && <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full">Usar este</div>}
                    </div>
                  </div>
                  <div className={cn("px-2.5 py-2 transition-colors", isSelected ? "bg-blue-500/10" : "bg-white/3 group-hover:bg-white/5")}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{tpl.emoji}</span>
                      <span className={cn("text-xs font-medium truncate", isSelected ? "text-blue-300" : "text-white/70")}>{tpl.name}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className={cn("mx-8 mb-8 rounded-2xl border border-white/10 bg-white/4 backdrop-blur-sm transition-all duration-300 overflow-hidden",
          selectedTpl ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none")}>
          <div className="px-6 py-5 border-b border-white/5 flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-sm text-white">Configurar projeto</span>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Nome do projeto</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Promoção Julho 2026"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-blue-500 h-9"
                  onKeyDown={e => { if (e.key === "Enter") handleCreate(); }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Resolução</Label>
                <Select value={String(resIdx)} onValueChange={v => setResIdx(Number(v))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOLUTIONS.map((r, i) => <SelectItem key={i} value={String(i)} className="text-xs">{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {isCustom && (
                  <div className="flex gap-2 mt-1">
                    <Input type="number" value={customW} onChange={e => setCustomW(Math.max(100, parseInt(e.target.value) || 100))} placeholder="Largura" className="bg-white/5 border-white/10 text-white h-8 text-xs" />
                    <span className="text-white/30 flex items-center text-sm">×</span>
                    <Input type="number" value={customH} onChange={e => setCustomH(Math.max(100, parseInt(e.target.value) || 100))} placeholder="Altura" className="bg-white/5 border-white/10 text-white h-8 text-xs" />
                  </div>
                )}
                {!isCustom && <p className="text-[10px] text-white/25 font-mono">{res.w} × {res.h} px</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Duração (MP4)</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {DURATION_OPTIONS.map(d => (
                    <button key={d} onClick={() => setDurationSeconds(d)}
                      className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                        durationSeconds === d ? "border-blue-500 bg-blue-500/15 text-blue-300" : "border-white/10 text-white/40 hover:border-white/25 hover:text-white/60")}>
                      {d}s
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6 pt-5 border-t border-white/5">
              <Button onClick={handleCreate} disabled={!name.trim() || (isCustom && (customW < 100 || customH < 100))}
                className="bg-blue-600 hover:bg-blue-500 text-white h-10 px-6 font-semibold gap-2 text-sm">
                <Wand2 className="w-4 h-4" /> Criar Projeto
              </Button>
              <div className="text-xs text-white/25">
                Template: <span className="text-white/40">{selectedTpl?.emoji} {selectedTpl?.name}</span>
                {!isCustom && <> · Canvas: <span className="font-mono text-white/40">{res.w}×{res.h}</span></>}
                {" "}· Saída: <span className="text-white/40">MP4 {durationSeconds}s</span>
              </div>
            </div>
          </div>
        </div>
        {!selectedTpl && (
          <div className="flex-1 flex items-center justify-center pb-16">
            <div className="flex flex-col items-center gap-2 text-white/20">
              <Film className="w-8 h-8" />
              <p className="text-sm">Selecione um template acima para continuar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Editor ────────────────────────────────────────────────────────────────

export default function BannerEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const requestUploadUrl = useRequestUploadUrl();
  const createMedia = useCreateMedia();
  const { data: mediaLibrary } = useListMedia();

  const [project, setProject] = useState<ProjectConfig | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([DEFAULT_SCENE()]);

  // P0: stale-closure-safe scene index
  const [currentSceneIdxState, setCurrentSceneIdxState] = useState(0);
  const currentSceneIdxRef = useRef(0);
  const setCurrentSceneIdx = useCallback((v: number | ((prev: number) => number)) => {
    setCurrentSceneIdxState(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      currentSceneIdxRef.current = next;
      return next;
    });
  }, []);
  const currentSceneIdx = currentSceneIdxState;

  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bgTab, setBgTab] = useState<"presets" | "gradients" | "color" | "image" | "video">("presets");
  const [bgColorInput, setBgColorInput] = useState("#1e3a5f");

  // Undo/redo
  const [undoStack, setUndoStack] = useState<HistorySnap[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnap[]>([]);

  const [previewing, setPreviewing] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Panel tabs
  type RightTab = "cena" | "texto" | "transicao" | "animacao";
  const [rightTab, setRightTab] = useState<RightTab>("cena");
  type LeftTab = "midia" | "elementos" | "fundo" | "camadas";
  const [leftTab, setLeftTab] = useState<LeftTab>("elementos");

  // Snap guides
  const [snapGuide, setSnapGuide] = useState<{ x?: boolean; y?: boolean }>({});

  // Scene transition CSS overlay
  const [sceneKey, setSceneKey] = useState(0);
  const [transitionAnim, setTransitionAnim] = useState<string>("");

  // V3: colorBlock overlay (2-phase fill + reveal)
  const [colorBlockOverlay, setColorBlockOverlay] = useState<{ opacity: number; color: string }>({ opacity: 0, color: "#0d1117" });

  // V3: canvas view zoom (50–200%, visual only)
  const [canvasViewZoom, setCanvasViewZoom] = useState(100);

  // V3: timeline transition popover (index of gap = scene i → i+1)
  const [transPop, setTransPop] = useState<number | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasH, setCanvasH] = useState(0);

  const dragging = useRef<{
    elemId: string;
    startClientX: number; startClientY: number;
    elemX: number; elemY: number;
  } | null>(null);

  const resizing = useRef<{
    elemId: string;
    handle: ResizeHandle;
    startClientX: number; startClientY: number;
    startW: number; startH: number;
    startX: number; startY: number;
    canvasRect: DOMRect;
  } | null>(null);

  const rotating = useRef<{
    elemId: string;
    centerX: number; centerY: number;
    startAngle: number; startRotation: number;
  } | null>(null);

  // V2: timeline pointer-drag
  const timelineDragRef = useRef<{ fromIdx: number; startX: number } | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // P0: safe setScene
  const setScene = useCallback((updater: Scene | ((prev: Scene) => Scene)) => {
    setScenes(prev => {
      const idx = currentSceneIdxRef.current;
      if (!prev[idx]) return prev;
      const current = prev[idx];
      const next = typeof updater === "function" ? updater(current) : updater;
      if (!next || !Array.isArray(next.elements)) return prev;
      return prev.map((s, i) => i === idx ? next : s);
    });
  }, []);

  const scene = scenes[currentSceneIdx] ?? scenes[0];

  // Load Google Fonts
  useEffect(() => {
    const id = "media-edit-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&family=Oswald:wght@400;700&family=Poppins:wght@400;700&family=Roboto:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Bebas+Neue&family=Anton&family=Raleway:wght@400;700&display=swap";
    document.head.appendChild(link);
  }, []);

  // Track canvas height
  useEffect(() => {
    if (!canvasRef.current) return;
    const ro = new ResizeObserver(entries => setCanvasH(entries[0].contentRect.height));
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [project]);

  // Close transition popover on click-outside
  useEffect(() => {
    if (transPop === null) return;
    const handler = () => setTransPop(null);
    window.addEventListener("pointerdown", handler);
    return () => window.removeEventListener("pointerdown", handler);
  }, [transPop]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") { setSelected(null); setTransPop(null); return; }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selected) {
          setScene(prev => ({ ...prev, elements: prev.elements.filter(el => el.id !== selected) }));
          setSelected(null);
        }
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
        if (e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
        if (e.key === "y") { e.preventDefault(); redo(); }
        if (e.key === "d") { e.preventDefault(); duplicateElem(selected); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // P0: pointer move with NaN guards
  const onPointerMove = useCallback((e: PointerEvent) => {
    if (timelineDragRef.current) return;
    if (rotating.current) {
      const { elemId, centerX, centerY, startAngle, startRotation } = rotating.current;
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
      if (!Number.isFinite(angle)) return;
      let newRot = (startRotation + angle - startAngle) % 360;
      if (!Number.isFinite(newRot)) return;
      if (newRot < 0) newRot += 360;
      setScene(prev => ({ ...prev, elements: prev.elements.map(el => el.id === elemId ? { ...el, rotation: Math.round(newRot) } : el) }));
      return;
    }
    if (resizing.current) {
      const { elemId, handle, startClientX, startClientY, startW, startH, startX, startY, canvasRect } = resizing.current;
      if (!canvasRect.width || !canvasRect.height) return;
      const dxPct = ((e.clientX - startClientX) / canvasRect.width) * 100;
      const dyPct = ((e.clientY - startClientY) / canvasRect.height) * 100;
      if (!Number.isFinite(dxPct) || !Number.isFinite(dyPct)) return;
      let newW = startW, newH = startH, newX = startX, newY = startY;
      if (handle.includes("e")) { newW = Math.max(5, startW + dxPct); newX = startX + dxPct / 2; }
      if (handle.includes("w")) { newW = Math.max(5, startW - dxPct); newX = startX + dxPct / 2; }
      if (handle.includes("s")) { newH = Math.max(3, startH + dyPct); newY = startY + dyPct / 2; }
      if (handle.includes("n")) { newH = Math.max(3, startH - dyPct); newY = startY + dyPct / 2; }
      if (!Number.isFinite(newW) || !Number.isFinite(newH) || !Number.isFinite(newX) || !Number.isFinite(newY)) return;
      setScene(prev => ({
        ...prev, elements: prev.elements.map(el => el.id === elemId
          ? { ...el, w: Math.max(5, newW), h: Math.max(3, newH), x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) }
          : el)
      }));
      return;
    }
    if (dragging.current && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dx = ((e.clientX - dragging.current.startClientX) / rect.width) * 100;
      const dy = ((e.clientY - dragging.current.startClientY) / rect.height) * 100;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      const rawX = dragging.current.elemX + dx;
      const rawY = dragging.current.elemY + dy;
      const snapX = Math.abs(rawX - 50) < 1.5;
      const snapY = Math.abs(rawY - 50) < 1.5;
      const newX = snapX ? 50 : Math.max(2, Math.min(98, rawX));
      const newY = snapY ? 50 : Math.max(2, Math.min(98, rawY));
      setSnapGuide({ x: snapX, y: snapY });
      setScene(prev => ({
        ...prev, elements: prev.elements.map(el => el.id === dragging.current!.elemId
          ? { ...el, x: newX, y: newY }
          : el)
      }));
    }
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = null;
    resizing.current = null;
    rotating.current = null;
    setSnapGuide({});
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // ── Undo/redo ─────────────────────────────────────────────────────────────────
  const pushHistory = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-39), { scenes: JSON.parse(JSON.stringify(scenes)), idx: currentSceneIdxRef.current }]);
    setRedoStack([]);
  }, [scenes]);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const snap = prev[prev.length - 1];
      setRedoStack(r => [...r, { scenes: JSON.parse(JSON.stringify(scenes)), idx: currentSceneIdxRef.current }]);
      setScenes(snap.scenes);
      setCurrentSceneIdx(snap.idx);
      setSelected(null);
      return prev.slice(0, -1);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes]);

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const snap = prev[prev.length - 1];
      setUndoStack(u => [...u, { scenes: JSON.parse(JSON.stringify(scenes)), idx: currentSceneIdxRef.current }]);
      setScenes(snap.scenes);
      setCurrentSceneIdx(snap.idx);
      setSelected(null);
      return prev.slice(0, -1);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes]);

  // ── Scene management ─────────────────────────────────────────────────────────
  const addScene = () => {
    pushHistory();
    const newScene = DEFAULT_SCENE();
    setScenes(prev => [...prev, newScene]);
    setCurrentSceneIdx(scenes.length);
    setSelected(null);
  };

  const duplicateScene = (idx: number) => {
    pushHistory();
    const clone: Scene = JSON.parse(JSON.stringify(scenes[idx]));
    clone.id = nid();
    clone.elements = clone.elements.map(el => ({ ...el, id: nid() }));
    setScenes(prev => [...prev.slice(0, idx + 1), clone, ...prev.slice(idx + 1)]);
    setCurrentSceneIdx(idx + 1);
    setSelected(null);
  };

  const deleteScene = (idx: number) => {
    if (scenes.length === 1) return;
    pushHistory();
    setScenes(prev => prev.filter((_, i) => i !== idx));
    setCurrentSceneIdx(prev => Math.min(prev, scenes.length - 2));
    setSelected(null);
  };

  const setSceneDuration = (idx: number, dur: number) => {
    setScenes(prev => prev.map((s, i) => i === idx ? { ...s, duration: dur } : s));
  };

  const updateScene = (patch: Partial<Scene>) => setScene(prev => ({ ...prev, ...patch }));

  // V3: apply transition to all scenes
  const applyTransitionToAll = (t: SceneTransition, ms: number, color: string) => {
    setScenes(prev => prev.map(s => ({ ...s, transition: t, transitionMs: ms, transitionColor: color })));
  };

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    pushHistory();
    setScene(prev => ({ ...prev, ...t.scene }));
    setSelected(null);
  };

  // ── Element management ───────────────────────────────────────────────────────
  const addText = () => {
    pushHistory();
    const el = newElem("text");
    setScene(prev => ({ ...prev, elements: [...prev.elements, el] }));
    setSelected(el.id);
  };

  const addShape = (type: "rect" | "ellipse") => {
    pushHistory();
    const el = newElem(type);
    setScene(prev => ({ ...prev, elements: [...prev.elements, el] }));
    setSelected(el.id);
  };

  const addImage = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return;
      const url = URL.createObjectURL(file);
      pushHistory();
      const el: CanvasElem = { ...newElem("image"), src: url, w: 40, h: 30, y: 50 };
      setScene(prev => ({ ...prev, elements: [...prev.elements, el] }));
      setSelected(el.id);
    };
    input.click();
  };

  const addImageFromLibrary = (url: string) => {
    pushHistory();
    const el: CanvasElem = { ...newElem("image"), src: url, w: 40, h: 30, y: 50 };
    setScene(prev => ({ ...prev, elements: [...prev.elements, el] }));
    setSelected(el.id);
  };

  const updateElem = (id: string, patch: Partial<CanvasElem>) => {
    setScene(prev => ({ ...prev, elements: prev.elements.map(el => el.id === id ? { ...el, ...patch } : el) }));
  };

  const deleteElem = (id: string) => {
    pushHistory();
    setScene(prev => ({ ...prev, elements: prev.elements.filter(el => el.id !== id) }));
    setSelected(null);
  };

  const duplicateElem = (id: string | null) => {
    if (!id) return;
    const src = scene.elements.find(el => el.id === id);
    if (!src) return;
    pushHistory();
    const clone: CanvasElem = { ...src, id: nid(), x: src.x + 3, y: src.y + 3 };
    setScene(prev => ({ ...prev, elements: [...prev.elements, clone] }));
    setSelected(clone.id);
  };

  const moveLayer = (id: string, dir: "up" | "down" | "front" | "back") => {
    setScene(prev => {
      const els = [...prev.elements];
      const idx = els.findIndex(el => el.id === id);
      if (idx < 0) return prev;
      if (dir === "up" && idx < els.length - 1) { [els[idx], els[idx + 1]] = [els[idx + 1], els[idx]]; }
      if (dir === "down" && idx > 0) { [els[idx], els[idx - 1]] = [els[idx - 1], els[idx]]; }
      if (dir === "front") { const [el] = els.splice(idx, 1); els.push(el); }
      if (dir === "back") { const [el] = els.splice(idx, 1); els.unshift(el); }
      return { ...prev, elements: els };
    });
  };

  const alignElem = (id: string, type: "centerH" | "centerV" | "left" | "right" | "top" | "bottom") => {
    const el = scene.elements.find(e => e.id === id);
    if (!el) return;
    const patch: Partial<CanvasElem> = {};
    if (type === "centerH") patch.x = 50;
    if (type === "centerV") patch.y = 50;
    if (type === "left") patch.x = el.w / 2;
    if (type === "right") patch.x = 100 - el.w / 2;
    if (type === "top") patch.y = el.h > 0 ? el.h / 2 : 5;
    if (type === "bottom") patch.y = el.h > 0 ? 100 - el.h / 2 : 95;
    updateElem(id, patch);
  };

  const startDrag = (elemId: string, e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const el = scene.elements.find(el => el.id === elemId);
    if (!el || el.locked) return;
    dragging.current = { elemId, startClientX: e.clientX, startClientY: e.clientY, elemX: el.x, elemY: el.y };
    setSelected(elemId);
  };

  const startResize = (handle: ResizeHandle, elemId: string, e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const el = scene.elements.find(el => el.id === elemId);
    if (!el || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    resizing.current = { elemId, handle, startClientX: e.clientX, startClientY: e.clientY, startW: el.w, startH: el.h || 10, startX: el.x, startY: el.y, canvasRect };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startRotate = (elemId: string, e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const el = scene.elements.find(el => el.id === elemId);
    if (!el || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const centerX = canvasRect.left + (el.x / 100) * canvasRect.width;
    const centerY = canvasRect.top + (el.y / 100) * canvasRect.height;
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
    rotating.current = { elemId, centerX, centerY, startAngle, startRotation: el.rotation };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const setBgImage = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return;
      updateScene({ bgImage: URL.createObjectURL(file) });
    };
    input.click();
  };

  const setBgVideo = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "video/*";
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return;
      updateScene({ bgVideo: URL.createObjectURL(file), bgImage: "" });
    };
    input.click();
  };

  const addPhotoToTimeline = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files ?? []).slice(0, 12);
      if (!files.length) return;
      const newScenes = files.map(f => makePhotoScene(URL.createObjectURL(f)));
      setScenes(prev => [...prev, ...newScenes]);
    };
    input.click();
  };

  // ── V2+: Timeline pointer-drag reorder — V3: fix proportional index calc ────
  const startTimelineDrag = (fromIdx: number, e: React.PointerEvent) => {
    e.stopPropagation();
    timelineDragRef.current = { fromIdx, startX: e.clientX };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onTimelineDragMove = (_e: React.PointerEvent, _fromIdx: number) => { /* visual feedback only */ };

  const onTimelineDragEnd = (e: React.PointerEvent, fromIdx: number) => {
    if (!timelineDragRef.current) return;
    const container = timelineContainerRef.current;
    if (!container) { timelineDragRef.current = null; return; }
    const containerRect = container.getBoundingClientRect();
    const relX = e.clientX - containerRect.left + container.scrollLeft;

    // V3 fix: use actual proportional clip widths instead of fixed 64px
    const totalSec = scenes.reduce((s, c) => s + (c.duration ?? (project?.durationSeconds ?? 5)), 0);
    const GAP = 6;
    let cumX = 0;
    let toIdx = scenes.length - 1;
    for (let i = 0; i < scenes.length; i++) {
      const dur = scenes[i].duration ?? (project?.durationSeconds ?? 5);
      const w = Math.max(MIN_CLIP_PX, (dur / Math.max(1, totalSec)) * 600);
      if (relX < cumX + w / 2) { toIdx = i; break; }
      cumX += w + GAP;
    }

    timelineDragRef.current = null;
    if (!Number.isInteger(fromIdx) || !Number.isInteger(toIdx)) return;
    if (fromIdx < 0 || fromIdx >= scenes.length) return;
    if (toIdx < 0 || toIdx >= scenes.length) return;
    if (fromIdx === toIdx) return;
    setScenes(prev => {
      const arr = [...prev];
      const [item] = arr.splice(fromIdx, 1);
      if (!item) return prev;
      arr.splice(toIdx, 0, item);
      return arr;
    });
    setCurrentSceneIdx(toIdx);
  };

  // ── V3: Scene switch with CSS transition ─────────────────────────────────────
  const switchScene = useCallback((idx: number) => {
    const from = scenes[currentSceneIdxRef.current];
    if (!from || idx === currentSceneIdxRef.current) {
      setCurrentSceneIdx(idx);
      setSelected(null);
      return;
    }
    const trans = from.transition ?? "fade";
    const ms = from.transitionMs ?? 500;

    // colorBlock: separate 2-phase overlay approach
    if (trans === "colorBlock") {
      const color = from.transitionColor ?? "#0d1117";
      setColorBlockOverlay({ opacity: 1, color });
      setTimeout(() => {
        setCurrentSceneIdx(idx);
        setSelected(null);
        setTimeout(() => setColorBlockOverlay({ opacity: 0, color }), 60);
      }, Math.max(100, ms / 2));
      return;
    }

    const animClass: Record<SceneTransition, string> = {
      none: "", fade: "beTransFade",
      slideLeft: "beTransSlideLeft", slideRight: "beTransSlideRight",
      slideUp: "beTransSlideUp", slideDown: "beTransSlideDown",
      zoom: "beTransZoom",
      wipeLeft: "beTransWipeLeft", wipeRight: "beTransWipeRight",
      circle: "beTransCircle",
      colorBlock: "",
    };
    const cls = animClass[trans] ?? "beTransFade";
    setTransitionAnim(cls);
    setSceneKey(k => k + 1);
    setCurrentSceneIdx(idx);
    setSelected(null);
    if (cls) setTimeout(() => setTransitionAnim(""), ms + 50);
  }, [scenes, setCurrentSceneIdx]);

  // ── V3: Video capture (canvas 2D) — all new transitions ─────────────────────
  type SceneFrame = {
    dataUrl: string;
    duration: number;
    transition?: SceneTransition;
    transitionMs?: number;
    transitionColor?: string;
    kenBurns?: Scene["kenBurns"];
    kenBurnsIntensity?: Scene["kenBurnsIntensity"];
  };

  const captureAsVideo = (
    sceneFrames: SceneFrame[],
    resW: number,
    resH: number,
  ): Promise<{ blob: Blob; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const offscreen = document.createElement("canvas");
      offscreen.width = resW; offscreen.height = resH;
      const ctx = offscreen.getContext("2d")!;
      const candidates = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=h264", "video/webm;codecs=vp9", "video/webm"];
      const mimeType = candidates.find(m => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
      const stream = offscreen.captureStream(25);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => resolve({ blob: new Blob(chunks, { type: mimeType }), mimeType });
      recorder.onerror = () => reject(new Error("Falha na gravação de vídeo"));

      const loadImg = (dataUrl: string): Promise<HTMLImageElement> =>
        new Promise((res, rej) => {
          const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error("Erro ao carregar frame")); img.src = dataUrl;
        });
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      const STEPS = 18;

      // V3: extended Ken Burns — zoomIn, zoomOut, panLeft, panRight
      async function applyKenBurns(img: HTMLImageElement, holdMs: number, kenBurns: Scene["kenBurns"], intensity: Scene["kenBurnsIntensity"]) {
        const scale = intensity ?? 1.08;
        if (!kenBurns || kenBurns === "off") {
          ctx.drawImage(img, 0, 0, resW, resH);
          await sleep(holdMs);
          return;
        }
        const frames = Math.max(1, Math.round(holdMs / 40));
        for (let f = 0; f < frames; f++) {
          const t = f / frames;
          ctx.save();
          if (kenBurns === "zoomIn") {
            const s = 1 + t * (scale - 1);
            const off = ((s - 1) / 2);
            ctx.drawImage(img, -off * resW, -off * resH, resW * s, resH * s);
          } else if (kenBurns === "zoomOut") {
            const s = scale - t * (scale - 1);
            const off = ((s - 1) / 2);
            ctx.drawImage(img, -off * resW, -off * resH, resW * s, resH * s);
          } else if (kenBurns === "panLeft") {
            // Pan right→left: image slightly wider, offset slides left
            const panAmt = 0.08;
            const ww = resW * (1 + panAmt);
            const offsetX = (1 - t) * panAmt * resW;
            ctx.drawImage(img, -offsetX, 0, ww, resH);
          } else if (kenBurns === "panRight") {
            // Pan left→right
            const panAmt = 0.08;
            const ww = resW * (1 + panAmt);
            const offsetX = t * panAmt * resW;
            ctx.drawImage(img, -offsetX, 0, ww, resH);
          }
          ctx.restore();
          await sleep(40);
        }
      }

      // V3: extended transition — wipeLeft/Right, slideUp/Down, circle, colorBlock
      async function applyTransition(from: HTMLImageElement, to: HTMLImageElement, transition: SceneTransition | undefined, ms: number, transColor: string) {
        const t = transition ?? "fade";
        if (t === "none") { ctx.drawImage(to, 0, 0, resW, resH); return; }
        for (let step = 1; step <= STEPS; step++) {
          const alpha = step / STEPS;
          if (t === "fade") {
            ctx.drawImage(from, 0, 0, resW, resH);
            ctx.globalAlpha = alpha;
            ctx.drawImage(to, 0, 0, resW, resH);
            ctx.globalAlpha = 1;
          } else if (t === "slideLeft") {
            ctx.drawImage(from, -alpha * resW, 0, resW, resH);
            ctx.drawImage(to, (1 - alpha) * resW, 0, resW, resH);
          } else if (t === "slideRight") {
            ctx.drawImage(from, alpha * resW, 0, resW, resH);
            ctx.drawImage(to, -(1 - alpha) * resW, 0, resW, resH);
          } else if (t === "slideUp") {
            ctx.drawImage(from, 0, -alpha * resH, resW, resH);
            ctx.drawImage(to, 0, (1 - alpha) * resH, resW, resH);
          } else if (t === "slideDown") {
            ctx.drawImage(from, 0, alpha * resH, resW, resH);
            ctx.drawImage(to, 0, -(1 - alpha) * resH, resW, resH);
          } else if (t === "zoom") {
            const s2 = 1 + alpha * 0.15;
            const off = ((s2 - 1) / 2);
            ctx.drawImage(from, 0, 0, resW, resH);
            ctx.globalAlpha = alpha;
            ctx.drawImage(to, -off * resW, -off * resH, resW * s2, resH * s2);
            ctx.globalAlpha = 1;
          } else if (t === "wipeLeft") {
            ctx.drawImage(from, 0, 0, resW, resH);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, alpha * resW, resH);
            ctx.clip();
            ctx.drawImage(to, 0, 0, resW, resH);
            ctx.restore();
          } else if (t === "wipeRight") {
            ctx.drawImage(from, 0, 0, resW, resH);
            ctx.save();
            ctx.beginPath();
            ctx.rect((1 - alpha) * resW, 0, resW, resH);
            ctx.clip();
            ctx.drawImage(to, 0, 0, resW, resH);
            ctx.restore();
          } else if (t === "circle") {
            const cx = resW / 2, cy = resH / 2;
            const maxR = Math.sqrt(cx * cx + cy * cy);
            ctx.drawImage(from, 0, 0, resW, resH);
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, alpha * maxR, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(to, 0, 0, resW, resH);
            ctx.restore();
          } else if (t === "colorBlock") {
            const half = STEPS / 2;
            if (step <= half) {
              // Phase 1: fill color over 'from'
              const a = step / half;
              ctx.drawImage(from, 0, 0, resW, resH);
              ctx.globalAlpha = a;
              ctx.fillStyle = transColor;
              ctx.fillRect(0, 0, resW, resH);
              ctx.globalAlpha = 1;
            } else {
              // Phase 2: reveal 'to' from behind color
              const a = 1 - (step - half) / half;
              ctx.drawImage(to, 0, 0, resW, resH);
              ctx.globalAlpha = a;
              ctx.fillStyle = transColor;
              ctx.fillRect(0, 0, resW, resH);
              ctx.globalAlpha = 1;
            }
          }
          await sleep(ms / STEPS);
        }
      }

      (async () => {
        try {
          const imgs = await Promise.all(sceneFrames.map(f => loadImg(f.dataUrl)));
          recorder.start();
          for (let i = 0; i < imgs.length; i++) {
            const frame = sceneFrames[i];
            const transMs = frame.transitionMs ?? 500;
            const transColor = frame.transitionColor ?? "#0d1117";
            const hasNext = i < imgs.length - 1;
            const holdMs = frame.duration * 1000 - (hasNext && frame.transition !== "none" ? transMs : 0);
            await applyKenBurns(imgs[i], Math.max(200, holdMs), frame.kenBurns, frame.kenBurnsIntensity);
            if (hasNext) await applyTransition(imgs[i], imgs[i + 1], frame.transition, transMs, transColor);
          }
          recorder.stop();
        } catch (err) { reject(err); }
      })();
    });

  // ── Export ───────────────────────────────────────────────────────────────────
  const exportCanvas = async (saveTo: "library" | "download") => {
    if (!canvasRef.current || !project) return;
    setSaving(true);
    const originalIdx = currentSceneIdx;
    try {
      const pixelRatio = project.res.w / canvasRef.current.offsetWidth;
      if (saveTo === "download") {
        const dataUrl = await toPng(canvasRef.current, { pixelRatio, cacheBust: true });
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${project.name.replace(/\s+/g, "-")}-cena${currentSceneIdx + 1}-${project.res.w}x${project.res.h}.png`;
        a.click();
        toast({ title: `✅ PNG baixado — cena ${currentSceneIdx + 1}` });
        setSaving(false);
        return;
      }
      const totalSec = scenes.reduce((sum, s) => sum + (s.duration ?? project.durationSeconds), 0);
      toast({ title: `🎬 Renderizando ${scenes.length} cena(s)… ${totalSec}s total` });
      const sceneFrames: SceneFrame[] = [];
      for (let i = 0; i < scenes.length; i++) {
        toast({ title: `🎬 Renderizando cena ${i + 1}/${scenes.length}…` });
        setCurrentSceneIdx(i);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const dataUrl = await toPng(canvasRef.current!, { pixelRatio, cacheBust: true });
        sceneFrames.push({
          dataUrl,
          duration: scenes[i].duration ?? project.durationSeconds,
          transition: scenes[i].transition ?? "fade",
          transitionMs: scenes[i].transitionMs ?? 500,
          transitionColor: scenes[i].transitionColor ?? "#0d1117",
          kenBurns: scenes[i].kenBurns ?? "off",
          kenBurnsIntensity: scenes[i].kenBurnsIntensity ?? 1.08,
        });
      }
      setCurrentSceneIdx(originalIdx);
      const { blob: videoBlob, mimeType } = await captureAsVideo(sceneFrames, project.res.w, project.res.h);
      if (videoBlob.size === 0) throw new Error("Vídeo gerado está vazio — o navegador bloqueou a captura de frames. Tente novamente com a aba em foco.");
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const filename = `midia-${Date.now()}.${ext}`;
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({ data: { name: filename, size: videoBlob.size, contentType: mimeType } });
      const putRes = await fetch(uploadURL, { method: "PUT", body: videoBlob, headers: { "Content-Type": mimeType } });
      if (!putRes.ok) throw new Error(`Falha ao enviar vídeo (${putRes.status} ${putRes.statusText})`);
      await createMedia.mutateAsync({ data: { name: project.name, type: "video", url: objectPath, durationSeconds: totalSec } });
      queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
      toast({ title: `✅ Vídeo ${ext.toUpperCase()} salvo — ${scenes.length} cena(s) • ${totalSec}s` });
    } catch (err) {
      setCurrentSceneIdx(originalIdx);
      toast({ title: `Erro ao exportar: ${err instanceof Error ? err.message : "tente novamente"}`, variant: "destructive" });
    } finally { setSaving(false); }
  };

  // ── Preview ──────────────────────────────────────────────────────────────────
  const startPreview = useCallback(() => {
    if (scenes.length <= 1) { toast({ title: "Adicione pelo menos 2 cenas para o preview." }); return; }
    setPreviewing(true);
    let idx = 0;
    switchScene(0);
    const tick = () => {
      idx = (idx + 1) % scenes.length;
      switchScene(idx);
      const dur = (scenes[idx].duration ?? 4) * 1000;
      previewTimerRef.current = setTimeout(tick, dur);
    };
    previewTimerRef.current = setTimeout(tick, (scenes[0].duration ?? 4) * 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, switchScene]);

  const stopPreview = useCallback(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    setPreviewing(false);
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const selectedElem = scene?.elements.find(el => el.id === selected) ?? null;
  const fsize = (pct: number) => canvasH > 0 ? `${(pct / 100) * canvasH}px` : `${pct * 4}px`;
  const ratio = project ? `${project.res.w}/${project.res.h}` : "16/9";

  // Auto-switch right tab
  useEffect(() => {
    if (selectedElem) {
      if (selectedElem.type === "text") setRightTab("texto");
      else setRightTab("animacao");
    } else {
      setRightTab("cena");
    }
  }, [selectedElem?.id]);

  // ── Guard ─────────────────────────────────────────────────────────────────────
  if (!scene || !Array.isArray(scene.elements)) {
    return <div className="flex items-center justify-center h-screen text-sm text-muted-foreground">Recarregando cena…</div>;
  }

  if (!project) {
    return <NewProjectScreen
      onStart={(cfg, s) => { setProject(cfg); setScenes([s]); setCurrentSceneIdx(0); setSelected(null); setUndoStack([]); setRedoStack([]); }}
      onQuickVideo={(cfg, photoScenes) => { setProject(cfg); setScenes(photoScenes); setCurrentSceneIdx(0); setSelected(null); setUndoStack([]); setRedoStack([]); }}
    />;
  }

  // Canvas background style
  const bgImageStyle = (): React.CSSProperties => {
    if (!scene.bgImage) return { background: scene.bgVideo ? "#000" : scene.bg };
    const zoom = scene.mediaZoom ?? 100;
    const panX = scene.mediaPanX ?? 0;
    const panY = scene.mediaPanY ?? 0;
    const fit = zoom > 100 ? `${zoom}%` : (scene.mediaFit ?? "cover");
    return { backgroundImage: `url(${scene.bgImage})`, backgroundSize: fit, backgroundPosition: `calc(50% + ${panX}%) calc(50% + ${panY}%)`, backgroundRepeat: "no-repeat" };
  };

  // Timeline proportional widths
  const totalTimelineSec = scenes.reduce((s, c) => s + (c.duration ?? project.durationSeconds), 0);
  const MIN_CLIP_PX = 64;

  // ── Editor JSX ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <style>{`
        /* ── Element animations ── */
        .be-anim-fadeIn     { animation-name: beAnimFadeIn; }
        .be-anim-slideLeft  { animation-name: beAnimSlideLeft; }
        .be-anim-slideRight { animation-name: beAnimSlideRight; }
        .be-anim-slideUp    { animation-name: beAnimSlideUp; }
        .be-anim-slideDown  { animation-name: beAnimSlideDown; }
        .be-anim-zoomIn     { animation-name: beAnimZoomIn; }
        .be-anim-zoomOut    { animation-name: beAnimZoomOut; }
        .be-anim-bounce     { animation-name: beAnimBounce; }
        .be-anim-pop        { animation-name: beAnimPop; }
        .be-anim-blurIn     { animation-name: beAnimBlurIn; }
        .be-anim-typewriter { animation-name: beAnimTypewriter; }
        @keyframes beAnimFadeIn     { from{opacity:0} to{opacity:1} }
        @keyframes beAnimSlideLeft  { from{transform:translateX(-120px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes beAnimSlideRight { from{transform:translateX(120px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes beAnimSlideUp    { from{transform:translateY(80px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes beAnimSlideDown  { from{transform:translateY(-80px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes beAnimZoomIn     { from{transform:scale(0.2);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes beAnimZoomOut    { from{transform:scale(2.2);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes beAnimBounce     { 0%{transform:translateY(-40px) scale(0.8);opacity:0} 60%{transform:translateY(8px) scale(1.02);opacity:1} 80%{transform:translateY(-4px)} 100%{transform:translateY(0)} }
        @keyframes beAnimPop        { 0%{transform:scale(0.4);opacity:0} 65%{transform:scale(1.08);opacity:1} 85%{transform:scale(0.97)} 100%{transform:scale(1);opacity:1} }
        @keyframes beAnimBlurIn     { from{filter:blur(18px);opacity:0} to{filter:blur(0);opacity:1} }
        @keyframes beAnimTypewriter { from{clip-path:inset(0 100% 0 0)} to{clip-path:inset(0 0% 0 0)} }
        /* ── Scene transitions ── */
        .beTransFade      { animation: beTransFadeA var(--trans-ms,500ms) ease forwards; }
        .beTransSlideLeft { animation: beTransSlideLeftA var(--trans-ms,500ms) ease forwards; }
        .beTransSlideRight{ animation: beTransSlideRightA var(--trans-ms,500ms) ease forwards; }
        .beTransSlideUp   { animation: beTransSlideUpA var(--trans-ms,500ms) ease forwards; }
        .beTransSlideDown { animation: beTransSlideDownA var(--trans-ms,500ms) ease forwards; }
        .beTransZoom      { animation: beTransZoomA var(--trans-ms,500ms) ease forwards; }
        .beTransWipeLeft  { animation: beTransWipeLeftA var(--trans-ms,500ms) ease forwards; }
        .beTransWipeRight { animation: beTransWipeRightA var(--trans-ms,500ms) ease forwards; }
        .beTransCircle    { animation: beTransCircleA var(--trans-ms,500ms) ease forwards; }
        @keyframes beTransFadeA       { from{opacity:0} to{opacity:1} }
        @keyframes beTransSlideLeftA  { from{transform:translateX(7%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes beTransSlideRightA { from{transform:translateX(-7%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes beTransSlideUpA    { from{transform:translateY(7%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes beTransSlideDownA  { from{transform:translateY(-7%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes beTransZoomA       { from{transform:scale(1.05);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes beTransWipeLeftA   { from{clip-path:inset(0 100% 0 0)} to{clip-path:inset(0 0% 0 0)} }
        @keyframes beTransWipeRightA  { from{clip-path:inset(0 0 0 100%)} to{clip-path:inset(0 0 0 0%)} }
        @keyframes beTransCircleA     { from{clip-path:circle(0% at 50% 50%)} to{clip-path:circle(150% at 50% 50%)} }
      `}</style>

      {/* ── TOP TOOLBAR */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0 flex-wrap">
        <Link href="/media">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-8">
            <ChevronLeft className="w-4 h-4" /> Biblioteca
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-6" />
        <Film className="w-4 h-4 text-blue-400 shrink-0" />
        <Input
          value={project.name}
          onChange={e => setProject(p => p ? { ...p, name: e.target.value } : p)}
          className="h-8 w-48 text-sm"
        />
        <div className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs font-mono text-muted-foreground shrink-0">
          {project.res.w} × {project.res.h}
        </div>
        <select value={project.durationSeconds}
          onChange={e => setProject(p => p ? { ...p, durationSeconds: parseInt(e.target.value) } : p)}
          className="h-7 text-xs rounded border border-input bg-background px-1 text-muted-foreground" title="Duração">
          {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}s</option>)}
        </select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={undo} disabled={undoStack.length === 0} className="h-8 gap-1.5" title="Desfazer (Ctrl+Z)">
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
        <Button variant="outline" size="sm" onClick={redo} disabled={redoStack.length === 0} className="h-8 gap-1.5" title="Refazer (Ctrl+Y)">
          <Redo2 className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setProject(null)} className="h-8 text-muted-foreground gap-1.5">+ Novo</Button>
        <Button variant={previewing ? "destructive" : "outline"} size="sm"
          onClick={previewing ? stopPreview : startPreview} disabled={saving} className="h-8 gap-1.5">
          {previewing ? <><Pause className="w-3.5 h-3.5" /> Parar</> : <><Play className="w-3.5 h-3.5" /> Preview</>}
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportCanvas("download")} disabled={saving} className="h-8 gap-1.5">
          <Download className="w-3.5 h-3.5" /> PNG
        </Button>
        <Button size="sm" onClick={() => exportCanvas("library")} disabled={saving}
          className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "Gerando MP4…" : "Salvar MP4"}
        </Button>
      </div>

      {/* ── BODY */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL */}
        <aside className="w-52 shrink-0 border-r bg-card flex flex-col overflow-hidden">
          <div className="flex border-b shrink-0">
            {(["midia", "elementos", "fundo", "camadas"] as LeftTab[]).map(t => (
              <button key={t} onClick={() => setLeftTab(t)}
                className={cn("flex-1 py-1.5 text-[9px] font-semibold uppercase tracking-wide transition-colors",
                  leftTab === t ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}>
                {t === "midia" ? "Mídia" : t === "elementos" ? "Add" : t === "fundo" ? "Fundo" : "Layers"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {leftTab === "midia" && (
              <div className="px-3 py-3 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fotos da Biblioteca</p>
                <div className="space-y-1.5">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8" onClick={setBgImage}>
                    <ImageIcon className="w-3.5 h-3.5" /> Upload de foto (fundo)
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8" onClick={addPhotoToTimeline}>
                    <Images className="w-3.5 h-3.5" /> Fotos → Timeline
                  </Button>
                </div>
                <Separator />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Imagens salvas</p>
                <div className="grid grid-cols-3 gap-1">
                  {(mediaLibrary?.filter(m => m.type === "image") ?? []).map(m => (
                    <button key={m.id} title={m.name}
                      onClick={() => addImageFromLibrary(m.url)}
                      className="aspect-square rounded overflow-hidden border border-white/10 hover:border-primary transition-colors">
                      <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {(mediaLibrary?.filter(m => m.type === "image") ?? []).length === 0 && (
                    <p className="col-span-3 text-[10px] text-muted-foreground text-center py-4">Nenhuma imagem na biblioteca</p>
                  )}
                </div>
              </div>
            )}

            {leftTab === "elementos" && (
              <div className="px-3 py-3 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Templates</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {TEMPLATES.map(t => (
                    <button key={t.name} onClick={() => applyTemplate(t)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-center">
                      <span className="text-xl">{t.emoji}</span>
                      <span className="text-[10px] font-medium text-muted-foreground">{t.name}</span>
                    </button>
                  ))}
                </div>
                <Separator />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Adicionar</p>
                <div className="space-y-1.5">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8" onClick={addText}><Type className="w-3.5 h-3.5" /> Texto</Button>
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8" onClick={addImage}><ImageIcon className="w-3.5 h-3.5" /> Imagem overlay</Button>
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8" onClick={() => addShape("rect")}><Square className="w-3.5 h-3.5" /> Retângulo</Button>
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8" onClick={() => addShape("ellipse")}><CircleDot className="w-3.5 h-3.5" /> Elipse / Círculo</Button>
                </div>
              </div>
            )}

            {leftTab === "fundo" && (
              <div className="px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Fundo da Cena</p>
                <div className="grid grid-cols-5 gap-1 mb-2">
                  {(["presets", "gradients", "color", "image", "video"] as const).map(tab => (
                    <button key={tab} onClick={() => setBgTab(tab)}
                      className={cn("text-[9px] py-1 rounded font-medium transition-colors",
                        bgTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                      {tab === "presets" ? "Sol." : tab === "gradients" ? "Grad." : tab === "color" ? "Cor" : tab === "image" ? "Foto" : "Vídeo"}
                    </button>
                  ))}
                </div>
                {bgTab === "presets" && (
                  <div className="grid grid-cols-5 gap-1">
                    {BG_PRESETS.map(p => (
                      <button key={p.value} onClick={() => updateScene({ bg: p.value, bgImage: "", bgVideo: "" })} title={p.label}
                        className={cn("h-7 rounded border-2 transition-all hover:scale-105", scene.bg === p.value && !scene.bgImage && !scene.bgVideo ? "border-primary" : "border-transparent")}
                        style={{ background: p.value }} />
                    ))}
                  </div>
                )}
                {bgTab === "gradients" && (
                  <div className="grid grid-cols-4 gap-1">
                    {GRADIENT_PRESETS.map(p => (
                      <button key={p.value} onClick={() => updateScene({ bg: p.value, bgImage: "", bgVideo: "" })} title={p.label}
                        className={cn("h-8 rounded border-2 transition-all hover:scale-105", scene.bg === p.value && !scene.bgImage && !scene.bgVideo ? "border-primary" : "border-transparent")}
                        style={{ background: p.value }} />
                    ))}
                  </div>
                )}
                {bgTab === "color" && (
                  <div className="space-y-2">
                    <input type="color" value={bgColorInput}
                      onChange={e => { setBgColorInput(e.target.value); updateScene({ bg: e.target.value, bgImage: "", bgVideo: "" }); }}
                      className="w-full h-9 rounded cursor-pointer border" />
                    <Input value={bgColorInput}
                      onChange={e => { setBgColorInput(e.target.value); if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) updateScene({ bg: e.target.value, bgImage: "", bgVideo: "" }); }}
                      className="h-7 text-xs font-mono" placeholder="#1e3a5f" />
                  </div>
                )}
                {bgTab === "image" && (
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full gap-2 h-8" onClick={setBgImage}><ImageIcon className="w-3.5 h-3.5" /> Carregar foto</Button>
                    {scene.bgImage && <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive gap-1.5 h-8" onClick={() => updateScene({ bgImage: "" })}><Trash2 className="w-3 h-3" /> Remover foto</Button>}
                  </div>
                )}
                {bgTab === "video" && (
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full gap-2 h-8" onClick={setBgVideo}><Film className="w-3.5 h-3.5" /> Carregar vídeo</Button>
                    <p className="text-[9px] text-muted-foreground text-center">MP4, WebM • loop automático</p>
                    {scene.bgVideo && <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive gap-1.5 h-8" onClick={() => updateScene({ bgVideo: "" })}><Trash2 className="w-3 h-3" /> Remover vídeo</Button>}
                  </div>
                )}
              </div>
            )}

            {leftTab === "camadas" && (
              <div className="px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Camadas da cena {currentSceneIdx + 1}
                </p>
                {scene.elements.length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-4">Nenhum elemento</p>
                )}
                <div className="space-y-0.5">
                  {[...scene.elements].reverse().map(el => (
                    <button key={el.id} onClick={() => setSelected(el.id)}
                      className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors",
                        selected === el.id ? "bg-primary/15 text-primary" : "hover:bg-muted text-muted-foreground")}>
                      {el.type === "text" ? <Type className="w-3 h-3 shrink-0" />
                        : el.type === "rect" ? <Square className="w-3 h-3 shrink-0" />
                        : el.type === "ellipse" ? <CircleDot className="w-3 h-3 shrink-0" />
                        : <ImageIcon className="w-3 h-3 shrink-0" />}
                      <span className="truncate flex-1">
                        {el.type === "text" ? el.text.slice(0, 16) || "Texto"
                          : el.type === "rect" ? "Retângulo"
                          : el.type === "ellipse" ? "Elipse"
                          : "Imagem"}
                      </span>
                      {el.locked && <Lock className="w-2.5 h-2.5 shrink-0 opacity-50" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── CANVAS AREA */}
        <main className="flex-1 bg-neutral-900 flex flex-col overflow-hidden" onClick={() => { setSelected(null); setTransPop(null); }}>

          {/* V3: Floating contextual toolbar */}
          {selectedElem && (
            <div className="shrink-0 bg-neutral-800/95 border-b border-white/10 px-3 py-1.5 flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
              <span className="text-[10px] text-white/30 font-semibold uppercase tracking-widest mr-1">
                {selectedElem.type === "text" ? "Texto" : selectedElem.type === "image" ? "Imagem" : selectedElem.type === "rect" ? "Rect" : "Elipse"}
              </span>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-white/60 hover:text-white px-2"
                onClick={() => { setRightTab("animacao"); }}>
                <Sparkles className="w-3 h-3" /> Animar
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-white/60 hover:text-white px-2"
                onClick={() => alignElem(selectedElem.id, "centerH")}>
                <AlignHorizontalJustifyCenter className="w-3 h-3" /> C.H
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-white/60 hover:text-white px-2"
                onClick={() => alignElem(selectedElem.id, "centerV")}>
                <AlignVerticalJustifyCenter className="w-3 h-3" /> C.V
              </Button>
              {selectedElem.type === "image" && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-white/60 hover:text-white px-2"
                  onClick={() => updateElem(selectedElem.id, { flipX: !selectedElem.flipX })}>
                  ↔ Flip
                </Button>
              )}
              <div className="flex items-center gap-1 ml-1">
                <span className="text-[10px] text-white/30">Opac.</span>
                <input type="range" min={0} max={1} step={0.05} value={selectedElem.opacity}
                  onChange={e => updateElem(selectedElem.id, { opacity: parseFloat(e.target.value) })}
                  className="w-16 accent-cyan-500" />
              </div>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-white/50 hover:text-white px-2"
                onClick={() => updateElem(selectedElem.id, { locked: !selectedElem.locked })}>
                {selectedElem.locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-white/50 hover:text-white px-2"
                onClick={() => duplicateElem(selectedElem.id)}>
                <Copy className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-red-400 hover:text-red-300 px-2"
                onClick={() => deleteElem(selectedElem.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}

          {/* Canvas center + zoom */}
          <div className="flex-1 flex items-center justify-center overflow-hidden p-4 relative">
            {/* V3: Canvas view zoom wrapper */}
            <div style={{
              aspectRatio: ratio,
              maxWidth: "100%",
              maxHeight: "100%",
              width: "100%",
              position: "relative",
              transform: `scale(${canvasViewZoom / 100})`,
              transformOrigin: "center center",
            }}>
              <div
                key={sceneKey}
                ref={canvasRef}
                className={transitionAnim}
                style={{
                  "--trans-ms": `${scene.transitionMs ?? 500}ms`,
                  width: "100%", height: "100%", position: "relative", overflow: "hidden", borderRadius: 6,
                  boxShadow: "0 0 0 1px rgba(255,255,255,.1), 0 8px 32px rgba(0,0,0,.6)",
                  ...bgImageStyle(),
                } as React.CSSProperties}
                onClick={e => { e.stopPropagation(); setSelected(null); }}
              >
                {/* V3: colorBlock overlay */}
                {colorBlockOverlay.opacity > 0 && (
                  <div style={{
                    position: "absolute", inset: 0, zIndex: 50,
                    backgroundColor: colorBlockOverlay.color,
                    opacity: colorBlockOverlay.opacity,
                    transition: "opacity 200ms ease",
                    pointerEvents: "none",
                  }} />
                )}

                {/* Video background */}
                {scene.bgVideo && (
                  <video key={scene.bgVideo} src={scene.bgVideo} autoPlay muted loop playsInline
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
                )}
                {scene.bgImage && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)", pointerEvents: "none", zIndex: 1 }} />}

                {/* Snap guides */}
                {snapGuide.x && <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#06b6d4", pointerEvents: "none", zIndex: 99, transform: "translateX(-50%)", boxShadow: "0 0 4px #06b6d4" }} />}
                {snapGuide.y && <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "#f43f5e", pointerEvents: "none", zIndex: 99, transform: "translateY(-50%)", boxShadow: "0 0 4px #f43f5e" }} />}

                {/* Elements */}
                <div key={`scene-${currentSceneIdx}`} style={{ position: "absolute", inset: 0, zIndex: 2 }}>
                  {scene.elements.map(el => {
                    const isSel = selected === el.id;
                    const hasH = el.h > 0;
                    const isShape = el.type === "rect" || el.type === "ellipse";
                    const anim = el.animation ?? "none";
                    const animDelay = el.animDelay ?? 0;
                    const animDur = el.animDuration ?? 0.75;
                    const textShadowStr = el.shadow ? "0 2px 12px rgba(0,0,0,0.9)" : "";
                    const strokeW = el.textStrokeWidth ?? 0;
                    const textStroke = strokeW > 0 && el.type === "text"
                      ? `${el.textStrokeColor ?? "#000"} ${strokeW}px, ${el.textStrokeColor ?? "#000"} -${strokeW}px, ${el.textStrokeColor ?? "#000"} 0 ${strokeW}px, ${el.textStrokeColor ?? "#000"} 0 -${strokeW}px`
                      : "";
                    const fullShadow = [textShadowStr, textStroke].filter(Boolean).join(", ");
                    const elemFilter = el.type === "image" ? buildElemFilter(el.imgFilter) : "";
                    const flipTransform = `scaleX(${el.flipX ? -1 : 1}) scaleY(${el.flipY ? -1 : 1})`;

                    return (
                      <div key={el.id}
                        className={anim !== "none" ? `be-anim-${anim}` : undefined}
                        style={{
                          position: "absolute",
                          left: `${el.x}%`, top: `${el.y}%`,
                          width: `${el.w}%`, height: hasH ? `${el.h}%` : "auto",
                          animationDelay: anim !== "none" ? `${animDelay}s` : undefined,
                          animationDuration: anim !== "none" ? `${animDur}s` : undefined,
                          animationFillMode: "both",
                          animationTimingFunction: "cubic-bezier(0.22,1,0.36,1)",
                          animationIterationCount: (el.animLoop && anim !== "none") ? "infinite" : 1,
                        }}
                      >
                        <div style={{
                          position: "relative", width: "100%", height: "100%",
                          transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
                          cursor: el.locked ? "default" : "move",
                          opacity: el.opacity,
                          outline: isSel ? "2px solid #3b82f6" : "1px dashed rgba(255,255,255,0.1)",
                          outlineOffset: 3,
                          userSelect: "none",
                        }}
                          onPointerDown={e => startDrag(el.id, e)}
                          onClick={e => { e.stopPropagation(); setSelected(el.id); }}
                        >
                          {el.type === "text" && (
                            <p style={{
                              margin: 0, fontSize: fsize(el.fontSize), color: el.color,
                              fontFamily: el.fontFamily, fontWeight: el.fontWeight, fontStyle: el.fontStyle,
                              textDecoration: el.textDecoration === "underline" ? "underline" : "none",
                              textAlign: el.textAlign, letterSpacing: `${el.letterSpacing}px`,
                              lineHeight: el.lineHeight, textShadow: fullShadow || "none",
                              whiteSpace: "pre-wrap", wordBreak: "break-word",
                              background: el.bgColor || "transparent",
                              padding: el.bgColor ? "4px 10px" : 0,
                              borderRadius: el.bgColor ? 6 : 0, pointerEvents: "none",
                              transform: flipTransform,
                            }}>{el.text}</p>
                          )}
                          {el.type === "image" && (
                            <img src={el.src} alt="" draggable={false}
                              style={{ width: "100%", height: hasH ? "100%" : "auto", objectFit: "contain", display: "block", pointerEvents: "none", filter: elemFilter || undefined, transform: flipTransform }} />
                          )}
                          {isShape && (
                            <div style={{
                              width: "100%", height: "100%",
                              background: el.fillColor || "transparent",
                              border: el.strokeWidth > 0 ? `${el.strokeWidth}px solid ${el.strokeColor}` : "none",
                              borderRadius: `${el.borderRadius}%`, pointerEvents: "none",
                              transform: flipTransform,
                            }} />
                          )}

                          {isSel && !el.locked && (
                            <>
                              <div style={{ position: "absolute", top: -26, left: "50%", transform: "translateX(-50%)", width: 14, height: 14, borderRadius: "50%", background: "#3b82f6", border: "2px solid white", cursor: "grab", zIndex: 10 }}
                                onPointerDown={e => startRotate(el.id, e)} title={`Rotar (${el.rotation}°)`} />
                              <div style={{ position: "absolute", top: -16, left: "50%", width: 1, height: 14, background: "#3b82f655", transform: "translateX(-50%)", pointerEvents: "none" }} />
                              {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as ResizeHandle[]).map(h => {
                                if (el.type === "text" && (h === "n" || h === "s" || h === "ne" || h === "nw" || h === "se" || h === "sw")) return null;
                                const cursors: Record<ResizeHandle, string> = { n: "n-resize", s: "s-resize", e: "e-resize", w: "w-resize", ne: "ne-resize", nw: "nw-resize", se: "se-resize", sw: "sw-resize" };
                                const pos: Record<ResizeHandle, React.CSSProperties> = {
                                  nw: { top: 0, left: 0, transform: "translate(-50%,-50%)" },
                                  n:  { top: 0, left: "50%", transform: "translate(-50%,-50%)" },
                                  ne: { top: 0, right: 0, transform: "translate(50%,-50%)" },
                                  e:  { top: "50%", right: 0, transform: "translate(50%,-50%)" },
                                  se: { bottom: 0, right: 0, transform: "translate(50%,50%)" },
                                  s:  { bottom: 0, left: "50%", transform: "translate(-50%,50%)" },
                                  sw: { bottom: 0, left: 0, transform: "translate(-50%,50%)" },
                                  w:  { top: "50%", left: 0, transform: "translate(-50%,-50%)" },
                                };
                                return (
                                  <div key={h}
                                    style={{ position: "absolute", width: 10, height: 10, background: "white", border: "2px solid #3b82f6", borderRadius: 2, cursor: cursors[h], zIndex: 10, ...pos[h] }}
                                    onPointerDown={e => startResize(h, el.id, e)} />
                                );
                              })}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {scene.elements.length === 0 && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, pointerEvents: "none", zIndex: 3 }}>
                    <Palette style={{ width: 32, height: 32, color: "rgba(255,255,255,0.2)" }} />
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, margin: 0 }}>Adicione elementos no painel esquerdo</p>
                  </div>
                )}
              </div>
            </div>

            {/* V3: Canvas view zoom controls */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 border border-white/10" onClick={e => e.stopPropagation()}>
              <button onClick={() => setCanvasViewZoom(v => Math.max(50, v - 10))} className="text-white/50 hover:text-white w-5 h-5 flex items-center justify-center"><ZoomOut className="w-3 h-3" /></button>
              <span className="text-[10px] text-white/50 font-mono w-9 text-center">{canvasViewZoom}%</span>
              <button onClick={() => setCanvasViewZoom(v => Math.min(200, v + 10))} className="text-white/50 hover:text-white w-5 h-5 flex items-center justify-center"><ZoomIn className="w-3 h-3" /></button>
              <button onClick={() => setCanvasViewZoom(100)} className="text-[9px] text-white/30 hover:text-white/60 ml-1">Fit</button>
            </div>
          </div>

          {/* ── TIMELINE */}
          <div className="shrink-0 bg-neutral-950 border-t border-white/10">
            <div className="flex items-center gap-2 px-3 pt-2 pb-1">
              <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Timeline</span>
              <span className="text-[9px] text-white/20">{scenes.length} cena · {totalTimelineSec}s total</span>
              <div className="flex-1" />
              <button onClick={addPhotoToTimeline}
                className="flex items-center gap-1 text-[10px] text-cyan-400/70 hover:text-cyan-300 transition-colors px-2 py-0.5 rounded border border-cyan-400/20 hover:border-cyan-400/40">
                <Plus className="w-3 h-3" /> Foto
              </button>
              <button onClick={addScene}
                className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors px-2 py-0.5 rounded border border-white/10 hover:border-white/20">
                <Plus className="w-3 h-3" /> Cena
              </button>
            </div>

            {/* Clips row */}
            <div ref={timelineContainerRef} className="flex items-end gap-1.5 overflow-x-auto px-3 pb-3 scrollbar-thin" style={{ position: "relative" }}>
              {scenes.map((s, i) => {
                const dur = s.duration ?? project.durationSeconds;
                const clipPx = Math.max(MIN_CLIP_PX, (dur / Math.max(1, totalTimelineSec)) * 600);
                const isActive = i === currentSceneIdx;
                const trans = s.transition ?? "fade";

                return (
                  <div key={s.id} className="flex items-end gap-0" style={{ flexShrink: 0 }}>
                    {/* Clip */}
                    <div
                      style={{ width: clipPx, flexShrink: 0, position: "relative" }}
                      onPointerDown={e => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.handle === "drag") startTimelineDrag(i, e); }}
                      onPointerMove={e => onTimelineDragMove(e, i)}
                      onPointerUp={e => onTimelineDragEnd(e, i)}
                      className={cn("rounded-lg border-2 overflow-hidden cursor-pointer transition-all group select-none",
                        isActive ? "border-cyan-400 shadow-[0_0_0_2px_rgba(103,210,210,0.25)]" : "border-white/10 hover:border-white/30")}
                      onClick={() => { stopPreview(); switchScene(i); }}
                    >
                      <div className="w-full" style={{ height: 52, background: s.bgImage ? `url(${s.bgImage}) center/cover no-repeat` : s.bg, position: "relative" }}>
                        <div data-handle="drag" className="absolute inset-0 cursor-grab" />
                        <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded font-bold pointer-events-none">{i + 1}</div>
                        {isActive && previewing && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 animate-pulse" />
                        )}
                        {scenes.length > 1 && (
                          <button onClick={e => { e.stopPropagation(); deleteScene(i); }}
                            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 bg-red-600/80 rounded-full w-4 h-4 flex items-center justify-center transition-opacity z-10">
                            <X className="w-2.5 h-2.5 text-white" />
                          </button>
                        )}
                      </div>
                      <div className="bg-black/70 flex items-center justify-between px-1.5 py-0.5 gap-1">
                        <input type="number" min={1} max={30}
                          value={dur}
                          onClick={e => e.stopPropagation()}
                          onChange={e => { e.stopPropagation(); setSceneDuration(i, Math.max(1, Math.min(30, parseInt(e.target.value) || dur))); }}
                          className="w-8 text-center text-[9px] text-white bg-transparent border-none outline-none font-mono"
                        />
                        <span className="text-[8px] text-white/40">s</span>
                        <button onClick={e => { e.stopPropagation(); duplicateScene(i); }}
                          className="text-white/30 hover:text-white/70 transition-colors" title="Duplicar">
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* V3: Transition button between clips */}
                    {i < scenes.length - 1 && (
                      <div style={{ position: "relative", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={e => { e.stopPropagation(); setTransPop(transPop === i ? null : i); }}
                          className={cn(
                            "w-7 h-7 rounded-full border flex items-center justify-center text-[9px] font-bold transition-all mx-0.5 mb-3",
                            transPop === i
                              ? "bg-cyan-500 border-cyan-400 text-white shadow-[0_0_0_2px_rgba(103,210,210,0.3)]"
                              : "bg-neutral-800 border-white/20 text-white/50 hover:border-cyan-500/50 hover:text-cyan-400"
                          )}
                          title={`Transição: ${trans}`}
                        >
                          {TRANS_BADGE[trans] ?? "F"}
                        </button>

                        {/* Popover */}
                        {transPop === i && (
                          <div
                            className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 bg-neutral-800 border border-white/15 rounded-xl shadow-2xl p-3 w-64"
                            onClick={e => e.stopPropagation()}
                          >
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Transição → cena {i + 2}</p>
                            <div className="grid grid-cols-4 gap-1 mb-3">
                              {TRANS_PRESETS.map(tp => (
                                <button key={tp.value}
                                  onClick={() => {
                                    setScenes(prev => prev.map((sc, si) => si === i ? { ...sc, transition: tp.value } : sc));
                                  }}
                                  className={cn(
                                    "flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg border text-center transition-all",
                                    scenes[i].transition === tp.value
                                      ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                                      : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/70"
                                  )}>
                                  <span className="text-base leading-none">{tp.icon}</span>
                                  <span className="text-[8px] leading-tight">{tp.label}</span>
                                </button>
                              ))}
                            </div>

                            {/* Duration slider */}
                            <div className="space-y-1 mb-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-white/40">Duração</span>
                                <span className="text-[10px] text-cyan-300 font-mono">{scenes[i].transitionMs ?? 500}ms</span>
                              </div>
                              <input type="range" min={150} max={2000} step={50}
                                value={scenes[i].transitionMs ?? 500}
                                onChange={e => setScenes(prev => prev.map((sc, si) => si === i ? { ...sc, transitionMs: parseInt(e.target.value) } : sc))}
                                className="w-full accent-cyan-500" />
                            </div>

                            {/* Color for colorBlock */}
                            {scenes[i].transition === "colorBlock" && (
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] text-white/40">Cor do bloco</span>
                                <input type="color" value={scenes[i].transitionColor ?? "#0d1117"}
                                  onChange={e => setScenes(prev => prev.map((sc, si) => si === i ? { ...sc, transitionColor: e.target.value } : sc))}
                                  className="w-8 h-6 rounded cursor-pointer border border-white/20" />
                              </div>
                            )}

                            {/* Apply to all */}
                            <button
                              onClick={() => {
                                const sc = scenes[i];
                                applyTransitionToAll(sc.transition ?? "fade", sc.transitionMs ?? 500, sc.transitionColor ?? "#0d1117");
                                setTransPop(null);
                              }}
                              className="w-full text-[10px] text-cyan-400/70 hover:text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/40 rounded-lg py-1 transition-colors">
                              ✓ Aplicar a todas as cenas
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        {/* ── RIGHT PANEL */}
        <aside className="w-64 shrink-0 border-l bg-card flex flex-col overflow-hidden">
          <div className="flex border-b shrink-0">
            {(["cena", "texto", "transicao", "animacao"] as RightTab[]).map(t => {
              const disabled = t === "texto" && !selectedElem;
              return (
                <button key={t} onClick={() => !disabled && setRightTab(t)}
                  className={cn("flex-1 py-1.5 text-[9px] font-semibold uppercase tracking-wide transition-colors",
                    rightTab === t ? "bg-primary/10 text-primary border-b-2 border-primary" :
                    disabled ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground")}>
                  {t === "cena" ? "Cena" : t === "texto" ? "Texto" : t === "transicao" ? "Trans." : "Anim."}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* ── CENA TAB */}
            {rightTab === "cena" && (
              <div className="p-3 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cena {currentSceneIdx + 1} / {scenes.length}</p>
                <div className="space-y-1">
                  <Label className="text-xs">Duração: {scene.duration ?? project.durationSeconds}s</Label>
                  <input type="range" min={1} max={30} step={1}
                    value={scene.duration ?? project.durationSeconds}
                    onChange={e => setSceneDuration(currentSceneIdx, parseInt(e.target.value))}
                    className="w-full accent-cyan-500" />
                </div>
                {scene.bgImage && (
                  <>
                    <Separator />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Foto de fundo</p>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Encaixe</Label>
                      <div className="flex gap-1">
                        {(["cover", "contain", "fill"] as const).map(fit => (
                          <button key={fit} onClick={() => updateScene({ mediaFit: fit })}
                            className={cn("flex-1 text-[10px] py-1 rounded border font-medium transition-colors",
                              scene.mediaFit === fit ? "border-cyan-500 bg-cyan-500/15 text-cyan-300" : "border-white/10 text-white/40 hover:border-white/25")}>
                            {fit}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Posição</Label>
                      <div className="grid grid-cols-3 gap-1">
                        {(["top", "center", "bottom", "left", "right"] as const).map(pos => (
                          <button key={pos} onClick={() => updateScene({ mediaPosition: pos })}
                            className={cn("text-[10px] py-1 rounded border font-medium transition-colors",
                              scene.mediaPosition === pos ? "border-cyan-500 bg-cyan-500/15 text-cyan-300" : "border-white/10 text-white/40 hover:border-white/25")}>
                            {pos === "top" ? "↑ Topo" : pos === "center" ? "· Centro" : pos === "bottom" ? "↓ Baixo" : pos === "left" ? "← Esq" : "Dir →"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><ZoomIn className="w-3 h-3" /> Zoom: {scene.mediaZoom ?? 100}%</Label>
                      <input type="range" min={100} max={200} step={5}
                        value={scene.mediaZoom ?? 100}
                        onChange={e => updateScene({ mediaZoom: parseInt(e.target.value) })}
                        className="w-full accent-cyan-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] flex items-center gap-1"><Move className="w-2.5 h-2.5" /> Pan X: {scene.mediaPanX ?? 0}%</Label>
                        <input type="range" min={-50} max={50} step={1}
                          value={scene.mediaPanX ?? 0}
                          onChange={e => updateScene({ mediaPanX: parseInt(e.target.value) })}
                          className="w-full accent-cyan-500" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Pan Y: {scene.mediaPanY ?? 0}%</Label>
                        <input type="range" min={-50} max={50} step={1}
                          value={scene.mediaPanY ?? 0}
                          onChange={e => updateScene({ mediaPanY: parseInt(e.target.value) })}
                          className="w-full accent-cyan-500" />
                      </div>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={() => duplicateScene(currentSceneIdx)}>
                    <Copy className="w-3 h-3" /> Duplicar
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1 text-destructive hover:text-destructive"
                    onClick={() => { setScene(prev => ({ ...prev, elements: [] })); setSelected(null); }}>
                    <Trash2 className="w-3 h-3" /> Limpar
                  </Button>
                </div>
              </div>
            )}

            {/* ── TRANSIÇÃO TAB (V3: full grid + slider) */}
            {rightTab === "transicao" && (
              <div className="p-3 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transição → próxima cena</p>

                {/* V3: grid of all presets */}
                <div className="grid grid-cols-3 gap-1">
                  {TRANS_PRESETS.map(tp => (
                    <button key={tp.value}
                      onClick={() => updateScene({ transition: tp.value })}
                      className={cn(
                        "flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border text-center transition-all",
                        scene.transition === tp.value
                          ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                          : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/70"
                      )}>
                      <span className="text-xl leading-none">{tp.icon}</span>
                      <span className="text-[9px] leading-tight mt-0.5">{tp.label}</span>
                    </button>
                  ))}
                </div>

                {/* V3: ms slider instead of fixed buttons */}
                {scene.transition !== "none" && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Label className="text-xs">Duração</Label>
                      <span className="text-[10px] text-cyan-300 font-mono">{scene.transitionMs ?? 500}ms</span>
                    </div>
                    <input type="range" min={150} max={2000} step={50}
                      value={scene.transitionMs ?? 500}
                      onChange={e => updateScene({ transitionMs: parseInt(e.target.value) })}
                      className="w-full accent-cyan-500" />
                    <div className="flex justify-between text-[9px] text-white/20">
                      <span>150ms</span><span>rápido</span><span>2000ms</span>
                    </div>
                  </div>
                )}

                {/* Color for colorBlock */}
                {scene.transition === "colorBlock" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cor do bloco</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={scene.transitionColor ?? "#0d1117"}
                        onChange={e => updateScene({ transitionColor: e.target.value })}
                        className="w-10 h-8 rounded cursor-pointer border border-white/20" />
                      <span className="text-[10px] text-white/40 font-mono">{scene.transitionColor ?? "#0d1117"}</span>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Apply to all */}
                <button
                  onClick={() => applyTransitionToAll(scene.transition ?? "fade", scene.transitionMs ?? 500, scene.transitionColor ?? "#0d1117")}
                  className="w-full text-[10px] text-cyan-400/70 hover:text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/40 rounded-lg py-1.5 transition-colors">
                  ✓ Aplicar a todas as cenas
                </button>

                <Separator />

                {/* Ken Burns V3: +panLeft/panRight */}
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ken Burns</p>
                <div className="grid grid-cols-3 gap-1">
                  {(["off", "zoomIn", "zoomOut", "panLeft", "panRight"] as const).map(kb => (
                    <button key={kb} onClick={() => updateScene({ kenBurns: kb })}
                      className={cn("text-[10px] py-1.5 rounded border font-medium transition-colors",
                        scene.kenBurns === kb ? "border-cyan-500 bg-cyan-500/15 text-cyan-300" : "border-white/10 text-white/40 hover:border-white/25")}>
                      {kb === "off" ? "Off" : kb === "zoomIn" ? "Zoom +" : kb === "zoomOut" ? "Zoom −" : kb === "panLeft" ? "Pan ←" : "Pan →"}
                    </button>
                  ))}
                </div>
                {scene.kenBurns !== "off" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1"><Sliders className="w-3 h-3" /> Intensidade</Label>
                    <div className="flex gap-1">
                      {([1.05, 1.08, 1.12] as const).map(v => (
                        <button key={v} onClick={() => updateScene({ kenBurnsIntensity: v })}
                          className={cn("flex-1 text-[10px] py-1 rounded border font-medium transition-colors",
                            scene.kenBurnsIntensity === v ? "border-cyan-500 bg-cyan-500/15 text-cyan-300" : "border-white/10 text-white/40 hover:border-white/25")}>
                          {v === 1.05 ? "Leve" : v === 1.08 ? "Médio" : "Forte"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TEXTO / ELEMENTO TAB */}
            {rightTab === "texto" && selectedElem && (
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {selectedElem.type === "text" ? "Texto" : selectedElem.type === "image" ? "Imagem" : selectedElem.type === "rect" ? "Retângulo" : "Elipse"}
                  </p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-foreground"
                      onClick={() => updateElem(selectedElem.id, { locked: !selectedElem.locked })}>
                      {selectedElem.locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-foreground"
                      onClick={() => duplicateElem(selectedElem.id)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteElem(selectedElem.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Layer order */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Camada</Label>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="flex-1 h-7" onClick={() => moveLayer(selectedElem.id, "front")}><BringToFront className="w-3 h-3" /></Button>
                    <Button variant="outline" size="sm" className="flex-1 h-7" onClick={() => moveLayer(selectedElem.id, "up")}>↑</Button>
                    <Button variant="outline" size="sm" className="flex-1 h-7" onClick={() => moveLayer(selectedElem.id, "down")}>↓</Button>
                    <Button variant="outline" size="sm" className="flex-1 h-7" onClick={() => moveLayer(selectedElem.id, "back")}><SendToBack className="w-3 h-3" /></Button>
                  </div>
                </div>

                {/* Align */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Alinhar</Label>
                  <div className="grid grid-cols-3 gap-1">
                    <Button variant="outline" size="sm" className="h-7" onClick={() => alignElem(selectedElem.id, "left")}><AlignStartVertical className="w-3 h-3" /></Button>
                    <Button variant="outline" size="sm" className="h-7" onClick={() => alignElem(selectedElem.id, "centerH")}><AlignHorizontalJustifyCenter className="w-3 h-3" /></Button>
                    <Button variant="outline" size="sm" className="h-7" onClick={() => alignElem(selectedElem.id, "right")}><AlignEndVertical className="w-3 h-3" /></Button>
                    <Button variant="outline" size="sm" className="h-7" onClick={() => alignElem(selectedElem.id, "top")}><AlignStartHorizontal className="w-3 h-3" /></Button>
                    <Button variant="outline" size="sm" className="h-7" onClick={() => alignElem(selectedElem.id, "centerV")}><AlignVerticalJustifyCenter className="w-3 h-3" /></Button>
                    <Button variant="outline" size="sm" className="h-7" onClick={() => alignElem(selectedElem.id, "bottom")}><AlignEndHorizontal className="w-3 h-3" /></Button>
                  </div>
                </div>

                {/* Transform */}
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Transformação</Label>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Largura: {selectedElem.w.toFixed(0)}%</Label>
                    <input type="range" min={5} max={100} step={1} value={selectedElem.w}
                      onChange={e => updateElem(selectedElem.id, { w: parseFloat(e.target.value) })} className="w-full accent-blue-500" />
                  </div>
                  {selectedElem.type !== "text" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Altura: {selectedElem.h.toFixed(0)}%</Label>
                      <input type="range" min={3} max={100} step={1} value={selectedElem.h || 10}
                        onChange={e => updateElem(selectedElem.id, { h: parseFloat(e.target.value) })} className="w-full accent-blue-500" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rotação: {selectedElem.rotation}°</Label>
                    <input type="range" min={0} max={359} step={1} value={selectedElem.rotation}
                      onChange={e => updateElem(selectedElem.id, { rotation: parseFloat(e.target.value) })} className="w-full accent-blue-500" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Opacidade: {Math.round(selectedElem.opacity * 100)}%</Label>
                    <input type="range" min={0} max={1} step={0.05} value={selectedElem.opacity}
                      onChange={e => updateElem(selectedElem.id, { opacity: parseFloat(e.target.value) })} className="w-full accent-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">X: {selectedElem.x.toFixed(0)}%</Label>
                      <input type="range" min={0} max={100} step={1} value={selectedElem.x}
                        onChange={e => updateElem(selectedElem.id, { x: parseFloat(e.target.value) })} className="w-full accent-blue-500" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Y: {selectedElem.y.toFixed(0)}%</Label>
                      <input type="range" min={0} max={100} step={1} value={selectedElem.y}
                        onChange={e => updateElem(selectedElem.id, { y: parseFloat(e.target.value) })} className="w-full accent-blue-500" />
                    </div>
                  </div>
                  {/* V3: Flip */}
                  <div className="flex gap-1">
                    <button onClick={() => updateElem(selectedElem.id, { flipX: !selectedElem.flipX })}
                      className={cn("flex-1 text-[10px] py-1 rounded border transition-colors",
                        selectedElem.flipX ? "border-blue-500 bg-blue-500/15 text-blue-300" : "border-white/10 text-white/40 hover:border-white/25")}>
                      ↔ Flip H
                    </button>
                    <button onClick={() => updateElem(selectedElem.id, { flipY: !selectedElem.flipY })}
                      className={cn("flex-1 text-[10px] py-1 rounded border transition-colors",
                        selectedElem.flipY ? "border-blue-500 bg-blue-500/15 text-blue-300" : "border-white/10 text-white/40 hover:border-white/25")}>
                      ↕ Flip V
                    </button>
                  </div>
                </div>

                <Separator />

                {/* Text-specific */}
                {selectedElem.type === "text" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Conteúdo</Label>
                      <Textarea value={selectedElem.text}
                        onChange={e => updateElem(selectedElem.id, { text: e.target.value })}
                        className="text-sm resize-none min-h-[60px]" rows={3} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fonte</Label>
                      <select value={selectedElem.fontFamily}
                        onChange={e => updateElem(selectedElem.id, { fontFamily: e.target.value })}
                        className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                        style={{ fontFamily: selectedElem.fontFamily }}>
                        {FONTS.map(f => <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tamanho: {selectedElem.fontSize.toFixed(1)}%</Label>
                      <input type="range" min={1} max={18} step={0.5} value={selectedElem.fontSize}
                        onChange={e => updateElem(selectedElem.id, { fontSize: parseFloat(e.target.value) })} className="w-full accent-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cor do texto</Label>
                      <div className="flex flex-wrap gap-1">
                        {TEXT_COLORS.map(c => <ColorDot key={c} color={c} selected={selectedElem.color === c} onClick={() => updateElem(selectedElem.id, { color: c })} />)}
                      </div>
                      <input type="color" value={selectedElem.color}
                        onChange={e => updateElem(selectedElem.id, { color: e.target.value })} className="w-full h-8 rounded cursor-pointer border mt-1" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Estilo</Label>
                      <div className="flex gap-1">
                        <Button variant={selectedElem.fontWeight === "bold" ? "default" : "outline"} size="sm" className="flex-1 h-7"
                          onClick={() => updateElem(selectedElem.id, { fontWeight: selectedElem.fontWeight === "bold" ? "normal" : "bold" })}><Bold className="w-3 h-3" /></Button>
                        <Button variant={selectedElem.fontStyle === "italic" ? "default" : "outline"} size="sm" className="flex-1 h-7"
                          onClick={() => updateElem(selectedElem.id, { fontStyle: selectedElem.fontStyle === "italic" ? "normal" : "italic" })}><Italic className="w-3 h-3" /></Button>
                        <Button variant={selectedElem.textDecoration === "underline" ? "default" : "outline"} size="sm" className="flex-1 h-7"
                          onClick={() => updateElem(selectedElem.id, { textDecoration: selectedElem.textDecoration === "underline" ? "none" : "underline" })}>
                          <span className="text-xs underline font-bold">U</span>
                        </Button>
                        <Button variant={selectedElem.shadow ? "default" : "outline"} size="sm" className="flex-1 h-7 text-[10px]"
                          onClick={() => updateElem(selectedElem.id, { shadow: !selectedElem.shadow })}>S</Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Alinhamento</Label>
                      <div className="flex gap-1">
                        {(["left", "center", "right"] as const).map(align => (
                          <Button key={align} variant={selectedElem.textAlign === align ? "default" : "outline"} size="sm" className="flex-1 h-7"
                            onClick={() => updateElem(selectedElem.id, { textAlign: align })}>
                            {align === "left" ? <AlignLeft className="w-3 h-3" /> : align === "center" ? <AlignCenter className="w-3 h-3" /> : <AlignRight className="w-3 h-3" />}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Contorno: {selectedElem.textStrokeWidth ?? 0}px</Label>
                      <input type="range" min={0} max={8} step={0.5} value={selectedElem.textStrokeWidth ?? 0}
                        onChange={e => updateElem(selectedElem.id, { textStrokeWidth: parseFloat(e.target.value) })} className="w-full accent-blue-500" />
                      {(selectedElem.textStrokeWidth ?? 0) > 0 && (
                        <input type="color" value={selectedElem.textStrokeColor ?? "#000000"}
                          onChange={e => updateElem(selectedElem.id, { textStrokeColor: e.target.value })} className="w-full h-7 rounded cursor-pointer border" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Espaç. letras: {selectedElem.letterSpacing}px</Label>
                      <input type="range" min={-5} max={20} step={0.5} value={selectedElem.letterSpacing}
                        onChange={e => updateElem(selectedElem.id, { letterSpacing: parseFloat(e.target.value) })} className="w-full accent-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Altura da linha: {selectedElem.lineHeight.toFixed(2)}</Label>
                      <input type="range" min={0.8} max={3} step={0.05} value={selectedElem.lineHeight}
                        onChange={e => updateElem(selectedElem.id, { lineHeight: parseFloat(e.target.value) })} className="w-full accent-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fundo do texto</Label>
                      <input type="color" value={selectedElem.bgColor || "#000000"}
                        onChange={e => updateElem(selectedElem.id, { bgColor: e.target.value })} className="w-full h-7 rounded cursor-pointer border" />
                      {selectedElem.bgColor && <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground" onClick={() => updateElem(selectedElem.id, { bgColor: "" })}>Remover fundo</Button>}
                    </div>
                  </>
                )}

                {/* Shape properties */}
                {(selectedElem.type === "rect" || selectedElem.type === "ellipse") && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cor de preenchimento</Label>
                      <input type="color" value={selectedElem.fillColor || "#3b82f6"}
                        onChange={e => updateElem(selectedElem.id, { fillColor: e.target.value })} className="w-full h-9 rounded cursor-pointer border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cor da borda</Label>
                      <input type="color" value={selectedElem.strokeColor || "#ffffff"}
                        onChange={e => updateElem(selectedElem.id, { strokeColor: e.target.value })} className="w-full h-8 rounded cursor-pointer border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Espessura da borda: {selectedElem.strokeWidth}px</Label>
                      <input type="range" min={0} max={20} step={1} value={selectedElem.strokeWidth}
                        onChange={e => updateElem(selectedElem.id, { strokeWidth: parseFloat(e.target.value) })} className="w-full accent-blue-500" />
                    </div>
                    {selectedElem.type === "rect" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Arredondamento: {selectedElem.borderRadius}%</Label>
                        <input type="range" min={0} max={50} step={1} value={selectedElem.borderRadius}
                          onChange={e => updateElem(selectedElem.id, { borderRadius: parseFloat(e.target.value) })} className="w-full accent-blue-500" />
                      </div>
                    )}
                  </>
                )}

                {/* Image: swap + V3 filters */}
                {selectedElem.type === "image" && (
                  <>
                    <Button variant="outline" size="sm" className="w-full gap-2 h-8" onClick={addImage}><ImageIcon className="w-3.5 h-3.5" /> Trocar imagem</Button>
                    <Separator />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      <Sun className="w-3 h-3" /> Ajustes de imagem
                    </p>
                    {/* Presets */}
                    <div className="grid grid-cols-2 gap-1">
                      {(["none", "natural", "warm", "cold"] as const).map(preset => (
                        <button key={preset}
                          onClick={() => updateElem(selectedElem.id, { imgFilter: { ...selectedElem.imgFilter, preset, brightness: preset === "none" ? 100 : selectedElem.imgFilter?.brightness, contrast: preset === "none" ? 100 : selectedElem.imgFilter?.contrast, saturate: preset === "none" ? 100 : selectedElem.imgFilter?.saturate } })}
                          className={cn("text-[10px] py-1 rounded border transition-colors",
                            (selectedElem.imgFilter?.preset ?? "none") === preset
                              ? "border-blue-500 bg-blue-500/15 text-blue-300"
                              : "border-white/10 text-white/40 hover:border-white/25")}>
                          {preset === "none" ? "Original" : preset === "natural" ? "Natural" : preset === "warm" ? "🌅 Quente" : "❄ Frio"}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px]">Brilho: {selectedElem.imgFilter?.brightness ?? 100}%</Label>
                      <input type="range" min={50} max={150} step={5}
                        value={selectedElem.imgFilter?.brightness ?? 100}
                        onChange={e => updateElem(selectedElem.id, { imgFilter: { ...selectedElem.imgFilter, brightness: parseInt(e.target.value) } })}
                        className="w-full accent-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px]">Contraste: {selectedElem.imgFilter?.contrast ?? 100}%</Label>
                      <input type="range" min={50} max={150} step={5}
                        value={selectedElem.imgFilter?.contrast ?? 100}
                        onChange={e => updateElem(selectedElem.id, { imgFilter: { ...selectedElem.imgFilter, contrast: parseInt(e.target.value) } })}
                        className="w-full accent-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px]">Saturação: {selectedElem.imgFilter?.saturate ?? 100}%</Label>
                      <input type="range" min={0} max={200} step={10}
                        value={selectedElem.imgFilter?.saturate ?? 100}
                        onChange={e => updateElem(selectedElem.id, { imgFilter: { ...selectedElem.imgFilter, saturate: parseInt(e.target.value) } })}
                        className="w-full accent-blue-500" />
                    </div>
                    {(selectedElem.imgFilter?.brightness !== undefined || selectedElem.imgFilter?.contrast !== undefined || selectedElem.imgFilter?.saturate !== undefined) && (
                      <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground"
                        onClick={() => updateElem(selectedElem.id, { imgFilter: undefined })}>
                        Resetar filtros
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── ANIMAÇÃO TAB (V3: grid visual + animDuration) */}
            {rightTab === "animacao" && (
              <div className="p-3 space-y-3">
                {selectedElem ? (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Animação de Entrada
                    </p>

                    {/* V3: visual grid with emoji */}
                    <div className="grid grid-cols-3 gap-1">
                      {ANIM_OPTIONS.map(opt => (
                        <button key={opt.value}
                          onClick={() => updateElem(selectedElem.id, { animation: opt.value })}
                          className={cn(
                            "flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border text-center transition-all",
                            (selectedElem.animation ?? "none") === opt.value
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-input text-muted-foreground hover:text-foreground hover:border-input/80"
                          )}>
                          <span className="text-lg leading-none">{opt.emoji}</span>
                          <span className="text-[8px] leading-tight mt-0.5">{opt.label}</span>
                        </button>
                      ))}
                    </div>

                    {(selectedElem.animation ?? "none") !== "none" && (
                      <>
                        {/* V3: animDuration slider */}
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <Label className="text-[10px] text-muted-foreground">Duração da animação</Label>
                            <span className="text-[10px] text-primary font-mono">{(selectedElem.animDuration ?? 0.75).toFixed(2)}s</span>
                          </div>
                          <input type="range" min={0.2} max={2.5} step={0.05}
                            value={selectedElem.animDuration ?? 0.75}
                            onChange={e => updateElem(selectedElem.id, { animDuration: parseFloat(e.target.value) })}
                            className="w-full accent-primary" />
                        </div>

                        {/* V3: animDelay */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Entrada após (atraso)</Label>
                          <div className="flex gap-1 flex-wrap">
                            {[0, 0.3, 0.5, 0.8, 1, 1.5, 2, 3].map(d => (
                              <button key={d}
                                onClick={() => updateElem(selectedElem.id, { animDelay: d })}
                                className={cn("text-[10px] px-2 py-1 rounded border transition-colors",
                                  (selectedElem.animDelay ?? 0) === d ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground hover:text-foreground")}>
                                {d}s
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* V3: animLoop */}
                        <button
                          onClick={() => updateElem(selectedElem.id, { animLoop: !selectedElem.animLoop })}
                          className={cn("w-full text-[10px] py-1.5 rounded border transition-colors",
                            selectedElem.animLoop ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:text-foreground")}>
                          {selectedElem.animLoop ? "🔁 Loop ativo (preview)" : "Loop desativado"}
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-[10px] text-muted-foreground text-center py-4">Selecione um elemento para editar animação</p>
                )}
              </div>
            )}
          </div>

          <div className="px-3 py-2 border-t border-white/5 shrink-0">
            <p className="text-[9px] text-muted-foreground/50 text-center">Del apaga · Ctrl+Z desfaz · Ctrl+Y refaz · Ctrl+D duplica</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
