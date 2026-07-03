import { useState, useRef, useCallback, useEffect } from "react";
import { toPng } from "html-to-image";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
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
  Loader2, Plus, Palette, RotateCcw, Download,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface CanvasElem {
  id: string;
  type: "text" | "image";
  x: number;          // % of canvas width (center anchor)
  y: number;          // % of canvas height (center anchor)
  w: number;          // % of canvas width
  text: string;
  src: string;
  fontSize: number;   // % of canvas height (e.g. 6 = 6%)
  color: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textAlign: "left" | "center" | "right";
  shadow: boolean;
  bgColor: string;
  opacity: number;
}

interface Scene {
  bg: string;
  bgImage: string;
  elements: CanvasElem[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_SCENE: Scene = {
  bg: "linear-gradient(135deg,#0f172a,#1e3a5f)",
  bgImage: "",
  elements: [],
};

const BG_PRESETS = [
  { label: "Noite", value: "linear-gradient(135deg,#0f172a,#1e3a5f)" },
  { label: "Promoção", value: "linear-gradient(135deg,#f97316,#dc2626)" },
  { label: "Frescor", value: "linear-gradient(135deg,#0891b2,#1d4ed8)" },
  { label: "Sucesso", value: "linear-gradient(135deg,#059669,#0891b2)" },
  { label: "Premium", value: "linear-gradient(135deg,#4c1d95,#1e1b4b)" },
  { label: "Sol", value: "linear-gradient(135deg,#f59e0b,#f97316)" },
  { label: "Preto", value: "#111111" },
  { label: "Branco", value: "#ffffff" },
];

const TEXT_COLORS = [
  "#ffffff","#f0f4ff","#fef3c7","#fde68a",
  "#fdba74","#f87171","#34d399","#60a5fa",
  "#111111","#1e293b","#dc2626","#16a34a",
];

function newElem(type: "text" | "image"): CanvasElem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    x: 50, y: 50, w: 70,
    text: type === "text" ? "Novo texto" : "",
    src: "",
    fontSize: 5,
    color: "#ffffff",
    fontWeight: "normal",
    fontStyle: "normal",
    textAlign: "center",
    shadow: false,
    bgColor: "",
    opacity: 1,
  };
}

const TEMPLATES: { name: string; emoji: string; scene: Scene }[] = [
  {
    name: "Promoção",
    emoji: "🔥",
    scene: {
      bg: "linear-gradient(135deg,#f97316,#dc2626)",
      bgImage: "",
      elements: [
        { id: "a1", type: "text", src: "", x: 50, y: 22, w: 85, text: "🔥 PROMOÇÃO ESPECIAL", fontSize: 8, color: "#ffffff", fontWeight: "bold", fontStyle: "normal", textAlign: "center", shadow: true, bgColor: "", opacity: 1 },
        { id: "a2", type: "text", src: "", x: 50, y: 44, w: 80, text: "ATÉ 50% DE DESCONTO", fontSize: 6, color: "#fff7ed", fontWeight: "bold", fontStyle: "normal", textAlign: "center", shadow: false, bgColor: "", opacity: 1 },
        { id: "a3", type: "text", src: "", x: 50, y: 64, w: 72, text: "Oferta por tempo limitado. Aproveite já!", fontSize: 3.5, color: "#ffedd5", fontWeight: "normal", fontStyle: "normal", textAlign: "center", shadow: false, bgColor: "", opacity: 1 },
      ],
    },
  },
  {
    name: "Destaque",
    emoji: "⭐",
    scene: {
      bg: "linear-gradient(135deg,#1e3a5f,#1e1b4b)",
      bgImage: "",
      elements: [
        { id: "b1", type: "text", src: "", x: 50, y: 20, w: 80, text: "⭐ NOVIDADE", fontSize: 4, color: "#fbbf24", fontWeight: "bold", fontStyle: "normal", textAlign: "center", shadow: false, bgColor: "", opacity: 1 },
        { id: "b2", type: "text", src: "", x: 50, y: 40, w: 88, text: "Conheça o Nosso Produto", fontSize: 7, color: "#f0f4ff", fontWeight: "bold", fontStyle: "normal", textAlign: "center", shadow: true, bgColor: "", opacity: 1 },
        { id: "b3", type: "text", src: "", x: 50, y: 63, w: 70, text: "Qualidade e inovação para você.", fontSize: 3.5, color: "#93c5fd", fontWeight: "normal", fontStyle: "italic", textAlign: "center", shadow: false, bgColor: "", opacity: 1 },
      ],
    },
  },
  {
    name: "Aviso",
    emoji: "⚠️",
    scene: {
      bg: "linear-gradient(135deg,#1a1a2e,#16213e)",
      bgImage: "",
      elements: [
        { id: "c1", type: "text", src: "", x: 50, y: 22, w: 80, text: "⚠️ ATENÇÃO", fontSize: 7.5, color: "#fbbf24", fontWeight: "bold", fontStyle: "normal", textAlign: "center", shadow: false, bgColor: "", opacity: 1 },
        { id: "c2", type: "text", src: "", x: 50, y: 50, w: 80, text: "Escreva sua mensagem aqui.", fontSize: 4.5, color: "#e2e8f0", fontWeight: "normal", fontStyle: "normal", textAlign: "center", shadow: false, bgColor: "", opacity: 1 },
        { id: "c3", type: "text", src: "", x: 50, y: 73, w: 70, text: "Informação importante.", fontSize: 3, color: "#94a3b8", fontWeight: "normal", fontStyle: "italic", textAlign: "center", shadow: false, bgColor: "", opacity: 1 },
      ],
    },
  },
  {
    name: "Preço",
    emoji: "💰",
    scene: {
      bg: "linear-gradient(135deg,#064e3b,#065f46)",
      bgImage: "",
      elements: [
        { id: "d1", type: "text", src: "", x: 50, y: 18, w: 80, text: "PREÇO ESPECIAL", fontSize: 5, color: "#6ee7b7", fontWeight: "bold", fontStyle: "normal", textAlign: "center", shadow: false, bgColor: "", opacity: 1 },
        { id: "d2", type: "text", src: "", x: 50, y: 42, w: 85, text: "R$ 99,90", fontSize: 11, color: "#ffffff", fontWeight: "bold", fontStyle: "normal", textAlign: "center", shadow: true, bgColor: "", opacity: 1 },
        { id: "d3", type: "text", src: "", x: 50, y: 68, w: 70, text: "por unidade • válido hoje", fontSize: 3.5, color: "#a7f3d0", fontWeight: "normal", fontStyle: "normal", textAlign: "center", shadow: false, bgColor: "", opacity: 1 },
      ],
    },
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function ColorDot({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={color}
      className="w-6 h-6 rounded-full border-2 flex-shrink-0 transition-transform hover:scale-110"
      style={{
        background: color,
        borderColor: selected ? "#3b82f6" : "transparent",
        outline: selected ? "2px solid #3b82f6" : "none",
        outlineOffset: 1,
      }}
    />
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function BannerEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const requestUploadUrl = useRequestUploadUrl();
  const createMedia = useCreateMedia();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasH, setCanvasH] = useState(0);
  const [scene, setScene] = useState<Scene>(DEFAULT_SCENE);
  const [selected, setSelected] = useState<string | null>(null);
  const [bannerName, setBannerName] = useState(`Banner ${new Date().toLocaleDateString("pt-BR")}`);
  const [saving, setSaving] = useState(false);
  const [bgTab, setBgTab] = useState<"presets" | "color" | "image">("presets");
  const [bgColorInput, setBgColorInput] = useState("#1e3a5f");
  const [history, setHistory] = useState<Scene[]>([]);

  const dragging = useRef<{
    elemId: string;
    startClientX: number;
    startClientY: number;
    elemX: number;
    elemY: number;
  } | null>(null);

  // Track canvas height for font sizing
  useEffect(() => {
    if (!canvasRef.current) return;
    const ro = new ResizeObserver(entries => {
      setCanvasH(entries[0].contentRect.height);
    });
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, []);

  // Pointer drag handlers
  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragging.current.startClientX) / rect.width) * 100;
    const dy = ((e.clientY - dragging.current.startClientY) / rect.height) * 100;
    const newX = Math.max(5, Math.min(95, dragging.current.elemX + dx));
    const newY = Math.max(5, Math.min(95, dragging.current.elemY + dy));
    setScene(prev => ({
      ...prev,
      elements: prev.elements.map(el =>
        el.id === dragging.current!.elemId ? { ...el, x: newX, y: newY } : el
      ),
    }));
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = null;
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
  const pushHistory = useCallback((s: Scene) => {
    setHistory(h => [...h.slice(-19), s]);
  }, []);

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setScene(prev);
    setSelected(null);
  };

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    pushHistory(scene);
    setScene({ ...t.scene });
    setSelected(null);
  };

  const updateScene = (patch: Partial<Scene>) => {
    setScene(prev => ({ ...prev, ...patch }));
  };

  const addText = () => {
    pushHistory(scene);
    const el = newElem("text");
    setScene(prev => ({ ...prev, elements: [...prev.elements, el] }));
    setSelected(el.id);
  };

  const addImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      pushHistory(scene);
      const el: CanvasElem = { ...newElem("image"), src: url, w: 40, y: 50 };
      setScene(prev => ({ ...prev, elements: [...prev.elements, el] }));
      setSelected(el.id);
    };
    input.click();
  };

  const updateElem = (id: string, patch: Partial<CanvasElem>) => {
    setScene(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === id ? { ...el, ...patch } : el),
    }));
  };

  const deleteElem = (id: string) => {
    pushHistory(scene);
    setScene(prev => ({ ...prev, elements: prev.elements.filter(el => el.id !== id) }));
    setSelected(null);
  };

  const startDrag = (elemId: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;
    const el = scene.elements.find(el => el.id === elemId);
    if (!el) return;
    dragging.current = {
      elemId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      elemX: el.x,
      elemY: el.y,
    };
    setSelected(elemId);
  };

  const setBgImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      updateScene({ bgImage: url });
    };
    input.click();
  };

  // Save to media library
  const handleSave = async () => {
    if (!canvasRef.current) return;
    setSaving(true);
    try {
      const pixelRatio = 1280 / canvasRef.current.offsetWidth;
      const dataUrl = await toPng(canvasRef.current, { pixelRatio, cacheBust: true });

      const fetchRes = await fetch(dataUrl);
      const blob = await fetchRes.blob();

      const filename = `banner-${Date.now()}.png`;
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
        data: { name: filename, size: blob.size, contentType: "image/png" },
      });

      await fetch(uploadURL, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "image/png" },
      });

      await new Promise<void>((resolve, reject) => {
        createMedia.mutate(
          { data: { name: bannerName, type: "image", url: objectPath, durationSeconds: 15 } },
          { onSuccess: () => resolve(), onError: () => reject(new Error("createMedia failed")) }
        );
      });

      queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
      toast({ title: "✅ Banner salvo na biblioteca de mídias!" });
      setSaving(false);
    } catch {
      toast({ title: "Erro ao salvar banner", variant: "destructive" });
      setSaving(false);
    }
  };

  const selectedElem = scene.elements.find(el => el.id === selected) ?? null;

  const fsize = (pct: number) => canvasH > 0 ? `${(pct / 100) * canvasH}px` : `${pct * 4}px`;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ── TOP TOOLBAR ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-card shrink-0 flex-wrap">
        <Link href="/media">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <ChevronLeft className="w-4 h-4" /> Biblioteca
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-6" />
        <Input
          value={bannerName}
          onChange={e => setBannerName(e.target.value)}
          className="h-8 w-56 text-sm"
          placeholder="Nome do banner..."
        />
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={undo} disabled={history.length === 0} className="gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Desfazer
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "Salvando..." : "Salvar na Biblioteca"}
        </Button>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL ──────────────────────────────────────────── */}
        <aside className="w-56 shrink-0 border-r bg-card flex flex-col overflow-y-auto">

          {/* Templates */}
          <div className="px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Templates</p>
            <div className="grid grid-cols-2 gap-1.5">
              {TEMPLATES.map(t => (
                <button
                  key={t.name}
                  onClick={() => applyTemplate(t)}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-center"
                >
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
            <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={addText}>
              <Type className="w-3.5 h-3.5" /> Texto
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={addImage}>
              <ImageIcon className="w-3.5 h-3.5" /> Imagem
            </Button>
          </div>

          <Separator />

          {/* Background */}
          <div className="px-3 py-3 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Fundo</p>
            <div className="flex gap-1 mb-2">
              {(["presets", "color", "image"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setBgTab(tab)}
                  className={cn(
                    "flex-1 text-[10px] py-1 rounded font-medium transition-colors",
                    bgTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab === "presets" ? "Preset" : tab === "color" ? "Cor" : "Foto"}
                </button>
              ))}
            </div>

            {bgTab === "presets" && (
              <div className="grid grid-cols-4 gap-1">
                {BG_PRESETS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => updateScene({ bg: p.value, bgImage: "" })}
                    title={p.label}
                    className={cn(
                      "h-8 rounded border-2 transition-all hover:scale-105",
                      scene.bg === p.value && !scene.bgImage ? "border-primary" : "border-transparent"
                    )}
                    style={{ background: p.value }}
                  />
                ))}
              </div>
            )}

            {bgTab === "color" && (
              <div className="space-y-2">
                <input
                  type="color"
                  value={bgColorInput}
                  onChange={e => { setBgColorInput(e.target.value); updateScene({ bg: e.target.value, bgImage: "" }); }}
                  className="w-full h-10 rounded cursor-pointer border"
                />
                <Input
                  value={bgColorInput}
                  onChange={e => { setBgColorInput(e.target.value); if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) updateScene({ bg: e.target.value, bgImage: "" }); }}
                  className="h-7 text-xs font-mono"
                  placeholder="#1e3a5f"
                />
              </div>
            )}

            {bgTab === "image" && (
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={setBgImage}>
                  <ImageIcon className="w-3.5 h-3.5" /> Carregar foto
                </Button>
                {scene.bgImage && (
                  <Button
                    variant="ghost" size="sm"
                    className="w-full text-destructive hover:text-destructive gap-1.5"
                    onClick={() => updateScene({ bgImage: "" })}
                  >
                    <Trash2 className="w-3 h-3" /> Remover foto
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Layers list */}
          {scene.elements.length > 0 && (
            <>
              <Separator />
              <div className="px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Camadas
                </p>
                <div className="space-y-1">
                  {[...scene.elements].reverse().map(el => (
                    <button
                      key={el.id}
                      onClick={() => setSelected(el.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors",
                        selected === el.id ? "bg-primary/15 text-primary" : "hover:bg-muted text-muted-foreground"
                      )}
                    >
                      {el.type === "text" ? <Type className="w-3 h-3 shrink-0" /> : <ImageIcon className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{el.type === "text" ? el.text.slice(0, 20) : "Imagem"}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>

        {/* ── CANVAS AREA ─────────────────────────────────────────── */}
        <main
          className="flex-1 bg-neutral-900 flex items-center justify-center overflow-hidden p-6"
          onClick={() => setSelected(null)}
        >
          {/* Canvas — 16:9 that fills the available space */}
          <div
            style={{ aspectRatio: "16/9", maxWidth: "100%", maxHeight: "100%", width: "100%", position: "relative" }}
          >
            <div
              ref={canvasRef}
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                borderRadius: 8,
                boxShadow: "0 0 0 1px rgba(255,255,255,.1), 0 8px 32px rgba(0,0,0,.6)",
                background: scene.bgImage ? `url(${scene.bgImage}) center/cover no-repeat` : scene.bg,
              }}
              onClick={e => { e.stopPropagation(); setSelected(null); }}
            >
              {/* Overlay so bg image + gradient coexist */}
              {scene.bgImage && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)", pointerEvents: "none" }} />
              )}

              {/* Elements */}
              {scene.elements.map(el => (
                <div
                  key={el.id}
                  style={{
                    position: "absolute",
                    left: `${el.x}%`,
                    top: `${el.y}%`,
                    transform: "translate(-50%, -50%)",
                    width: `${el.w}%`,
                    cursor: "move",
                    opacity: el.opacity,
                    outline: selected === el.id ? "2px solid #3b82f6" : "1px dashed rgba(255,255,255,0.15)",
                    outlineOffset: 4,
                    borderRadius: 2,
                    userSelect: "none",
                  }}
                  onPointerDown={e => startDrag(el.id, e)}
                  onClick={e => { e.stopPropagation(); setSelected(el.id); }}
                >
                  {el.type === "text" && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: fsize(el.fontSize),
                        color: el.color,
                        fontWeight: el.fontWeight,
                        fontStyle: el.fontStyle,
                        textAlign: el.textAlign,
                        textShadow: el.shadow ? "0 2px 10px rgba(0,0,0,0.9)" : "none",
                        lineHeight: 1.25,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        background: el.bgColor || "transparent",
                        padding: el.bgColor ? "4px 10px" : 0,
                        borderRadius: el.bgColor ? 6 : 0,
                        pointerEvents: "none",
                      }}
                    >
                      {el.text}
                    </p>
                  )}
                  {el.type === "image" && (
                    <img
                      src={el.src}
                      alt=""
                      draggable={false}
                      style={{ width: "100%", height: "auto", objectFit: "contain", display: "block", pointerEvents: "none" }}
                    />
                  )}
                </div>
              ))}

              {scene.elements.length === 0 && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, pointerEvents: "none" }}>
                  <Palette style={{ width: 32, height: 32, color: "rgba(255,255,255,0.2)" }} />
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, margin: 0 }}>Escolha um template ou adicione elementos</p>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ── RIGHT PANEL — Properties ─────────────────────────────── */}
        <aside className="w-60 shrink-0 border-l bg-card flex flex-col overflow-y-auto">
          {selectedElem ? (
            <div className="p-3 space-y-4 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {selectedElem.type === "text" ? "Texto" : "Imagem"}
                </p>
                <Button
                  variant="ghost" size="icon"
                  className="w-6 h-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => deleteElem(selectedElem.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              {selectedElem.type === "text" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Conteúdo</Label>
                    <Textarea
                      value={selectedElem.text}
                      onChange={e => updateElem(selectedElem.id, { text: e.target.value })}
                      className="text-sm resize-none min-h-[72px]"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Tamanho da fonte: {selectedElem.fontSize.toFixed(1)}%</Label>
                    <input
                      type="range" min={1.5} max={15} step={0.5}
                      value={selectedElem.fontSize}
                      onChange={e => updateElem(selectedElem.id, { fontSize: parseFloat(e.target.value) })}
                      className="w-full accent-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Cor do texto</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {TEXT_COLORS.map(c => (
                        <ColorDot key={c} color={c} selected={selectedElem.color === c} onClick={() => updateElem(selectedElem.id, { color: c })} />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={selectedElem.color}
                      onChange={e => updateElem(selectedElem.id, { color: e.target.value })}
                      className="w-full h-8 rounded cursor-pointer border mt-1"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Estilo</Label>
                    <div className="flex gap-1">
                      <Button
                        variant={selectedElem.fontWeight === "bold" ? "default" : "outline"}
                        size="sm" className="flex-1 h-7 text-xs"
                        onClick={() => updateElem(selectedElem.id, { fontWeight: selectedElem.fontWeight === "bold" ? "normal" : "bold" })}
                      >
                        <Bold className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={selectedElem.fontStyle === "italic" ? "default" : "outline"}
                        size="sm" className="flex-1 h-7 text-xs"
                        onClick={() => updateElem(selectedElem.id, { fontStyle: selectedElem.fontStyle === "italic" ? "normal" : "italic" })}
                      >
                        <Italic className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={selectedElem.shadow ? "default" : "outline"}
                        size="sm" className="flex-1 h-7 text-[9px]"
                        onClick={() => updateElem(selectedElem.id, { shadow: !selectedElem.shadow })}
                        title="Sombra"
                      >
                        S
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Alinhamento</Label>
                    <div className="flex gap-1">
                      {(["left", "center", "right"] as const).map(align => (
                        <Button
                          key={align}
                          variant={selectedElem.textAlign === align ? "default" : "outline"}
                          size="sm" className="flex-1 h-7"
                          onClick={() => updateElem(selectedElem.id, { textAlign: align })}
                        >
                          {align === "left" ? <AlignLeft className="w-3 h-3" /> : align === "center" ? <AlignCenter className="w-3 h-3" /> : <AlignRight className="w-3 h-3" />}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-1.5">
                <Label className="text-xs">Largura: {selectedElem.w.toFixed(0)}%</Label>
                <input
                  type="range" min={10} max={100} step={1}
                  value={selectedElem.w}
                  onChange={e => updateElem(selectedElem.id, { w: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Opacidade: {Math.round(selectedElem.opacity * 100)}%</Label>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={selectedElem.opacity}
                  onChange={e => updateElem(selectedElem.id, { opacity: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">X: {selectedElem.x.toFixed(0)}%</Label>
                  <input
                    type="range" min={5} max={95} step={1}
                    value={selectedElem.x}
                    onChange={e => updateElem(selectedElem.id, { x: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Y: {selectedElem.y.toFixed(0)}%</Label>
                  <input
                    type="range" min={5} max={95} step={1}
                    value={selectedElem.y}
                    onChange={e => updateElem(selectedElem.id, { y: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
              <Layers className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">
                Clique em um elemento no canvas para editar suas propriedades
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
