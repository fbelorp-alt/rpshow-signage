import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useListScreens, useRequestUploadUrl } from "@workspace/api-client-react";
import {
  MapPin, Plus, Search, Pencil, Trash2,
  Clock, Users, Navigation, Camera,
  Monitor, Building2, X, Loader2, Upload,
  ExternalLink, Map as MapIcon, Zap, Settings,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Location {
  id: number;
  name: string;
  abbreviation: string | null;
  address: string | null;
  city: string | null;
  latitude: string | null;
  longitude: string | null;
  imageUrl: string | null;
  audience: number | null;
  audienceUnit: string | null;
  timezone: string | null;
  internalId: string | null;
  productionType: string | null;
  description: string | null;
}

interface MergedLocation {
  name: string;
  screens: any[];
  details: Location | null; // null = auto-detected, not yet configured
}

interface FormState {
  name: string; abbreviation: string; cep: string; address: string; city: string;
  latitude: string; longitude: string; audience: string; audienceUnit: string;
  timezone: string; internalId: string; productionType: string; description: string;
}

const EMPTY_FORM: FormState = {
  name: "", abbreviation: "", cep: "", address: "", city: "",
  latitude: "", longitude: "", audience: "", audienceUnit: "pessoas/hora",
  timezone: "America/Sao_Paulo", internalId: "", productionType: "", description: "",
};

const TIMEZONES = [
  "America/Sao_Paulo", "America/Manaus", "America/Belem", "America/Fortaleza",
  "America/Recife", "America/Cuiaba", "America/Porto_Velho", "America/Boa_Vista",
  "America/Rio_Branco", "America/Noronha",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function geocodeAddress(address: string, city: string): Promise<{ lat: string; lon: string } | null> {
  try {
    const q = encodeURIComponent(`${address}, ${city}, Brasil`);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
      headers: { "Accept-Language": "pt-BR" },
    });
    const data = await r.json();
    if (data?.[0]) return { lat: String(data[0].lat), lon: String(data[0].lon) };
    return null;
  } catch { return null; }
}

function GoogleMapEmbed({ lat, lon, name, height = 180 }: { lat: string; lon: string; name: string; height?: number }) {
  return (
    <iframe
      src={`https://maps.google.com/maps?q=${lat},${lon}&output=embed&zoom=15`}
      title={`Mapa - ${name}`}
      className="w-full rounded-xl border border-border/50"
      style={{ height }}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function parseScreenLocation(loc: string): { cep: string; city: string; address: string } {
  let rest = loc;
  const cepMatch = rest.match(/CEP\s*([\d]{5}-?[\d]{3})/i);
  const cep = cepMatch ? cepMatch[1] : "";
  if (cepMatch) rest = rest.replace(cepMatch[0], "").trim();
  const cityMatch = rest.match(/([^,]+\/[A-Z]{2})/);
  const city = cityMatch ? cityMatch[1].trim() : "";
  if (cityMatch) rest = rest.replace(cityMatch[0], "").trim();
  const address = rest.replace(/,\s*,/g, ",").replace(/^[\s,]+|[\s,]+$/g, "").trim();
  return { cep, city, address };
}

// ── Location Card ─────────────────────────────────────────────────────────────

function LocationCard({
  merged, onConfigure, onDelete, onImageUpload, uploadingId,
}: {
  merged: MergedLocation;
  onConfigure: (m: MergedLocation) => void;
  onDelete: (id: number) => void;
  onImageUpload: (id: number, file: File) => void;
  uploadingId: number | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const det = merged.details;
  const hasCoords = !!(det?.latitude && det?.longitude);
  const isUploading = uploadingId === det?.id;

  const googleMapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${det!.latitude},${det!.longitude}`
    : (det?.address || det?.city)
    ? `https://www.google.com/maps/search/${encodeURIComponent([det?.address, det?.city].filter(Boolean).join(", "))}`
    : null;

  return (
    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden flex flex-col group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">

      {/* ── Photo area ── */}
      <div
        className={cn("relative overflow-hidden bg-muted/20", det?.id ? "cursor-pointer" : "cursor-default")}
        style={{ paddingTop: "50%" }}
        onClick={() => det?.id && !isUploading && fileRef.current?.click()}
        title={det?.id ? "Clique para trocar a foto do painel" : "Configure o local para adicionar foto"}
      >
        {det?.imageUrl ? (
          <img src={det.imageUrl} alt={merged.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-2">
              <span className="text-base font-bold text-primary">{initials(merged.name)}</span>
            </div>
            {!det?.id && (
              <span className="text-[10px] text-muted-foreground/40 font-medium mt-1">Detectado automaticamente</span>
            )}
          </div>
        )}

        {/* Upload overlay — only if has details entry */}
        {det?.id && (
          <div className={cn(
            "absolute inset-0 flex flex-col items-center justify-center transition-all duration-200",
            isUploading ? "bg-black/60" : "opacity-0 group-hover:opacity-100 bg-black/40"
          )}>
            {isUploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : (
              <>
                <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border border-white/30 mb-1">
                  <Camera className="w-4 h-4 text-white" />
                </div>
                <span className="text-[10px] text-white font-semibold">
                  {det.imageUrl ? "Trocar foto" : "Adicionar foto"}
                </span>
              </>
            )}
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f && det?.id) onImageUpload(det.id, f); e.target.value = ""; }} />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/55 backdrop-blur-sm rounded-full px-2 py-0.5 text-white text-[10px] font-semibold">
          <Monitor className="w-2.5 h-2.5" />{merged.screens.length} tela{merged.screens.length !== 1 ? "s" : ""}
        </div>
        {det?.productionType && (
          <div className="absolute top-2 right-2 bg-primary/80 backdrop-blur-sm rounded-md px-2 py-0.5 text-white text-[10px] font-bold">
            {det.productionType}
          </div>
        )}
        {!det?.id && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-primary/80 backdrop-blur-sm rounded-md px-2 py-0.5 text-white text-[10px] font-bold">
            <Zap className="w-2.5 h-2.5" /> Auto
          </div>
        )}
      </div>

      {/* ── Card body ── */}
      <div className="flex flex-col flex-1 p-4 gap-3">

        {/* Name */}
        <div>
          <div className="flex items-start justify-between gap-1.5">
            <h3 className="font-bold text-sm leading-tight">{merged.name}</h3>
            {det?.abbreviation && (
              <span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded shrink-0 text-muted-foreground">{det.abbreviation}</span>
            )}
          </div>
          {det?.internalId && <span className="text-[10px] text-muted-foreground/50 font-mono mt-0.5 block">#{det.internalId}</span>}
        </div>

        {/* Screens list */}
        <div className="flex flex-wrap gap-1">
          {merged.screens.slice(0, 4).map((s: any) => (
            <span key={s.id} className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-md font-mono">
              {s.name ?? s.code}
            </span>
          ))}
          {merged.screens.length > 4 && (
            <span className="text-[10px] text-muted-foreground/50">+{merged.screens.length - 4}</span>
          )}
        </div>

        {/* Address */}
        {(det?.address || det?.city) && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 shrink-0 mt-px text-primary/60" />
            <span className="leading-snug">{[det?.address, det?.city].filter(Boolean).join(", ")}</span>
          </div>
        )}

        {/* Stats */}
        {(det?.audience || det?.timezone) && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {det?.audience && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Users className="w-2.5 h-2.5 text-primary/50" />
                <span className="font-semibold text-foreground">{det.audience.toLocaleString("pt-BR")}</span>
                <span className="text-[10px]">{det.audienceUnit ?? "pessoas/hora"}</span>
              </div>
            )}
            {det?.timezone && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="w-2.5 h-2.5 text-primary/50" />
                <span>{det.timezone.replace("America/", "")}</span>
              </div>
            )}
          </div>
        )}

        {/* Mini map */}
        {hasCoords && (
          <div className="rounded-xl overflow-hidden border border-border/40" style={{ height: 100 }}>
            <GoogleMapEmbed lat={det!.latitude!} lon={det!.longitude!} name={merged.name} height={100} />
          </div>
        )}

        {/* Description */}
        {det?.description && (
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{det.description}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border/40">
          {googleMapsUrl ? (
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors">
              <ExternalLink className="w-3 h-3" /> Google Maps
            </a>
          ) : !det?.id ? (
            <span className="text-[11px] text-primary/60 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Detectado das telas
            </span>
          ) : null}

          <div className="flex gap-1.5 ml-auto">
            <Button variant="outline" size="sm"
              className={cn("h-7 px-2.5 text-xs gap-1", !det?.id && "border-primary/40 text-primary hover:bg-primary/10")}
              onClick={() => onConfigure(merged)}>
              {det?.id ? <><Pencil className="w-3 h-3" /> Editar</> : <><Settings className="w-3 h-3" /> Configurar</>}
            </Button>
            {det?.id && (
              <Button variant="outline" size="sm"
                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                onClick={() => onDelete(det.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function LocationModal({
  editId, form, setForm, onClose, onSubmit, isPending, geocoding, onGeocode,
  onImageUpload, uploadingId, currentImageUrl,
}: {
  editId: number | null;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  geocoding: boolean;
  onGeocode: () => void;
  onImageUpload: (id: number, file: File) => void;
  uploadingId: number | null;
  currentImageUrl: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const hasCoords = !!(form.latitude && form.longitude);
  const isUploading = uploadingId === editId;

  const lookupCep = useCallback(async () => {
    const raw = form.cep.replace(/\D/g, "");
    if (raw.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const d = await r.json();
      if (d.erro) return;
      const address = [d.logradouro, d.bairro].filter(Boolean).join(", ");
      const city = `${d.localidade} — ${d.uf}`;
      setForm(f => ({ ...f, address, city, cep: d.cep ?? f.cep }));
      const geo = await geocodeAddress(address, city);
      if (geo) setForm(f => ({ ...f, latitude: geo.lat, longitude: geo.lon }));
    } catch { /* ignore */ }
    finally { setCepLoading(false); }
  }, [form.cep, setForm]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && editId) onImageUpload(editId, file);
  }, [editId, onImageUpload]);

  const field = (label: string, key: keyof FormState, opts?: { placeholder?: string; mono?: boolean; required?: boolean; type?: string; readOnly?: boolean }) => (
    <div>
      <label className="text-[11px] font-semibold text-muted-foreground mb-1 block uppercase tracking-wide">
        {label}{opts?.required && " *"}
      </label>
      <input
        required={opts?.required}
        type={opts?.type ?? "text"}
        value={form[key]}
        readOnly={opts?.readOnly}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={opts?.placeholder}
        className={cn(
          "w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors",
          opts?.mono && "font-mono",
          opts?.readOnly && "opacity-60 cursor-default"
        )}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border/60 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">{editId ? "Configurar Local" : "Novo Local"}</h2>
              <p className="text-[11px] text-muted-foreground">Adicione endereço, foto e coordenadas do painel</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="overflow-y-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">

            {/* ── LEFT: Fields ── */}
            <div className="px-6 py-5 space-y-4 border-r border-border/30">

              <div>
                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">Identificação</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">{field("Nome do Local", "name", { placeholder: "Ex: Shopping Iguatemi — Piso 2", required: true })}</div>
                  {field("Abreviação", "abbreviation", { placeholder: "IGT-P2" })}
                  {field("ID Interno", "internalId", { placeholder: "Código interno" })}
                  {field("Tipo de Produção", "productionType", { placeholder: "Indoor, Outdoor..." })}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">Localização</p>
                <div className="space-y-3">
                  {/* CEP auto-fill */}
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground mb-1 block uppercase tracking-wide">CEP</label>
                    <div className="flex gap-2">
                      <input
                        value={form.cep}
                        onChange={e => setForm(f => ({ ...f, cep: e.target.value }))}
                        onBlur={lookupCep}
                        placeholder="00000-000"
                        maxLength={9}
                        className="flex-1 bg-background border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors font-mono"
                      />
                      <button type="button" onClick={lookupCep} disabled={cepLoading}
                        className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground rounded-lg px-3 py-2 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap">
                        {cepLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                        {cepLoading ? "Buscando..." : "Preencher"}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">Preenche endereço, cidade e coordenadas automaticamente</p>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground mb-1 block uppercase tracking-wide">Endereço</label>
                    <div className="flex gap-2">
                      <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                        placeholder="Rua, número, bairro"
                        className="flex-1 bg-background border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors" />
                      <button type="button" onClick={onGeocode} disabled={geocoding}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-lg px-3 py-2 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap">
                        {geocoding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                        {geocoding ? "Buscando..." : "Buscar"}
                      </button>
                    </div>
                  </div>
                  {field("Cidade", "city", { placeholder: "Ribeirão Preto — SP" })}
                  <div className="grid grid-cols-2 gap-3">
                    {field("Latitude", "latitude", { placeholder: "-21.1915", mono: true })}
                    {field("Longitude", "longitude", { placeholder: "-47.8073", mono: true })}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">Audiência & Fuso</p>
                <div className="grid grid-cols-2 gap-3">
                  {field("Audiência estimada", "audience", { placeholder: "5000", type: "number" })}
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground mb-1 block uppercase tracking-wide">Unidade</label>
                    <select value={form.audienceUnit} onChange={e => setForm(f => ({ ...f, audienceUnit: e.target.value }))}
                      className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary cursor-pointer">
                      <option>pessoas/hora</option><option>pessoas/dia</option><option>impressões/mês</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] font-semibold text-muted-foreground mb-1 block uppercase tracking-wide">Fuso Horário</label>
                    <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                      className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary cursor-pointer">
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground mb-1 block uppercase tracking-wide">Descrição</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Informações adicionais sobre o local ou o painel..."
                  rows={3} className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>

            {/* ── RIGHT: Map + Image ── */}
            <div className="px-6 py-5 space-y-4 bg-muted/10">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">Mapa</p>
                {hasCoords ? (
                  <div className="space-y-2">
                    <GoogleMapEmbed lat={form.latitude} lon={form.longitude} name={form.name} height={200} />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-background border border-border/40 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Latitude</p>
                        <p className="text-xs font-mono font-semibold">{Number(form.latitude).toFixed(6)}</p>
                      </div>
                      <div className="bg-background border border-border/40 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Longitude</p>
                        <p className="text-xs font-mono font-semibold">{Number(form.longitude).toFixed(6)}</p>
                      </div>
                    </div>
                    <a href={`https://www.google.com/maps?q=${form.latitude},${form.longitude}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
                      <ExternalLink className="w-3 h-3" /> Abrir no Google Maps
                    </a>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/40 bg-background flex flex-col items-center justify-center gap-2 text-center" style={{ height: 200 }}>
                    <MapIcon className="w-8 h-8 text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground/50">Informe o endereço e clique em<br /><strong>Buscar</strong> para ver o mapa</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">Foto do Painel</p>
                {editId ? (
                  <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
                    onClick={() => !isUploading && fileRef.current?.click()}
                    className={cn("relative rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden",
                      dragOver ? "border-primary bg-primary/10" : "border-border/40 hover:border-primary/50 hover:bg-primary/5")}
                    style={{ minHeight: 120 }}>
                    {currentImageUrl ? (
                      <img src={currentImageUrl} alt="" className="w-full h-32 object-cover rounded-xl" />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
                        {isUploading ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : (
                          <>
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                              <Upload className="w-5 h-5 text-primary/60" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground/80">Clique ou arraste a foto</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Máx. 1920 × 1080 px</p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {currentImageUrl && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-xl">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f && editId) onImageUpload(editId, f); e.target.value = ""; }} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/40 bg-background flex flex-col items-center justify-center gap-2 p-6 text-center">
                    <Upload className="w-6 h-6 text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground/50">Salve o local primeiro para<br />adicionar a foto do painel</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-border/40 bg-card">
            <button type="button" onClick={onClose}
              className="flex-1 border border-border/60 rounded-xl py-2.5 text-sm font-semibold cursor-pointer bg-transparent hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-bold cursor-pointer disabled:opacity-60 hover:bg-primary/90 transition-colors">
              {isPending ? "Salvando..." : editId ? "Salvar" : "Criar local"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Locais() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  const { data: locations = [], isLoading: loadingLocs } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: () => fetch("/api/locations", { credentials: "include" }).then(r => r.json()),
  });

  const { data: screensRaw = [], isLoading: loadingScreens } = useListScreens();
  const screens = screensRaw as any[];
  const requestUploadUrl = useRequestUploadUrl();

  // ── Merge: build cards from screens grouped by location field ──────────────
  const merged: MergedLocation[] = useMemo(() => {
    // Group screens by location name (case-insensitive)
    const byLoc = new Map<string, any[]>();
    for (const s of screens) {
      const loc = (s.location ?? "").trim();
      if (!loc) continue;
      const key = loc.toLowerCase();
      if (!byLoc.has(key)) byLoc.set(key, []);
      byLoc.get(key)!.push(s);
    }

    const result: MergedLocation[] = [];

    // For each unique screen location, find matching locations table entry
    for (const [key, locScreens] of byLoc) {
      const det = locations.find(l => l.name.toLowerCase().trim() === key) ?? null;
      result.push({ name: locScreens[0].location, screens: locScreens, details: det });
    }

    // Also include locations table entries not linked to any screen
    for (const loc of locations) {
      const key = loc.name.toLowerCase().trim();
      if (!byLoc.has(key)) {
        result.push({ name: loc.name, screens: [], details: loc });
      }
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [screens, locations]);

  const isLoading = loadingLocs || loadingScreens;

  const createMut = useMutation({
    mutationFn: (body: FormState) =>
      fetch("/api/locations", { method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); toast({ title: "Local configurado!" }); closeModal(); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<FormState & { imageUrl: string }> }) =>
      fetch(`/api/locations/${id}`, { method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); toast({ title: "Local atualizado!" }); closeModal(); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => fetch(`/api/locations/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); toast({ title: "Local removido." }); setDeleteId(null); },
  });

  async function handleImageUpload(locationId: number, file: File) {
    if (!file.type.startsWith("image/")) { toast({ title: "Use um arquivo de imagem", variant: "destructive" }); return; }
    setUploadingId(locationId);
    try {
      const res = await requestUploadUrl.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type } });
      await fetch(res.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await fetch(`/api/locations/${locationId}`, { method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: res.objectPath }) });
      qc.invalidateQueries({ queryKey: ["locations"] });
      toast({ title: "Foto atualizada!" });
    } catch { toast({ title: "Erro ao fazer upload da foto", variant: "destructive" }); }
    finally { setUploadingId(null); }
  }

  // Open modal pre-filled with screen location name (for auto-detected cards)
  function handleConfigure(m: MergedLocation) {
    if (m.details) {
      setEditId(m.details.id);
      setForm({
        cep: "", name: m.details.name, abbreviation: m.details.abbreviation ?? "",
        address: m.details.address ?? "", city: m.details.city ?? "",
        latitude: m.details.latitude ?? "", longitude: m.details.longitude ?? "",
        audience: m.details.audience != null ? String(m.details.audience) : "",
        audienceUnit: m.details.audienceUnit ?? "pessoas/hora",
        timezone: m.details.timezone ?? "America/Sao_Paulo",
        internalId: m.details.internalId ?? "", productionType: m.details.productionType ?? "",
        description: m.details.description ?? "",
      });
    } else {
      // Auto-fill from the screen's saved location string
      const screenLoc = m.screens[0]?.location ?? "";
      const parsed = screenLoc ? parseScreenLocation(screenLoc) : { cep: "", city: "", address: "" };
      setForm({ ...EMPTY_FORM, name: m.name, cep: parsed.cep, address: parsed.address, city: parsed.city });
      setShowModal(true);
      // Auto-geocode if we extracted enough data
      if (parsed.address || parsed.city) {
        setGeocoding(true);
        geocodeAddress(parsed.address, parsed.city).then(result => {
          setGeocoding(false);
          if (result) setForm(f => ({ ...f, latitude: result.lat, longitude: result.lon }));
        });
      }
      return;
    }
    setShowModal(true);
  }

  function openCreate() { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditId(null); setForm(EMPTY_FORM); }

  async function handleGeocode() {
    if (!form.address.trim()) { toast({ title: "Informe o endereço primeiro", variant: "destructive" }); return; }
    setGeocoding(true);
    const result = await geocodeAddress(form.address, form.city);
    setGeocoding(false);
    if (result) { setForm(f => ({ ...f, latitude: result.lat, longitude: result.lon })); toast({ title: "Localização encontrada!" }); }
    else toast({ title: "Endereço não encontrado. Insira lat/lon manualmente.", variant: "destructive" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId !== null) updateMut.mutate({ id: editId, body: form });
    else createMut.mutate(form);
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return merged;
    const q = search.toLowerCase();
    return merged.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.details?.city ?? "").toLowerCase().includes(q) ||
      (m.details?.address ?? "").toLowerCase().includes(q) ||
      m.screens.some((s: any) => (s.name ?? "").toLowerCase().includes(q))
    );
  }, [merged, search]);

  const currentImageUrl = editId !== null
    ? (locations.find(l => l.id === editId)?.imageUrl ?? null)
    : null;
  const isPending = createMut.isPending || updateMut.isPending;

  const autoCount = merged.filter(m => !m.details).length;
  const configuredCount = merged.filter(m => !!m.details).length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={MapPin}
        title="Locais"
        description={`${merged.length} ponto${merged.length !== 1 ? "s" : ""} de exibição${autoCount > 0 ? ` · ${autoCount} aguardando configuração` : ""}`}
        actions={
          <Button onClick={openCreate} className="gap-2 h-9 text-sm">
            <Plus className="w-4 h-4" /> Adicionar Local
          </Button>
        }
      />

      {/* Stats */}
      {merged.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full">
            <Monitor className="w-3 h-3 text-primary/60" />
            <span><strong className="text-foreground">{screens.filter((s: any) => s.location).length}</strong> telas com local definido</span>
          </div>
          {configuredCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-emerald-500/10 px-3 py-1.5 rounded-full">
              <MapPin className="w-3 h-3 text-emerald-400" />
              <span><strong className="text-foreground">{configuredCount}</strong> configurado{configuredCount !== 1 ? "s" : ""}</span>
            </div>
          )}
          {autoCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-primary/80 bg-primary/10 px-3 py-1.5 rounded-full">
              <Zap className="w-3 h-3" />
              <span><strong>{autoCount}</strong> detectado{autoCount !== 1 ? "s" : ""} automaticamente — clique em Configurar para adicionar foto e mapa</span>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar local, cidade ou tela..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        {search && <span className="text-xs text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border rounded-2xl overflow-hidden animate-pulse">
              <div className="bg-muted/40" style={{ paddingTop: "50%" }} />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted/40 rounded w-3/4" />
                <div className="h-3 bg-muted/30 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-20 h-20 rounded-3xl bg-muted/20 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-muted-foreground/30" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-muted-foreground">
              {search ? "Nenhum local encontrado" : "Nenhuma tela com local definido"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {search
                ? "Tente outro termo"
                : "Vá em Minhas Telas → edite uma tela e preencha o campo Local"}
            </p>
          </div>
          {!search && (
            <Button variant="outline" size="sm" onClick={openCreate} className="gap-1.5 mt-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar manualmente
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(m => (
            <LocationCard
              key={m.name}
              merged={m}
              onConfigure={handleConfigure}
              onDelete={id => setDeleteId(id)}
              onImageUpload={handleImageUpload}
              uploadingId={uploadingId}
            />
          ))}
        </div>
      )}

      {showModal && (
        <LocationModal
          editId={editId} form={form} setForm={setForm}
          onClose={closeModal} onSubmit={handleSubmit} isPending={isPending}
          geocoding={geocoding} onGeocode={handleGeocode}
          onImageUpload={handleImageUpload} uploadingId={uploadingId}
          currentImageUrl={currentImageUrl}
        />
      )}

      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="font-bold">Remover configuração do local?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">Remove foto, mapa e dados do local. As telas não são afetadas.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border rounded-xl py-2.5 text-sm font-semibold cursor-pointer bg-transparent hover:bg-muted transition-colors">Cancelar</button>
              <button onClick={() => deleteMut.mutate(deleteId!)} disabled={deleteMut.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-60 transition-colors">
                {deleteMut.isPending ? "Removendo..." : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
