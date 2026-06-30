import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Pencil, Trash2, KeyRound, ShieldCheck, User, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Operator {
  id: number;
  username: string;
  name: string;
  role: string;
  createdAt: string;
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide",
      role === "admin"
        ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
        : "bg-blue-500/15 text-blue-400 border-blue-500/25"
    )}>
      {role === "admin" ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
      {role === "admin" ? "Admin" : "Operador"}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0e1018] border border-white/10 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/50 focus:bg-white/8 transition-all";

export default function UsersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Operator | null>(null);
  const [resetTarget, setResetTarget] = useState<Operator | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Operator | null>(null);

  const [createForm, setCreateForm] = useState({ username: "", name: "", password: "", role: "operator" });
  const [editForm, setEditForm] = useState({ name: "", role: "operator" });
  const [resetPw, setResetPw] = useState("");

  const { data: operators = [], isLoading } = useQuery<Operator[]>({
    queryKey: ["operators"],
    queryFn: () => apiFetch("/operators"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["operators"] });

  const createMut = useMutation({
    mutationFn: (data: typeof createForm) => apiFetch("/operators", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); setShowCreate(false); setCreateForm({ username: "", name: "", password: "", role: "operator" }); toast({ title: "Usuário criado com sucesso" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const editMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; role: string } }) =>
      apiFetch(`/operators/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); setEditTarget(null); toast({ title: "Usuário atualizado" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const resetMut = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      apiFetch(`/operators/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
    onSuccess: () => { setResetTarget(null); setResetPw(""); toast({ title: "Senha redefinida com sucesso" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/operators/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setDeleteTarget(null); toast({ title: "Usuário excluído" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400/50" />
        <p className="text-white/40 text-sm">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/8 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter uppercase">Usuários</h1>
          <p className="text-muted-foreground font-mono text-xs mt-1 tracking-widest uppercase">Gerenciar Operadores</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all"
        >
          <UserPlus className="w-4 h-4" /> Novo Usuário
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/8 overflow-hidden bg-[#0e1018]">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-white/30" />
          </div>
        ) : operators.length === 0 ? (
          <div className="text-center py-16 text-white/30 text-sm">Nenhum usuário encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/3">
                <th className="text-left px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest">Nome</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest">Usuário</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest">Perfil</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest">Criado em</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {operators.map((op, i) => {
                const isSelf = String(op.id) === user?.id;
                return (
                  <tr key={op.id} className={cn("border-b border-white/5 hover:bg-white/2 transition-colors", i === operators.length - 1 && "border-b-0")}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {op.name[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-white">{op.name}</span>
                        {isSelf && <span className="text-[9px] font-bold text-white/30 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded">você</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-white/60 text-xs">{op.username}</td>
                    <td className="px-5 py-3.5"><RoleBadge role={op.role} /></td>
                    <td className="px-5 py-3.5 text-white/40 text-xs">
                      {new Date(op.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditTarget(op); setEditForm({ name: op.name, role: op.role }); }}
                          title="Editar"
                          className="p-1.5 rounded hover:bg-white/8 text-white/40 hover:text-white transition-all"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setResetTarget(op); setResetPw(""); }}
                          title="Redefinir senha"
                          className="p-1.5 rounded hover:bg-white/8 text-white/40 hover:text-amber-400 transition-all"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => setDeleteTarget(op)}
                            title="Excluir"
                            className="p-1.5 rounded hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-lg border border-white/8 bg-white/2 p-4 text-xs text-white/40 space-y-1">
        <p><span className="text-amber-400 font-bold">Admin</span> — acesso completo ao painel, incluindo gerenciar usuários.</p>
        <p><span className="text-blue-400 font-bold">Operador</span> — pode enviar mídia, criar e editar playlists. Não gerencia usuários.</p>
      </div>

      {/* ── Modal: Criar usuário ─────────────────────────────────────── */}
      {showCreate && (
        <Modal title="Novo Usuário" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <Field label="Nome completo">
              <input className={inputCls} placeholder="Ex: João Silva" value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
            </Field>
            <Field label="Usuário (login)">
              <input className={inputCls} placeholder="Ex: joao.silva" value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value.toLowerCase().replace(/\s/g, "") })} />
            </Field>
            <Field label="Senha">
              <input className={inputCls} type="password" placeholder="Mínimo 6 caracteres" value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
            </Field>
            <Field label="Perfil">
              <div className="flex gap-2">
                {(["operator", "admin"] as const).map((r) => (
                  <button key={r} onClick={() => setCreateForm({ ...createForm, role: r })}
                    className={cn("flex-1 py-2 rounded-lg border text-xs font-bold transition-all",
                      createForm.role === r
                        ? r === "admin" ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "bg-blue-500/20 border-blue-500/40 text-blue-400"
                        : "bg-white/3 border-white/10 text-white/40 hover:bg-white/5"
                    )}>
                    {r === "admin" ? "Admin" : "Operador"}
                  </button>
                ))}
              </div>
            </Field>
            <button
              onClick={() => createMut.mutate(createForm)}
              disabled={createMut.isPending || !createForm.username || !createForm.name || !createForm.password}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              {createMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar Usuário
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Editar usuário ────────────────────────────────────── */}
      {editTarget && (
        <Modal title={`Editar — ${editTarget.username}`} onClose={() => setEditTarget(null)}>
          <div className="space-y-4">
            <Field label="Nome completo">
              <input className={inputCls} value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </Field>
            <Field label="Perfil">
              <div className="flex gap-2">
                {(["operator", "admin"] as const).map((r) => (
                  <button key={r} onClick={() => setEditForm({ ...editForm, role: r })}
                    className={cn("flex-1 py-2 rounded-lg border text-xs font-bold transition-all",
                      editForm.role === r
                        ? r === "admin" ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "bg-blue-500/20 border-blue-500/40 text-blue-400"
                        : "bg-white/3 border-white/10 text-white/40 hover:bg-white/5"
                    )}>
                    {r === "admin" ? "Admin" : "Operador"}
                  </button>
                ))}
              </div>
            </Field>
            <button
              onClick={() => editMut.mutate({ id: editTarget.id, data: editForm })}
              disabled={editMut.isPending || !editForm.name}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              {editMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar Alterações
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Redefinir senha ───────────────────────────────────── */}
      {resetTarget && (
        <Modal title={`Redefinir senha — ${resetTarget.username}`} onClose={() => setResetTarget(null)}>
          <div className="space-y-4">
            <p className="text-xs text-white/40">Digite a nova senha para o usuário <span className="text-white font-semibold">{resetTarget.name}</span>.</p>
            <Field label="Nova senha">
              <input className={inputCls} type="password" placeholder="Mínimo 6 caracteres" value={resetPw}
                onChange={(e) => setResetPw(e.target.value)} />
            </Field>
            <button
              onClick={() => resetMut.mutate({ id: resetTarget.id, password: resetPw })}
              disabled={resetMut.isPending || resetPw.length < 6}
              className="w-full py-2.5 bg-amber-500 text-black rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
            >
              {resetMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Redefinir Senha
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Confirmar exclusão ────────────────────────────────── */}
      {deleteTarget && (
        <Modal title="Confirmar exclusão" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-white/70">
              Tem certeza que deseja excluir o usuário <span className="text-white font-bold">{deleteTarget.name}</span>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white/60 rounded-lg text-sm font-medium hover:bg-white/8 transition-all">
                Cancelar
              </button>
              <button
                onClick={() => deleteMut.mutate(deleteTarget.id)}
                disabled={deleteMut.isPending}
                className="flex-1 py-2.5 bg-red-500/80 text-white rounded-lg text-sm font-bold hover:bg-red-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {deleteMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
