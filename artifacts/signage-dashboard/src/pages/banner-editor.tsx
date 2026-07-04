import { useState, useRef, useCallback, useEffect } from "react";
import { toPng } from "html-to-image";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  useRequestUploadUrl,
  useCreateMedia,
  getListMediaQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, Type, ImageIcon, Trash2, Bold, Italic,
  AlignLeft, AlignCenter, AlignRight, Save, Layers,
  Loader2, Palette, RotateCcw, Square, CircleDot, Copy,
  BringToFront, SendToBack, Lock, Unlock, Download,
  AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
  AlignStartVertical, AlignEndVertical, AlignStartHorizontal, AlignEndHorizontal,
  Wand2, Film,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface ExportRes {
  label: string;
  w: number;
  h: number;
  custom?: boolean;
}

type AnimationType = "none" | "fadeIn" | "slideLeft" | "slideRight" | "slideUp" | "zoomIn" | "bounce";

interface CanvasElem {
  id: string;
  type: "text" | "image" | "rect" | "ellipse";
  x: number;             // % of canvas width (center anchor)
  y: number;             // % of canvas height (center anchor)
  w: number;             // % of canvas width
  h: number;             // % of canvas height (0 = auto for text)
  rotation: number;      // degrees
  text: string;
  src: string;
  fontSize: number;      // % of canvas height
  fontFamily: string;
  color: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textDecoration: "none" | "underline";
  textAlign: "left" | "center" | "right";
  letterSpacing: number; // px
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
  animDelay?: number; // seconds (0, 0.3, 0.5, 0.8, 1, 1.5, 2)
}

interface Scene {
  bg: string;
  bgImage: string;
  bgVideo?: string;
  elements: CanvasElem[];
  duration?: number; // per-scene override; falls back to project.durationSeconds
}

interface ProjectConfig {
  name: string;
  res: ExportRes;
  durationSeconds: number;
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

const TEXT_COLORS = [
  "#ffffff", "#f0f4ff", "#fef3c7", "#fde68a",
  "#fdba74", "#f87171", "#34d399", "#60a5fa",
  "#111111", "#1e293b", "#dc2626", "#16a34a",
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

const ANIM_OPTIONS: { label: string; value: AnimationType }[] = [
  { label: "Nenhuma",      value: "none" },
  { label: "Fade In",      value: "fadeIn" },
  { label: "Slide Esq →",  value: "slideLeft" },
  { label: "Slide Dir ←",  value: "slideRight" },
  { label: "Slide Baixo ↑",value: "slideUp" },
  { label: "Zoom In",      value: "zoomIn" },
  { label: "Bounce ↓",     value: "bounce" },
];

const DEFAULT_SCENE: Scene = {
  bg: "linear-gradient(135deg,#0f172a,#1e3a5f)",
  bgImage: "",
  bgVideo: "",
  elements: [],
};

function newElem(type: CanvasElem["type"]): CanvasElem {
  const isShape = type === "rect" || type === "ellipse";
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
  };
}

const TEMPLATES: { name: string; emoji: string; scene: Scene }[] = [
  {
    name: "Promoção", emoji: "🔥",
    scene: {
      bg: "linear-gradient(135deg,#f97316,#dc2626)", bgImage: "",
      elements: [
        { id: "a1", type: "text", src: "", x: 50, y: 22, w: 85, h: 0, rotation: 0, text: "🔥 PROMOÇÃO ESPECIAL", fontSize: 8, fontFamily: "Oswald, sans-serif", color: "#ffffff", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 2, lineHeight: 1.2, shadow: true, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "a2", type: "text", src: "", x: 50, y: 44, w: 80, h: 0, rotation: 0, text: "ATÉ 50% DE DESCONTO", fontSize: 6, fontFamily: "Oswald, sans-serif", color: "#fff7ed", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 3, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "a3", type: "text", src: "", x: 50, y: 65, w: 72, h: 0, rotation: 0, text: "Oferta por tempo limitado. Aproveite já!", fontSize: 3.5, fontFamily: "Inter, sans-serif", color: "#ffedd5", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.3, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
      ],
    },
  },
  {
    name: "Destaque", emoji: "⭐",
    scene: {
      bg: "linear-gradient(135deg,#1e3a5f,#1e1b4b)", bgImage: "",
      elements: [
        { id: "b1", type: "text", src: "", x: 50, y: 20, w: 80, h: 0, rotation: 0, text: "⭐ NOVIDADE", fontSize: 4, fontFamily: "Montserrat, sans-serif", color: "#fbbf24", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 4, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "b2", type: "text", src: "", x: 50, y: 42, w: 88, h: 0, rotation: 0, text: "Conheça o Nosso Produto", fontSize: 7, fontFamily: "Montserrat, sans-serif", color: "#f0f4ff", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.2, shadow: true, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "b3", type: "text", src: "", x: 50, y: 64, w: 70, h: 0, rotation: 0, text: "Qualidade e inovação para você.", fontSize: 3.5, fontFamily: "Raleway, sans-serif", color: "#93c5fd", fontWeight: "normal", fontStyle: "italic", textDecoration: "none", textAlign: "center", letterSpacing: 1, lineHeight: 1.3, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
      ],
    },
  },
  {
    name: "Aviso", emoji: "⚠️",
    scene: {
      bg: "linear-gradient(135deg,#1a1a2e,#16213e)", bgImage: "",
      elements: [
        { id: "c0", type: "rect", src: "", x: 50, y: 22, w: 88, h: 16, rotation: 0, text: "", fontSize: 5, fontFamily: "Inter, sans-serif", color: "#ffffff", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "#fbbf2422", strokeColor: "#fbbf24", strokeWidth: 2, borderRadius: 4, locked: false },
        { id: "c1", type: "text", src: "", x: 50, y: 22, w: 80, h: 0, rotation: 0, text: "⚠️ ATENÇÃO", fontSize: 7.5, fontFamily: "Oswald, sans-serif", color: "#fbbf24", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 2, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "c2", type: "text", src: "", x: 50, y: 52, w: 80, h: 0, rotation: 0, text: "Escreva sua mensagem aqui.", fontSize: 4.5, fontFamily: "Inter, sans-serif", color: "#e2e8f0", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.4, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "c3", type: "text", src: "", x: 50, y: 74, w: 70, h: 0, rotation: 0, text: "Informação importante.", fontSize: 3, fontFamily: "Inter, sans-serif", color: "#94a3b8", fontWeight: "normal", fontStyle: "italic", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.3, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
      ],
    },
  },
  {
    name: "Preço", emoji: "💰",
    scene: {
      bg: "linear-gradient(135deg,#064e3b,#065f46)", bgImage: "",
      elements: [
        { id: "d1", type: "text", src: "", x: 50, y: 18, w: 80, h: 0, rotation: 0, text: "PREÇO ESPECIAL", fontSize: 5, fontFamily: "Montserrat, sans-serif", color: "#6ee7b7", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 4, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "d2", type: "text", src: "", x: 50, y: 44, w: 85, h: 0, rotation: 0, text: "R$ 99,90", fontSize: 11, fontFamily: "Bebas Neue, sans-serif", color: "#ffffff", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 2, lineHeight: 1.1, shadow: true, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "d3", type: "text", src: "", x: 50, y: 70, w: 70, h: 0, rotation: 0, text: "por unidade • válido hoje", fontSize: 3.5, fontFamily: "Inter, sans-serif", color: "#a7f3d0", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.3, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
      ],
    },
  },
  {
    name: "Cardápio", emoji: "🍽️",
    scene: {
      bg: "linear-gradient(135deg,#3b0764,#1e1b4b)", bgImage: "",
      elements: [
        { id: "e0", type: "rect", src: "", x: 50, y: 12, w: 90, h: 10, rotation: 0, text: "", fontSize: 5, fontFamily: "Inter, sans-serif", color: "#ffffff", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "#7c3aed", strokeColor: "", strokeWidth: 0, borderRadius: 3, locked: false },
        { id: "e1", type: "text", src: "", x: 50, y: 12, w: 85, h: 0, rotation: 0, text: "🍽️ CARDÁPIO DO DIA", fontSize: 5, fontFamily: "Montserrat, sans-serif", color: "#ffffff", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 3, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "e2", type: "text", src: "", x: 50, y: 36, w: 80, h: 0, rotation: 0, text: "Prato Principal", fontSize: 5.5, fontFamily: "Playfair Display, serif", color: "#e9d5ff", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.3, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "e3", type: "text", src: "", x: 50, y: 52, w: 75, h: 0, rotation: 0, text: "Descrição do prato. Ingredientes e preparo especial da casa.", fontSize: 3.2, fontFamily: "Inter, sans-serif", color: "#c4b5fd", fontWeight: "normal", fontStyle: "italic", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.5, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "e4", type: "text", src: "", x: 50, y: 72, w: 50, h: 0, rotation: 0, text: "R$ 45,00", fontSize: 7, fontFamily: "Oswald, sans-serif", color: "#fbbf24", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 1, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
      ],
    },
  },
  {
    name: "Evento", emoji: "🎯",
    scene: {
      bg: "linear-gradient(135deg,#be185d,#9f1239)", bgImage: "",
      elements: [
        { id: "f1", type: "text", src: "", x: 50, y: 18, w: 85, h: 0, rotation: 0, text: "🎯 EVENTO ESPECIAL", fontSize: 4.5, fontFamily: "Montserrat, sans-serif", color: "#fce7f3", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 4, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "f2", type: "text", src: "", x: 50, y: 40, w: 90, h: 0, rotation: 0, text: "Nome do Evento", fontSize: 9, fontFamily: "Anton, sans-serif", color: "#ffffff", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 2, lineHeight: 1.1, shadow: true, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "f3", type: "text", src: "", x: 50, y: 62, w: 65, h: 0, rotation: 0, text: "📅 Data • 🕐 Horário • 📍 Local", fontSize: 3.5, fontFamily: "Inter, sans-serif", color: "#fbcfe8", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.4, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "f0", type: "rect", src: "", x: 50, y: 78, w: 35, h: 9, rotation: 0, text: "", fontSize: 5, fontFamily: "Inter, sans-serif", color: "#ffffff", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "#ffffff", strokeColor: "", strokeWidth: 0, borderRadius: 4, locked: false },
        { id: "f4", type: "text", src: "", x: 50, y: 78, w: 33, h: 0, rotation: 0, text: "INSCREVA-SE", fontSize: 3.5, fontFamily: "Montserrat, sans-serif", color: "#be185d", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 2, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
      ],
    },
  },
  {
    name: "Horários", emoji: "🕐",
    scene: {
      bg: "linear-gradient(135deg,#0c1445,#1e3a5f)", bgImage: "",
      elements: [
        { id: "g1", type: "text", src: "", x: 50, y: 12, w: 80, h: 0, rotation: 0, text: "🕐 HORÁRIO DE ATENDIMENTO", fontSize: 4, fontFamily: "Oswald, sans-serif", color: "#60a5fa", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 3, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "g0", type: "rect", src: "", x: 50, y: 50, w: 85, h: 55, rotation: 0, text: "", fontSize: 5, fontFamily: "Inter, sans-serif", color: "#ffffff", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "#1e3a5f55", strokeColor: "#3b82f633", strokeWidth: 1, borderRadius: 3, locked: false },
        { id: "g2", type: "text", src: "", x: 50, y: 33, w: 80, h: 0, rotation: 0, text: "Segunda a Sexta", fontSize: 4.5, fontFamily: "Inter, sans-serif", color: "#e2e8f0", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.3, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "g3", type: "text", src: "", x: 50, y: 44, w: 70, h: 0, rotation: 0, text: "08:00 — 18:00", fontSize: 6, fontFamily: "Bebas Neue, sans-serif", color: "#60a5fa", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 2, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "g4", type: "text", src: "", x: 50, y: 60, w: 80, h: 0, rotation: 0, text: "Sábado", fontSize: 4.5, fontFamily: "Inter, sans-serif", color: "#e2e8f0", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.3, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "g5", type: "text", src: "", x: 50, y: 71, w: 70, h: 0, rotation: 0, text: "09:00 — 13:00", fontSize: 6, fontFamily: "Bebas Neue, sans-serif", color: "#34d399", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 2, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "g6", type: "text", src: "", x: 50, y: 88, w: 80, h: 0, rotation: 0, text: "Domingo: Fechado", fontSize: 3.5, fontFamily: "Inter, sans-serif", color: "#f87171", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.3, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
      ],
    },
  },
  {
    name: "Notícia", emoji: "📰",
    scene: {
      bg: "#111111", bgImage: "",
      elements: [
        { id: "h0", type: "rect", src: "", x: 50, y: 7, w: 100, h: 12, rotation: 0, text: "", fontSize: 5, fontFamily: "Inter, sans-serif", color: "#ffffff", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "#dc2626", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "h1", type: "text", src: "", x: 50, y: 7, w: 90, h: 0, rotation: 0, text: "📰 BREAKING NEWS", fontSize: 4.5, fontFamily: "Oswald, sans-serif", color: "#ffffff", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 4, lineHeight: 1.2, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "h2", type: "text", src: "", x: 50, y: 38, w: 88, h: 0, rotation: 0, text: "Título Principal da Notícia", fontSize: 7.5, fontFamily: "Playfair Display, serif", color: "#ffffff", fontWeight: "bold", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.25, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "h3", type: "text", src: "", x: 50, y: 60, w: 82, h: 0, rotation: 0, text: "Subtítulo ou descrição breve do que aconteceu. Detalhes adicionais sobre o assunto.", fontSize: 3.5, fontFamily: "Inter, sans-serif", color: "#9ca3af", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.6, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
        { id: "h4", type: "text", src: "", x: 50, y: 82, w: 70, h: 0, rotation: 0, text: "Fonte • Hoje às 10:00h", fontSize: 2.8, fontFamily: "Inter, sans-serif", color: "#6b7280", fontWeight: "normal", fontStyle: "normal", textDecoration: "none", textAlign: "center", letterSpacing: 0, lineHeight: 1.3, shadow: false, bgColor: "", opacity: 1, fillColor: "", strokeColor: "", strokeWidth: 0, borderRadius: 0, locked: false },
      ],
    },
  },
];

// ── Helper ─────────────────────────────────────────────────────────────────────

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

function ColorDot({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={color}
      className="w-6 h-6 rounded-full border-2 flex-shrink-0 transition-transform hover:scale-110"
      style={{ background: color, borderColor: selected ? "#3b82f6" : "transparent", outline: selected ? "2px solid #3b82f6" : "none", outlineOffset: 1 }}
    />
  );
}

// ── Setup Screen ──────────────────────────────────────────────────────────────

const DURATION_OPTIONS = [5, 10, 15, 20, 30, 60];

function NewProjectScreen({ onStart }: { onStart: (cfg: ProjectConfig) => void }) {
  const [name, setName] = useState(`Mídia ${new Date().toLocaleDateString("pt-BR")}`);
  const [resIdx, setResIdx] = useState(0);
  const [customW, setCustomW] = useState(1920);
  const [customH, setCustomH] = useState(1080);
  const [durationSeconds, setDurationSeconds] = useState(15);
  const res = RESOLUTIONS[resIdx];
  const isCustom = res.custom;
  const finalRes = isCustom ? { label: `Personalizado — ${customW}×${customH}`, w: customW, h: customH } : res;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-card border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-5">
          <div className="flex items-center gap-3 mb-1">
            <Film className="w-6 h-6 text-white" />
            <h1 className="text-xl font-bold text-white">Mídia Edit</h1>
          </div>
          <p className="text-blue-100 text-sm">Crie imagens e artes para sua tela de LED ou TV</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Nome do projeto</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Promoção Julho 2026" className="h-9" />
          </div>

          {/* Resolution */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Resolução de saída</Label>
            <p className="text-xs text-muted-foreground">
              Define o canvas e o arquivo exportado — escolha a resolução exata do seu painel LED ou TV.
            </p>
            <div className="grid gap-2">
              {RESOLUTIONS.map((r, i) => (
                <button
                  key={i}
                  onClick={() => setResIdx(i)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all",
                    resIdx === i ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-muted-foreground"
                  )}
                >
                  <div className={cn("w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors",
                    resIdx === i ? "border-blue-500 bg-blue-500" : "border-muted-foreground")} />
                  <div>
                    <span className="text-sm font-medium">{r.label}</span>
                    {!r.custom && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({r.w > r.h ? "Paisagem" : r.w < r.h ? "Retrato" : "Quadrado"})
                      </span>
                    )}
                  </div>
                  {/* Mini aspect preview */}
                  {!r.custom && (
                    <div className="ml-auto shrink-0">
                      <div
                        className="bg-muted border rounded"
                        style={{
                          width: r.w >= r.h ? 32 : Math.round(32 * r.w / r.h),
                          height: r.h >= r.w ? 20 : Math.round(20 * r.h / r.w),
                        }}
                      />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {isCustom && (
              <div className="flex gap-3 pt-1">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Largura (px)</Label>
                  <Input type="number" value={customW} onChange={e => setCustomW(Math.max(100, parseInt(e.target.value) || 100))} className="h-8" />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Altura (px)</Label>
                  <Input type="number" value={customH} onChange={e => setCustomH(Math.max(100, parseInt(e.target.value) || 100))} className="h-8" />
                </div>
              </div>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Duração do vídeo MP4</Label>
            <p className="text-xs text-muted-foreground">
              Tempo que a mídia ficará visível na tela antes de ir para a próxima.
            </p>
            <div className="flex gap-2 flex-wrap">
              {DURATION_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDurationSeconds(d)}
                  className={cn(
                    "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                    durationSeconds === d ? "border-blue-500 bg-blue-500/10 text-blue-400" : "border-border hover:border-muted-foreground text-muted-foreground"
                  )}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm text-muted-foreground space-y-1">
            {!isCustom && (
              <div>Canvas: <span className="font-mono text-foreground">{res.w} × {res.h} px</span> • Proporção: <span className="text-foreground">{Math.round((res.w / res.h) * 100) / 100}:1</span></div>
            )}
            <div>Saída: <span className="text-foreground font-medium">MP4 {durationSeconds}s</span> • salvo diretamente na Biblioteca de Mídia</div>
          </div>

          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 text-sm font-semibold gap-2"
            onClick={() => { if (name.trim()) onStart({ name: name.trim(), res: finalRes, durationSeconds }); }}
            disabled={!name.trim() || (isCustom && (customW < 100 || customH < 100))}
          >
            <Wand2 className="w-4 h-4" /> Criar Projeto
          </Button>
        </div>
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

  const [project, setProject] = useState<ProjectConfig | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([DEFAULT_SCENE]);
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bgTab, setBgTab] = useState<"presets" | "gradients" | "color" | "image" | "video">("presets");
  const [bgColorInput, setBgColorInput] = useState("#1e3a5f");
  const [history, setHistory] = useState<Scene[]>([]);

  // Derived scene + setScene that transparently operate on the current scene
  const scene = scenes[currentSceneIdx] ?? scenes[0];
  const setScene = useCallback((updater: Scene | ((prev: Scene) => Scene)) => {
    setScenes(prev => prev.map((s, i) =>
      i === currentSceneIdx ? (typeof updater === "function" ? updater(s) : updater) : s
    ));
  }, [currentSceneIdx]);

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

  // Load Google Fonts
  useEffect(() => {
    const id = "media-edit-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&family=Oswald:wght@400;700&family=Poppins:wght@400;700&family=Roboto:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Bebas+Neue&family=Anton&family=Raleway:wght@400;700&display=swap";
    document.head.appendChild(link);
  }, []);

  // Track canvas height for font sizing
  useEffect(() => {
    if (!canvasRef.current) return;
    const ro = new ResizeObserver(entries => setCanvasH(entries[0].contentRect.height));
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [project]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") { setSelected(null); return; }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selected) {
          setScene(prev => ({ ...prev, elements: prev.elements.filter(el => el.id !== selected) }));
          setSelected(null);
        }
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") { e.preventDefault(); undo(); }
        if (e.key === "d") { e.preventDefault(); duplicateElem(selected); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, history]);

  // Pointer events (drag / resize / rotate)
  const onPointerMove = useCallback((e: PointerEvent) => {
    if (rotating.current) {
      const { elemId, centerX, centerY, startAngle, startRotation } = rotating.current;
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
      let newRot = (startRotation + angle - startAngle) % 360;
      if (newRot < 0) newRot += 360;
      setScene(prev => ({ ...prev, elements: prev.elements.map(el => el.id === elemId ? { ...el, rotation: Math.round(newRot) } : el) }));
      return;
    }
    if (resizing.current) {
      const { elemId, handle, startClientX, startClientY, startW, startH, startX, startY, canvasRect } = resizing.current;
      const dxPct = ((e.clientX - startClientX) / canvasRect.width) * 100;
      const dyPct = ((e.clientY - startClientY) / canvasRect.height) * 100;
      let newW = startW, newH = startH, newX = startX, newY = startY;
      if (handle.includes("e")) { newW = Math.max(5, startW + dxPct); newX = startX + dxPct / 2; }
      if (handle.includes("w")) { newW = Math.max(5, startW - dxPct); newX = startX + dxPct / 2; }
      if (handle.includes("s")) { newH = Math.max(3, startH + dyPct); newY = startY + dyPct / 2; }
      if (handle.includes("n")) { newH = Math.max(3, startH - dyPct); newY = startY + dyPct / 2; }
      setScene(prev => ({ ...prev, elements: prev.elements.map(el => el.id === elemId ? { ...el, w: newW, h: newH, x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) } : el) }));
      return;
    }
    if (dragging.current && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ((e.clientX - dragging.current.startClientX) / rect.width) * 100;
      const dy = ((e.clientY - dragging.current.startClientY) / rect.height) * 100;
      const newX = Math.max(2, Math.min(98, dragging.current.elemX + dx));
      const newY = Math.max(2, Math.min(98, dragging.current.elemY + dy));
      setScene(prev => ({ ...prev, elements: prev.elements.map(el => el.id === dragging.current!.elemId ? { ...el, x: newX, y: newY } : el) }));
    }
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = null;
    resizing.current = null;
    rotating.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // Helpers
  const pushHistory = useCallback((s: Scene) => setHistory(h => [...h.slice(-29), s]), []);
  const undo = () => {
    if (history.length === 0) return;
    setScene(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
    setSelected(null);
  };

  const applyTemplate = (t: typeof TEMPLATES[0]) => { pushHistory(scene); setScene({ ...t.scene }); setSelected(null); };

  // ── Scene management
  const addScene = () => {
    setScenes(prev => [...prev, { ...DEFAULT_SCENE }]);
    setCurrentSceneIdx(scenes.length);
    setSelected(null);
  };
  const duplicateScene = (idx: number) => {
    const clone: Scene = JSON.parse(JSON.stringify(scenes[idx]));
    clone.elements = clone.elements.map(el => ({ ...el, id: Math.random().toString(36).slice(2) }));
    setScenes(prev => [...prev.slice(0, idx + 1), clone, ...prev.slice(idx + 1)]);
    setCurrentSceneIdx(idx + 1);
    setSelected(null);
  };
  const deleteScene = (idx: number) => {
    if (scenes.length === 1) return;
    setScenes(prev => prev.filter((_, i) => i !== idx));
    setCurrentSceneIdx(prev => Math.min(prev, scenes.length - 2));
    setSelected(null);
  };
  const setSceneDuration = (idx: number, dur: number) => {
    setScenes(prev => prev.map((s, i) => i === idx ? { ...s, duration: dur } : s));
  };
  const updateScene = (patch: Partial<Scene>) => setScene(prev => ({ ...prev, ...patch }));

  const addText = () => {
    pushHistory(scene);
    const el = newElem("text");
    setScene(prev => ({ ...prev, elements: [...prev.elements, el] }));
    setSelected(el.id);
  };

  const addShape = (type: "rect" | "ellipse") => {
    pushHistory(scene);
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
      pushHistory(scene);
      const el: CanvasElem = { ...newElem("image"), src: url, w: 40, h: 30, y: 50 };
      setScene(prev => ({ ...prev, elements: [...prev.elements, el] }));
      setSelected(el.id);
    };
    input.click();
  };

  const updateElem = (id: string, patch: Partial<CanvasElem>) => {
    setScene(prev => ({ ...prev, elements: prev.elements.map(el => el.id === id ? { ...el, ...patch } : el) }));
  };

  const deleteElem = (id: string) => {
    pushHistory(scene);
    setScene(prev => ({ ...prev, elements: prev.elements.filter(el => el.id !== id) }));
    setSelected(null);
  };

  const duplicateElem = (id: string | null) => {
    if (!id) return;
    const src = scene.elements.find(el => el.id === id);
    if (!src) return;
    pushHistory(scene);
    const clone: CanvasElem = { ...src, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, x: src.x + 3, y: src.y + 3 };
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

  // ── Video capture: renders array of PNG scenes → offscreen canvas → MediaRecorder → MP4/WebM blob
  // Between scenes, does a 300ms crossfade by drawing both frames with lerped alpha.
  const captureAsVideo = (
    sceneFrames: { dataUrl: string; duration: number }[],
    resW: number,
    resH: number,
  ): Promise<{ blob: Blob; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const offscreen = document.createElement("canvas");
      offscreen.width = resW;
      offscreen.height = resH;
      const ctx = offscreen.getContext("2d")!;

      const candidates = [
        "video/mp4;codecs=avc1",
        "video/mp4",
        "video/webm;codecs=h264",
        "video/webm;codecs=vp9",
        "video/webm",
      ];
      const mimeType = candidates.find(m => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
      const stream = offscreen.captureStream(25);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => resolve({ blob: new Blob(chunks, { type: mimeType }), mimeType });
      recorder.onerror = () => reject(new Error("Falha na gravação de vídeo"));

      const loadImg = (dataUrl: string): Promise<HTMLImageElement> =>
        new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = () => rej(new Error("Erro ao carregar frame"));
          img.src = dataUrl;
        });

      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

      const CROSS_MS = 300; // crossfade duration between scenes
      const CROSS_STEPS = 10;

      (async () => {
        try {
          const imgs = await Promise.all(sceneFrames.map(f => loadImg(f.dataUrl)));
          recorder.start();

          for (let i = 0; i < imgs.length; i++) {
            const holdMs = sceneFrames[i].duration * 1000 - (i < imgs.length - 1 ? CROSS_MS : 0);
            // Hold current scene
            ctx.drawImage(imgs[i], 0, 0, resW, resH);
            await sleep(Math.max(200, holdMs));

            // Crossfade to next scene
            if (i < imgs.length - 1) {
              for (let step = 1; step <= CROSS_STEPS; step++) {
                const alpha = step / CROSS_STEPS;
                ctx.drawImage(imgs[i], 0, 0, resW, resH);
                ctx.globalAlpha = alpha;
                ctx.drawImage(imgs[i + 1], 0, 0, resW, resH);
                ctx.globalAlpha = 1;
                await sleep(CROSS_MS / CROSS_STEPS);
              }
            }
          }
          recorder.stop();
        } catch (err) {
          reject(err);
        }
      })();
    });

  // Export helpers
  const exportCanvas = async (saveTo: "library" | "download") => {
    if (!canvasRef.current || !project) return;
    setSaving(true);
    const originalIdx = currentSceneIdx;
    try {
      const pixelRatio = project.res.w / canvasRef.current.offsetWidth;

      // ── Download → PNG of current scene only
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

      // ── Save to library → MP4/WebM — render each scene in sequence
      const totalSec = scenes.reduce((sum, s) => sum + (s.duration ?? project.durationSeconds), 0);
      toast({ title: `🎬 Renderizando ${scenes.length} cena(s)… ${totalSec}s total` });

      // Render each scene: temporarily switch to it, wait for React paint, capture PNG
      const sceneFrames: { dataUrl: string; duration: number }[] = [];
      for (let i = 0; i < scenes.length; i++) {
        setCurrentSceneIdx(i);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); // 2 frames for React
        const dataUrl = await toPng(canvasRef.current!, { pixelRatio, cacheBust: true });
        sceneFrames.push({ dataUrl, duration: scenes[i].duration ?? project.durationSeconds });
      }
      // Restore
      setCurrentSceneIdx(originalIdx);

      const { blob: videoBlob, mimeType } = await captureAsVideo(sceneFrames, project.res.w, project.res.h);
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const filename = `midia-${Date.now()}.${ext}`;
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
        data: { name: filename, size: videoBlob.size, contentType: mimeType },
      });
      await fetch(uploadURL, { method: "PUT", body: videoBlob, headers: { "Content-Type": mimeType } });
      await new Promise<void>((resolve, reject) => {
        createMedia.mutate(
          { data: { name: project.name, type: "video", url: objectPath, durationSeconds: totalSec } },
          { onSuccess: () => resolve(), onError: () => reject() }
        );
      });
      queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
      toast({ title: `✅ Vídeo ${ext.toUpperCase()} salvo — ${scenes.length} cena(s) • ${totalSec}s total` });
    } catch (err) {
      setCurrentSceneIdx(originalIdx);
      toast({ title: `Erro ao exportar: ${err instanceof Error ? err.message : "tente novamente"}`, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectedElem = scene.elements.find(el => el.id === selected) ?? null;
  const fsize = (pct: number) => canvasH > 0 ? `${(pct / 100) * canvasH}px` : `${pct * 4}px`;
  const ratio = project ? `${project.res.w}/${project.res.h}` : "16/9";

  // ── Setup screen
  if (!project) {
    return <NewProjectScreen onStart={cfg => { setProject(cfg); setScenes([DEFAULT_SCENE]); setCurrentSceneIdx(0); setSelected(null); setHistory([]); }} />;
  }

  // ── Editor
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <style>{`
        .be-anim-fadeIn    { animation-name: beAnimFadeIn; }
        .be-anim-slideLeft { animation-name: beAnimSlideLeft; }
        .be-anim-slideRight{ animation-name: beAnimSlideRight; }
        .be-anim-slideUp   { animation-name: beAnimSlideUp; }
        .be-anim-zoomIn    { animation-name: beAnimZoomIn; }
        .be-anim-bounce    { animation-name: beAnimBounce; }
        @keyframes beAnimFadeIn    { from{opacity:0} to{opacity:1} }
        @keyframes beAnimSlideLeft { from{transform:translateX(-120px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes beAnimSlideRight{ from{transform:translateX(120px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes beAnimSlideUp   { from{transform:translateY(80px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes beAnimZoomIn    { from{transform:scale(0.2);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes beAnimBounce    { 0%{transform:translateY(-40px) scale(0.8);opacity:0} 60%{transform:translateY(8px) scale(1.02);opacity:1} 80%{transform:translateY(-4px)} 100%{transform:translateY(0)} }
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

        {/* Resolution + duration badges */}
        <div className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs font-mono text-muted-foreground shrink-0">
          {project.res.w} × {project.res.h}
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs font-mono text-muted-foreground shrink-0">
          MP4 · {project.durationSeconds}s
        </div>
        {/* Duration quick-change */}
        <select
          value={project.durationSeconds}
          onChange={e => setProject(p => p ? { ...p, durationSeconds: parseInt(e.target.value) } : p)}
          className="h-7 text-xs rounded border border-input bg-background px-1 text-muted-foreground"
          title="Alterar duração do vídeo"
        >
          {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}s</option>)}
        </select>

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={undo} disabled={history.length === 0} className="h-8 gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Desfazer
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setProject(null)} className="h-8 text-muted-foreground gap-1.5">
          + Novo Projeto
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportCanvas("download")} disabled={saving} className="h-8 gap-1.5">
          <Download className="w-3.5 h-3.5" /> PNG
        </Button>
        <Button size="sm" onClick={() => exportCanvas("library")} disabled={saving}
          className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? `Gerando MP4 ${project.durationSeconds}s…` : "Salvar MP4 na Biblioteca"}
        </Button>
      </div>

      {/* ── BODY */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL */}
        <aside className="w-52 shrink-0 border-r bg-card flex flex-col overflow-y-auto">
          {/* Templates */}
          <div className="px-3 py-3">
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
          </div>

          <Separator />

          {/* Add elements */}
          <div className="px-3 py-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Adicionar</p>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8" onClick={addText}>
              <Type className="w-3.5 h-3.5" /> Texto
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8" onClick={addImage}>
              <ImageIcon className="w-3.5 h-3.5" /> Imagem
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8" onClick={() => addShape("rect")}>
              <Square className="w-3.5 h-3.5" /> Retângulo
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8" onClick={() => addShape("ellipse")}>
              <CircleDot className="w-3.5 h-3.5" /> Elipse / Círculo
            </Button>
          </div>

          <Separator />

          {/* Background */}
          <div className="px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Fundo</p>
            <div className="grid grid-cols-5 gap-1 mb-2">
              {(["presets", "gradients", "color", "image", "video"] as const).map(tab => (
                <button key={tab} onClick={() => setBgTab(tab)}
                  className={cn("text-[9px] py-1 rounded font-medium transition-colors",
                    bgTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {tab === "presets" ? "Sólido" : tab === "gradients" ? "Grad." : tab === "color" ? "Cor" : tab === "image" ? "Foto" : "Vídeo"}
                </button>
              ))}
            </div>

            {bgTab === "presets" && (
              <div className="grid grid-cols-5 gap-1">
                {BG_PRESETS.map(p => (
                  <button key={p.value} onClick={() => updateScene({ bg: p.value, bgImage: "", bgVideo: "" })} title={p.label}
                    className={cn("h-7 rounded border-2 transition-all hover:scale-105",
                      scene.bg === p.value && !scene.bgImage && !scene.bgVideo ? "border-primary" : "border-transparent")}
                    style={{ background: p.value }} />
                ))}
              </div>
            )}

            {bgTab === "gradients" && (
              <div className="grid grid-cols-4 gap-1">
                {GRADIENT_PRESETS.map(p => (
                  <button key={p.value} onClick={() => updateScene({ bg: p.value, bgImage: "", bgVideo: "" })} title={p.label}
                    className={cn("h-8 rounded border-2 transition-all hover:scale-105",
                      scene.bg === p.value && !scene.bgImage && !scene.bgVideo ? "border-primary" : "border-transparent")}
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
                <Button variant="outline" size="sm" className="w-full gap-2 h-8" onClick={setBgImage}>
                  <ImageIcon className="w-3.5 h-3.5" /> Carregar foto
                </Button>
                {scene.bgImage && (
                  <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive gap-1.5 h-8"
                    onClick={() => updateScene({ bgImage: "" })}>
                    <Trash2 className="w-3 h-3" /> Remover foto
                  </Button>
                )}
              </div>
            )}

            {bgTab === "video" && (
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full gap-2 h-8" onClick={setBgVideo}>
                  <Film className="w-3.5 h-3.5" /> Carregar vídeo
                </Button>
                <p className="text-[9px] text-muted-foreground text-center">MP4, WebM • loop automático</p>
                {scene.bgVideo && (
                  <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive gap-1.5 h-8"
                    onClick={() => updateScene({ bgVideo: "" })}>
                    <Trash2 className="w-3 h-3" /> Remover vídeo
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Layers */}
          {scene.elements.length > 0 && (
            <>
              <Separator />
              <div className="px-3 py-3 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Camadas
                </p>
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
                        {el.type === "text" ? el.text.slice(0, 18) || "Texto"
                          : el.type === "rect" ? "Retângulo"
                          : el.type === "ellipse" ? "Elipse"
                          : "Imagem"}
                      </span>
                      {el.locked && <Lock className="w-2.5 h-2.5 shrink-0 opacity-50" />}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>

        {/* ── CANVAS AREA */}
        <main className="flex-1 bg-neutral-900 flex flex-col overflow-hidden"
          onClick={() => setSelected(null)}>
          {/* Canvas center */}
          <div className="flex-1 flex items-center justify-center overflow-hidden p-6">
          <div style={{ aspectRatio: ratio, maxWidth: "100%", maxHeight: "100%", width: "100%", position: "relative" }}>
            <div ref={canvasRef}
              style={{
                width: "100%", height: "100%", position: "relative", overflow: "hidden", borderRadius: 6,
                boxShadow: "0 0 0 1px rgba(255,255,255,.1), 0 8px 32px rgba(0,0,0,.6)",
                background: scene.bgImage ? `url(${scene.bgImage}) center/cover no-repeat` : scene.bgVideo ? "#000" : scene.bg,
              }}
              onClick={e => { e.stopPropagation(); setSelected(null); }}
            >
              {/* Video background */}
              {scene.bgVideo && (
                <video key={scene.bgVideo} src={scene.bgVideo} autoPlay muted loop playsInline
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
              )}
              {scene.bgImage && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)", pointerEvents: "none", zIndex: 1 }} />}

              {/* Elements — key resets CSS animations on scene switch */}
              <div key={`scene-${currentSceneIdx}`} style={{ position: "absolute", inset: 0, zIndex: 2 }}>
              {scene.elements.map(el => {
                const isSel = selected === el.id;
                const hasH = el.h > 0;
                const isShape = el.type === "rect" || el.type === "ellipse";
                const anim = el.animation ?? "none";
                const animDelay = el.animDelay ?? 0;

                return (
                  <div key={el.id}
                    className={anim !== "none" ? `be-anim-${anim}` : undefined}
                    style={{
                      position: "absolute",
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      width: `${el.w}%`,
                      height: hasH ? `${el.h}%` : "auto",
                      animationDelay: anim !== "none" ? `${animDelay}s` : undefined,
                      animationDuration: "0.75s",
                      animationFillMode: "both",
                      animationTimingFunction: "cubic-bezier(0.22,1,0.36,1)",
                    }}
                  >
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      height: "100%",
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
                    {/* Content */}
                    {el.type === "text" && (
                      <p style={{
                        margin: 0,
                        fontSize: fsize(el.fontSize),
                        color: el.color,
                        fontFamily: el.fontFamily,
                        fontWeight: el.fontWeight,
                        fontStyle: el.fontStyle,
                        textDecoration: el.textDecoration === "underline" ? "underline" : "none",
                        textAlign: el.textAlign,
                        letterSpacing: `${el.letterSpacing}px`,
                        lineHeight: el.lineHeight,
                        textShadow: el.shadow ? "0 2px 12px rgba(0,0,0,0.9)" : "none",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        background: el.bgColor || "transparent",
                        padding: el.bgColor ? "4px 10px" : 0,
                        borderRadius: el.bgColor ? 6 : 0,
                        pointerEvents: "none",
                      }}>{el.text}</p>
                    )}
                    {el.type === "image" && (
                      <img src={el.src} alt="" draggable={false}
                        style={{ width: "100%", height: hasH ? "100%" : "auto", objectFit: "contain", display: "block", pointerEvents: "none" }} />
                    )}
                    {isShape && (
                      <div style={{
                        width: "100%", height: "100%",
                        background: el.fillColor || "transparent",
                        border: el.strokeWidth > 0 ? `${el.strokeWidth}px solid ${el.strokeColor}` : "none",
                        borderRadius: `${el.borderRadius}%`,
                        pointerEvents: "none",
                      }} />
                    )}

                    {/* Resize handles — show when selected */}
                    {isSel && !el.locked && (
                      <>
                        {/* Rotation handle */}
                        <div
                          style={{ position: "absolute", top: -26, left: "50%", transform: "translateX(-50%)", width: 14, height: 14, borderRadius: "50%", background: "#3b82f6", border: "2px solid white", cursor: "grab", zIndex: 10 }}
                          onPointerDown={e => startRotate(el.id, e)}
                          title={`Rotar (${el.rotation}°)`}
                        />
                        {/* Line from element to rotation handle */}
                        <div style={{ position: "absolute", top: -16, left: "50%", width: 1, height: 14, background: "#3b82f655", transform: "translateX(-50%)", pointerEvents: "none" }} />

                        {/* Edge + corner handles */}
                        {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as ResizeHandle[]).map(h => {
                          // For text elements, only show E/W handles (no height resize)
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
                              onPointerDown={e => startResize(h, el.id, e)}
                            />
                          );
                        })}
                      </>
                    )}
                  </div>
                  </div>
                );
              })}
              </div>{/* elements container */}

              {scene.elements.length === 0 && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, pointerEvents: "none", zIndex: 3 }}>
                  <Palette style={{ width: 32, height: 32, color: "rgba(255,255,255,0.2)" }} />
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, margin: 0 }}>Escolha um template ou adicione elementos</p>
                </div>
              )}
            </div>
          </div>
          </div>{/* end canvas center */}

          {/* ── SCENE STRIP */}
          <div className="h-24 shrink-0 bg-neutral-950 border-t border-neutral-800 flex items-center gap-2 px-3 overflow-x-auto"
            onClick={e => e.stopPropagation()}>
            {scenes.map((s, idx) => {
              const dur = s.duration ?? project.durationSeconds;
              const isActive = idx === currentSceneIdx;
              return (
                <div key={idx} className="flex flex-col items-center gap-1 shrink-0">
                  <div
                    className={cn("relative w-24 h-14 rounded cursor-pointer border-2 transition-all overflow-hidden",
                      isActive ? "border-blue-500 shadow-lg shadow-blue-500/30" : "border-neutral-700 hover:border-neutral-500")}
                    style={{ background: s.bgImage ? `url(${s.bgImage}) center/cover` : s.bg }}
                    onClick={() => { setCurrentSceneIdx(idx); setSelected(null); }}
                  >
                    <span className="absolute bottom-0.5 left-1 text-[9px] font-bold text-white/60 select-none">
                      {idx + 1}
                    </span>
                    <span className="absolute bottom-0.5 right-1 text-[9px] font-mono text-white/60 select-none">
                      {dur}s
                    </span>
                    {/* Actions on hover */}
                    <div className={cn("absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 hover:opacity-100 transition-opacity")}>
                      <button className="text-white hover:text-blue-300" title="Duplicar"
                        onClick={e => { e.stopPropagation(); duplicateScene(idx); }}>
                        <Copy className="w-3 h-3" />
                      </button>
                      {scenes.length > 1 && (
                        <button className="text-white hover:text-red-400" title="Excluir"
                          onClick={e => { e.stopPropagation(); deleteScene(idx); }}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Per-scene duration */}
                  <select
                    value={dur}
                    onChange={e => setSceneDuration(idx, parseInt(e.target.value))}
                    onClick={e => e.stopPropagation()}
                    className="h-5 text-[9px] rounded border border-neutral-700 bg-neutral-900 text-neutral-400 px-0.5 w-24"
                  >
                    {[3, 5, 8, 10, 15, 20, 30].map(d => <option key={d} value={d}>{d}s</option>)}
                  </select>
                </div>
              );
            })}
            {/* Add scene */}
            <button
              className="shrink-0 w-14 h-14 rounded border-2 border-dashed border-neutral-700 hover:border-blue-500 hover:text-blue-400 flex flex-col items-center justify-center text-neutral-600 transition-colors gap-0.5"
              onClick={addScene} title="Adicionar cena">
              <span className="text-xl leading-none">+</span>
              <span className="text-[9px]">Cena</span>
            </button>
            {/* Total */}
            <div className="ml-auto shrink-0 text-[10px] text-neutral-600 text-right pr-1">
              <div className="font-mono text-neutral-400">{scenes.reduce((sum, s) => sum + (s.duration ?? project.durationSeconds), 0)}s</div>
              <div>total</div>
            </div>
          </div>

        </main>

        {/* ── RIGHT PANEL */}
        <aside className="w-64 shrink-0 border-l bg-card flex flex-col overflow-y-auto">
          {selectedElem ? (
            <div className="p-3 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {selectedElem.type === "text" ? "Texto" : selectedElem.type === "image" ? "Imagem" : selectedElem.type === "rect" ? "Retângulo" : "Elipse"}
                </p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-foreground"
                    onClick={() => updateElem(selectedElem.id, { locked: !selectedElem.locked })}
                    title={selectedElem.locked ? "Desbloquear" : "Bloquear"}>
                    {selectedElem.locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-foreground"
                    onClick={() => duplicateElem(selectedElem.id)} title="Duplicar (Ctrl+D)">
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
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={() => moveLayer(selectedElem.id, "front")} title="Trazer para frente">
                    <BringToFront className="w-3 h-3" />
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={() => moveLayer(selectedElem.id, "up")} title="Um para frente">
                    ↑
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={() => moveLayer(selectedElem.id, "down")} title="Um para trás">
                    ↓
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={() => moveLayer(selectedElem.id, "back")} title="Mandar para o fundo">
                    <SendToBack className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Align */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Alinhar</Label>
                <div className="grid grid-cols-3 gap-1">
                  <Button variant="outline" size="sm" className="h-7" title="Alinhar esquerda" onClick={() => alignElem(selectedElem.id, "left")}><AlignStartVertical className="w-3 h-3" /></Button>
                  <Button variant="outline" size="sm" className="h-7" title="Centralizar horizontal" onClick={() => alignElem(selectedElem.id, "centerH")}><AlignHorizontalJustifyCenter className="w-3 h-3" /></Button>
                  <Button variant="outline" size="sm" className="h-7" title="Alinhar direita" onClick={() => alignElem(selectedElem.id, "right")}><AlignEndVertical className="w-3 h-3" /></Button>
                  <Button variant="outline" size="sm" className="h-7" title="Alinhar topo" onClick={() => alignElem(selectedElem.id, "top")}><AlignStartHorizontal className="w-3 h-3" /></Button>
                  <Button variant="outline" size="sm" className="h-7" title="Centralizar vertical" onClick={() => alignElem(selectedElem.id, "centerV")}><AlignVerticalJustifyCenter className="w-3 h-3" /></Button>
                  <Button variant="outline" size="sm" className="h-7" title="Alinhar baixo" onClick={() => alignElem(selectedElem.id, "bottom")}><AlignEndHorizontal className="w-3 h-3" /></Button>
                </div>
              </div>

              {/* Entrance animation */}
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <Wand2 className="w-3 h-3" /> Animação de Entrada
                </Label>
                <div className="grid grid-cols-2 gap-1">
                  {ANIM_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => updateElem(selectedElem.id, { animation: opt.value })}
                      className={cn(
                        "text-[10px] py-1.5 px-2 rounded border font-medium transition-colors text-left",
                        (selectedElem.animation ?? "none") === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input text-muted-foreground hover:text-foreground hover:border-input"
                      )}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {(selectedElem.animation ?? "none") !== "none" && (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Atraso (segundos)</Label>
                    <div className="flex gap-1 flex-wrap">
                      {[0, 0.3, 0.5, 0.8, 1, 1.5, 2].map(d => (
                        <button key={d}
                          onClick={() => updateElem(selectedElem.id, { animDelay: d })}
                          className={cn(
                            "text-[10px] px-2 py-1 rounded border transition-colors",
                            (selectedElem.animDelay ?? 0) === d
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-input text-muted-foreground hover:text-foreground"
                          )}>
                          {d}s
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Text properties */}
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
                    <select
                      value={selectedElem.fontFamily}
                      onChange={e => updateElem(selectedElem.id, { fontFamily: e.target.value })}
                      className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                      style={{ fontFamily: selectedElem.fontFamily }}
                    >
                      {FONTS.map(f => (
                        <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Tamanho: {selectedElem.fontSize.toFixed(1)}%</Label>
                    <input type="range" min={1} max={18} step={0.5} value={selectedElem.fontSize}
                      onChange={e => updateElem(selectedElem.id, { fontSize: parseFloat(e.target.value) })}
                      className="w-full accent-blue-500" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Cor do texto</Label>
                    <div className="flex flex-wrap gap-1">
                      {TEXT_COLORS.map(c => (
                        <ColorDot key={c} color={c} selected={selectedElem.color === c} onClick={() => updateElem(selectedElem.id, { color: c })} />
                      ))}
                    </div>
                    <input type="color" value={selectedElem.color}
                      onChange={e => updateElem(selectedElem.id, { color: e.target.value })}
                      className="w-full h-8 rounded cursor-pointer border mt-1" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Estilo</Label>
                    <div className="flex gap-1">
                      <Button variant={selectedElem.fontWeight === "bold" ? "default" : "outline"} size="sm" className="flex-1 h-7"
                        onClick={() => updateElem(selectedElem.id, { fontWeight: selectedElem.fontWeight === "bold" ? "normal" : "bold" })}>
                        <Bold className="w-3 h-3" />
                      </Button>
                      <Button variant={selectedElem.fontStyle === "italic" ? "default" : "outline"} size="sm" className="flex-1 h-7"
                        onClick={() => updateElem(selectedElem.id, { fontStyle: selectedElem.fontStyle === "italic" ? "normal" : "italic" })}>
                        <Italic className="w-3 h-3" />
                      </Button>
                      <Button variant={selectedElem.textDecoration === "underline" ? "default" : "outline"} size="sm" className="flex-1 h-7"
                        onClick={() => updateElem(selectedElem.id, { textDecoration: selectedElem.textDecoration === "underline" ? "none" : "underline" })}>
                        <span className="text-xs underline font-bold">U</span>
                      </Button>
                      <Button variant={selectedElem.shadow ? "default" : "outline"} size="sm" className="flex-1 h-7 text-[10px]"
                        onClick={() => updateElem(selectedElem.id, { shadow: !selectedElem.shadow })} title="Sombra">
                        S
                      </Button>
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
                    <Label className="text-xs">Espaç. entre letras: {selectedElem.letterSpacing}px</Label>
                    <input type="range" min={-5} max={20} step={0.5} value={selectedElem.letterSpacing}
                      onChange={e => updateElem(selectedElem.id, { letterSpacing: parseFloat(e.target.value) })}
                      className="w-full accent-blue-500" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Altura da linha: {selectedElem.lineHeight.toFixed(2)}</Label>
                    <input type="range" min={0.8} max={3} step={0.05} value={selectedElem.lineHeight}
                      onChange={e => updateElem(selectedElem.id, { lineHeight: parseFloat(e.target.value) })}
                      className="w-full accent-blue-500" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Fundo do texto</Label>
                    <input type="color" value={selectedElem.bgColor || "#000000"}
                      onChange={e => updateElem(selectedElem.id, { bgColor: e.target.value })}
                      className="w-full h-7 rounded cursor-pointer border" />
                    {selectedElem.bgColor && (
                      <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground"
                        onClick={() => updateElem(selectedElem.id, { bgColor: "" })}>Remover fundo</Button>
                    )}
                  </div>
                </>
              )}

              {/* Shape properties */}
              {(selectedElem.type === "rect" || selectedElem.type === "ellipse") && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cor de preenchimento</Label>
                    <input type="color" value={selectedElem.fillColor || "#3b82f6"}
                      onChange={e => updateElem(selectedElem.id, { fillColor: e.target.value })}
                      className="w-full h-9 rounded cursor-pointer border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cor da borda</Label>
                    <input type="color" value={selectedElem.strokeColor || "#ffffff"}
                      onChange={e => updateElem(selectedElem.id, { strokeColor: e.target.value })}
                      className="w-full h-8 rounded cursor-pointer border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Espessura da borda: {selectedElem.strokeWidth}px</Label>
                    <input type="range" min={0} max={20} step={1} value={selectedElem.strokeWidth}
                      onChange={e => updateElem(selectedElem.id, { strokeWidth: parseFloat(e.target.value) })}
                      className="w-full accent-blue-500" />
                  </div>
                  {selectedElem.type === "rect" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Arredondamento: {selectedElem.borderRadius}%</Label>
                      <input type="range" min={0} max={50} step={1} value={selectedElem.borderRadius}
                        onChange={e => updateElem(selectedElem.id, { borderRadius: parseFloat(e.target.value) })}
                        className="w-full accent-blue-500" />
                    </div>
                  )}
                </>
              )}

              {/* Image properties */}
              {selectedElem.type === "image" && (
                <div className="space-y-1.5">
                  <Button variant="outline" size="sm" className="w-full gap-2 h-8" onClick={addImage}>
                    <ImageIcon className="w-3.5 h-3.5" /> Trocar imagem
                  </Button>
                </div>
              )}

              <Separator />

              {/* Transform */}
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Transformação</Label>

                <div className="space-y-1.5">
                  <Label className="text-xs">Largura: {selectedElem.w.toFixed(0)}%</Label>
                  <input type="range" min={5} max={100} step={1} value={selectedElem.w}
                    onChange={e => updateElem(selectedElem.id, { w: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500" />
                </div>

                {(selectedElem.type !== "text") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Altura: {selectedElem.h.toFixed(0)}%</Label>
                    <input type="range" min={3} max={100} step={1} value={selectedElem.h || 10}
                      onChange={e => updateElem(selectedElem.id, { h: parseFloat(e.target.value) })}
                      className="w-full accent-blue-500" />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Rotação: {selectedElem.rotation}°</Label>
                  <input type="range" min={0} max={359} step={1} value={selectedElem.rotation}
                    onChange={e => updateElem(selectedElem.id, { rotation: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Opacidade: {Math.round(selectedElem.opacity * 100)}%</Label>
                  <input type="range" min={0} max={1} step={0.05} value={selectedElem.opacity}
                    onChange={e => updateElem(selectedElem.id, { opacity: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">X: {selectedElem.x.toFixed(0)}%</Label>
                    <input type="range" min={0} max={100} step={1} value={selectedElem.x}
                      onChange={e => updateElem(selectedElem.id, { x: parseFloat(e.target.value) })}
                      className="w-full accent-blue-500" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Y: {selectedElem.y.toFixed(0)}%</Label>
                    <input type="range" min={0} max={100} step={1} value={selectedElem.y}
                      onChange={e => updateElem(selectedElem.id, { y: parseFloat(e.target.value) })}
                      className="w-full accent-blue-500" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
              <Layers className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">Clique em um elemento no canvas para editar suas propriedades</p>
              <p className="text-[10px] text-muted-foreground/60">Del — apagar • Ctrl+D — duplicar • Ctrl+Z — desfazer</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
