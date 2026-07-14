import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  MapPin, Plus, Search, Pencil, Trash2,
  Globe, Clock, Users, Navigation,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
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

function MapEmbed({ lat, lon, name }: { lat: string; lon: string; name: string }) {
  const url = `https://www.openstreetmap.org/export/embed.html?bbox=${Number(lon) - 0.005},${Number(lat) - 0.005},${Number(lon) + 0.005},${Number(lat) + 0.005}&layer=mapnik&marker=${lat},${lon}`;
  return (
    <iframe
      src={url}
      title={`Mapa - ${name}`}
      className="w-full h-[180px] rounded-lg border"
      loading="lazy"
    />
  );
}

export default function Locais() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const { data: locations = [], isLoading } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: () => fetch("/api/locations", { credentials: "include" }).then(r => r.json()),
  });

  const createMut = useMutation({
    mutationFn: (body: FormState) =>
      fetch("/api/locations", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations"] });
      toast({ title: "Local criado!" });
      closeModal();
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<FormState> }) =>
      fetch(`/api/locations/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations"] });
      toast({ title: "Local atualizado!" });
      closeModal();
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/locations/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations"] });
      toast({ title: "Local removido." });
      setDeleteId(null);
    },
  });

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(l: Location) {
    setEditId(l.id);
    setForm({
      name: l.name,
      abbreviation: l.abbreviation ?? "",
      address: l.address ?? "",
      city: l.city ?? "",
      latitude: l.latitude ?? "",
      longitude: l.longitude ?? "",
      audience: l.audience != null ? String(l.audience) : "",
      audienceUnit: l.audienceUnit ?? "pessoas/hora",
      timezone: l.timezone ?? "America/Sao_Paulo",
      internalId: l.internalId ?? "",
      productionType: l.productionType ?? "",
      description: l.description ?? "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  async function handleGeocode() {
    if (!form.address.trim()) { toast({ title: "Informe o endereço primeiro", variant: "destructive" }); return; }
    setGeocoding(true);
    const result = await geocodeAddress(form.address, form.city);
    setGeocoding(false);
    if (result) {
      setForm(f => ({ ...f, latitude: result.lat, longitude: result.lon }));
      toast({ title: "Coordenadas encontradas!" });
    } else {
      toast({ title: "Endereço não encontrado. Insira lat/lon manualmente.", variant: "destructive" });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId !== null) {
      updateMut.mutate({ id: editId, body: form });
    } else {
      createMut.mutate(form);
    }
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div>
      <PageHeader
        icon={MapPin}
        title="Locais"
        description="Gerencie os pontos de exibição e seus endereços"
        className="mb-5"
        actions={
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer">
            <Plus className="w-4 h-4" /> Adicionar Local
          </button>
        }
      />

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            placeholder="Buscar local ou cidade..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-muted/20">
          <span className="text-xs text-muted-foreground">{filtered.length} local{filtered.length !== 1 ? "is" : ""} encontrado{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/10">
                  {["Local", "Cidade", "Endereço", "Coordenadas", "Audiência", "Fuso Horário", "Ações"].map(h => (
                    <th key={h} className="text-left text-[10.5px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 && (
                  <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">Nenhum local encontrado</td></tr>
                )}
                {pageItems.map(l => (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                    {/* Nome */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4 text-teal-500" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{l.name}</div>
                          {l.abbreviation && (
                            <span className="text-[10px] bg-muted rounded px-1.5 py-px font-mono text-muted-foreground">{l.abbreviation}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Cidade */}
                    <td className="px-4 py-3 align-middle text-xs text-muted-foreground whitespace-nowrap">
                      {l.city ?? "—"}
                    </td>

                    {/* Endereço */}
                    <td className="px-4 py-3 align-middle text-xs text-muted-foreground max-w-[180px] truncate">
                      {l.address ?? "—"}
                    </td>

                    {/* Coordenadas */}
                    <td className="px-4 py-3 align-middle">
                      {l.latitude && l.longitude ? (
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${l.latitude}&mlon=${l.longitude}&zoom=16`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] text-blue-500 hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          <Navigation className="w-2.5 h-2.5" />
                          {Number(l.latitude).toFixed(4)}, {Number(l.longitude).toFixed(4)}
                        </a>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* Audiência */}
                    <td className="px-4 py-3 align-middle">
                      {l.audience ? (
                        <span className="flex items-center gap-1 text-xs">
                          <Users className="w-3 h-3 text-muted-foreground" />
                          {l.audience.toLocaleString("pt-BR")} <span className="text-muted-foreground">{l.audienceUnit}</span>
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* Fuso */}
                    <td className="px-4 py-3 align-middle">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />{(l.timezone ?? "").replace("America/", "")}
                      </span>
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(l)} title="Editar"
                          className="w-7 h-7 rounded-md bg-muted/40 border flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => setDeleteId(l.id)} title="Remover"
                          className="w-7 h-7 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center cursor-pointer text-red-500 hover:bg-red-500/20 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && filtered.length > PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
            <span>Mostrando {(page - 1) * PER_PAGE + 1} a {Math.min(page * PER_PAGE, filtered.length)} de {filtered.length}</span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={cn("min-w-[28px] h-7 rounded border text-xs px-1",
                    p === page ? "bg-primary text-primary-foreground border-primary" : "bg-transparent cursor-pointer hover:bg-muted")}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-card z-10">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                {editId ? "Editar Local" : "Novo Local"}
              </h2>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none text-xl leading-none">×</button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Nome */}
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nome do Local *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Shopping Iguatemi - Piso 2"
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
                      {geocoding ? "Buscando..." : "Buscar"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Cidade</label>
                  <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="Cidade - UF"
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
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Mapa</label>
                    <MapEmbed lat={form.latitude} lon={form.longitude} name={form.name} />
                  </div>
                )}

                {/* Audiência */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Audiência</label>
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
