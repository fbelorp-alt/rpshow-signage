import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useListScreens, useRequestUploadUrl } from "@workspace/api-client-react";
import {
  MapPin, Plus, Search, Pencil, Trash2,
  Globe, Clock, Users, Navigation, Camera,
  Monitor, Building2, ChevronDown, ChevronUp,
  X, Loader2, ImageIcon,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  createdAt: string;
}

interface FormState {
  name: string; abbreviation: string; address: string; city: string;
  latitude: string; longitude: string; audience: string; audienceUnit: string;
  timezone: string; internalId: string; productionType: string; description: string;
}

const EMPTY_FORM: FormState = {
  name: "", abbreviation: "", address: "", city: "",
  latitude: "", longitude: "", audience: "", audienceUnit: "pessoas/hora",
  timezone: "America/Sao_Paulo", internalId: "", productionType: "", description: "",
};

const TIMEZONES = [
  "America/Sao_Paulo", "America/Manaus", "America/Belem", "America/Fortaleza",
  "America/Recife", "America/Cuiaba", "America/Porto_Velho", "America/Boa_Vista",
  "America/Rio_Branco", "America/Noronha",
];

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

function MapEmbed({ lat, lon, name, height = 160 }: { lat: string; lon: string; name: string; height?: number }) {
  const url = `https://www.openstreetmap.org/export/embed.html?bbox=${Number(lon) - 0.005},${Number(lat) - 0.005},${Number(lon) + 0.005},${Number(lat) + 0.005}&layer=mapnik&marker=${lat},${lon}`;
  return (
    <iframe
      src={url}
      title={`Mapa - ${name}`}
      className="w-full rounded-lg border"
      style={{ height }}
      loading="lazy"
    />
  );
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

// ── Location Card ─────────────────────────────────────────────────────────────

function LocationCard({
  location,
  screenCount,
  onEdit,
  onDelete,
  onImageUpload,
  uploadingId,
}: {
  location: Location;
  screenCount: number;
  onEdit: (l: Location) => void;
  onDelete: (id: number) => void;
  onImageUpload: (id: number, file: File) => void;
  uploadingId: number | null;
}) {
  const [mapOpen, setMapOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isUploading = uploadingId === location.id;
  const hasCoords = !!(location.latitude && location.longitude);

  return (
    <div className="bg-card border rounded-2xl overflow-hidden flex flex-col group hover:border-primary/30 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5">

      {/* ── Image / Banner area ── */}
      <div
        className="relative cursor-pointer overflow-hidden"
        style={{ paddingTop: "56.25%" }}
        onClick={() => !isUploading && fileRef.current?.click()}
        title="Clique para trocar a imagem"
      >
        {location.imageUrl ? (
          <img
            src={location.imageUrl}
            alt={location.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center mb-1">
              <span className="text-xl font-bold text-primary">{initials(location.name)}</span>
            </div>
            <span className="text-[10px] text-muted-foreground/60 font-medium">Sem imagem</span>
          </div>
        )}

        {/* Upload hover overlay */}
        <div className={cn(
          "absolute inset-0 flex flex-col items-center justify-center transition-all duration-200",
          isUploading ? "bg-black/50" : "bg-black/0 opacity-0 group-hover:opacity-100 group-hover:bg-black/40"
        )}>
          {isUploading ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-1 border border-white/30">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] text-white font-medium">
                {location.imageUrl ? "Trocar imagem" : "Adicionar imagem"}
              </span>
            </>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) onImageUpload(location.id, file);
            e.target.value = "";
          }}
        />

        {/* Screen count badge */}
        {screenCount > 0 && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5 text-white text-[10px] font-semibold">
            <Monitor className="w-3 h-3" />
            {screenCount} tela{screenCount !== 1 ? "s" : ""}
          </div>
        )}

        {/* Abbreviation badge */}
        {location.abbreviation && (
          <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-md px-2 py-0.5 text-white text-[10px] font-mono font-semibold">
            {location.abbreviation}
          </div>
        )}
      </div>

      {/* ── Card body ── */}
      <div className="flex flex-col flex-1 p-4 gap-3">

        {/* Name + type */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm leading-tight">{location.name}</h3>
            {location.productionType && (
              <span className="text-[9px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-semibold shrink-0 whitespace-nowrap">
                {location.productionType}
              </span>
            )}
          </div>
          {location.internalId && (
            <span className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 block">
              ID: {location.internalId}
            </span>
          )}
        </div>

        {/* Address */}
        {(location.address || location.city) && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 shrink-0 mt-px text-primary/60" />
            <span className="leading-snug">
              {[location.address, location.city].filter(Boolean).join(", ")}
            </span>
          </div>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {location.audience && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Users className="w-3 h-3 text-primary/50" />
              <span className="font-medium text-foreground">{location.audience.toLocaleString("pt-BR")}</span>
              <span>{location.audienceUnit ?? "pessoas/hora"}</span>
            </div>
          )}
          {location.timezone && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="w-3 h-3 text-primary/50" />
              <span>{location.timezone.replace("America/", "")}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {location.description && (
          <p className="text-[11px] text-muted-foreground leading-relaxed border-t pt-2">
            {location.description}
          </p>
        )}

        {/* Map toggle */}
        {hasCoords && (
          <div>
            <button
              onClick={() => setMapOpen(o => !o)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              <Globe className="w-3 h-3" />
              {mapOpen ? "Ocultar mapa" : "Ver mapa"}
              {mapOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span className="font-mono text-[10px] ml-1 opacity-60">
                {Number(location.latitude).toFixed(3)}, {Number(location.longitude).toFixed(3)}
              </span>
            </button>
            {mapOpen && (
              <div className="mt-2">
                <MapEmbed lat={location.latitude!} lon={location.longitude!} name={location.name} height={140} />
                <a
                  href={`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}&zoom=16`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-blue-500 hover:underline mt-1"
                >
                  <Navigation className="w-2.5 h-2.5" /> Abrir no mapa
                </a>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-2 border-t">
          <Button
            variant="outline" size="sm"
            className="flex-1 h-7 text-xs gap-1.5"
            onClick={() => onEdit(location)}
          >
            <Pencil className="w-3 h-3" /> Editar
          </Button>
          <Button
            variant="outline" size="sm"
            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:border-destructive/30"
            onClick={() => onDelete(location.id)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
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

  const { data: locations = [], isLoading } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: () => fetch("/api/locations", { credentials: "include" }).then(r => r.json()),
  });

  const { data: screens = [] } = useListScreens();

  const requestUploadUrl = useRequestUploadUrl();

  const createMut = useMutation({
    mutationFn: (body: FormState) =>
      fetch("/api/locations", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); toast({ title: "Local criado!" }); closeModal(); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<FormState & { imageUrl: string }> }) =>
      fetch(`/api/locations/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
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
      await fetch(`/api/locations/${locationId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: res.objectPath }),
      });
      qc.invalidateQueries({ queryKey: ["locations"] });
      toast({ title: "Imagem atualizada!" });
    } catch {
      toast({ title: "Erro ao fazer upload da imagem", variant: "destructive" });
    } finally {
      setUploadingId(null);
    }
  }

  function openCreate() { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); }
  function openEdit(l: Location) {
    setEditId(l.id);
    setForm({
      name: l.name, abbreviation: l.abbreviation ?? "", address: l.address ?? "",
      city: l.city ?? "", latitude: l.latitude ?? "", longitude: l.longitude ?? "",
      audience: l.audience != null ? String(l.audience) : "", audienceUnit: l.audienceUnit ?? "pessoas/hora",
      timezone: l.timezone ?? "America/Sao_Paulo", internalId: l.internalId ?? "",
      productionType: l.productionType ?? "", description: l.description ?? "",
    });
    setShowModal(true);
  }
  function closeModal() { setShowModal(false); setEditId(null); setForm(EMPTY_FORM); }

  async function handleGeocode() {
    if (!form.address.trim()) { toast({ title: "Informe o endereço primeiro", variant: "destructive" }); return; }
    setGeocoding(true);
    const result = await geocodeAddress(form.address, form.city);
    setGeocoding(false);
    if (result) { setForm(f => ({ ...f, latitude: result.lat, longitude: result.lon })); toast({ title: "Coordenadas encontradas!" }); }
    else toast({ title: "Endereço não encontrado. Insira lat/lon manualmente.", variant: "destructive" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId !== null) updateMut.mutate({ id: editId, body: form });
    else createMut.mutate(form);
  }

  function getScreenCount(location: Location) {
    const name = location.name.toLowerCase();
    const city = (location.city ?? "").toLowerCase();
    const abbr = (location.abbreviation ?? "").toLowerCase();
    return (screens as any[]).filter((s: any) => {
      const loc = (s.location ?? "").toLowerCase();
      if (!loc) return false;
      return loc.includes(name) || (city.length > 3 && loc.includes(city)) || (abbr.length > 1 && loc.includes(abbr));
    }).length;
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return locations;
    const q = search.toLowerCase();
    return locations.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.city ?? "").toLowerCase().includes(q) ||
      (l.address ?? "").toLowerCase().includes(q)
    );
  }, [locations, search]);

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={MapPin}
        title="Locais"
        description={`${locations.length} ponto${locations.length !== 1 ? "s" : ""} de exibição cadastrado${locations.length !== 1 ? "s" : ""}`}
        actions={
          <Button onClick={openCreate} className="gap-2 h-9 text-sm">
            <Plus className="w-4 h-4" /> Adicionar Local
          </Button>
        }
      />

      {/* Search + count */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar local ou cidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        {search && (
          <span className="text-xs text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* ── Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border rounded-2xl overflow-hidden animate-pulse">
              <div className="bg-muted/40" style={{ paddingTop: "56.25%" }} />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted/40 rounded w-3/4" />
                <div className="h-3 bg-muted/30 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center">
            <Building2 className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <p className="font-medium text-muted-foreground">
            {search ? "Nenhum local encontrado" : "Nenhum local cadastrado"}
          </p>
          {!search && (
            <Button variant="outline" size="sm" onClick={openCreate} className="gap-1.5 mt-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar primeiro local
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(location => (
            <LocationCard
              key={location.id}
              location={location}
              screenCount={getScreenCount(location)}
              onEdit={openEdit}
              onDelete={id => setDeleteId(id)}
              onImageUpload={handleImageUpload}
              uploadingId={uploadingId}
            />
          ))}
        </div>
      )}

      {/* ── Edit / Create Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-card z-10">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                {editId ? "Editar Local" : "Novo Local"}
              </h2>
              <button onClick={closeModal} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Nome */}
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nome do Local *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Shopping Iguatemi — Piso 2"
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Abreviação</label>
                  <input value={form.abbreviation} onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value }))}
                    placeholder="Ex: IGT-P2"
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">ID Interno</label>
                  <input value={form.internalId} onChange={e => setForm(f => ({ ...f, internalId: e.target.value }))}
                    placeholder="Código interno"
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary" />
                </div>

                {/* Endereço */}
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Endereço</label>
                  <div className="flex gap-2">
                    <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="Rua, número, bairro"
                      className="flex-1 bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary" />
                    <button type="button" onClick={handleGeocode} disabled={geocoding}
                      className="flex items-center gap-1.5 bg-blue-500 text-white rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer disabled:opacity-60 whitespace-nowrap">
                      <Navigation className="w-3 h-3" />
                      {geocoding ? "Buscando..." : "Geocodificar"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Cidade</label>
                  <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="Cidade — UF"
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Tipo de Produção</label>
                  <input value={form.productionType} onChange={e => setForm(f => ({ ...f, productionType: e.target.value }))}
                    placeholder="Ex: Comercial, Institucional"
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary" />
                </div>

                {/* Lat / Lon */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Latitude</label>
                  <input value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                    placeholder="-21.1234"
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary font-mono" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Longitude</label>
                  <input value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                    placeholder="-47.8765"
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary font-mono" />
                </div>

                {/* Mapa preview */}
                {form.latitude && form.longitude && (
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Pré-visualização do Mapa</label>
                    <MapEmbed lat={form.latitude} lon={form.longitude} name={form.name} height={180} />
                  </div>
                )}

                {/* Audiência */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Audiência estimada</label>
                  <input type="number" value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
                    placeholder="Ex: 5000"
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Unidade</label>
                  <select value={form.audienceUnit} onChange={e => setForm(f => ({ ...f, audienceUnit: e.target.value }))}
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary cursor-pointer">
                    <option>pessoas/hora</option>
                    <option>pessoas/dia</option>
                    <option>impressões/mês</option>
                  </select>
                </div>

                {/* Fuso horário */}
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Fuso Horário</label>
                  <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary cursor-pointer">
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>

                {/* Descrição */}
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Descrição</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Informações adicionais sobre o local..."
                    rows={2}
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary resize-none" />
                </div>
              </div>

              <div className="flex gap-2 pt-4 mt-2 border-t">
                <button type="button" onClick={closeModal}
                  className="flex-1 border rounded-lg py-2 text-sm font-semibold cursor-pointer bg-transparent hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold cursor-pointer disabled:opacity-60">
                  {isPending ? "Salvando..." : editId ? "Salvar alterações" : "Criar local"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="font-bold">Remover local?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">Essa ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border rounded-lg py-2 text-sm font-semibold cursor-pointer bg-transparent hover:bg-muted">
                Cancelar
              </button>
              <button onClick={() => deleteMut.mutate(deleteId!)} disabled={deleteMut.isPending}
                className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm font-semibold cursor-pointer disabled:opacity-60">
                {deleteMut.isPending ? "Removendo..." : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
