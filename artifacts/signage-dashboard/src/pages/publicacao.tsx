import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Tv2, ListVideo, Filter, Search, ChevronLeft, ChevronRight,
  Pencil, Clock, CheckCircle2, XCircle, Calendar, User, RefreshCw,
  LayoutList,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── types ──────────────────────────────────────────────────────────────────────

interface Publication {
  id: number;
  playlistId: number;
  playlistName: string;
  mediaId: number;
  mediaName: string;
  mediaUrl: string | null;
  mediaType: string | null;
  position: number;
  ordem: number;
  durationSeconds: number;
  title: string;
  clientName: string | null;
  startAt: string | null;
  endAt: string | null;
  status: "ativo" | "agendado" | "expirado";
  screenIds: number[];
  screenNames: string[];
}

interface PlaylistOption { id: number; name: string; }
interface ScreenOption  { id: number; name: string; }

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `00:${String(sec).padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ativo") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
      <CheckCircle2 className="w-2.5 h-2.5" /> Ativo
    </span>
  );
  if (status === "agendado") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
      <Clock className="w-2.5 h-2.5" /> Agendado
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
      <XCircle className="w-2.5 h-2.5" /> Expirado
    </span>
  );
}

// ── Edit modal ─────────────────────────────────────────────────────────────────

function EditModal({ item, onClose }: { item: Publication; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: item.title ?? "",
    clientName: item.clientName ?? "",
    startAt: item.startAt ? item.startAt.slice(0, 16) : "",
    endAt:   item.endAt   ? item.endAt.slice(0, 16)   : "",
    durationSeconds: item.durationSeconds,
  });

  const mut = useMutation({
    mutationFn: () =>
      fetch(`/api/publications/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: form.title || null,
          clientName: form.clientName || null,
          startAt: form.startAt || null,
          endAt:   form.endAt   || null,
          durationSeconds: form.durationSeconds,
        }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publications"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Pencil className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Editar inserção</p>
            <p className="text-[11px] text-muted-foreground truncate max-w-xs">{item.playlistName}</p>
          </div>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Título</label>
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={item.mediaName}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Cliente / Anunciante</label>
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.clientName}
              onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
              placeholder="Nome do cliente"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Data Início</label>
              <input type="datetime-local"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.startAt}
                onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Data Fim</label>
              <input type="datetime-local"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.endAt}
                onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Duração (segundos)</label>
            <input type="number" min={1} max={3600}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.durationSeconds}
              onChange={e => setForm(f => ({ ...f, durationSeconds: Number(e.target.value) }))}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 pb-5 pt-2">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button
            disabled={mut.isPending}
            onClick={() => mut.mutate()}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
            {mut.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export default function Publicacao() {
  const [filterPlaylistId, setFilterPlaylistId] = useState<string>("");
  const [filterScreenId,   setFilterScreenId]   = useState<string>("");
  const [filterStatus,     setFilterStatus]      = useState<string>("");
  const [search,           setSearch]            = useState("");
  const [page,             setPage]              = useState(1);
  const [editing,          setEditing]           = useState<Publication | null>(null);

  const { data: pubs = [], isLoading, refetch } = useQuery<Publication[]>({
    queryKey: ["publications", filterPlaylistId, filterStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterPlaylistId) params.set("playlistId", filterPlaylistId);
      if (filterStatus)     params.set("status", filterStatus);
      return fetch(`/api/publications?${params}`, { credentials: "include" }).then(r => r.json());
    },
  });

  const { data: playlistOpts = [] } = useQuery<PlaylistOption[]>({
    queryKey: ["pub-playlists"],
    queryFn: () => fetch("/api/publications/playlists", { credentials: "include" }).then(r => r.json()),
  });

  const { data: screenOpts = [] } = useQuery<ScreenOption[]>({
    queryKey: ["screens-list"],
    queryFn: () => fetch("/api/screens", { credentials: "include" }).then(r => r.json()),
  });

  // client-side screen + search filter (server already handles playlist+status)
  const filtered = useMemo(() => {
    let list = pubs;
    if (filterScreenId) list = list.filter(p => p.screenIds.includes(Number(filterScreenId)));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.clientName?.toLowerCase().includes(q) ||
        p.playlistName?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [pubs, filterScreenId, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v); setPage(1);
  };

  return (
    <div className="space-y-5 -m-4 sm:-m-6">

      {/* Header */}
      <div className="border-b bg-card px-6 pt-5 pb-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <LayoutList className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Publicação</h1>
              <p className="text-xs text-muted-foreground">Grade de inserções por playlist</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-foreground text-xs font-medium transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              className="pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 w-44"
              placeholder="Buscar registros…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Player (screen) */}
          <div className="relative">
            <Tv2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={filterScreenId}
              onChange={e => handleFilterChange(setFilterScreenId)(e.target.value)}
              className="pl-8 pr-6 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer"
            >
              <option value="">— Player —</option>
              {screenOpts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Playlist */}
          <div className="relative">
            <ListVideo className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={filterPlaylistId}
              onChange={e => handleFilterChange(setFilterPlaylistId)(e.target.value)}
              className="pl-8 pr-6 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer"
            >
              <option value="">— Playlist —</option>
              {playlistOpts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Status */}
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={filterStatus}
              onChange={e => handleFilterChange(setFilterStatus)(e.target.value)}
              className="pl-8 pr-6 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer"
            >
              <option value="">Ativos/Agendados</option>
              <option value="ativo">Ativos</option>
              <option value="agendado">Agendados</option>
              <option value="expirado">Expirados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-4 sm:px-6 pb-6">
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-16">Mídia</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Playlist</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Título</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Cliente</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Data Inicial</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Data Final</th>
                  <th className="px-3 py-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Duração</th>
                  <th className="px-3 py-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Ordem</th>
                  <th className="px-3 py-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-3 py-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-sm text-muted-foreground">Carregando…</td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <LayoutList className="w-6 h-6 text-primary" />
                        </div>
                        <p className="text-sm text-muted-foreground">Nenhuma inserção encontrada</p>
                        <p className="text-xs text-muted-foreground max-w-xs">Adicione mídias às suas playlists para que apareçam aqui</p>
                      </div>
                    </td>
                  </tr>
                ) : paginated.map((p, i) => (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-b border-border transition-colors hover:bg-muted/30",
                      i % 2 === 1 && "bg-muted/10"
                    )}
                  >
                    {/* Thumbnail */}
                    <td className="px-4 py-2.5">
                      <div className="w-12 h-8 rounded-md overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                        {p.mediaUrl && (p.mediaType?.startsWith("image") || p.mediaType === "image") ? (
                          <img src={p.mediaUrl.startsWith("/objects/") ? `/api/storage${p.mediaUrl}` : p.mediaUrl}
                            alt={p.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[9px] text-muted-foreground font-medium text-center px-1 leading-tight truncate">
                            {p.mediaType?.toUpperCase() ?? "—"}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Playlist */}
                    <td className="px-3 py-2.5">
                      <p className="text-xs font-medium text-foreground truncate max-w-[160px]">{p.playlistName}</p>
                      {p.screenNames.length > 0 && (
                        <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                          <Tv2 className="inline w-2.5 h-2.5 mr-0.5" />{p.screenNames.join(", ")}
                        </p>
                      )}
                    </td>

                    {/* Título */}
                    <td className="px-3 py-2.5">
                      <p className="text-xs font-semibold text-foreground truncate max-w-[180px]">{p.title}</p>
                    </td>

                    {/* Cliente */}
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      {p.clientName ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                          <User className="w-2.5 h-2.5" /> {p.clientName}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40">—</span>
                      )}
                    </td>

                    {/* Data Inicial */}
                    <td className="px-3 py-2.5 hidden lg:table-cell">
                      <span className="text-[11px] tabular-nums text-foreground">{fmtDate(p.startAt)}</span>
                    </td>

                    {/* Data Final */}
                    <td className="px-3 py-2.5 hidden lg:table-cell">
                      <span className="text-[11px] tabular-nums text-foreground">{fmtDate(p.endAt)}</span>
                    </td>

                    {/* Duração */}
                    <td className="px-3 py-2.5 text-center hidden md:table-cell">
                      <span className="text-[11px] tabular-nums font-mono text-foreground">{fmtDuration(p.durationSeconds)}</span>
                    </td>

                    {/* Ordem */}
                    <td className="px-3 py-2.5 text-center hidden lg:table-cell">
                      <span className="text-[11px] tabular-nums font-bold text-foreground">{p.ordem}</span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5 text-center">
                      <StatusBadge status={p.status} />
                    </td>

                    {/* Ações */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => setEditing(p)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-border hover:bg-primary/10 hover:border-primary/40 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
            <p className="text-[11px] text-muted-foreground">
              Mostrando {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} registros
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="flex items-center justify-center w-7 h-7 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const n = i + 1;
                return (
                  <button key={n} onClick={() => setPage(n)}
                    className={cn(
                      "flex items-center justify-center w-7 h-7 rounded-lg border text-xs font-semibold transition-colors",
                      page === n ? "bg-primary text-white border-primary" : "border-border hover:bg-muted text-foreground"
                    )}>
                    {n}
                  </button>
                );
              })}
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="flex items-center justify-center w-7 h-7 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editing && <EditModal item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
