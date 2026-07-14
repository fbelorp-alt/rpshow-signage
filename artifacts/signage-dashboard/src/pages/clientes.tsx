import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Building2, Plus, Search, Pencil, Trash2,
  Phone, MapPin, Tag, Users, CheckCircle, XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Client {
  id: number;
  userId: string | null;
  name: string;
  cnpj: string | null;
  segment: string | null;
  type: string;
  contactName: string | null;
  contactPhone: string | null;
  address: string | null;
  active: boolean;
  createdAt: string;
  screenCount: number;
}

const SEGMENTS = [
  "Alimentação", "Automotivo", "Educação", "Esporte e Lazer", "Farmácia",
  "Moda e Vestuário", "Saúde e Beleza", "Serviços", "Tecnologia", "Varejo", "Outro",
];

function fmtCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

interface FormState {
  name: string; cnpj: string; segment: string;
  contactName: string; contactPhone: string; address: string; active: boolean;
}

const EMPTY_FORM: FormState = {
  name: "", cnpj: "", segment: "", contactName: "", contactPhone: "", address: "", active: true,
};

export default function Clientes() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [segFilter, setSegFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const PER_PAGE = 10;

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => fetch("/api/clients", { credentials: "include" }).then(r => r.json()),
  });

  const createMut = useMutation({
    mutationFn: (body: Omit<FormState, "active"> & { active: boolean }) =>
      fetch("/api/clients", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Cliente criado!" });
      closeModal();
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<FormState> }) =>
      fetch(`/api/clients/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Cliente atualizado!" });
      closeModal();
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/clients/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Cliente removido." });
      setDeleteId(null);
    },
  });

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(c: Client) {
    setEditId(c.id);
    setForm({
      name: c.name,
      cnpj: c.cnpj ?? "",
      segment: c.segment ?? "",
      contactName: c.contactName ?? "",
      contactPhone: c.contactPhone ?? "",
      address: c.address ?? "",
      active: c.active,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...form, cnpj: form.cnpj.replace(/\D/g, "") };
    if (editId !== null) {
      updateMut.mutate({ id: editId, body });
    } else {
      createMut.mutate(body);
    }
  }

  const filtered = useMemo(() => {
    let list = clients;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.cnpj ?? "").includes(q) ||
        (c.segment ?? "").toLowerCase().includes(q) ||
        (c.contactName ?? "").toLowerCase().includes(q)
      );
    }
    if (segFilter) list = list.filter(c => c.segment === segFilter);
    return list;
  }, [clients, search, segFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div>
      <PageHeader
        icon={Building2}
        title="Clientes / Anunciantes"
        description="Gerencie seus clientes e anunciantes"
        className="mb-5"
        actions={
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer">
            <Plus className="w-4 h-4" /> Adicionar Cliente
          </button>
        }
      />

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            placeholder="Buscar nome, CNPJ..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={segFilter}
          onChange={e => { setSegFilter(e.target.value); setPage(1); }}
          className="bg-card border rounded-lg px-3 py-2 text-sm cursor-pointer outline-none text-foreground"
        >
          <option value="">Todos os segmentos</option>
          {SEGMENTS.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-muted/20 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{filtered.length} cliente{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}</span>
          <span className="text-xs text-muted-foreground">Exibindo {PER_PAGE} por página</span>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/10">
                  {["Nome", "Segmento", "CNPJ", "Contato", "Telas", "Status", "Ações"].map(h => (
                    <th key={h} className="text-left text-[10.5px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 && (
                  <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">Nenhum cliente encontrado</td></tr>
                )}
                {pageItems.map(c => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                    {/* Nome */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{c.name}</div>
                          {c.address && (
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-px">
                              <MapPin className="w-2.5 h-2.5" />{c.address}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Segmento */}
                    <td className="px-4 py-3 align-middle">
                      {c.segment ? (
                        <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-500 rounded-full px-2 py-0.5 text-[11px] font-medium">
                          <Tag className="w-2.5 h-2.5" />{c.segment}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* CNPJ */}
                    <td className="px-4 py-3 align-middle text-xs text-muted-foreground tabular-nums">
                      {c.cnpj ? fmtCnpj(c.cnpj) : "—"}
                    </td>

                    {/* Contato */}
                    <td className="px-4 py-3 align-middle">
                      {c.contactName || c.contactPhone ? (
                        <div>
                          {c.contactName && <div className="text-xs font-medium">{c.contactName}</div>}
                          {c.contactPhone && (
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" />{c.contactPhone}
                            </div>
                          )}
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* Telas */}
                    <td className="px-4 py-3 align-middle text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
                        c.screenCount > 0 ? "bg-violet-500/10 text-violet-500" : "bg-muted text-muted-foreground"
                      )}>
                        <Users className="w-2.5 h-2.5" />{c.screenCount}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 align-middle">
                      {c.active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-500 text-xs font-semibold">
                          <CheckCircle className="w-3 h-3" />Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500 text-xs font-semibold">
                          <XCircle className="w-3 h-3" />Inativo
                        </span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(c)} title="Editar"
                          className="w-7 h-7 rounded-md bg-muted/40 border flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => setDeleteId(c.id)} title="Remover"
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

        {/* Pagination */}
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

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                {editId ? "Editar Cliente" : "Novo Cliente"}
              </h2>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nome *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nome do cliente / anunciante"
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">CNPJ</label>
                  <input value={fmtCnpj(form.cnpj)} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
                    placeholder="00.000.000/0000-00"
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Segmento</label>
                  <select value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary cursor-pointer">
                    <option value="">Selecionar...</option>
                    {SEGMENTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Responsável</label>
                  <input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                    placeholder="Nome do contato"
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Telefone</label>
                  <input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))}
                    placeholder="(16) 99999-9999"
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Endereço</label>
                  <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Rua, número, cidade"
                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary" />
                </div>
                {editId && (
                  <div className="col-span-2 flex items-center gap-2">
                    <input type="checkbox" id="active" checked={form.active}
                      onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                      className="w-4 h-4 rounded cursor-pointer" />
                    <label htmlFor="active" className="text-sm cursor-pointer select-none">Cliente ativo</label>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 border rounded-lg py-2 text-sm font-semibold cursor-pointer bg-transparent hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold cursor-pointer disabled:opacity-60">
                  {isPending ? "Salvando..." : editId ? "Salvar alterações" : "Criar cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="font-bold">Remover cliente?</h3>
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
