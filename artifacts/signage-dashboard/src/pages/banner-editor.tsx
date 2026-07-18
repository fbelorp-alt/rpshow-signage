import { useState, useRef, useCallback, useEffect } from "react";
import { toPng } from "html-to-image";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  useRequestUploadUrl,
  useCreateMedia,
  useUpdateMedia,
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
  ZoomIn, ZoomOut, Move, Sliders, Sparkles, Sun, Search,
} from "lucide-react";

// ── Nano-id helper ─────────────────────────────────────────────────────────────
const nid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// ── URL resolver — /objects/... → /api/storage/objects/... ────────────────────
function resolveUrl(url: string | undefined | null): string {
  if (!url) return "";
  if (url.startsWith("/objects/")) return `/api/storage${url}`;
  return url;
}

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
  | "zoom" | "zoomOut"
  | "wipeLeft" | "wipeRight" | "wipeTop" | "wipeBottom"
  | "circle"
  | "colorBlock"
  | "pushLeft" | "pushRight" | "pushUp" | "pushDown"
  | "splitH" | "splitV"
  | "diagonalTL" | "diagonalBR"
  | "blur" | "flash";

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
type CropEdge = "t" | "b" | "l" | "r" | "tl" | "tr" | "bl" | "br";

interface ImgFilter {
  brightness?: number;   // 50–150, default 100
  contrast?: number;
  saturate?: number;
  preset?: "none" | "natural" | "warm" | "cold";
}

// ── ShapeKind ─────────────────────────────────────────────────────────────────
type ShapeKind = "rect" | "rounded" | "pill" | "ellipse" | "circle"
  | "triangle" | "diamond" | "pentagon" | "hexagon" | "star"
  | "arrowRight" | "arrowLeft" | "lineH" | "lineV";

function getShapeClipPath(kind: ShapeKind): string | undefined {
  switch (kind) {
    case "triangle":   return "polygon(50% 0%, 0% 100%, 100% 100%)";
    case "diamond":    return "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
    case "pentagon":   return "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)";
    case "hexagon":    return "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
    case "star":       return "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
    case "arrowRight": return "polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)";
    case "arrowLeft":  return "polygon(40% 0%, 40% 20%, 100% 20%, 100% 80%, 40% 80%, 40% 100%, 0% 50%)";
    default: return undefined;
  }
}

function getShapeBorderRadius(kind: ShapeKind): number {
  if (kind === "ellipse" || kind === "circle") return 50;
  if (kind === "pill") return 50;
  if (kind === "rounded") return 20;
  return 0;
}

const SHAPE_LABEL: Record<ShapeKind, string> = {
  rect: "Retângulo", rounded: "Rect. Redondo", pill: "Pílula",
  ellipse: "Elipse", circle: "Círculo",
  triangle: "Triângulo", diamond: "Losango", pentagon: "Pentágono",
  hexagon: "Hexágono", star: "Estrela",
  arrowRight: "Seta →", arrowLeft: "Seta ←",
  lineH: "Linha H", lineV: "Linha V",
};

// ── CanvasElem ────────────────────────────────────────────────────────────────
interface CanvasElem {
  id: string;
  type: "text" | "image" | "rect" | "ellipse";
  shapeKind?: ShapeKind;
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
  cropInset?: { t: number; r: number; b: number; l: number }; // V3: crop handles
  // Text outline (V2)
  textStrokeColor?: string;
  textStrokeWidth?: number;
}

type PexelsVideo = {
  id: number;
  image: string;
  duration: number;
  user: { name: string };
  video_files: {
    id: number;
    quality: string;
    width: number;
    height: number;
    link: string;
    file_type: string;
  }[];
};

interface BgSlide {
  id: string;
  url: string;
  type: "image" | "video";
  duration: number;           // seconds
  transition: SceneTransition;
  transitionMs: number;
}

interface Scene {
  id: string;          // V2 — stable key
  bg: string;
  bgImage: string;
  bgVideo?: string;
  bgSlides?: BgSlide[]; // background slideshow
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
  { value: "none",        label: "Corte",      icon: "✂" },
  { value: "fade",        label: "Fade",       icon: "◌" },
  { value: "blur",        label: "Desfoque",   icon: "◈" },
  { value: "flash",       label: "Flash",      icon: "⚡" },
  { value: "zoom",        label: "Zoom Entra", icon: "⊕" },
  { value: "zoomOut",     label: "Zoom Sai",   icon: "⊖" },
  { value: "slideLeft",   label: "Slide ←",    icon: "←" },
  { value: "slideRight",  label: "Slide →",    icon: "→" },
  { value: "slideUp",     label: "Slide ↑",    icon: "↑" },
  { value: "slideDown",   label: "Slide ↓",    icon: "↓" },
  { value: "pushLeft",    label: "Push ←",     icon: "◁" },
  { value: "pushRight",   label: "Push →",     icon: "▷" },
  { value: "pushUp",      label: "Push ↑",     icon: "△" },
  { value: "pushDown",    label: "Push ↓",     icon: "▽" },
  { value: "wipeLeft",    label: "Wipe ←",     icon: "▶" },
  { value: "wipeRight",   label: "Wipe →",     icon: "◀" },
  { value: "wipeTop",     label: "Wipe ↓",     icon: "▼" },
  { value: "wipeBottom",  label: "Wipe ↑",     icon: "▲" },
  { value: "splitH",      label: "Dividir H",  icon: "↕" },
  { value: "splitV",      label: "Dividir V",  icon: "↔" },
  { value: "circle",      label: "Círculo",    icon: "●" },
  { value: "diagonalTL",  label: "Diagonal ↘", icon: "◸" },
  { value: "diagonalBR",  label: "Diagonal ↖", icon: "◿" },
  { value: "colorBlock",  label: "Bloco Cor",  icon: "■" },
];

// Badge label for transition in timeline
const TRANS_BADGE: Record<SceneTransition, string> = {
  none: "✂", fade: "F", blur: "◈", flash: "⚡",
  zoom: "Z+", zoomOut: "Z-",
  slideLeft: "←", slideRight: "→", slideUp: "↑", slideDown: "↓",
  pushLeft: "P←", pushRight: "P→", pushUp: "P↑", pushDown: "P↓",
  wipeLeft: "W←", wipeRight: "W→", wipeTop: "W↓", wipeBottom: "W↑",
  splitH: "↕", splitV: "↔",
  circle: "◉", diagonalTL: "◸", diagonalBR: "◿", colorBlock: "■",
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

// ── Template segment type ──────────────────────────────────────────────────────
type TemplateSegment = "geral" | "alimentacao" | "varejo" | "saude" | "eventos" | "servicos" | "promo";

// ── Template helpers ───────────────────────────────────────────────────────────
function mkT(x: number, y: number, w: number, text: string, fontSize: number, color: string, p: Partial<CanvasElem> = {}): CanvasElem {
  return {
    id: "t", type: "text", x, y, w, h: 0, rotation: 0, src: "", text, fontSize, color,
    fontFamily: "Inter, sans-serif", fontWeight: "normal", fontStyle: "normal",
    textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.25,
    shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0,
    borderRadius: 0, locked: false, animation: "none", animDelay: 0, animDuration: 0.75, animLoop: false,
    flipX: false, flipY: false, textStrokeColor: "#000000", textStrokeWidth: 0, ...p,
  };
}
function mkR(x: number, y: number, w: number, h: number, fillColor: string, p: Partial<CanvasElem> = {}): CanvasElem {
  return {
    id: "r", type: "rect", x, y, w, h, rotation: 0, src: "", text: "", fontSize: 4,
    fontFamily: "Inter, sans-serif", fontWeight: "normal", fontStyle: "normal",
    textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.25,
    color: "#ffffff", shadow: false, bgColor: "", opacity: 1, fillColor, strokeColor: "", strokeWidth: 0,
    borderRadius: 0, locked: false, animation: "none", animDelay: 0, animDuration: 0.75, animLoop: false,
    flipX: false, flipY: false, textStrokeColor: "#000000", textStrokeWidth: 0, ...p,
  };
}
function mkE(x: number, y: number, w: number, h: number, fillColor: string, p: Partial<CanvasElem> = {}): CanvasElem {
  return { ...mkR(x, y, w, h, fillColor, p), type: "ellipse", borderRadius: 50 };
}
function SC(bg: string, t: SceneTransition, elements: CanvasElem[], transitionMs = 500, transitionColor = "#0d1117"): Omit<Scene, "id"> {
  return {
    bg, bgImage: "", transition: t, transitionMs, transitionColor,
    kenBurns: "off", kenBurnsIntensity: 1.08, mediaFit: "cover", mediaPosition: "center",
    mediaZoom: 100, mediaPanX: 0, mediaPanY: 0, elements,
  };
}

// ── Template data ──────────────────────────────────────────────────────────────
const TEMPLATES: { name: string; emoji: string; segment: TemplateSegment; scene: Omit<Scene, "id"> }[] = [

  // ── Promo ──────────────────────────────────────────────────────────────────────
  {
    name: "Mega Oferta", emoji: "🔥", segment: "promo",
    scene: SC("linear-gradient(135deg,#f97316,#dc2626)", "fade", [
      mkR(50, 9, 100, 18, "rgba(0,0,0,0.25)"),
      mkE(80, 50, 22, 40, "#dc2626", { strokeColor: "#ffffff", strokeWidth: 2 }),
      mkT(42, 9, 60, "PROMOÇÃO ESPECIAL", 5, "#ffffff", { fontWeight: "bold", letterSpacing: 3, animation: "fadeIn", animDelay: 0 }),
      mkT(42, 36, 72, "MEGA OFERTA", 11.2, "#ffffff", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", shadow: true, animation: "pop", animDelay: 0.1 }),
      mkT(42, 54, 65, "Preço exclusivo por tempo limitado", 5.5, "#ffedd5", { animation: "slideUp", animDelay: 0.3 }),
      mkT(80, 44, 22, "50%", 8.8, "#ffffff", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", shadow: true }),
      mkT(80, 56, 22, "OFF", 5.8, "#fef08a", { fontWeight: "bold", letterSpacing: 2 }),
      mkT(42, 78, 62, "APROVEITE AGORA!", 6.5, "#fef08a", { fontWeight: "bold", letterSpacing: 3, animation: "slideUp", animDelay: 0.5 }),
    ]),
  },
  {
    name: "Liquidação", emoji: "💥", segment: "promo",
    scene: SC("linear-gradient(135deg,#1e1e2e,#4c1d95)", "slideLeft", [
      mkR(22, 50, 44, 100, "rgba(109,40,217,0.4)"),
      mkR(50, 90, 100, 20, "#7c3aed", { opacity: 0.85 }),
      mkT(22, 26, 38, "🏷️ LIQUIDAÇÃO", 5.5, "#e9d5ff", { fontWeight: "bold", letterSpacing: 2, animation: "fadeIn" }),
      mkT(22, 44, 38, "ATÉ", 6.8, "#f0abfc", { fontFamily: "Oswald, sans-serif", fontWeight: "bold" }),
      mkT(22, 60, 38, "70%", 16, "#ffffff", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", shadow: true, animation: "pop", animDelay: 0.2 }),
      mkT(22, 74, 36, "de desconto", 5.8, "#d8b4fe", { animation: "fadeIn", animDelay: 0.4 }),
      mkT(73, 34, 48, "Aproveite os melhores preços", 5.8, "#e9d5ff", { animation: "slideLeft", animDelay: 0.3 }),
      mkT(73, 50, 48, "Estoque limitado.", 5.5, "#c4b5fd", { fontStyle: "italic" }),
      mkT(50, 90, 88, "Oferta válida enquanto durar o estoque  •  Não perca!", 5, "#ffffff", { animation: "fadeIn", animDelay: 0.6 }),
    ]),
  },
  {
    name: "Lançamento", emoji: "✨", segment: "promo",
    scene: SC("linear-gradient(135deg,#0f172a,#1e3a5f)", "zoom", [
      mkR(18, 20, 28, 14, "#3b82f6", { borderRadius: 8 }),
      mkT(18, 20, 26, "✨ NOVO", 5.5, "#ffffff", { fontWeight: "bold", letterSpacing: 4 }),
      mkT(50, 42, 88, "Conheça o Lançamento", 9.4, "#f0f9ff", { fontFamily: "Montserrat, sans-serif", fontWeight: "bold", shadow: true, animation: "zoomIn", animDelay: 0.1 }),
      mkT(50, 58, 80, "A experiência que você esperava chegou.", 5.8, "#94a3b8", { fontStyle: "italic", animation: "fadeIn", animDelay: 0.4 }),
      mkE(78, 76, 22, 40, "#3b82f6"),
      mkT(78, 71, 22, "R$ 299", 7.4, "#ffffff", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", shadow: true, animation: "pop", animDelay: 0.5 }),
      mkT(78, 82, 22, "à vista", 5, "#bfdbfe"),
    ]),
  },
  {
    name: "Black Friday", emoji: "🖤", segment: "promo",
    scene: SC("#111111", "fade", [
      mkR(50, 10, 100, 20, "#fbbf24", { opacity: 0.9 }),
      mkT(50, 10, 90, "BLACK FRIDAY", 11.2, "#111111", { fontFamily: "'Bebas Neue', sans-serif", fontWeight: "bold", letterSpacing: 6, animation: "fadeIn" }),
      mkT(50, 32, 88, "DESCONTOS ATÉ 80%", 8.1, "#fbbf24", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", letterSpacing: 4, animation: "slideDown", animDelay: 0.2 }),
      mkR(50, 57, 80, 24, "#fbbf24", { borderRadius: 4 }),
      mkT(50, 53, 78, "SÓ HOJE", 9.4, "#111111", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", letterSpacing: 8, animation: "pop", animDelay: 0.4 }),
      mkT(50, 63, 78, "Meia-noite acaba a promoção", 5, "#111111"),
      mkT(50, 82, 90, "Corra! Estoque limitado.", 5.8, "#d4d4d4", { letterSpacing: 2, animation: "fadeIn", animDelay: 0.6 }),
    ]),
  },

  // ── Varejo ────────────────────────────────────────────────────────────────────
  {
    name: "Vitrine Loja", emoji: "🛍️", segment: "varejo",
    scene: SC("linear-gradient(135deg,#1f2937,#374151)", "slideRight", [
      mkR(6, 50, 12, 100, "#3b82f6", { opacity: 0.8 }),
      mkT(58, 22, 75, "Novidades da Semana", 5.5, "#9ca3af", { letterSpacing: 3, animation: "fadeIn" }),
      mkT(58, 38, 80, "Produtos\nSelecionados", 8.8, "#ffffff", { fontFamily: "Montserrat, sans-serif", fontWeight: "bold", shadow: true, lineHeight: 1.15, animation: "slideLeft", animDelay: 0.2 }),
      mkT(58, 60, 70, "A partir de", 5.5, "#9ca3af", { animation: "fadeIn", animDelay: 0.4 }),
      mkT(58, 73, 72, "R$ 49,90", 10, "#3b82f6", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", animation: "pop", animDelay: 0.5 }),
      mkT(58, 86, 70, "Visite nossa loja e confira!", 5, "#6b7280", { animation: "fadeIn", animDelay: 0.7 }),
    ]),
  },

  // ── Alimentação ───────────────────────────────────────────────────────────────
  {
    name: "Cardápio do Dia", emoji: "🍽️", segment: "alimentacao",
    scene: SC("linear-gradient(160deg,#1c0a00,#3b1200)", "wipeLeft", [
      mkR(50, 8, 100, 16, "#92400e", { opacity: 0.7 }),
      mkR(50, 94, 100, 12, "#92400e", { opacity: 0.6 }),
      mkT(50, 8, 90, "🍽️ CARDÁPIO DO DIA", 6.8, "#fbbf24", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", letterSpacing: 3, animation: "slideDown" }),
      mkT(50, 30, 82, "Prato Principal", 6.8, "#fef3c7", { fontWeight: "bold", animation: "fadeIn", animDelay: 0.2 }),
      mkT(50, 43, 80, "Arroz • Feijão • Frango Grelhado", 5.5, "#fde68a", { animation: "fadeIn", animDelay: 0.3 }),
      mkT(50, 56, 82, "Sobremesa: Mousse de Maracujá", 5.5, "#fef3c7", { fontStyle: "italic", animation: "fadeIn", animDelay: 0.4 }),
      mkT(50, 74, 60, "R$ 29,90", 11.2, "#34d399", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", shadow: true, animation: "pop", animDelay: 0.6 }),
      mkT(50, 94, 80, "⏰ Seg–Sex 11h–14h  •  Peça pelo WhatsApp", 5, "#fcd34d"),
    ]),
  },
  {
    name: "Pizza Promo", emoji: "🍕", segment: "alimentacao",
    scene: SC("linear-gradient(135deg,#7f1d1d,#991b1b)", "circle", [
      mkE(50, 50, 55, 98, "rgba(0,0,0,0.2)"),
      mkE(78, 22, 24, 43, "#dc2626", { strokeColor: "#fbbf24", strokeWidth: 3 }),
      mkT(50, 22, 62, "🍕 PIZZARIA", 5.8, "#fbbf24", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", letterSpacing: 4, animation: "fadeIn" }),
      mkT(50, 44, 65, "Pizza Grande", 8.8, "#ffffff", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", shadow: true, animation: "slideUp", animDelay: 0.2 }),
      mkT(50, 58, 62, "2 Sabores + Borda Recheada", 5.5, "#fca5a5", { animation: "fadeIn", animDelay: 0.3 }),
      mkT(78, 17, 24, "POR", 5, "#fbbf24", { fontWeight: "bold" }),
      mkT(78, 28, 24, "R$39", 8.1, "#ffffff", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", shadow: true, animation: "pop", animDelay: 0.4 }),
      mkT(50, 78, 70, "Peça agora: (00) 0000-0000", 5.8, "#fef2f2", { animation: "slideUp", animDelay: 0.5 }),
    ]),
  },
  {
    name: "Burger Deal", emoji: "🍔", segment: "alimentacao",
    scene: SC("linear-gradient(135deg,#1c0a00,#451a03)", "slideLeft", [
      mkR(50, 12, 100, 24, "#92400e", { opacity: 0.6 }),
      mkR(50, 56, 80, 30, "rgba(255,255,255,0.06)", { borderRadius: 4 }),
      mkT(50, 12, 90, "🍔 COMBO ESPECIAL", 7.4, "#fbbf24", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", letterSpacing: 3, animation: "slideDown" }),
      mkT(50, 34, 85, "Burger + Batata + Refri", 6.5, "#fef3c7", { fontWeight: "bold", animation: "fadeIn", animDelay: 0.2 }),
      mkT(50, 47, 75, "Duplo Smash", 5.8, "#fde68a"),
      mkT(50, 57, 75, "Fritas Grandes", 5.8, "#fde68a"),
      mkT(50, 67, 75, "Refrigerante 500ml", 5.8, "#fde68a"),
      mkT(50, 83, 65, "R$ 42,90", 10, "#f97316", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", shadow: true, animation: "pop", animDelay: 0.5 }),
    ]),
  },
  {
    name: "Café da Manhã", emoji: "☕", segment: "alimentacao",
    scene: SC("linear-gradient(160deg,#292524,#44403c)", "fade", [
      mkR(50, 10, 100, 20, "#78350f", { opacity: 0.7 }),
      mkT(50, 10, 90, "☕ CAFÉ DA MANHÃ", 6.8, "#fde68a", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", letterSpacing: 3, animation: "fadeIn" }),
      mkT(50, 30, 85, "Bem-vindo ao nosso espaço!", 6.8, "#fef3c7", { fontWeight: "bold", animation: "slideDown", animDelay: 0.2 }),
      mkT(50, 44, 80, "Pão na chapa • Ovos • Suco fresco • Café especial", 5.5, "#d6d3d1", { animation: "fadeIn", animDelay: 0.3 }),
      mkR(50, 70, 62, 20, "#78350f", { borderRadius: 6, opacity: 0.85 }),
      mkT(50, 63, 60, "Horário de Atendimento", 5.5, "#fbbf24", { letterSpacing: 2, animation: "fadeIn", animDelay: 0.4 }),
      mkT(50, 73, 60, "07h às 11h  •  Todos os dias", 5.8, "#fef3c7", { fontWeight: "bold" }),
      mkT(50, 90, 85, "Reserve sua mesa: (00) 0000-0000", 5.5, "#a8a29e", { animation: "fadeIn", animDelay: 0.6 }),
    ]),
  },
  {
    name: "Açaí & Sorvete", emoji: "🍧", segment: "alimentacao",
    scene: SC("linear-gradient(160deg,#4a044e,#86198f)", "zoom", [
      mkR(50, 8, 100, 16, "#701a75", { opacity: 0.8 }),
      mkT(50, 8, 90, "🍧 AÇAÍ NA TIGELA", 6.8, "#f0abfc", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", letterSpacing: 3, animation: "fadeIn" }),
      mkT(50, 28, 90, "Escolha seu tamanho", 6.5, "#fdf4ff", { fontWeight: "bold", animation: "slideDown", animDelay: 0.1 }),
      mkR(18, 60, 28, 40, "rgba(255,255,255,0.1)", { borderRadius: 6 }),
      mkR(50, 60, 28, 40, "rgba(255,255,255,0.1)", { borderRadius: 6 }),
      mkR(82, 60, 28, 40, "rgba(255,255,255,0.1)", { borderRadius: 6 }),
      mkT(18, 50, 26, "P", 7.4, "#f0abfc", { fontFamily: "Oswald, sans-serif", fontWeight: "bold" }),
      mkT(50, 50, 26, "M", 7.4, "#e879f9", { fontFamily: "Oswald, sans-serif", fontWeight: "bold" }),
      mkT(82, 50, 26, "G", 7.4, "#c026d3", { fontFamily: "Oswald, sans-serif", fontWeight: "bold" }),
      mkT(18, 63, 26, "R$ 15,90", 5.5, "#fdf4ff", { fontWeight: "bold", animation: "fadeIn", animDelay: 0.3 }),
      mkT(50, 63, 26, "R$ 22,90", 5.5, "#fdf4ff", { fontWeight: "bold", animation: "fadeIn", animDelay: 0.4 }),
      mkT(82, 63, 26, "R$ 29,90", 5.5, "#fdf4ff", { fontWeight: "bold", animation: "fadeIn", animDelay: 0.5 }),
      mkT(50, 90, 90, "Aceitamos Pix • Cartão • Dinheiro", 5, "#f5d0fe", { animation: "fadeIn", animDelay: 0.7 }),
    ]),
  },
  {
    name: "Happy Hour", emoji: "🍻", segment: "alimentacao",
    scene: SC("linear-gradient(135deg,#1e3a5f,#0f172a)", "slideDown", [
      mkR(50, 12, 100, 24, "#f59e0b", { opacity: 0.9 }),
      mkT(50, 12, 90, "🍻 HAPPY HOUR", 8.8, "#1e1b18", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", letterSpacing: 6, animation: "fadeIn" }),
      mkT(50, 38, 88, "2 por 1 em todas as bebidas!", 8.1, "#fbbf24", { fontFamily: "Montserrat, sans-serif", fontWeight: "bold", shadow: true, animation: "pop", animDelay: 0.2 }),
      mkT(50, 55, 80, "Petiscos a partir de R$ 19,90", 6.5, "#93c5fd", { animation: "slideUp", animDelay: 0.3 }),
      mkR(50, 76, 62, 18, "#1d4ed8", { borderRadius: 6, opacity: 0.85 }),
      mkT(50, 70, 60, "Horário", 5, "#bfdbfe", { letterSpacing: 2 }),
      mkT(50, 79, 60, "17h às 21h  •  Toda semana", 6.5, "#ffffff", { fontWeight: "bold" }),
      mkT(50, 93, 85, "Reserve: @nossobarzinho  •  (00) 0000-0000", 5, "#64748b", { animation: "fadeIn", animDelay: 0.6 }),
    ]),
  },

  // ── Saúde / Beleza / Fitness ──────────────────────────────────────────────────
  {
    name: "Academia", emoji: "💪", segment: "saude",
    scene: SC("linear-gradient(135deg,#0f172a,#1e3a5f)", "wipeRight", [
      mkR(50, 8, 100, 16, "#1d4ed8", { opacity: 0.8 }),
      mkT(50, 8, 90, "💪 ACADEMIA FITNESS", 6.5, "#ffffff", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", letterSpacing: 3, animation: "fadeIn" }),
      mkT(50, 26, 85, "Comece sua transformação!", 8.1, "#f0f9ff", { fontFamily: "Montserrat, sans-serif", fontWeight: "bold", shadow: true, animation: "slideDown", animDelay: 0.2 }),
      mkR(50, 52, 85, 32, "rgba(255,255,255,0.05)", { borderRadius: 6 }),
      mkT(50, 42, 80, "✓ Musculação  •  ✓ Cardio  •  ✓ Funcional", 5.5, "#93c5fd", { animation: "fadeIn", animDelay: 0.3 }),
      mkT(50, 52, 80, "✓ Personal Trainer  •  ✓ Vestiário completo", 5.5, "#93c5fd"),
      mkT(50, 62, 80, "✓ Aulas coletivas inclusas na mensalidade", 5.5, "#93c5fd"),
      mkT(50, 78, 65, "Mensalidade a partir de", 5.5, "#64748b", { animation: "fadeIn", animDelay: 0.5 }),
      mkT(50, 89, 68, "R$ 89,90/mês", 8.8, "#3b82f6", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", animation: "pop", animDelay: 0.6 }),
    ]),
  },
  {
    name: "Yoga & Bem-estar", emoji: "🧘", segment: "saude",
    scene: SC("linear-gradient(160deg,#0f4c40,#134e4a)", "fade", [
      mkR(50, 92, 100, 16, "#0f766e", { opacity: 0.7 }),
      mkT(50, 14, 88, "🧘 YOGA & BEM-ESTAR", 6.5, "#99f6e4", { fontFamily: "Raleway, sans-serif", fontWeight: "bold", letterSpacing: 4, animation: "fadeIn" }),
      mkT(50, 32, 85, "Equilíbrio para\nCorpo e Mente", 8.8, "#f0fdfa", { fontFamily: "'Playfair Display', serif", fontWeight: "bold", lineHeight: 1.2, shadow: true, animation: "blurIn", animDelay: 0.2 }),
      mkT(50, 55, 80, "Aulas presenciais e online", 5.8, "#99f6e4", { fontStyle: "italic", animation: "fadeIn", animDelay: 0.4 }),
      mkT(50, 67, 80, "Acesso ilimitado a todas as turmas", 5.5, "#a7f3d0"),
      mkT(50, 82, 70, "Plano mensal: R$ 49,90", 6.8, "#34d399", { fontWeight: "bold", animation: "slideUp", animDelay: 0.5 }),
      mkT(50, 92, 80, "Contato: @yogaebemestar", 5, "#ffffff"),
    ]),
  },
  {
    name: "Clínica & Estética", emoji: "💉", segment: "saude",
    scene: SC("linear-gradient(160deg,#0c1a2e,#1e3a5f)", "slideUp", [
      mkR(50, 10, 100, 20, "rgba(14,165,233,0.2)"),
      mkT(50, 10, 82, "💉 CLÍNICA ESTÉTICA", 6.1, "#7dd3fc", { fontFamily: "Montserrat, sans-serif", fontWeight: "bold", letterSpacing: 3, animation: "fadeIn" }),
      mkT(50, 30, 85, "Agende sua Avaliação", 8.8, "#f0f9ff", { fontFamily: "Montserrat, sans-serif", fontWeight: "bold", shadow: true, animation: "slideDown", animDelay: 0.2 }),
      mkT(50, 44, 82, "Harmonização  •  Botox  •  Preenchimento", 5.5, "#bae6fd", { animation: "fadeIn", animDelay: 0.3 }),
      mkT(50, 55, 82, "Limpeza de Pele  •  Peeling  •  Microagulhamento", 5.5, "#bae6fd"),
      mkR(50, 74, 60, 16, "#0ea5e9", { borderRadius: 6, opacity: 0.85 }),
      mkT(50, 74, 58, "AVALIAÇÃO GRATUITA", 6.5, "#ffffff", { fontWeight: "bold", letterSpacing: 2, animation: "pop", animDelay: 0.5 }),
      mkT(50, 91, 80, "(00) 0000-0000  •  @clinicaestetica", 5.5, "#64748b", { animation: "fadeIn", animDelay: 0.7 }),
    ]),
  },
  {
    name: "Farmácia Oferta", emoji: "💊", segment: "saude",
    scene: SC("linear-gradient(135deg,#14532d,#166534)", "slideLeft", [
      mkR(50, 8, 100, 16, "#15803d", { opacity: 0.9 }),
      mkT(50, 8, 90, "💊 OFERTA DA SEMANA", 6.5, "#ffffff", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", letterSpacing: 3, animation: "fadeIn" }),
      mkT(50, 28, 85, "Vitamina C 1000mg", 8.1, "#dcfce7", { fontWeight: "bold", animation: "slideDown", animDelay: 0.2 }),
      mkT(50, 40, 80, "Caixa com 30 comprimidos efervescentes", 5.5, "#86efac", { animation: "fadeIn", animDelay: 0.3 }),
      mkE(50, 68, 38, 68, "#16a34a", { strokeColor: "#ffffff", strokeWidth: 2 }),
      mkT(50, 58, 36, "DE R$ 39,90", 5.5, "#bbf7d0", { textDecoration: "underline" }),
      mkT(50, 69, 36, "R$ 24,90", 9.4, "#ffffff", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", shadow: true, animation: "pop", animDelay: 0.4 }),
      mkT(50, 80, 36, "38% OFF", 5.8, "#fef08a", { fontWeight: "bold" }),
      mkT(50, 93, 85, "Válido até 31/07  •  Consulte disponibilidade", 5, "#86efac", { animation: "fadeIn", animDelay: 0.6 }),
    ]),
  },

  // ── Eventos ───────────────────────────────────────────────────────────────────
  {
    name: "Show & Festa", emoji: "🎶", segment: "eventos",
    scene: SC("linear-gradient(135deg,#4c1d95,#6366f1)", "circle", [
      mkE(15, 18, 18, 32, "#7c3aed", { opacity: 0.5 }),
      mkE(85, 82, 18, 32, "#4f46e5", { opacity: 0.5 }),
      mkT(50, 12, 90, "🎶 EVENTO ESPECIAL", 5.5, "#e0e7ff", { fontFamily: "Montserrat, sans-serif", fontWeight: "bold", letterSpacing: 3, animation: "typewriter", animDuration: 1.2 }),
      mkT(50, 32, 88, "NOME DO SHOW", 11.2, "#ffffff", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", shadow: true, letterSpacing: 2, animation: "zoomIn", animDelay: 0.4 }),
      mkT(50, 50, 85, "Artista Convidado  •  Banda Principal", 5.8, "#c7d2fe", { animation: "fadeIn", animDelay: 0.6 }),
      mkR(50, 70, 80, 16, "rgba(255,255,255,0.1)", { borderRadius: 4 }),
      mkT(50, 66, 78, "📅 Sábado, 26 de Julho  •  21h", 5.8, "#a5b4fc", { animation: "fadeIn", animDelay: 0.7 }),
      mkT(50, 75, 78, "📍 Arena Eventos — Centro", 5.8, "#a5b4fc"),
      mkT(50, 91, 80, "Ingressos: R$ 50 antecipado  •  R$ 70 na porta", 5.5, "#c7d2fe", { animation: "slideUp", animDelay: 0.8 }),
    ]),
  },
  {
    name: "Workshop", emoji: "🎓", segment: "eventos",
    scene: SC("linear-gradient(135deg,#0c1a2e,#1e3a5f)", "slideLeft", [
      mkR(50, 8, 100, 16, "#1d4ed8", { opacity: 0.8 }),
      mkR(6, 50, 12, 100, "#1e40af", { opacity: 0.4 }),
      mkT(50, 8, 82, "🎓 WORKSHOP", 6.8, "#ffffff", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", letterSpacing: 5, animation: "fadeIn" }),
      mkT(50, 28, 85, "Marketing Digital\npara Pequenos Negócios", 8.1, "#e0f2fe", { fontFamily: "Montserrat, sans-serif", fontWeight: "bold", lineHeight: 1.2, shadow: true, animation: "slideDown", animDelay: 0.2 }),
      mkT(50, 52, 80, "📅 Sábado, 02 de Agosto  •  9h às 17h", 5.8, "#7dd3fc", { animation: "fadeIn", animDelay: 0.4 }),
      mkT(50, 62, 80, "📍 Coworking Central  •  Vagas limitadas", 5.8, "#7dd3fc"),
      mkR(50, 80, 55, 18, "#2563eb", { borderRadius: 6, opacity: 0.9 }),
      mkT(50, 76, 53, "Inscrição", 5, "#bfdbfe", { letterSpacing: 2 }),
      mkT(50, 84, 53, "R$ 149,00  •  Inclui material", 5.8, "#ffffff", { fontWeight: "bold", animation: "pop", animDelay: 0.5 }),
      mkT(50, 95, 85, "Garanta já a sua vaga!", 5, "#93c5fd", { animation: "fadeIn", animDelay: 0.7 }),
    ]),
  },
  {
    name: "Aniversário Loja", emoji: "🎂", segment: "eventos",
    scene: SC("linear-gradient(135deg,#f59e0b,#d97706)", "zoom", [
      mkR(50, 50, 100, 100, "rgba(0,0,0,0.15)"),
      mkE(50, 40, 55, 98, "rgba(255,255,255,0.08)"),
      mkT(50, 12, 90, "🎂 ANIVERSÁRIO", 6.8, "#7c2d12", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", letterSpacing: 5, animation: "fadeIn" }),
      mkT(50, 30, 90, "10 Anos", 14.9, "#ffffff", { fontFamily: "'Bebas Neue', sans-serif", shadow: true, animation: "pop", animDelay: 0.2 }),
      mkT(50, 48, 88, "de muito obrigado por confiar em nós!", 6.5, "#fef3c7", { fontStyle: "italic", animation: "blurIn", animDelay: 0.4 }),
      mkR(50, 70, 72, 18, "#92400e", { borderRadius: 6, opacity: 0.7 }),
      mkT(50, 66, 70, "Celebre com a gente!", 5.5, "#fde68a", { letterSpacing: 2 }),
      mkT(50, 74, 70, "30% OFF em toda a loja esta semana", 5.8, "#ffffff", { fontWeight: "bold", animation: "slideUp", animDelay: 0.5 }),
      mkT(50, 92, 80, "Venha nos visitar  •  @nossaloja", 5, "#fef3c7", { animation: "fadeIn", animDelay: 0.7 }),
    ]),
  },

  // ── Serviços ──────────────────────────────────────────────────────────────────
  {
    name: "Barbearia", emoji: "💈", segment: "servicos",
    scene: SC("#111111", "wipeLeft", [
      mkR(50, 8, 100, 16, "#b91c1c", { opacity: 0.85 }),
      mkT(50, 8, 90, "💈 BARBEARIA PREMIUM", 6.5, "#ffffff", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", letterSpacing: 4, animation: "fadeIn" }),
      mkT(50, 26, 85, "Estilo que fala por você", 6.8, "#f1f5f9", { fontFamily: "'Playfair Display', serif", fontStyle: "italic", animation: "blurIn", animDelay: 0.2 }),
      mkR(50, 57, 85, 46, "rgba(255,255,255,0.04)", { borderRadius: 6 }),
      mkT(26, 40, 40, "Corte Masculino", 5.5, "#e2e8f0", { textAlign: "left", animation: "fadeIn", animDelay: 0.3 }),
      mkT(76, 40, 30, "R$ 45,00", 5.5, "#ef4444", { fontWeight: "bold" }),
      mkT(26, 52, 40, "Barba Completa", 5.5, "#e2e8f0", { textAlign: "left", animation: "fadeIn", animDelay: 0.35 }),
      mkT(76, 52, 30, "R$ 35,00", 5.5, "#ef4444", { fontWeight: "bold" }),
      mkT(26, 64, 40, "Corte + Barba", 5.5, "#e2e8f0", { textAlign: "left", animation: "fadeIn", animDelay: 0.4 }),
      mkT(76, 64, 30, "R$ 70,00", 5.5, "#fbbf24", { fontWeight: "bold" }),
      mkT(50, 90, 90, "Agendamento: (00) 0000-0000 ou Instagram", 5, "#64748b", { animation: "fadeIn", animDelay: 0.7 }),
    ]),
  },
  {
    name: "Oficina Auto", emoji: "🔧", segment: "servicos",
    scene: SC("linear-gradient(135deg,#1c1917,#292524)", "slideDown", [
      mkR(50, 8, 100, 16, "#d97706", { opacity: 0.9 }),
      mkT(50, 8, 90, "🔧 OFICINA MECÂNICA", 6.5, "#1c1917", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", letterSpacing: 3, animation: "fadeIn" }),
      mkT(50, 26, 85, "Revisão Completa do seu Veículo", 8.1, "#fef3c7", { fontFamily: "Montserrat, sans-serif", fontWeight: "bold", shadow: true, animation: "slideDown", animDelay: 0.2 }),
      mkT(50, 40, 85, "Motor  •  Freios  •  Suspensão  •  Alinhamento", 5.5, "#d6d3d1", { animation: "fadeIn", animDelay: 0.3 }),
      mkR(50, 63, 70, 20, "#78350f", { borderRadius: 6, opacity: 0.8 }),
      mkT(50, 57, 68, "A partir de", 5.5, "#fde68a", { animation: "fadeIn", animDelay: 0.4 }),
      mkT(50, 67, 68, "R$ 149,90", 10, "#f59e0b", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", shadow: true, animation: "pop", animDelay: 0.5 }),
      mkT(50, 82, 85, "✓ Garantia de serviço  ✓ Orçamento sem compromisso", 5.5, "#a8a29e", { animation: "fadeIn", animDelay: 0.6 }),
      mkT(50, 93, 80, "(00) 0000-0000  •  Rua das Oficinas, 123", 5, "#78716c", { animation: "fadeIn", animDelay: 0.7 }),
    ]),
  },
  {
    name: "Imobiliária", emoji: "🏠", segment: "servicos",
    scene: SC("linear-gradient(160deg,#0c1a2e,#1e3a5f)", "slideRight", [
      mkR(50, 8, 100, 16, "#0369a1", { opacity: 0.85 }),
      mkE(82, 50, 26, 46, "rgba(14,165,233,0.15)"),
      mkT(50, 8, 90, "🏠 IMOBILIÁRIA", 6.5, "#ffffff", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", letterSpacing: 4, animation: "fadeIn" }),
      mkT(50, 26, 85, "Novo Lançamento", 8.8, "#f0f9ff", { fontFamily: "Montserrat, sans-serif", fontWeight: "bold", shadow: true, animation: "slideDown", animDelay: 0.2 }),
      mkT(50, 40, 80, "Apartamentos 2 e 3 quartos com suíte", 5.8, "#bae6fd", { animation: "fadeIn", animDelay: 0.3 }),
      mkT(50, 50, 80, "Lazer completo  •  Localização privilegiada", 5.8, "#bae6fd"),
      mkR(50, 70, 55, 16, "#0284c7", { borderRadius: 6, opacity: 0.9 }),
      mkT(50, 66, 53, "Condições Especiais", 5.5, "#e0f2fe", { letterSpacing: 2 }),
      mkT(50, 74, 53, "Consulte nossos corretores", 5.8, "#ffffff", { fontWeight: "bold", animation: "pop", animDelay: 0.5 }),
      mkT(50, 91, 80, "(00) 0000-0000  •  www.imobiliaria.com.br", 5.5, "#38bdf8", { animation: "fadeIn", animDelay: 0.7 }),
    ]),
  },
  {
    name: "Odontologia", emoji: "🦷", segment: "servicos",
    scene: SC("linear-gradient(160deg,#f0f9ff,#e0f2fe)", "fade", [
      mkR(50, 8, 100, 16, "#0ea5e9", { opacity: 0.9 }),
      mkE(85, 50, 22, 40, "#e0f2fe", { strokeColor: "#0ea5e9", strokeWidth: 2 }),
      mkT(50, 8, 90, "🦷 ODONTOLOGIA", 6.5, "#ffffff", { fontFamily: "Oswald, sans-serif", fontWeight: "bold", letterSpacing: 4, animation: "fadeIn" }),
      mkT(50, 26, 85, "Sorria com Confiança", 8.8, "#0c4a6e", { fontFamily: "Montserrat, sans-serif", fontWeight: "bold", animation: "blurIn", animDelay: 0.2 }),
      mkT(50, 40, 80, "Implante  •  Clareamento  •  Aparelho Invisível", 5.8, "#0369a1", { animation: "fadeIn", animDelay: 0.3 }),
      mkT(50, 50, 80, "Tratamento Estético  •  Lentes de Contato Dental", 5.8, "#0369a1"),
      mkR(50, 70, 55, 16, "#0ea5e9", { borderRadius: 6, opacity: 0.9 }),
      mkT(50, 66, 53, "Avaliação Gratuita", 5.5, "#f0f9ff", { letterSpacing: 2 }),
      mkT(50, 74, 53, "Agende pelo WhatsApp", 5.8, "#ffffff", { fontWeight: "bold", animation: "slideUp", animDelay: 0.5 }),
      mkT(50, 91, 80, "(00) 0000-0000  •  @odontologia", 5.5, "#0369a1", { animation: "fadeIn", animDelay: 0.7 }),
    ]),
  },
];

const BLANK_TEMPLATE: { name: string; emoji: string; segment: TemplateSegment; scene: Omit<Scene, "id"> } = {
  name: "Em branco", emoji: "⬜", segment: "geral",
  scene: SC("linear-gradient(135deg,#0f172a,#1e3a5f)", "fade", []),
};
const ALL_TEMPLATES = [BLANK_TEMPLATE, ...TEMPLATES];

// ── ColorDot ──────────────────────────────────────────────────────────────────
function ColorDot({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn("w-6 h-6 rounded-full border-2 transition-all hover:scale-110 shrink-0", selected ? "border-primary" : "border-transparent")}
      style={{ background: color }} />
  );
}

// ── Template preview (generic) ────────────────────────────────────────────────
function TemplatePreview({ template }: { template: typeof ALL_TEMPLATES[0] }) {
  const { bg, elements } = template.scene;
  const shapes = elements.filter(e => e.type === "rect" || e.type === "ellipse").slice(0, 5);
  const texts = elements.filter(e => e.type === "text").slice(0, 4);
  return (
    <div className="w-full h-full overflow-hidden relative" style={{ background: bg }}>
      {shapes.map((sh, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${sh.x}%`, top: `${sh.y}%`,
          width: `${sh.w}%`, height: `${sh.h}%`,
          transform: "translate(-50%,-50%)",
          background: sh.fillColor || "rgba(255,255,255,0.15)",
          borderRadius: sh.borderRadius === 50 ? "50%" : `${sh.borderRadius * 0.2}px`,
          opacity: sh.opacity,
          border: sh.strokeWidth > 0 ? `${sh.strokeWidth * 0.4}px solid ${sh.strokeColor}` : undefined,
        }} />
      ))}
      {texts.map((t, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${t.x}%`, top: `${t.y}%`,
          width: `${t.w}%`,
          transform: "translate(-50%,-50%)",
          fontSize: `${Math.max(7, Math.min(16, t.fontSize * 1.35))}px`,
          fontWeight: t.fontWeight,
          color: t.color,
          textAlign: t.textAlign as "left" | "center" | "right",
          lineHeight: 1.2,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          textShadow: t.shadow ? "0 1px 2px rgba(0,0,0,0.6)" : undefined,
        }}>
          {t.text.split("\n")[0]}
        </div>
      ))}
      {elements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">{template.emoji}</span>
        </div>
      )}
    </div>
  );
}

// ── Segment filter chips ──────────────────────────────────────────────────────
const SEG_CHIPS: { label: string; value: TemplateSegment | "todos" }[] = [
  { label: "Todos", value: "todos" },
  { label: "Alimentação", value: "alimentacao" },
  { label: "Varejo", value: "varejo" },
  { label: "Promo", value: "promo" },
  { label: "Saúde", value: "saude" },
  { label: "Eventos", value: "eventos" },
  { label: "Serviços", value: "servicos" },
];

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
  const [segFilter, setSegFilter] = useState<TemplateSegment | "todos">("todos");

  const res = RESOLUTIONS[resIdx];
  const isCustom = !!res.custom;
  const finalRes = isCustom ? { label: `Personalizado — ${customW}×${customH}`, w: customW, h: customH } : res;

  const filteredTemplates = segFilter === "todos"
    ? ALL_TEMPLATES
    : ALL_TEMPLATES.filter(t => t.name === "Em branco" || t.segment === segFilter);

  function handleSelectTemplate(tpl: typeof ALL_TEMPLATES[0]) {
    setSelectedTpl(tpl);
    if (!name) setName(tpl.name === "Em branco" ? `Mídia ${new Date().toLocaleDateString("pt-BR")}` : tpl.name);
  }

  function handleCreate() {
    if (!selectedTpl || !name.trim()) return;
    if (isCustom && (customW < 100 || customH < 100)) return;
    const baseElems = (selectedTpl.scene.elements ?? []).map(e => ({ ...e, id: nid() }));
    const scene: Scene = { ...DEFAULT_SCENE(), ...selectedTpl.scene, elements: baseElems };
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

  const canCreate = !!selectedTpl && !!name.trim() && !(isCustom && (customW < 100 || customH < 100));

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col">
      {/* ── Top nav bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5 shrink-0">
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

      {/* ── Sticky config bar ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[#0d1117]/95 backdrop-blur-md border-b border-white/8 shrink-0 px-6 py-3">
        <div className="flex items-end gap-3 flex-wrap">
          {/* Nome */}
          <div className="flex-1 min-w-[180px] max-w-xs space-y-1">
            <Label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Nome do projeto</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Promoção Julho 2026"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-blue-500 h-8 text-xs"
              onKeyDown={e => { if (e.key === "Enter" && canCreate) handleCreate(); }} />
          </div>
          {/* Resolução */}
          <div className="min-w-[160px] space-y-1">
            <Label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Resolução</Label>
            <Select value={String(resIdx)} onValueChange={v => setResIdx(Number(v))}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTIONS.map((r, i) => <SelectItem key={i} value={String(i)} className="text-xs">{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {isCustom && (
              <div className="flex gap-1.5 mt-1">
                <Input type="number" value={customW} onChange={e => setCustomW(Math.max(100, parseInt(e.target.value) || 100))} placeholder="L" className="bg-white/5 border-white/10 text-white h-7 text-xs w-20" />
                <span className="text-white/30 flex items-center text-xs">×</span>
                <Input type="number" value={customH} onChange={e => setCustomH(Math.max(100, parseInt(e.target.value) || 100))} placeholder="A" className="bg-white/5 border-white/10 text-white h-7 text-xs w-20" />
              </div>
            )}
          </div>
          {/* Duração */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Duração (MP4)</Label>
            <div className="flex gap-1 flex-wrap">
              {DURATION_OPTIONS.map(d => (
                <button key={d} onClick={() => setDurationSeconds(d)}
                  className={cn("px-2.5 py-1 rounded-lg border text-xs font-medium transition-all h-8",
                    durationSeconds === d ? "border-blue-500 bg-blue-500/15 text-blue-300" : "border-white/10 text-white/40 hover:border-white/25 hover:text-white/60")}>
                  {d}s
                </button>
              ))}
            </div>
          </div>
          {/* Criar */}
          <div className="flex items-end gap-2 pb-0.5">
            <Button onClick={handleCreate} disabled={!canCreate}
              className={cn("h-8 px-4 font-semibold gap-1.5 text-xs transition-all",
                canCreate ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-white/5 text-white/30 cursor-not-allowed")}>
              <Wand2 className="w-3.5 h-3.5" />
              {selectedTpl ? `Criar: ${selectedTpl.emoji} ${selectedTpl.name}` : "Criar Projeto"}
            </Button>
          </div>
        </div>
        {!selectedTpl && (
          <p className="text-[11px] text-amber-400/60 mt-1.5 flex items-center gap-1">
            <span>↓</span> Selecione um template abaixo para habilitar o botão
          </p>
        )}
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Vídeo rápido */}
        <div className="px-8 pt-5 pb-3">
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

        {/* Template grid */}
        <div className="px-8 pb-8">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs text-white/30">Templates:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {SEG_CHIPS.map(chip => (
                <button key={chip.value} onClick={() => setSegFilter(chip.value)}
                  className={cn("px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border",
                    segFilter === chip.value
                      ? "bg-blue-500/20 border-blue-500/60 text-blue-300"
                      : "bg-white/5 border-white/10 text-white/40 hover:border-white/25 hover:text-white/60")}>
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTemplates.map(tpl => {
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
      </div>
    </div>
  );
}

// ── Main Editor ────────────────────────────────────────────────────────────────

export default function BannerEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const requestUploadUrl = useRequestUploadUrl();
  const createMedia = useCreateMedia();
  const updateMedia = useUpdateMedia();
  const { data: mediaLibrary } = useListMedia();

  // Draft save/load
  const [draftId, setDraftId] = useState<number | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const isDirtyRef = useRef(false);
  const projectLoadedRef = useRef(false);
  const saveDraftRef = useRef<((opts?: { silent?: boolean }) => Promise<void>) | null>(null);

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
  const [cropMode, setCropMode] = useState<string | null>(null);

  // Scene transition CSS overlay
  const [sceneKey, setSceneKey] = useState(0);
  const [transitionAnim, setTransitionAnim] = useState<string>("");

  // V3: colorBlock overlay (2-phase fill + reveal)
  const [colorBlockOverlay, setColorBlockOverlay] = useState<{ opacity: 0 | 1; color: string }>({ opacity: 0, color: "#0d1117" });

  // bgSlides cycling
  const [bgSlideIdx, setBgSlideIdx] = useState(0);
  const [bgSlideKey, setBgSlideKey] = useState(0);
  const [bgSlideTrans, setBgSlideTrans] = useState("");
  const [exportBgOverride, setExportBgOverride] = useState<BgSlide | null>(null);

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

  const cropping = useRef<{
    elemId: string; edge: CropEdge;
    startClientX: number; startClientY: number;
    startInset: { t: number; r: number; b: number; l: number };
    canvasRect: DOMRect;
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

  // Load draft from ?edit=ID on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (!editId) return;
    const id = parseInt(editId);
    if (!Number.isFinite(id)) return;
    fetch(`/api/media/${id}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(media => {
        if (!media?.metaJson) return;
        try {
          const parsed = JSON.parse(media.metaJson);
          if (parsed._type !== "banner-editor-v3") return;
          setProject(parsed.project);
          setScenes(parsed.scenes);
          setCurrentSceneIdx(0);
          setDraftId(id);
        } catch { /* ignore */ }
      })
      .catch(() => { /* ignore */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save draft (create on first call, update on subsequent)
  const saveDraft = async (opts?: { silent?: boolean }) => {
    if (!project || draftSaving) return;
    const silent = opts?.silent ?? false;
    setDraftSaving(true);
    try {
      const metaJson = JSON.stringify({ _type: "banner-editor-v3", project, scenes });
      if (draftId) {
        await updateMedia.mutateAsync({ id: draftId, data: { metaJson } });
        if (!silent) toast({ title: "💾 Rascunho salvo" });
      } else {
        const media = await createMedia.mutateAsync({
          data: { name: project.name, type: "draft", url: "", durationSeconds: project.durationSeconds, metaJson },
        });
        setDraftId(media.id);
        // Update URL so refresh reopens the same draft
        const url = new URL(window.location.href);
        url.searchParams.set("edit", String(media.id));
        window.history.replaceState({}, "", url.toString());
        await queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
        if (!silent) toast({ title: "💾 Rascunho salvo — disponível em Biblioteca > Editar" });
      }
      isDirtyRef.current = false;
      setLastAutoSave(new Date());
    } catch {
      if (!silent) toast({ title: "Erro ao salvar rascunho", variant: "destructive" });
    } finally {
      setDraftSaving(false);
    }
  };

  // Keep ref in sync so the auto-save interval always calls the latest closure
  useEffect(() => { saveDraftRef.current = saveDraft; });

  // Mark dirty whenever scenes or project change (skip initial load)
  useEffect(() => {
    if (!project) return;
    if (!projectLoadedRef.current) { projectLoadedRef.current = true; return; }
    isDirtyRef.current = true;
  }, [scenes, project]);

  // Auto-save every 2 minutes (silent)
  useEffect(() => {
    const id = setInterval(() => {
      if (isDirtyRef.current) saveDraftRef.current?.({ silent: true });
    }, 120_000);
    return () => clearInterval(id);
  }, []);

  // Close editor — salva silenciosamente se tiver alterações pendentes
  const handleClose = async () => {
    if (isDirtyRef.current && project) {
      await saveDraft({ silent: true });
    }
    navigate("/media");
  };

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

  // bgSlides: reset index when scene changes
  useEffect(() => { setBgSlideIdx(0); setBgSlideTrans(""); }, [currentSceneIdx]);

  // bgSlides: auto-cycle through slides in preview
  useEffect(() => {
    const slides = scene.bgSlides;
    if (!slides || slides.length <= 1) return;
    const current = slides[bgSlideIdx];
    const holdMs = (current?.duration ?? 4) * 1000;
    const timer = setTimeout(() => {
      const next = (bgSlideIdx + 1) % slides.length;
      const t = current?.transition ?? "fade";
      const ms = current?.transitionMs ?? 500;
      const bgAnimClass: Record<SceneTransition, string> = {
        none: "", fade: "beTransFade", blur: "beTransBlur", flash: "beTransFlash",
        zoom: "beTransZoom", zoomOut: "beTransZoomOut",
        slideLeft: "beTransSlideLeft", slideRight: "beTransSlideRight",
        slideUp: "beTransSlideUp", slideDown: "beTransSlideDown",
        pushLeft: "beTransPushLeft", pushRight: "beTransPushRight",
        pushUp: "beTransPushUp", pushDown: "beTransPushDown",
        wipeLeft: "beTransWipeLeft", wipeRight: "beTransWipeRight",
        wipeTop: "beTransWipeTop", wipeBottom: "beTransWipeBottom",
        splitH: "beTransSplitH", splitV: "beTransSplitV",
        circle: "beTransCircle", diagonalTL: "beTransDiagTL", diagonalBR: "beTransDiagBR",
        colorBlock: "",
      };
      if (t === "colorBlock") {
        const color = scene.transitionColor ?? "#0d1117";
        setColorBlockOverlay({ opacity: 1, color });
        setTimeout(() => {
          setBgSlideIdx(next); setBgSlideKey(k => k + 1);
          setTimeout(() => setColorBlockOverlay({ opacity: 0, color }), 60);
        }, Math.max(100, ms / 2));
      } else {
        const cls = bgAnimClass[t] ?? "beTransFade";
        setBgSlideTrans(cls); setBgSlideKey(k => k + 1); setBgSlideIdx(next);
        if (cls) setTimeout(() => setBgSlideTrans(""), ms + 50);
      }
    }, holdMs);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgSlideIdx, scene.bgSlides, scene.transitionColor]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") { if (cropMode) { setCropMode(null); return; } setSelected(null); setTransPop(null); return; }
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
    if (cropping.current) {
      const { elemId, edge, startClientX, startClientY, startInset, canvasRect } = cropping.current;
      if (!canvasRect.width || !canvasRect.height) return;
      const dxPct = ((e.clientX - startClientX) / canvasRect.width) * 100;
      const dyPct = ((e.clientY - startClientY) / canvasRect.height) * 100;
      const ci = { ...startInset };
      if (edge.includes("t")) ci.t = Math.max(0, Math.min(45, startInset.t + dyPct));
      if (edge.includes("b")) ci.b = Math.max(0, Math.min(45, startInset.b - dyPct));
      if (edge.includes("l")) ci.l = Math.max(0, Math.min(45, startInset.l + dxPct));
      if (edge.includes("r")) ci.r = Math.max(0, Math.min(45, startInset.r - dxPct));
      if (ci.t + ci.b > 90) { const ex = ci.t + ci.b - 90; ci.t = Math.max(0, ci.t - ex / 2); ci.b = Math.max(0, ci.b - ex / 2); }
      if (ci.l + ci.r > 90) { const ex = ci.l + ci.r - 90; ci.l = Math.max(0, ci.l - ex / 2); ci.r = Math.max(0, ci.r - ex / 2); }
      setScene(prev => ({ ...prev, elements: prev.elements.map(el => el.id === elemId ? { ...el, cropInset: ci } : el) }));
      return;
    }
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
    cropping.current = null;
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

  // ── Pack de elementos ─────────────────────────────────────────────────────────
  const addShapeKind = (kind: ShapeKind) => {
    pushHistory();
    const isLine = kind === "lineH" || kind === "lineV";
    const isCircle = kind === "circle";
    const br = getShapeBorderRadius(kind);
    const base = newElem("rect");
    const el: CanvasElem = {
      ...base,
      shapeKind: kind,
      fillColor: "#3b82f6",
      strokeWidth: 0,
      borderRadius: br,
      w: isLine ? (kind === "lineH" ? 60 : 1.5) : (isCircle ? 20 : 30),
      h: isLine ? (kind === "lineH" ? 1.5 : 40) : (isCircle ? 20 : 25),
    };
    setScene(prev => ({ ...prev, elements: [...prev.elements, el] }));
    setSelected(el.id);
  };

  const addQuickText = (variant: "titulo" | "subtitulo" | "preco" | "cta" | "eyebrow") => {
    pushHistory();
    const base = newElem("text");
    const variants: Record<string, Partial<CanvasElem>> = {
      titulo:    { text: "Título Principal", fontSize: 8, fontWeight: "bold", fontFamily: "Montserrat, sans-serif", color: "#ffffff", shadow: true, w: 80 },
      subtitulo: { text: "Subtítulo de apoio", fontSize: 4.5, fontFamily: "sans-serif", color: "#e2e8f0", w: 70 },
      preco:     { text: "R$ 99,90", fontSize: 10, fontWeight: "bold", fontFamily: "Oswald, sans-serif", color: "#fbbf24", shadow: true, w: 60 },
      cta:       { text: "SAIBA MAIS", fontSize: 4, fontWeight: "bold", color: "#ffffff", letterSpacing: 3, bgColor: "#3b82f6", w: 40, y: 65 },
      eyebrow:   { text: "✨ NOVIDADE", fontSize: 3.2, fontWeight: "bold", color: "#79B4B0", letterSpacing: 4, w: 50, y: 30 },
    };
    const el: CanvasElem = { ...base, ...variants[variant] } as CanvasElem;
    setScene(prev => ({ ...prev, elements: [...prev.elements, el] }));
    setSelected(el.id);
  };

  const addBadge = (kind: "pct_off" | "novo" | "promo" | "oferta" | "cta_btn" | "tag_preco" | "exclusivo" | "urgente") => {
    pushHistory();
    const bg = newElem("rect");
    const tx = newElem("text");
    const badges: Record<string, { bgPatch: Partial<CanvasElem>; txPatch: Partial<CanvasElem> }> = {
      pct_off:   { bgPatch: { fillColor: "#dc2626", borderRadius: 6, w: 28, h: 14 }, txPatch: { text: "50% OFF", fontSize: 5, fontWeight: "bold", color: "#ffffff", shadow: true } },
      novo:      { bgPatch: { fillColor: "#16a34a", borderRadius: 6, w: 22, h: 10 }, txPatch: { text: "NOVO", fontSize: 4, fontWeight: "bold", color: "#ffffff", letterSpacing: 3 } },
      promo:     { bgPatch: { fillColor: "#f59e0b", borderRadius: 6, w: 26, h: 10 }, txPatch: { text: "PROMOÇÃO", fontSize: 3.5, fontWeight: "bold", color: "#1c1917", letterSpacing: 2 } },
      oferta:    { bgPatch: { fillColor: "#7c3aed", borderRadius: 0, w: 70, h: 10 }, txPatch: { text: "⚡ OFERTA ESPECIAL", fontSize: 4, fontWeight: "bold", color: "#ffffff", letterSpacing: 2 } },
      cta_btn:   { bgPatch: { fillColor: "#3b82f6", borderRadius: 8, w: 40, h: 12 }, txPatch: { text: "COMPRAR AGORA", fontSize: 4, fontWeight: "bold", color: "#ffffff", letterSpacing: 2 } },
      tag_preco: { bgPatch: { fillColor: "#fbbf24", shapeKind: "diamond" as ShapeKind, w: 18, h: 18 }, txPatch: { text: "R$49", fontSize: 4, fontWeight: "bold", color: "#1c1917" } },
      exclusivo: { bgPatch: { fillColor: "#0f172a", borderRadius: 4, w: 32, h: 10, strokeColor: "#fbbf24", strokeWidth: 2 }, txPatch: { text: "★ EXCLUSIVO", fontSize: 3.5, fontWeight: "bold", color: "#fbbf24", letterSpacing: 2 } },
      urgente:   { bgPatch: { fillColor: "#dc2626", shapeKind: "arrowRight" as ShapeKind, w: 36, h: 12 }, txPatch: { text: "SÓ HOJE!", fontSize: 4, fontWeight: "bold", color: "#ffffff", letterSpacing: 1 } },
    };
    const b = badges[kind];
    const bgEl: CanvasElem = { ...bg, ...b.bgPatch, borderRadius: (b.bgPatch.borderRadius ?? 0), strokeColor: b.bgPatch.strokeColor ?? "", strokeWidth: b.bgPatch.strokeWidth ?? 0 };
    const txEl: CanvasElem = { ...tx, ...b.txPatch, x: bgEl.x, y: bgEl.y };
    setScene(prev => ({ ...prev, elements: [...prev.elements, bgEl, txEl] }));
    setSelected(txEl.id);
  };

  const addFrame = (kind: "fina" | "grossa" | "redonda" | "polaroid") => {
    pushHistory();
    const base = newElem("rect");
    const frames: Record<string, Partial<CanvasElem>> = {
      fina:     { fillColor: "transparent", strokeColor: "#ffffff", strokeWidth: 2, borderRadius: 0, w: 40, h: 55, opacity: 0.9 },
      grossa:   { fillColor: "transparent", strokeColor: "#ffffff", strokeWidth: 8, borderRadius: 0, w: 40, h: 55, opacity: 0.85 },
      redonda:  { fillColor: "transparent", strokeColor: "#ffffff", strokeWidth: 4, borderRadius: 15, w: 38, h: 55, opacity: 0.9 },
      polaroid: { fillColor: "#ffffff", strokeColor: "#e5e7eb", strokeWidth: 1, borderRadius: 2, w: 40, h: 50, opacity: 1 },
    };
    const el: CanvasElem = { ...base, ...frames[kind] } as CanvasElem;
    setScene(prev => ({ ...prev, elements: [...prev.elements, el] }));
    setSelected(el.id);
  };

  const addSticker = (emoji: string) => {
    pushHistory();
    const el: CanvasElem = { ...newElem("text"), text: emoji, fontSize: 8, w: 20, h: 12 };
    setScene(prev => ({ ...prev, elements: [...prev.elements, el] }));
    setSelected(el.id);
  };

  const [elemSearch, setElemSearch] = useState("");
  const [elemCat, setElemCat] = useState<"texto" | "formas" | "badges" | "molduras" | "stickers">("formas");

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

  // ── Pexels / galeria ─────────────────────────────────────────────────────────
  const [mediaGalleryTab, setMediaGalleryTab] = useState<"biblioteca" | "pexels" | "pexelsVideo">("biblioteca");
  const [libSearch, setLibSearch] = useState("");
  const [pexelsQ, setPexelsQ] = useState("");
  const [pexelsResults, setPexelsResults] = useState<{ id: number; src: { medium: string; large: string }; photographer: string; alt: string }[]>([]);
  const [pexelsLoading, setPexelsLoading] = useState(false);
  const [pexelsNoKey, setPexelsNoKey] = useState(false);
  const [pexelsPage, setPexelsPage] = useState(1);
  const [pexelsTotalPages, setPexelsTotalPages] = useState(0);
  const [pexelsVideoQ, setPexelsVideoQ] = useState("");
  const [pexelsVideoResults, setPexelsVideoResults] = useState<PexelsVideo[]>([]);
  const [pexelsVideoLoading, setPexelsVideoLoading] = useState(false);
  const [pexelsVideoNoKey, setPexelsVideoNoKey] = useState(false);
  const [pexelsVideoPage, setPexelsVideoPage] = useState(1);
  const [pexelsVideoTotalPages, setPexelsVideoTotalPages] = useState(0);

  const searchPexels = async (q: string, page = 1) => {
    if (!q.trim()) return;
    setPexelsLoading(true); setPexelsNoKey(false);
    try {
      const r = await fetch(`/api/media/stock-search?q=${encodeURIComponent(q)}&page=${page}`, { credentials: "include" });
      if (r.status === 503) { setPexelsNoKey(true); return; }
      const data = await r.json();
      setPexelsResults(data.photos ?? []);
      setPexelsTotalPages(Math.ceil((data.total_results ?? 0) / 24));
      setPexelsPage(page);
    } finally { setPexelsLoading(false); }
  };

  const importPexelsPhoto = async (photo: typeof pexelsResults[0], action: "fundo" | "canvas" | "slide"): Promise<string | undefined> => {
    try {
      toast({ title: "⏳ Importando foto…" });
      const proxyUrl = `/api/media/stock-proxy?url=${encodeURIComponent(photo.src.large)}`;
      const r = await fetch(proxyUrl);
      const blob = await r.blob();
      const ct = blob.type || "image/jpeg";
      const ext = ct.includes("png") ? "png" : "jpg";
      const filename = `pexels-${photo.id}-${photo.photographer.replace(/\s+/g, "-").toLowerCase()}.${ext}`;
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
        data: { name: filename, size: blob.size, contentType: ct },
      });
      await fetch(uploadURL, { method: "PUT", body: blob, headers: { "Content-Type": ct } });
      await createMedia.mutateAsync({ data: { name: filename, type: "image", url: objectPath } });
      queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
      if (action === "fundo") {
        updateScene({ bgImage: objectPath, bgVideo: "" });
      } else if (action === "canvas") {
        addImageFromLibrary(objectPath);
      }
      // "slide" action: caller handles adding to bgSlides using returned objectPath
      toast({ title: `📷 Foto de ${photo.photographer} salva na biblioteca` });
      return objectPath;
    } catch (err) {
      toast({ title: `Erro ao importar: ${err instanceof Error ? err.message : "tente novamente"}`, variant: "destructive" });
      return undefined;
    }
  };

  const pickPexelsVideoFile = (video: PexelsVideo) => {
    const files = (video.video_files ?? []).filter(f =>
      (f.file_type || "").includes("mp4") || f.link.includes(".mp4"),
    );
    if (!files.length) return video.video_files?.[0];
    const hd = files.find(f => f.quality === "hd");
    if (hd) return hd;
    return [...files].sort((a, b) => (b.width || 0) - (a.width || 0)).find(f => (f.width || 0) <= 1920) ?? files[0];
  };

  const searchPexelsVideos = async (q: string, page = 1) => {
    if (!q.trim()) return;
    setPexelsVideoLoading(true); setPexelsVideoNoKey(false);
    try {
      const r = await fetch(`/api/media/stock-search-videos?q=${encodeURIComponent(q)}&page=${page}`, { credentials: "include" });
      if (r.status === 503) { setPexelsVideoNoKey(true); setPexelsVideoResults([]); return; }
      if (r.status === 401) { toast({ title: "Faça login novamente para buscar vídeos", variant: "destructive" }); setPexelsVideoResults([]); return; }
      if (!r.ok) { toast({ title: "Busca de vídeos indisponível", variant: "destructive" }); setPexelsVideoResults([]); return; }
      const data = await r.json();
      const videos = (data.videos ?? []) as PexelsVideo[];
      setPexelsVideoResults(videos);
      setPexelsVideoTotalPages(Math.ceil((data.total_results ?? 0) / 15) || 1);
      setPexelsVideoPage(page);
      if (!videos.length) toast({ title: "Nenhum vídeo encontrado para esse termo" });
    } catch (e) {
      toast({ title: `Erro na busca: ${e instanceof Error ? e.message : "rede"}`, variant: "destructive" });
      setPexelsVideoResults([]);
    } finally { setPexelsVideoLoading(false); }
  };

  const importPexelsVideo = async (video: PexelsVideo, action: "fundo" | "biblioteca") => {
    try {
      toast({ title: "⏳ Importando vídeo…" });
      const file = pickPexelsVideoFile(video);
      if (!file?.link) throw new Error("Arquivo de vídeo indisponível");
      const proxyUrl = `/api/media/stock-proxy?url=${encodeURIComponent(file.link)}`;
      const r = await fetch(proxyUrl, { credentials: "include" });
      if (!r.ok) throw new Error(`Falha no download (${r.status})`);
      const blob = await r.blob();
      const ct = blob.type || "video/mp4";
      const filename = `pexels-video-${video.id}-${(video.user?.name || "pexels").replace(/\s+/g, "-").toLowerCase()}.mp4`;
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
        data: { name: filename, size: blob.size, contentType: ct },
      });
      await fetch(uploadURL, { method: "PUT", body: blob, headers: { "Content-Type": ct } });
      await createMedia.mutateAsync({
        data: { name: filename, type: "video", url: objectPath, durationSeconds: video.duration || undefined },
      });
      queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
      if (action === "fundo") updateScene({ bgVideo: resolveUrl(objectPath), bgImage: "" });
      toast({ title: `🎬 Vídeo de ${video.user?.name || "Pexels"} salvo na biblioteca` });
    } catch (err) {
      toast({ title: `Erro ao importar vídeo: ${err instanceof Error ? err.message : "tente novamente"}`, variant: "destructive" });
    }
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

  const startCrop = (edge: CropEdge, elemId: string, e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const el = scene.elements.find(el => el.id === elemId);
    if (!el || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const startInset = el.cropInset ?? { t: 0, r: 0, b: 0, l: 0 };
    cropping.current = { elemId, edge, startClientX: e.clientX, startClientY: e.clientY, startInset, canvasRect };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const clearCrop = (elemId: string) => {
    updateElem(elemId, { cropInset: undefined });
    setCropMode(null);
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
      blur: "beTransBlur", flash: "beTransFlash",
      zoom: "beTransZoom", zoomOut: "beTransZoomOut",
      slideLeft: "beTransSlideLeft", slideRight: "beTransSlideRight",
      slideUp: "beTransSlideUp", slideDown: "beTransSlideDown",
      pushLeft: "beTransPushLeft", pushRight: "beTransPushRight",
      pushUp: "beTransPushUp", pushDown: "beTransPushDown",
      wipeLeft: "beTransWipeLeft", wipeRight: "beTransWipeRight",
      wipeTop: "beTransWipeTop", wipeBottom: "beTransWipeBottom",
      splitH: "beTransSplitH", splitV: "beTransSplitV",
      circle: "beTransCircle",
      diagonalTL: "beTransDiagTL", diagonalBR: "beTransDiagBR",
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
          } else if (t === "zoomOut") {
            const s = 1.3 - alpha * 0.3;
            const off = ((s - 1) / 2);
            ctx.drawImage(from, -off * resW, -off * resH, resW * s, resH * s);
            ctx.globalAlpha = alpha;
            ctx.drawImage(to, 0, 0, resW, resH);
            ctx.globalAlpha = 1;
          } else if (t === "pushLeft") {
            ctx.drawImage(from, -alpha * resW, 0, resW, resH);
            ctx.drawImage(to, (1 - alpha) * resW, 0, resW, resH);
          } else if (t === "pushRight") {
            ctx.drawImage(from, alpha * resW, 0, resW, resH);
            ctx.drawImage(to, -(1 - alpha) * resW, 0, resW, resH);
          } else if (t === "pushUp") {
            ctx.drawImage(from, 0, -alpha * resH, resW, resH);
            ctx.drawImage(to, 0, (1 - alpha) * resH, resW, resH);
          } else if (t === "pushDown") {
            ctx.drawImage(from, 0, alpha * resH, resW, resH);
            ctx.drawImage(to, 0, -(1 - alpha) * resH, resW, resH);
          } else if (t === "wipeTop") {
            ctx.drawImage(from, 0, 0, resW, resH);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, resW, alpha * resH);
            ctx.clip();
            ctx.drawImage(to, 0, 0, resW, resH);
            ctx.restore();
          } else if (t === "wipeBottom") {
            ctx.drawImage(from, 0, 0, resW, resH);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, (1 - alpha) * resH, resW, resH);
            ctx.clip();
            ctx.drawImage(to, 0, 0, resW, resH);
            ctx.restore();
          } else if (t === "splitH") {
            ctx.drawImage(from, 0, 0, resW, resH);
            ctx.save();
            ctx.beginPath();
            const hh = resH / 2;
            ctx.rect(0, hh - alpha * hh, resW, alpha * hh);
            ctx.rect(0, hh, resW, alpha * hh);
            ctx.clip();
            ctx.drawImage(to, 0, 0, resW, resH);
            ctx.restore();
          } else if (t === "splitV") {
            ctx.drawImage(from, 0, 0, resW, resH);
            ctx.save();
            ctx.beginPath();
            const hw = resW / 2;
            ctx.rect(hw - alpha * hw, 0, alpha * hw, resH);
            ctx.rect(hw, 0, alpha * hw, resH);
            ctx.clip();
            ctx.drawImage(to, 0, 0, resW, resH);
            ctx.restore();
          } else if (t === "diagonalTL") {
            ctx.drawImage(from, 0, 0, resW, resH);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(alpha * resW * 2, 0);
            ctx.lineTo(0, alpha * resH * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(to, 0, 0, resW, resH);
            ctx.restore();
          } else if (t === "diagonalBR") {
            ctx.drawImage(from, 0, 0, resW, resH);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(resW, resH);
            ctx.lineTo(resW - alpha * resW * 2, resH);
            ctx.lineTo(resW, resH - alpha * resH * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(to, 0, 0, resW, resH);
            ctx.restore();
          } else if (t === "blur") {
            const blurOut = Math.round(alpha * 22);
            const blurIn  = Math.round((1 - alpha) * 22);
            ctx.filter = blurOut > 0 ? `blur(${blurOut}px)` : "none";
            ctx.globalAlpha = 1 - alpha;
            ctx.drawImage(from, 0, 0, resW, resH);
            ctx.filter = blurIn > 0 ? `blur(${blurIn}px)` : "none";
            ctx.globalAlpha = alpha;
            ctx.drawImage(to, 0, 0, resW, resH);
            ctx.filter = "none";
            ctx.globalAlpha = 1;
          } else if (t === "flash") {
            const half = STEPS / 2;
            if (step <= half) {
              const a = step / half;
              ctx.drawImage(from, 0, 0, resW, resH);
              ctx.globalAlpha = a;
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, resW, resH);
              ctx.globalAlpha = 1;
            } else {
              const a = 1 - (step - half) / half;
              ctx.drawImage(to, 0, 0, resW, resH);
              ctx.globalAlpha = a;
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, resW, resH);
              ctx.globalAlpha = 1;
            }
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
        const scn = scenes[i];
        const slides = scn.bgSlides?.length ? scn.bgSlides : null;
        if (slides) {
          toast({ title: `🎬 Cena ${i + 1}/${scenes.length} — ${slides.length} slides…` });
          setCurrentSceneIdx(i);
          for (let j = 0; j < slides.length; j++) {
            const slide = slides[j];
            const isLastSlide = j === slides.length - 1;
            setExportBgOverride(slide);
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            const dataUrl = await toPng(canvasRef.current!, { pixelRatio, cacheBust: true });
            sceneFrames.push({
              dataUrl,
              duration: slide.duration,
              transition: isLastSlide ? (scn.transition ?? "fade") : slide.transition,
              transitionMs: isLastSlide ? (scn.transitionMs ?? 500) : slide.transitionMs,
              transitionColor: scn.transitionColor ?? "#0d1117",
              kenBurns: scn.kenBurns ?? "off",
              kenBurnsIntensity: scn.kenBurnsIntensity ?? 1.08,
            });
          }
          setExportBgOverride(null);
        } else {
          toast({ title: `🎬 Renderizando cena ${i + 1}/${scenes.length}…` });
          setCurrentSceneIdx(i);
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          const dataUrl = await toPng(canvasRef.current!, { pixelRatio, cacheBust: true });
          sceneFrames.push({
            dataUrl,
            duration: scn.duration ?? project.durationSeconds,
            transition: scn.transition ?? "fade",
            transitionMs: scn.transitionMs ?? 500,
            transitionColor: scn.transitionColor ?? "#0d1117",
            kenBurns: scn.kenBurns ?? "off",
            kenBurnsIntensity: scn.kenBurnsIntensity ?? 1.08,
          });
        }
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
  const getActiveBgSlide = (): BgSlide | null =>
    exportBgOverride ?? (scene.bgSlides?.length ? (scene.bgSlides[bgSlideIdx] ?? null) : null);

  const bgImageStyle = (): React.CSSProperties => {
    const activeSlide = getActiveBgSlide();
    const activeBgImage = activeSlide ? (activeSlide.type === "image" ? activeSlide.url : "") : scene.bgImage;
    const activeBgVideo = activeSlide ? (activeSlide.type === "video" ? activeSlide.url : undefined) : scene.bgVideo;
    if (!activeBgImage) return { background: activeBgVideo ? "#000" : scene.bg };
    const zoom = scene.mediaZoom ?? 100;
    const panX = scene.mediaPanX ?? 0;
    const panY = scene.mediaPanY ?? 0;
    const fit = zoom > 100 ? `${zoom}%` : (scene.mediaFit ?? "cover");
    return { backgroundImage: `url(${resolveUrl(activeBgImage)})`, backgroundSize: fit, backgroundPosition: `calc(50% + ${panX}%) calc(50% + ${panY}%)`, backgroundRepeat: "no-repeat" };
  };

  const activeBgVideo = (): string | undefined => {
    const activeSlide = getActiveBgSlide();
    return activeSlide ? (activeSlide.type === "video" ? activeSlide.url : undefined) : scene.bgVideo;
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
        .beTransFade       { animation: beTransFadeA      var(--trans-ms,500ms) ease         forwards; }
        .beTransBlur       { animation: beTransBlurA      var(--trans-ms,500ms) ease         forwards; }
        .beTransFlash      { animation: beTransFlashA     var(--trans-ms,400ms) ease         forwards; }
        .beTransZoom       { animation: beTransZoomA      var(--trans-ms,500ms) ease         forwards; }
        .beTransZoomOut    { animation: beTransZoomOutA   var(--trans-ms,500ms) ease         forwards; }
        .beTransSlideLeft  { animation: beTransSlideLeftA var(--trans-ms,500ms) ease         forwards; }
        .beTransSlideRight { animation: beTransSlideRightA var(--trans-ms,500ms) ease        forwards; }
        .beTransSlideUp    { animation: beTransSlideUpA   var(--trans-ms,500ms) ease         forwards; }
        .beTransSlideDown  { animation: beTransSlideDownA var(--trans-ms,500ms) ease         forwards; }
        .beTransPushLeft   { animation: beTransPushLeftA  var(--trans-ms,500ms) cubic-bezier(.25,.46,.45,.94) forwards; }
        .beTransPushRight  { animation: beTransPushRightA var(--trans-ms,500ms) cubic-bezier(.25,.46,.45,.94) forwards; }
        .beTransPushUp     { animation: beTransPushUpA    var(--trans-ms,500ms) cubic-bezier(.25,.46,.45,.94) forwards; }
        .beTransPushDown   { animation: beTransPushDownA  var(--trans-ms,500ms) cubic-bezier(.25,.46,.45,.94) forwards; }
        .beTransWipeLeft   { animation: beTransWipeLeftA  var(--trans-ms,500ms) ease         forwards; }
        .beTransWipeRight  { animation: beTransWipeRightA var(--trans-ms,500ms) ease         forwards; }
        .beTransWipeTop    { animation: beTransWipeTopA   var(--trans-ms,500ms) ease         forwards; }
        .beTransWipeBottom { animation: beTransWipeBottomA var(--trans-ms,500ms) ease        forwards; }
        .beTransSplitH     { animation: beTransSplitHA    var(--trans-ms,500ms) ease         forwards; }
        .beTransSplitV     { animation: beTransSplitVA    var(--trans-ms,500ms) ease         forwards; }
        .beTransCircle     { animation: beTransCircleA    var(--trans-ms,500ms) ease         forwards; }
        .beTransDiagTL     { animation: beTransDiagTLA    var(--trans-ms,500ms) ease         forwards; }
        .beTransDiagBR     { animation: beTransDiagBRA    var(--trans-ms,500ms) ease         forwards; }
        @keyframes beTransFadeA        { from{opacity:0} to{opacity:1} }
        @keyframes beTransBlurA        { from{filter:blur(18px);opacity:0} to{filter:blur(0);opacity:1} }
        @keyframes beTransFlashA       { 0%{filter:brightness(4);opacity:0.6} 40%{filter:brightness(1.2);opacity:1} 100%{filter:brightness(1);opacity:1} }
        @keyframes beTransZoomA        { from{transform:scale(1.12);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes beTransZoomOutA     { from{transform:scale(0.88);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes beTransSlideLeftA   { from{transform:translateX(7%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes beTransSlideRightA  { from{transform:translateX(-7%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes beTransSlideUpA     { from{transform:translateY(7%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes beTransSlideDownA   { from{transform:translateY(-7%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes beTransPushLeftA    { from{transform:translateX(100%)} to{transform:translateX(0)} }
        @keyframes beTransPushRightA   { from{transform:translateX(-100%)} to{transform:translateX(0)} }
        @keyframes beTransPushUpA      { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes beTransPushDownA    { from{transform:translateY(-100%)} to{transform:translateY(0)} }
        @keyframes beTransWipeLeftA    { from{clip-path:inset(0 100% 0 0)} to{clip-path:inset(0 0% 0 0)} }
        @keyframes beTransWipeRightA   { from{clip-path:inset(0 0 0 100%)} to{clip-path:inset(0 0 0 0%)} }
        @keyframes beTransWipeTopA     { from{clip-path:inset(0 0 100% 0)} to{clip-path:inset(0 0 0% 0)} }
        @keyframes beTransWipeBottomA  { from{clip-path:inset(100% 0 0 0)} to{clip-path:inset(0% 0 0 0)} }
        @keyframes beTransSplitHA      { from{clip-path:inset(50% 0 50% 0)} to{clip-path:inset(0 0 0 0)} }
        @keyframes beTransSplitVA      { from{clip-path:inset(0 50% 0 50%)} to{clip-path:inset(0 0 0 0)} }
        @keyframes beTransCircleA      { from{clip-path:circle(0% at 50% 50%)} to{clip-path:circle(150% at 50% 50%)} }
        @keyframes beTransDiagTLA      { from{clip-path:polygon(0 0,0 0,0 0)} to{clip-path:polygon(0 0,200% 0,0 200%)} }
        @keyframes beTransDiagBRA      { from{clip-path:polygon(100% 100%,100% 100%,100% 100%)} to{clip-path:polygon(100% 100%,-100% 100%,100% -100%)} }
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
        <div className="flex items-center gap-1.5">
          {lastAutoSave && (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              salvo às {lastAutoSave.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button size="sm" onClick={() => saveDraft()} disabled={draftSaving || saving} className="h-8 gap-1.5 bg-amber-500 hover:bg-amber-600 text-white">
            {draftSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {draftId ? "Salvar" : "Salvar Rascunho"}
          </Button>
        </div>
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
        <div className="w-px h-6 bg-border shrink-0" />
        <Button variant="ghost" size="sm" onClick={handleClose} title="Fechar editor" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-destructive/10">
          <X className="w-4 h-4" />
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
              <div className="flex flex-col h-full">
                {/* Sub-tab switcher */}
                <div className="flex border-b border-white/10 shrink-0">
                  {(["biblioteca", "pexels", "pexelsVideo"] as const).map(tab => (
                    <button key={tab} onClick={() => setMediaGalleryTab(tab)}
                      className={cn("flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors",
                        mediaGalleryTab === tab ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}>
                      {tab === "biblioteca" ? "Minha Biblioteca" : tab === "pexels" ? "Buscar Fotos" : "Buscar Vídeos"}
                    </button>
                  ))}
                </div>

                {/* ── Minha Biblioteca ── */}
                {mediaGalleryTab === "biblioteca" && (
                  <div className="px-3 py-3 space-y-3 flex-1 overflow-auto">
                    <div className="space-y-1.5">
                      <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8" onClick={setBgImage}>
                        <ImageIcon className="w-3.5 h-3.5" /> Upload foto (fundo)
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8" onClick={addPhotoToTimeline}>
                        <Images className="w-3.5 h-3.5" /> Fotos → Timeline
                      </Button>
                    </div>
                    <Separator />
                    <Input
                      placeholder="Buscar na biblioteca…"
                      value={libSearch}
                      onChange={e => setLibSearch(e.target.value)}
                      className="h-7 text-xs"
                    />
                    <div className="grid grid-cols-3 gap-1">
                      {(mediaLibrary?.filter(m => m.type === "image" && (!libSearch || m.name.toLowerCase().includes(libSearch.toLowerCase()))) ?? []).map(m => (
                        <div key={m.id} className="relative group aspect-square rounded overflow-hidden border border-white/10">
                          <img src={resolveUrl(m.url)} alt={m.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 p-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-4">
                            <button onClick={() => updateScene({ bgImage: m.url, bgVideo: "" })}
                              className="flex-1 text-[9px] font-bold bg-blue-600 hover:bg-blue-500 rounded py-1 text-white">Fundo</button>
                            <button onClick={() => {
                              const slide: BgSlide = { id: nid(), url: m.url, type: "image", duration: 4, transition: "fade", transitionMs: 500 };
                              setScene(prev => ({ ...prev, bgSlides: [...(prev.bgSlides ?? []), slide] }));
                            }} className="flex-1 text-[9px] font-bold bg-violet-600 hover:bg-violet-500 rounded py-1 text-white">Slide+</button>
                            <button onClick={() => addImageFromLibrary(m.url)}
                              className="flex-1 text-[9px] font-bold bg-emerald-600 hover:bg-emerald-500 rounded py-1 text-white">Canvas</button>
                          </div>
                        </div>
                      ))}
                      {(mediaLibrary?.filter(m => m.type === "image") ?? []).length === 0 && (
                        <p className="col-span-3 text-[10px] text-muted-foreground text-center py-4">Nenhuma imagem na biblioteca</p>
                      )}
                    </div>
                    {/* Vídeos na biblioteca */}
                    {(mediaLibrary?.filter(m => m.type === "video" && (!libSearch || m.name.toLowerCase().includes(libSearch.toLowerCase()))) ?? []).length > 0 && (
                      <>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Vídeos</p>
                        <div className="grid grid-cols-2 gap-1">
                          {(mediaLibrary?.filter(m => m.type === "video" && (!libSearch || m.name.toLowerCase().includes(libSearch.toLowerCase()))) ?? []).map(m => (
                            <div key={m.id} className="relative group aspect-video rounded overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center">
                              <Film className="w-5 h-5 text-white/30 pointer-events-none" />
                              {m.durationSeconds && <span className="absolute top-1 right-1 text-[8px] bg-black/70 text-white rounded px-1">{m.durationSeconds}s</span>}
                              <div className="absolute inset-x-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-4">
                                <button onClick={() => updateScene({ bgVideo: resolveUrl(m.url), bgImage: "" })}
                                  className="w-full text-[9px] font-bold bg-blue-600 hover:bg-blue-500 rounded py-1 text-white">▶ Fundo</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── Buscar Fotos Pexels ── */}
                {mediaGalleryTab === "pexels" && (
                  <div className="px-3 py-3 flex flex-col gap-2 flex-1 overflow-auto">
                    <form onSubmit={e => { e.preventDefault(); searchPexels(pexelsQ); }} className="flex gap-1">
                      <Input
                        placeholder="Ex: restaurante, academia…"
                        value={pexelsQ}
                        onChange={e => setPexelsQ(e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                      <Button type="submit" size="sm" className="h-7 px-2 shrink-0" disabled={pexelsLoading}>
                        {pexelsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                      </Button>
                    </form>

                    {pexelsNoKey && (
                      <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-2 text-[10px] text-amber-300 text-center">
                        PEXELS_API_KEY não configurada.<br />Obtenha em <span className="underline">pexels.com/api</span>
                      </div>
                    )}

                    {pexelsResults.length === 0 && !pexelsLoading && !pexelsNoKey && (
                      <p className="text-[10px] text-muted-foreground text-center py-6">
                        Digite um termo e pesquise.<br />
                        <span className="opacity-50">Fotos via Pexels (grátis)</span>
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-1">
                      {pexelsResults.map(photo => (
                        <div key={photo.id} className="relative group aspect-video rounded overflow-hidden border border-white/10">
                          <img src={photo.src.medium} alt={photo.alt} className="w-full h-full object-cover" loading="lazy" />
                          <div className="absolute inset-x-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 p-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-4">
                            <button onClick={() => importPexelsPhoto(photo, "fundo")}
                              className="flex-1 text-[9px] font-bold bg-blue-600 hover:bg-blue-500 rounded py-1 text-white">Fundo</button>
                            <button onClick={async () => {
                              const savedPath = await importPexelsPhoto(photo, "slide");
                              if (savedPath) {
                                const slide: BgSlide = { id: nid(), url: savedPath, type: "image", duration: 4, transition: "fade", transitionMs: 500 };
                                setScene(prev => ({ ...prev, bgSlides: [...(prev.bgSlides ?? []), slide] }));
                              }
                            }} className="flex-1 text-[9px] font-bold bg-violet-600 hover:bg-violet-500 rounded py-1 text-white">Slide+</button>
                            <button onClick={() => importPexelsPhoto(photo, "canvas")}
                              className="flex-1 text-[9px] font-bold bg-emerald-600 hover:bg-emerald-500 rounded py-1 text-white">Canvas</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {pexelsResults.length > 0 && (
                      <div className="flex items-center gap-2 justify-center mt-1">
                        <button disabled={pexelsPage <= 1 || pexelsLoading}
                          onClick={() => searchPexels(pexelsQ, pexelsPage - 1)}
                          className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 px-2 py-1">← Ant.</button>
                        <span className="text-[10px] text-muted-foreground">{pexelsPage} / {pexelsTotalPages}</span>
                        <button disabled={pexelsPage >= pexelsTotalPages || pexelsLoading}
                          onClick={() => searchPexels(pexelsQ, pexelsPage + 1)}
                          className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 px-2 py-1">Próx. →</button>
                      </div>
                    )}

                    <p className="text-[8px] text-muted-foreground/40 text-center mt-auto">Fotos via Pexels</p>
                  </div>
                )}

                {/* ── Buscar Vídeos Pexels ── */}
                {mediaGalleryTab === "pexelsVideo" && (
                  <div className="px-3 py-3 flex flex-col gap-2 flex-1 overflow-auto">
                    <form onSubmit={e => { e.preventDefault(); searchPexelsVideos(pexelsVideoQ); }} className="flex gap-1">
                      <Input
                        placeholder="Ex: carro, loja, comida…"
                        value={pexelsVideoQ}
                        onChange={e => setPexelsVideoQ(e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                      <Button type="submit" size="sm" className="h-7 px-2 shrink-0" disabled={pexelsVideoLoading}>
                        {pexelsVideoLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                      </Button>
                    </form>

                    {pexelsVideoNoKey && (
                      <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-2 text-[10px] text-amber-300 text-center">
                        PEXELS_API_KEY não configurada.<br />Obtenha em <span className="underline">pexels.com/api</span>
                      </div>
                    )}

                    {pexelsVideoResults.length === 0 && !pexelsVideoLoading && !pexelsVideoNoKey && (
                      <p className="text-[10px] text-muted-foreground text-center py-6">
                        Digite um termo e pesquise.<br />
                        <span className="opacity-50">Vídeos via Pexels (grátis)</span>
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-1">
                      {pexelsVideoResults.map(video => (
                        <div key={video.id} className="relative group aspect-video rounded overflow-hidden border border-white/10">
                          <img src={video.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                          <span className="absolute top-1 right-1 text-[8px] bg-black/70 text-white rounded px-1">{video.duration}s</span>
                          <div className="absolute inset-x-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 p-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-4">
                            <button onClick={() => importPexelsVideo(video, "fundo")}
                              className="flex-1 text-[9px] font-bold bg-blue-600 hover:bg-blue-500 rounded py-1 text-white">▶ Fundo</button>
                            <button onClick={() => importPexelsVideo(video, "biblioteca")}
                              className="flex-1 text-[9px] font-bold bg-emerald-600 hover:bg-emerald-500 rounded py-1 text-white">+ Bibl.</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {pexelsVideoResults.length > 0 && (
                      <div className="flex items-center gap-2 justify-center mt-1">
                        <button disabled={pexelsVideoPage <= 1 || pexelsVideoLoading}
                          onClick={() => searchPexelsVideos(pexelsVideoQ, pexelsVideoPage - 1)}
                          className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 px-2 py-1">← Ant.</button>
                        <span className="text-[10px] text-muted-foreground">{pexelsVideoPage} / {pexelsVideoTotalPages}</span>
                        <button disabled={pexelsVideoPage >= pexelsVideoTotalPages || pexelsVideoLoading}
                          onClick={() => searchPexelsVideos(pexelsVideoQ, pexelsVideoPage + 1)}
                          className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 px-2 py-1">Próx. →</button>
                      </div>
                    )}

                    <p className="text-[8px] text-muted-foreground/40 text-center mt-auto">Vídeos via Pexels</p>
                  </div>
                )}
              </div>
            )}

            {leftTab === "elementos" && (
              <div className="flex flex-col h-full">
                {/* search */}
                <div className="px-3 pt-3 pb-2 shrink-0">
                  <Input placeholder="Buscar elemento…" value={elemSearch} onChange={e => setElemSearch(e.target.value)} className="h-7 text-xs" />
                </div>
                {/* cat chips */}
                <div className="flex gap-0.5 px-2 shrink-0 flex-wrap">
                  {(["formas","texto","badges","molduras","stickers"] as const).map(c => (
                    <button key={c} onClick={() => setElemCat(c)}
                      className={cn("text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide transition-colors mb-1",
                        elemCat === c ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground hover:bg-white/10")}>
                      {c === "formas" ? "Formas" : c === "texto" ? "Texto" : c === "badges" ? "Badges" : c === "molduras" ? "Molduras" : "Stickers"}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">

                  {/* ── FORMAS ── */}
                  {elemCat === "formas" && (() => {
                    const ALL_SHAPES: { kind: ShapeKind; emoji: string; label: string; fill: string }[] = [
                      { kind: "rect",      emoji: "⬜", label: "Retângulo",    fill: "#3b82f6" },
                      { kind: "rounded",   emoji: "▬",  label: "Arredondado",  fill: "#3b82f6" },
                      { kind: "pill",      emoji: "💊", label: "Pílula",       fill: "#3b82f6" },
                      { kind: "ellipse",   emoji: "⭕", label: "Elipse",       fill: "#ec4899" },
                      { kind: "circle",    emoji: "🔵", label: "Círculo",      fill: "#0ea5e9" },
                      { kind: "triangle",  emoji: "🔺", label: "Triângulo",    fill: "#f59e0b" },
                      { kind: "diamond",   emoji: "◆",  label: "Losango",      fill: "#8b5cf6" },
                      { kind: "pentagon",  emoji: "⬠",  label: "Pentágono",    fill: "#06b6d4" },
                      { kind: "hexagon",   emoji: "⬡",  label: "Hexágono",     fill: "#10b981" },
                      { kind: "star",      emoji: "⭐", label: "Estrela",      fill: "#fbbf24" },
                      { kind: "arrowRight",emoji: "➡",  label: "Seta →",      fill: "#ef4444" },
                      { kind: "arrowLeft", emoji: "⬅",  label: "Seta ←",      fill: "#ef4444" },
                      { kind: "lineH",     emoji: "—",  label: "Linha H",      fill: "#ffffff" },
                      { kind: "lineV",     emoji: "|",  label: "Linha V",      fill: "#ffffff" },
                    ];
                    const filtered = elemSearch
                      ? ALL_SHAPES.filter(s => s.label.toLowerCase().includes(elemSearch.toLowerCase()))
                      : ALL_SHAPES;
                    return (
                      <div className="grid grid-cols-3 gap-1">
                        {filtered.map(s => (
                          <button key={s.kind} onClick={() => addShapeKind(s.kind)}
                            className="flex flex-col items-center gap-1 p-2 rounded-lg border border-white/10 hover:border-primary hover:bg-primary/5 transition-colors">
                            <div className="w-8 h-8 flex items-center justify-center rounded"
                              style={{ background: s.fill, clipPath: getShapeClipPath(s.kind), borderRadius: getShapeBorderRadius(s.kind) > 0 ? `${getShapeBorderRadius(s.kind)}%` : undefined }}>
                              {!getShapeClipPath(s.kind) && <span className="text-[10px] text-white/0">·</span>}
                            </div>
                            <span className="text-[9px] text-muted-foreground leading-tight text-center">{s.label}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  {/* ── TEXTO RÁPIDO ── */}
                  {elemCat === "texto" && (() => {
                    const QTEXTS: { v: "titulo"|"subtitulo"|"preco"|"cta"|"eyebrow"; label: string; preview: string; style: React.CSSProperties }[] = [
                      { v: "titulo",    label: "Título",     preview: "Título Principal", style: { fontSize: 15, fontWeight: "bold", color: "#fff" } },
                      { v: "subtitulo", label: "Subtítulo",  preview: "Subtítulo de apoio", style: { fontSize: 10, color: "#cbd5e1" } },
                      { v: "preco",     label: "Preço",      preview: "R$ 99,90", style: { fontSize: 18, fontWeight: "bold", color: "#fbbf24" } },
                      { v: "cta",       label: "CTA",        preview: "SAIBA MAIS", style: { fontSize: 9, fontWeight: "bold", color: "#fff", background: "#3b82f6", padding: "2px 8px", borderRadius: 4, letterSpacing: 2 } },
                      { v: "eyebrow",   label: "Eyebrow",    preview: "✨ NOVIDADE", style: { fontSize: 9, fontWeight: "bold", color: "#79B4B0", letterSpacing: 3 } },
                    ];
                    const filtered = elemSearch
                      ? QTEXTS.filter(t => t.label.toLowerCase().includes(elemSearch.toLowerCase()))
                      : QTEXTS;
                    return (
                      <div className="space-y-1">
                        {filtered.map(t => (
                          <button key={t.v} onClick={() => addQuickText(t.v)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-white/10 hover:border-primary hover:bg-primary/5 transition-colors">
                            <span className="text-[10px] text-muted-foreground w-16 text-left">{t.label}</span>
                            <span style={t.style} className="truncate max-w-[120px]">{t.preview}</span>
                          </button>
                        ))}
                        <Separator className="my-1" />
                        <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8" onClick={addText}>
                          <Type className="w-3.5 h-3.5" /> Texto em branco
                        </Button>
                        <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8" onClick={addImage}>
                          <ImageIcon className="w-3.5 h-3.5" /> Imagem overlay
                        </Button>
                      </div>
                    );
                  })()}

                  {/* ── BADGES ── */}
                  {elemCat === "badges" && (() => {
                    const BADGES: { kind: Parameters<typeof addBadge>[0]; label: string; preview: string; bg: string; color: string }[] = [
                      { kind: "pct_off",   label: "% OFF",      preview: "50% OFF",          bg: "#dc2626", color: "#fff" },
                      { kind: "novo",      label: "Novo",       preview: "NOVO",              bg: "#16a34a", color: "#fff" },
                      { kind: "promo",     label: "Promoção",   preview: "PROMOÇÃO",          bg: "#f59e0b", color: "#1c1917" },
                      { kind: "oferta",    label: "Faixa",      preview: "⚡ OFERTA ESPECIAL", bg: "#7c3aed", color: "#fff" },
                      { kind: "cta_btn",   label: "Botão CTA",  preview: "COMPRAR AGORA",     bg: "#3b82f6", color: "#fff" },
                      { kind: "tag_preco", label: "Tag Preço",  preview: "◆ R$49",            bg: "#fbbf24", color: "#1c1917" },
                      { kind: "exclusivo", label: "Exclusivo",  preview: "★ EXCLUSIVO",       bg: "#0f172a", color: "#fbbf24" },
                      { kind: "urgente",   label: "Urgente",    preview: "➡ SÓ HOJE!",        bg: "#dc2626", color: "#fff" },
                    ];
                    const filtered = elemSearch
                      ? BADGES.filter(b => b.label.toLowerCase().includes(elemSearch.toLowerCase()))
                      : BADGES;
                    return (
                      <div className="grid grid-cols-2 gap-1">
                        {filtered.map(b => (
                          <button key={b.kind} onClick={() => addBadge(b.kind)}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-lg border border-white/10 hover:border-primary hover:bg-primary/5 transition-colors">
                            <div className="px-2 py-1 rounded text-[9px] font-bold truncate w-full text-center"
                              style={{ background: b.bg, color: b.color }}>{b.preview}</div>
                            <span className="text-[9px] text-muted-foreground">{b.label}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  {/* ── MOLDURAS ── */}
                  {elemCat === "molduras" && (() => {
                    const FRAMES: { kind: Parameters<typeof addFrame>[0]; label: string; desc: string }[] = [
                      { kind: "fina",     label: "Fina",     desc: "Borda fina branca" },
                      { kind: "grossa",   label: "Grossa",   desc: "Borda espessa" },
                      { kind: "redonda",  label: "Redonda",  desc: "Cantos arredondados" },
                      { kind: "polaroid", label: "Polaroid", desc: "Fundo branco inferior" },
                    ];
                    const filtered = elemSearch
                      ? FRAMES.filter(f => f.label.toLowerCase().includes(elemSearch.toLowerCase()))
                      : FRAMES;
                    return (
                      <div className="space-y-1.5">
                        {filtered.map(f => (
                          <button key={f.kind} onClick={() => addFrame(f.kind)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-white/10 hover:border-primary hover:bg-primary/5 transition-colors">
                            <div className="w-10 h-12 shrink-0 rounded"
                              style={{
                                border: f.kind === "polaroid" ? "1px solid #e5e7eb" : f.kind === "grossa" ? "6px solid #fff" : f.kind === "redonda" ? "3px solid #fff" : "2px solid #fff",
                                borderRadius: f.kind === "redonda" ? 8 : f.kind === "polaroid" ? 2 : 0,
                                background: f.kind === "polaroid" ? "#fff" : "transparent",
                              }} />
                            <div className="text-left">
                              <p className="text-[11px] font-medium text-foreground">{f.label}</p>
                              <p className="text-[9px] text-muted-foreground">{f.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  {/* ── STICKERS ── */}
                  {elemCat === "stickers" && (() => {
                    const STICKERS = [
                      "🔥","⭐","💥","✅","❌","💯","🎯","🏆","🎁","💎",
                      "🚀","⚡","❤️","💰","👑","🛒","📣","📢","🔔","✨",
                      "🎉","💡","🔑","🌟",
                    ];
                    const filtered = elemSearch
                      ? STICKERS.filter(e => e.includes(elemSearch))
                      : STICKERS;
                    return (
                      <div className="grid grid-cols-5 gap-1">
                        {filtered.map(em => (
                          <button key={em} onClick={() => addSticker(em)}
                            className="aspect-square rounded-lg border border-white/10 hover:border-primary hover:bg-primary/5 transition-colors text-xl flex items-center justify-center">
                            {em}
                          </button>
                        ))}
                      </div>
                    );
                  })()}

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

                {/* ── Slideshow de Fundo ── */}
                <div className="mt-4 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      <Film className="w-3 h-3" /> Slideshow de fundo
                      {(scene.bgSlides?.length ?? 0) > 0 && (
                        <span className="ml-1 bg-primary/20 text-primary rounded-full px-1.5 text-[8px]">{scene.bgSlides!.length}</span>
                      )}
                    </p>
                    <div className="flex gap-1">
                      <button
                        title="Adicionar imagem ao slideshow"
                        onClick={() => {
                          const inp = document.createElement("input");
                          inp.type = "file"; inp.accept = "image/*,video/*"; inp.multiple = true;
                          inp.onchange = async () => {
                            const files = Array.from(inp.files ?? []);
                            for (const file of files) {
                              const isVideo = file.type.startsWith("video/");
                              const url = URL.createObjectURL(file);
                              const slide: BgSlide = { id: nid(), url, type: isVideo ? "video" : "image", duration: 4, transition: "fade", transitionMs: 500 };
                              setScene(prev => ({ ...prev, bgSlides: [...(prev.bgSlides ?? []), slide] }));
                            }
                          };
                          inp.click();
                        }}
                        className="text-[9px] bg-primary/15 hover:bg-primary/25 text-primary rounded px-2 py-0.5 font-bold">
                        + Upload
                      </button>
                      {(scene.bgSlides?.length ?? 0) > 0 && (
                        <button onClick={() => updateScene({ bgSlides: [] })}
                          className="text-[9px] bg-destructive/15 hover:bg-destructive/25 text-destructive rounded px-2 py-0.5 font-bold">
                          Limpar
                        </button>
                      )}
                    </div>
                  </div>

                  {(scene.bgSlides?.length ?? 0) === 0 && (
                    <p className="text-[9px] text-muted-foreground text-center py-3 border border-dashed border-white/10 rounded-lg">
                      Adicione imagens/vídeos para criar<br />um slideshow de fundo com transições
                    </p>
                  )}

                  {(scene.bgSlides?.length ?? 0) > 0 && (
                    <div className="space-y-1.5">
                      {scene.bgSlides!.map((slide, si) => (
                        <div key={slide.id} className={cn("rounded-lg border p-1.5 gap-1.5 flex items-center", bgSlideIdx === si && !exportBgOverride ? "border-primary/50 bg-primary/5" : "border-white/10 bg-white/3")}>
                          {/* Thumbnail */}
                          <div className="w-10 h-7 shrink-0 rounded overflow-hidden bg-black/40 flex items-center justify-center border border-white/10">
                            {slide.type === "image"
                              ? <img src={resolveUrl(slide.url)} className="w-full h-full object-cover" />
                              : <Film className="w-3 h-3 text-white/40" />
                            }
                          </div>
                          {/* Controls */}
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-muted-foreground w-4 shrink-0">{si + 1}.</span>
                              <input type="number" min={1} max={60} value={slide.duration}
                                onChange={e => setScene(prev => ({ ...prev, bgSlides: prev.bgSlides!.map((s: BgSlide, j: number) => j === si ? { ...s, duration: Math.max(1, Number(e.target.value)) } : s) }))}
                                className="w-10 h-5 text-[9px] text-center bg-white/5 border border-white/10 rounded font-mono" />
                              <span className="text-[8px] text-muted-foreground">s</span>
                              <select value={slide.transition}
                                onChange={e => setScene(prev => ({ ...prev, bgSlides: prev.bgSlides!.map((s: BgSlide, j: number) => j === si ? { ...s, transition: e.target.value as SceneTransition } : s) }))}
                                className="flex-1 h-5 text-[8px] bg-white/5 border border-white/10 rounded px-0.5 text-foreground truncate">
                                {TRANS_PRESETS.map(p => <option key={p.value} value={p.value}>{p.icon} {p.label}</option>)}
                              </select>
                            </div>
                          </div>
                          {/* Remove */}
                          <button onClick={() => setScene(prev => ({ ...prev, bgSlides: prev.bgSlides!.filter((_: BgSlide, j: number) => j !== si) }))}
                            className="shrink-0 text-white/30 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <p className="text-[8px] text-muted-foreground text-center pt-1 opacity-60">
                        Cicla automaticamente no editor e na exportação
                      </p>
                    </div>
                  )}
                </div>
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
                        : el.type === "image" ? <ImageIcon className="w-3 h-3 shrink-0" />
                        : <Square className="w-3 h-3 shrink-0" />}
                      <span className="truncate flex-1">
                        {el.type === "text" ? el.text.slice(0, 16) || "Texto"
                          : el.type === "image" ? "Imagem"
                          : el.shapeKind ? SHAPE_LABEL[el.shapeKind]
                          : el.type === "ellipse" ? "Elipse"
                          : "Retângulo"}
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
                {selectedElem.type === "text" ? "Texto" : selectedElem.type === "image" ? "Imagem" : selectedElem.shapeKind ? SHAPE_LABEL[selectedElem.shapeKind] : selectedElem.type === "ellipse" ? "Elipse" : "Retângulo"}
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
                <>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-white/60 hover:text-white px-2"
                    onClick={() => updateElem(selectedElem.id, { flipX: !selectedElem.flipX })}>
                    ↔ Flip
                  </Button>
                  <Button variant="ghost" size="sm"
                    className={`h-6 text-[10px] gap-1 px-2 ${cropMode === selectedElem.id ? "text-amber-400 bg-amber-400/10" : "text-white/60 hover:text-white"}`}
                    onClick={() => {
                      if (cropMode === selectedElem.id) {
                        setCropMode(null);
                      } else {
                        if (!selectedElem.cropInset) updateElem(selectedElem.id, { cropInset: { t: 0, r: 0, b: 0, l: 0 } });
                        setCropMode(selectedElem.id);
                      }
                    }}>
                    ✂ Recortar
                  </Button>
                  {selectedElem.cropInset && (
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-white/40 hover:text-red-400 px-2"
                      onClick={() => clearCrop(selectedElem.id)}>
                      ↺ Limpar Crop
                    </Button>
                  )}
                </>
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
                  // when bgSlides active, use base bg only — the animated inner div handles the image
                  ...((scene.bgSlides?.length ?? 0) > 0 ? { background: scene.bg } : bgImageStyle()),
                } as React.CSSProperties}
                onClick={e => { e.stopPropagation(); setSelected(null); setCropMode(null); }}
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

                {/* bgSlides animated layer (overrides bgImage on outer div when slides are active) */}
                {(scene.bgSlides?.length ?? 0) > 0 && (
                  <div key={bgSlideKey} className={bgSlideTrans}
                    style={{ "--trans-ms": `${scene.bgSlides![bgSlideIdx]?.transitionMs ?? 500}ms`, position: "absolute", inset: 0, zIndex: 0, ...bgImageStyle() } as React.CSSProperties} />
                )}

                {/* Video background */}
                {activeBgVideo() && (
                  <video key={activeBgVideo()} src={resolveUrl(activeBgVideo()!)} autoPlay muted loop playsInline
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
                )}
                {(getActiveBgSlide() ? getActiveBgSlide()!.type === "image" : !!scene.bgImage) && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)", pointerEvents: "none", zIndex: 1 }} />
                )}

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
                          {el.type === "image" && (() => {
                            const ci = el.cropInset;
                            const clip = ci ? `inset(${ci.t}% ${ci.r}% ${ci.b}% ${ci.l}%)` : undefined;
                            const isCropping = cropMode === el.id;
                            return (
                              <div style={{ position: "relative", width: "100%", height: "100%", clipPath: isCropping ? undefined : clip, overflow: "hidden" }}>
                                <img src={resolveUrl(el.src)} alt="" draggable={false}
                                  style={{ width: "100%", height: hasH ? "100%" : "auto", objectFit: "contain", display: "block", pointerEvents: "none", filter: elemFilter || undefined, transform: flipTransform }} />
                                {isCropping && ci && (() => {
                                  const cropHandles: { edge: CropEdge; style: React.CSSProperties; cursor: string }[] = [
                                    { edge: "t",  style: { top: `${ci.t}%`,      left: "50%",           transform: "translate(-50%,-50%)" }, cursor: "n-resize" },
                                    { edge: "b",  style: { top: `${100-ci.b}%`,  left: "50%",           transform: "translate(-50%,-50%)" }, cursor: "s-resize" },
                                    { edge: "l",  style: { top: "50%",           left: `${ci.l}%`,      transform: "translate(-50%,-50%)" }, cursor: "w-resize" },
                                    { edge: "r",  style: { top: "50%",           left: `${100-ci.r}%`,  transform: "translate(-50%,-50%)" }, cursor: "e-resize" },
                                    { edge: "tl", style: { top: `${ci.t}%`,      left: `${ci.l}%`,      transform: "translate(-50%,-50%)" }, cursor: "nw-resize" },
                                    { edge: "tr", style: { top: `${ci.t}%`,      left: `${100-ci.r}%`,  transform: "translate(-50%,-50%)" }, cursor: "ne-resize" },
                                    { edge: "bl", style: { top: `${100-ci.b}%`,  left: `${ci.l}%`,      transform: "translate(-50%,-50%)" }, cursor: "sw-resize" },
                                    { edge: "br", style: { top: `${100-ci.b}%`,  left: `${100-ci.r}%`,  transform: "translate(-50%,-50%)" }, cursor: "se-resize" },
                                  ];
                                  return (
                                    <>
                                      {/* Dark overlay outside crop region — 4 stripes */}
                                      <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:6 }}>
                                        <div style={{ position:"absolute", top:0, left:0, right:0, height:`${ci.t}%`, background:"rgba(0,0,0,0.55)" }} />
                                        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:`${ci.b}%`, background:"rgba(0,0,0,0.55)" }} />
                                        <div style={{ position:"absolute", top:`${ci.t}%`, bottom:`${ci.b}%`, left:0, width:`${ci.l}%`, background:"rgba(0,0,0,0.55)" }} />
                                        <div style={{ position:"absolute", top:`${ci.t}%`, bottom:`${ci.b}%`, right:0, width:`${ci.r}%`, background:"rgba(0,0,0,0.55)" }} />
                                        {/* Crop border */}
                                        <div style={{ position:"absolute", top:`${ci.t}%`, bottom:`${ci.b}%`, left:`${ci.l}%`, right:`${ci.r}%`, border:"2px solid #f59e0b", boxSizing:"border-box" }} />
                                      </div>
                                      {/* Crop handles */}
                                      {cropHandles.map(({ edge, style, cursor }) => (
                                        <div key={edge}
                                          style={{ position:"absolute", width:12, height:12, background:"#f59e0b", border:"2px solid white", borderRadius:2, cursor, zIndex:7, ...style }}
                                          onPointerDown={e2 => startCrop(edge, el.id, e2)} />
                                      ))}
                                    </>
                                  );
                                })()}
                              </div>
                            );
                          })()}
                          {isShape && (() => {
                            const sk = el.shapeKind;
                            const cp = sk ? getShapeClipPath(sk) : undefined;
                            const hasClip = !!cp;
                            return (
                              <div style={{
                                width: "100%", height: "100%",
                                background: el.fillColor || "transparent",
                                border: !hasClip && el.strokeWidth > 0 ? `${el.strokeWidth}px solid ${el.strokeColor}` : "none",
                                borderRadius: hasClip ? 0 : `${el.borderRadius}%`,
                                clipPath: cp,
                                pointerEvents: "none",
                                transform: flipTransform,
                              }} />
                            );
                          })()}

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
                    {selectedElem.type === "text" ? "Texto" : selectedElem.type === "image" ? "Imagem" : selectedElem.shapeKind ? SHAPE_LABEL[selectedElem.shapeKind] : selectedElem.type === "ellipse" ? "Elipse" : "Retângulo"}
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
