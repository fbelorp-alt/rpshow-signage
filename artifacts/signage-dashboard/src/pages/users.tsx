import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus, Pencil, Trash2, KeyRound, ShieldCheck, User, Loader2, AlertTriangle, Lock, LockOpen,
  ChevronDown, ChevronUp, Search, Mail, MessageCircle, CreditCard, Plus, Monitor, Wifi, WifiOff,
  Unlock, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Operator {
  id: number;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  createdAt: string;
  blocked: boolean;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  trialDays: number;
  pricePerScreen: string;
  monthlyAmount: string;
  screenCount: number;
}

interface ScreenItem {
  id: number;
  name: string;
  code: string;
  status: string;
  resolution: string | null;
  location: string | null;
  blocked: boolean;
  lastSeen: string | null;
  playsToday: number;
  lastPlayName: string | null;
  lastPlayType: string | null;
}

interface Payment {
  id: number;
  operatorId: number;
  referenceMonth: string;
  status: string;
  amount: string;
  notes: string | null;
  paidAt: string | null;
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

async function adminFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`/api/admin${path}`, {
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

function timeAgo(iso: string | null): string {
  if (!iso) return "Nunca";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.floor(d)}s atrás`;
  if (d < 3600) return `${Math.floor(d / 60)}min atrás`;
  if (d < 86400) return `${Math.floor(d / 3600)}h atrás`;
  return `${Math.floor(d / 86400)}d atrás`;
}

function mediaTypeLabel(t: string | null): string {
  if (!t) return "";
  const map: Record<string, string> = {
    video: "Vídeo", image: "Imagem", youtube: "YouTube",
    webpage: "Web", weather: "Clima", clock: "Relógio", rss: "RSS",
  };
  return map[t] ?? t;
}

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${months[parseInt(m!) - 1]} ${y}`;
}

function SubBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    trial: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    suspended: "bg-red-500/15 text-red-400 border-red-500/30",
    cancelled: "bg-white/10 text-white/40 border-white/15",
    pending_approval: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  };
  const label: Record<string, string> = {
    active: "Ativo", trial: "Trial", suspended: "Suspenso",
    cancelled: "Cancelado", pending_approval: "Aguardando",
  };
  return (
    <span className={cn("inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide", map[status] ?? "bg-white/10 text-white/40 border-white/15")}>
      {label[status] ?? status}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    overdue: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  const label: Record<string, string> = { paid: "Pago", pending: "Pendente", overdue: "Vencido" };
  return <span className={cn("inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase", map[status] ?? "bg-white/10 text-white/40")}>{label[status] ?? status}</span>;
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
  const [subscriptionDialog, setSubscriptionDialog] = useState<Operator | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<Operator | null>(null);

  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [createForm, setCreateForm] = useState({ username: "", name: "", password: "", role: "operator" });
  const [editForm, setEditForm] = useState({ name: "", role: "operator", email: "", phone: "" });
  const [resetPw, setResetPw] = useState("");

  const [subStatus, setSubStatus] = useState("active");
  const [trialDays, setTrialDays] = useState("30");
  const [pricePerScreen, setPricePerScreen] = useState("50.00");

  const [payMonth, setPayMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [payStatus, setPayStatus] = useState("paid");
  const [payAmount, setPayAmount] = useState("50.00");
  const [payNotes, setPayNotes] = useState("");

  const { data: operators = [], isLoading } = useQuery<Operator[]>({
    queryKey: ["operators"],
    queryFn: () => apiFetch("/operators"),
  });

  const { data: clientScreens = [] } = useQuery<ScreenItem[]>({
    queryKey: ["admin-screens", expandedId],
    queryFn: () => adminFetch(`/operators/${expandedId}/screens`),
    enabled: expandedId !== null,
    refetchInterval: 15000,
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["admin-payments", expandedId],
    queryFn: () => adminFetch(`/operators/${expandedId}/payments`),
    enabled: expandedId !== null,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["operators"] });

  const createMut = useMutation({
    mutationFn: (data: typeof createForm) => apiFetch("/operators", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); setShowCreate(false); setCreateForm({ username: "", name: "", password: "", role: "operator" }); toast({ title: "Usuário criado com sucesso" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const editMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof editForm }) =>
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

  const blockMut = useMutation({
    mutationFn: ({ id, blocked }: { id: number; blocked: boolean }) =>
      apiFetch(`/operators/${id}/blocked`, { method: "PATCH", body: JSON.stringify({ blocked }) }),
    onSuccess: (_data, vars) => {
      invalidate();
      toast({ title: vars.blocked ? "Acesso bloqueado" : "Acesso liberado" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateSub = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      adminFetch(`/operators/${id}/subscription`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { invalidate(); setSubscriptionDialog(null); toast({ title: "Assinatura atualizada!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const addPayment = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      adminFetch(`/operators/${id}/payments`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payments", paymentDialog?.id] });
      setPaymentDialog(null);
      setPayNotes("");
      toast({ title: "Pagamento registrado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deletePayment = useMutation({
    mutationFn: ({ operatorId, paymentId }: { operatorId: number; paymentId: number }) =>
      adminFetch(`/operators/${operatorId}/payments/${paymentId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-payments", expandedId] }),
  });

  const toggleScreenBlock = useMutation({
    mutationFn: ({ screenId, blocked }: { screenId: number; blocked: boolean }) =>
      adminFetch(`/screens/${screenId}/block`, { method: "PATCH", body: JSON.stringify({ blocked }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-screens", expandedId] }),
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400/50" />
        <p className="text-white/40 text-sm">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const filtered = operators.filter(op =>
    !search ||
    op.name.toLowerCase().includes(search.toLowerCase()) ||
    op.username.toLowerCase().includes(search.toLowerCase()) ||
    (op.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/8 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter uppercase">Clientes</h1>
          <p className="text-muted-foreground font-mono text-xs mt-1 tracking-widest uppercase">Gerenciar Usuários e Assinaturas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              placeholder="Buscar por nome, usuário ou email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-primary/50"
            />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all shrink-0"
          >
            <UserPlus className="w-4 h-4" /> Novo Usuário
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/8 overflow-hidden bg-[#0e1018]">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-white/30" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-white/30 text-sm">
            {search ? "Nenhum usuário encontrado para esta busca" : "Nenhum usuário encontrado."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/3">
                <th className="text-left px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest">Nome</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest">Usuário</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest">Perfil</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest">Cliente</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest">Criado em</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((op, i) => {
                const isSelf = String(op.id) === user?.id;
                const isClient = op.role !== "admin";
                const isExpanded = expandedId === op.id;
                return (
                  <>
                    <tr
                      key={op.id}
                      className={cn(
                        "border-b border-white/5 hover:bg-white/2 transition-colors",
                        i === filtered.length - 1 && !isExpanded && "border-b-0",
                        op.blocked && "opacity-60",
                        isClient && "cursor-pointer"
                      )}
                      onClick={() => isClient && setExpandedId(isExpanded ? null : op.id)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0", op.blocked ? "bg-red-500/20 text-red-400" : "bg-primary/20 text-primary")}>
                            {op.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-white">{op.name}</span>
                              {isSelf && <span className="text-[9px] font-bold text-white/30 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded">você</span>}
                              {op.blocked && <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" />Bloqueado</span>}
                            </div>
                            {op.email && <div className="text-[10px] text-white/30 mt-0.5">{op.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-white/60 text-xs">{op.username}</td>
                      <td className="px-5 py-3.5"><RoleBadge role={op.role} /></td>
                      <td className="px-5 py-3.5">
                        {isClient ? (
                          <div className="flex items-center gap-2">
                            <SubBadge status={op.subscriptionStatus} />
                            <span className="text-[11px] text-white/40">
                              {op.screenCount} tela{op.screenCount !== 1 ? "s" : ""}
                              {op.screenCount > 0 && <> · R$ {op.monthlyAmount}/mês</>}
                            </span>
                            {op.subscriptionStatus === "trial" && op.trialEndsAt && (
                              <span className="text-[10px] text-white/30">
                                ({Math.max(0, Math.ceil((new Date(op.trialEndsAt).getTime() - Date.now()) / 86400000))}d restantes)
                              </span>
                            )}
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
                          </div>
                        ) : (
                          <span className="text-white/20 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-white/40 text-xs">
                        {new Date(op.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditTarget(op); setEditForm({ name: op.name, role: op.role, email: op.email ?? "", phone: op.phone ?? "" }); }}
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
                          {isClient && (
                            <button
                              onClick={() => { setSubscriptionDialog(op); setSubStatus(op.subscriptionStatus); setTrialDays(String(op.trialDays)); setPricePerScreen(op.pricePerScreen); }}
                              title="Assinatura"
                              className="p-1.5 rounded hover:bg-white/8 text-white/40 hover:text-emerald-400 transition-all"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!isSelf && (
                            <button
                              onClick={() => blockMut.mutate({ id: op.id, blocked: !op.blocked })}
                              disabled={blockMut.isPending}
                              title={op.blocked ? "Liberar acesso" : "Bloquear acesso"}
                              className={cn("p-1.5 rounded transition-all", op.blocked
                                ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                : "hover:bg-red-500/10 text-white/40 hover:text-red-400"
                              )}
                            >
                              {op.blocked ? <LockOpen className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>
                          )}
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

                    {isClient && isExpanded && (
                      <tr key={`${op.id}-expanded`} className={cn("border-b border-white/5 bg-white/2", i === filtered.length - 1 && "border-b-0")}>
                        <td colSpan={6} className="px-5 py-4 space-y-4">
                          {/* Contact + actions */}
                          <div className="flex flex-wrap items-center gap-3">
                            {op.email && (
                              <a href={`mailto:${op.email}`} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors">
                                <Mail className="w-3.5 h-3.5" /> {op.email}
                              </a>
                            )}
                            {op.phone && (
                              <a href={`https://wa.me/${op.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-emerald-400 transition-colors">
                                <MessageCircle className="w-3.5 h-3.5" /> {op.phone}
                              </a>
                            )}
                            <button
                              onClick={() => { setPaymentDialog(op); setPayAmount(op.monthlyAmount); }}
                              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-all ml-auto"
                            >
                              <Plus className="w-3.5 h-3.5" /> Registrar pagamento
                            </button>
                          </div>

                          {/* Screens */}
                          <div>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                              <Monitor className="w-3 h-3" /> Telas ({clientScreens.length})
                            </p>
                            {clientScreens.length === 0 ? (
                              <p className="text-xs text-white/30 py-1">Nenhuma tela cadastrada</p>
                            ) : (
                              <div className="rounded-lg border border-white/8 overflow-hidden">
                                {clientScreens.map(s => (
                                  <div key={s.id} className="flex items-center gap-3 px-3 py-2 border-b border-white/5 last:border-0 hover:bg-white/3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-medium text-white truncate">{s.name}</span>
                                        {s.blocked && <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1 py-0.5 rounded">Bloq.</span>}
                                      </div>
                                      <div className="text-[10px] text-white/30 flex items-center gap-1.5 mt-0.5">
                                        {s.location && <span>{s.location}</span>}
                                        {s.resolution && <span>· {s.resolution}</span>}
                                        <span className="font-mono opacity-60">· {s.code}</span>
                                      </div>
                                    </div>
                                    <div className="shrink-0">
                                      {s.status === "online" ? (
                                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400"><Wifi className="w-3 h-3" /> Online</span>
                                      ) : (
                                        <span className="flex items-center gap-1 text-[11px] text-white/30"><WifiOff className="w-3 h-3" /> Offline</span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-white/40 w-16 text-right shrink-0">{s.playsToday ?? 0} plays</div>
                                    <div className="text-[10px] text-white/30 w-28 truncate shrink-0">
                                      {s.lastPlayName ? `${s.lastPlayName} (${mediaTypeLabel(s.lastPlayType)})` : "—"}
                                    </div>
                                    <div className="text-[10px] text-white/30 w-20 shrink-0">{timeAgo(s.lastSeen)}</div>
                                    <button
                                      onClick={() => toggleScreenBlock.mutate({ screenId: s.id, blocked: !s.blocked })}
                                      disabled={toggleScreenBlock.isPending}
                                      className={cn("text-[10px] px-2 py-1 rounded border shrink-0 flex items-center gap-1",
                                        s.blocked ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" : "border-red-500/30 text-red-400 hover:bg-red-500/10")}
                                    >
                                      {s.blocked ? <><Unlock className="w-3 h-3" /> Liberar</> : <><Lock className="w-3 h-3" /> Bloquear</>}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Payments */}
                          <div>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">
                              Histórico de pagamentos ({payments.length})
                            </p>
                            {payments.length === 0 ? (
                              <p className="text-xs text-white/30 py-1">Nenhum pagamento registrado</p>
                            ) : (
                              <div className="space-y-1.5">
                                {payments.map(p => (
                                  <div key={p.id} className="flex items-center gap-3 bg-white/3 rounded-lg px-3 py-2">
                                    <span className="text-xs font-medium text-white/50 w-16 shrink-0">{formatMonth(p.referenceMonth)}</span>
                                    <PaymentBadge status={p.status} />
                                    <span className="text-sm text-white font-medium">R$ {p.amount}</span>
                                    {p.paidAt && <span className="text-xs text-white/30">{new Date(p.paidAt).toLocaleDateString("pt-BR")}</span>}
                                    {p.notes && <span className="text-xs text-white/30 truncate max-w-32">{p.notes}</span>}
                                    <button
                                      className="ml-auto p-1 rounded hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors shrink-0"
                                      title="Excluir pagamento"
                                      onClick={() => deletePayment.mutate({ operatorId: op.id, paymentId: p.id })}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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
            <Field label="Email">
              <input className={inputCls} type="email" placeholder="email@empresa.com" value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </Field>
            <Field label="Telefone / WhatsApp">
              <input className={inputCls} placeholder="(11) 99999-9999" value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
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

      {/* ── Modal: Assinatura ────────────────────────────────────────── */}
      {subscriptionDialog && (
        <Modal title={`Assinatura — ${subscriptionDialog.name}`} onClose={() => setSubscriptionDialog(null)}>
          <div className="space-y-4">
            <Field label="Status">
              <select
                className={inputCls}
                value={subStatus}
                onChange={(e) => setSubStatus(e.target.value)}
              >
                <option value="active">Ativo</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspenso</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </Field>
            {subStatus === "trial" && (
              <Field label="Dias de trial">
                <input className={inputCls} type="number" min={1} max={365} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
                <p className="text-[10px] text-white/30 mt-1">O prazo será recalculado a partir de agora</p>
              </Field>
            )}
            <Field label="Valor por tela (R$)">
              <input className={inputCls} value={pricePerScreen} onChange={(e) => setPricePerScreen(e.target.value)} placeholder="50.00" />
              <p className="text-[10px] text-white/30 mt-1">Cobrança calculada automaticamente: telas × valor/tela</p>
            </Field>
            <button
              onClick={() => updateSub.mutate({ id: subscriptionDialog.id, body: { subscriptionStatus: subStatus, trialDays: subStatus === "trial" ? parseInt(trialDays) : undefined, pricePerScreen } })}
              disabled={updateSub.isPending}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              {updateSub.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Registrar Pagamento ───────────────────────────────── */}
      {paymentDialog && (
        <Modal title={`Registrar pagamento — ${paymentDialog.name}`} onClose={() => setPaymentDialog(null)}>
          <div className="space-y-4">
            <Field label="Mês de referência">
              <input className={inputCls} type="month" value={payMonth} onChange={(e) => setPayMonth(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select className={inputCls} value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
                  <option value="paid">Pago</option>
                  <option value="pending">Pendente</option>
                  <option value="overdue">Vencido</option>
                </select>
              </Field>
              <Field label="Valor (R$)">
                <input className={inputCls} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </Field>
            </div>
            <Field label="Observações (opcional)">
              <input className={inputCls} value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Ex: Pago via Banco Cora · PIX" />
            </Field>
            <button
              onClick={() => addPayment.mutate({ id: paymentDialog.id, body: { referenceMonth: payMonth, status: payStatus, amount: payAmount, notes: payNotes || undefined } })}
              disabled={addPayment.isPending}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              {addPayment.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Registrar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
