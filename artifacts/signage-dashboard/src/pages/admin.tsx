import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, CreditCard, CheckCircle2, XCircle, Clock, Trash2,
  ChevronDown, ChevronUp, Plus, RefreshCw, ShieldAlert, Pencil,
  Monitor, Lock, Unlock, Search, UserPlus, Mail, Phone,
  MessageCircle, X, Bell, CheckCheck, TrendingUp, Wifi, WifiOff,
  DollarSign, AlertCircle, MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

type Operator = {
  id: number;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  createdAt: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  trialDays: number;
  pricePerScreen: string;
  monthlyAmount: string;
  screenCount: number;
};

type ScreenItem = {
  id: number;
  name: string;
  status: string;
  resolution: string | null;
  location: string | null;
  blocked: boolean;
  lastSeen: string | null;
};

type Payment = {
  id: number;
  operatorId: number;
  referenceMonth: string;
  status: string;
  amount: string;
  notes: string | null;
  paidAt: string | null;
  dueDate: string | null;
  createdAt: string;
};

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function avatarColor(id: number) {
  const colors = [
    "from-blue-500 to-blue-700",
    "from-violet-500 to-violet-700",
    "from-emerald-500 to-emerald-700",
    "from-amber-500 to-amber-700",
    "from-rose-500 to-rose-700",
    "from-sky-500 to-sky-700",
    "from-indigo-500 to-indigo-700",
    "from-pink-500 to-pink-700",
  ];
  return colors[id % colors.length];
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:           { label: "Ativo",      cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
    trial:            { label: "Trial",      cls: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
    suspended:        { label: "Suspenso",   cls: "bg-red-500/15 text-red-400 border-red-500/25" },
    cancelled:        { label: "Cancelado",  cls: "bg-white/8 text-white/40 border-white/10" },
    pending_approval: { label: "Pendente",   cls: "bg-orange-500/15 text-orange-400 border-orange-500/25" },
  };
  const s = map[status] ?? { label: status, cls: "bg-white/8 text-white/40 border-white/10" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.cls}`}>
      {s.label}
    </span>
  );
}

function PayBadge({ status }: { status: string }) {
  if (status === "paid")    return <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Pago</span>;
  if (status === "pending") return <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">Pendente</span>;
  if (status === "overdue") return <span className="text-[11px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">Vencido</span>;
  return <span className="text-[11px] text-white/40 px-2 py-0.5 rounded-full">{status}</span>;
}

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${months[parseInt(m!) - 1]} ${y}`;
}

function trialDaysLeft(endsAt: string | null) {
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000));
}

const adminFetch = (url: string, opts?: RequestInit) =>
  fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });

function KpiCard({
  label, value, sub, icon: Icon, accent = "blue",
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: "blue" | "emerald" | "amber" | "red" | "violet";
}) {
  const ring: Record<string, string> = {
    blue:    "border-blue-500/20 bg-blue-500/5",
    emerald: "border-emerald-500/20 bg-emerald-500/5",
    amber:   "border-amber-500/20 bg-amber-500/5",
    red:     "border-red-500/20 bg-red-500/5",
    violet:  "border-violet-500/20 bg-violet-500/5",
  };
  const iconCls: Record<string, string> = {
    blue:    "text-blue-400 bg-blue-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    amber:   "text-amber-400 bg-amber-500/10",
    red:     "text-red-400 bg-red-500/10",
    violet:  "text-violet-400 bg-violet-500/10",
  };
  const valCls: Record<string, string> = {
    blue:    "text-blue-400",
    emerald: "text-emerald-400",
    amber:   "text-amber-400",
    red:     "text-red-400",
    violet:  "text-violet-400",
  };
  return (
    <div className={`rounded-2xl border p-5 flex items-center gap-4 ${ring[accent]}`}
      style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconCls[accent]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-0.5">{label}</p>
        <p className={`text-2xl font-black tabular-nums tracking-tight ${valCls[accent]}`}>{value}</p>
        {sub && <p className="text-[11px] text-white/30 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { user } = useAuth() as { user: { role?: string } | null };
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [newClientDialog, setNewClientDialog] = useState(false);
  const [editInfoDialog, setEditInfoDialog] = useState<Operator | null>(null);
  const [subscriptionDialog, setSubscriptionDialog] = useState<Operator | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<Operator | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Operator | null>(null);
  const [approveDialog, setApproveDialog] = useState<Operator | null>(null);

  const [approveStatus, setApproveStatus] = useState("trial");
  const [approveDays, setApproveDays] = useState("30");
  const [approvePricePerScreen, setApprovePricePerScreen] = useState("50.00");

  const [nc, setNc] = useState({
    name: "", username: "", password: "", email: "", phone: "",
    pricePerScreen: "50.00", subscriptionStatus: "trial", trialDays: "30",
  });
  const [editInfo, setEditInfo] = useState({ name: "", email: "", phone: "" });
  const [subStatus, setSubStatus] = useState("active");
  const [trialDays, setTrialDays] = useState("30");
  const [pricePerScreen, setPricePerScreen] = useState("50.00");
  const [payMonth, setPayMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [payStatus, setPayStatus] = useState("paid");
  const [payAmount, setPayAmount] = useState("80.00");
  const [payNotes, setPayNotes] = useState("");

  const { data: operators = [], isLoading } = useQuery<Operator[]>({
    queryKey: ["admin-operators"],
    queryFn: () => adminFetch("/api/admin/operators").then(r => r.json()),
    refetchInterval: 60_000,
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["admin-payments", expandedId],
    queryFn: () => adminFetch(`/api/admin/operators/${expandedId}/payments`).then(r => r.json()),
    enabled: expandedId !== null,
  });

  const { data: clientScreens = [] } = useQuery<ScreenItem[]>({
    queryKey: ["admin-screens", expandedId],
    queryFn: () => adminFetch(`/api/admin/operators/${expandedId}/screens`).then(r => r.json()),
    enabled: expandedId !== null,
    refetchInterval: 15000,
  });

  const invalidateAll = () => qc.invalidateQueries({ queryKey: ["admin-operators"] });

  const createClient = useMutation({
    mutationFn: (body: typeof nc) =>
      adminFetch("/api/admin/operators", { method: "POST", body: JSON.stringify(body) }).then(r => {
        if (!r.ok) return r.json().then(e => Promise.reject(new Error((e as { error?: string }).error ?? "Erro")));
        return r.json();
      }),
    onSuccess: () => {
      invalidateAll(); setNewClientDialog(false);
      setNc({ name: "", username: "", password: "", email: "", phone: "", pricePerScreen: "50.00", subscriptionStatus: "trial", trialDays: "30" });
      toast({ title: "Cliente criado com sucesso!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateInfo = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { name: string; email: string; phone: string } }) =>
      adminFetch(`/api/admin/operators/${id}/info`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { invalidateAll(); setEditInfoDialog(null); toast({ title: "Informações atualizadas!" }); },
  });

  const toggleBlock = useMutation({
    mutationFn: ({ screenId, blocked }: { screenId: number; blocked: boolean }) =>
      adminFetch(`/api/admin/screens/${screenId}/block`, { method: "PATCH", body: JSON.stringify({ blocked }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-screens", expandedId] }); invalidateAll(); },
  });

  const updateSub = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      adminFetch(`/api/admin/operators/${id}/subscription`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { invalidateAll(); setSubscriptionDialog(null); toast({ title: "Assinatura atualizada!" }); },
  });

  const addPayment = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      adminFetch(`/api/admin/operators/${id}/payments`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payments", paymentDialog?.id] });
      setPaymentDialog(null); setPayNotes("");
      toast({ title: "Pagamento registrado!" });
    },
  });

  const deletePayment = useMutation({
    mutationFn: ({ operatorId, paymentId }: { operatorId: number; paymentId: number }) =>
      adminFetch(`/api/admin/operators/${operatorId}/payments/${paymentId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-payments", expandedId] }),
  });

  const approveOp = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      adminFetch(`/api/admin/operators/${id}/approve`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { invalidateAll(); setApproveDialog(null); toast({ title: "✅ Cliente aprovado!" }); },
  });

  const deleteOp = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin/operators/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidateAll(); setDeleteDialog(null); toast({ title: "Cliente removido" }); },
  });

  if ((user as any)?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <ShieldAlert className="w-10 h-10 text-red-400" />
        <p className="text-white/50">Acesso restrito a administradores.</p>
        <Button variant="outline" onClick={() => navigate("/")}>Voltar</Button>
      </div>
    );
  }

  const pending        = operators.filter(o => o.subscriptionStatus === "pending_approval");
  const totalActive    = operators.filter(o => o.subscriptionStatus === "active").length;
  const totalTrial     = operators.filter(o => o.subscriptionStatus === "trial").length;
  const totalSuspended = operators.filter(o => o.subscriptionStatus === "suspended").length;
  const totalScreens   = operators.reduce((s, o) => s + (o.screenCount ?? 0), 0);
  const mrr            = operators
    .filter(o => o.subscriptionStatus === "active")
    .reduce((s, o) => s + parseFloat(o.monthlyAmount || "0"), 0);

  const filterBtns = [
    { key: "all",           label: "Todos",      count: operators.length },
    { key: "active",        label: "Ativos",     count: totalActive },
    { key: "trial",         label: "Trial",      count: totalTrial },
    { key: "suspended",     label: "Suspensos",  count: totalSuspended },
    { key: "pending_approval", label: "Pendentes", count: pending.length },
  ];

  const filtered = operators.filter(op => {
    const matchSearch =
      !search ||
      op.name.toLowerCase().includes(search.toLowerCase()) ||
      op.username.toLowerCase().includes(search.toLowerCase()) ||
      (op.email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || op.subscriptionStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Painel Administrativo</h1>
          <p className="text-sm text-white/40 mt-1">Gestão de clientes, assinaturas e telas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin-operators"] })}
            className="gap-2 text-white/60 border-white/10 hover:border-white/20 hover:text-white"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
          <Button
            size="sm"
            onClick={() => setNewClientDialog(true)}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <UserPlus className="w-3.5 h-3.5" /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* ── KPI CARDS ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="MRR"           value={`R$ ${mrr.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={DollarSign} accent="emerald" sub="Receita mensal recorrente" />
        <KpiCard label="Clientes Ativos" value={totalActive}    icon={CheckCircle2} accent="blue"   sub={`de ${operators.length} total`} />
        <KpiCard label="Em Trial"      value={totalTrial}       icon={Clock}        accent="amber"  sub="período de teste" />
        <KpiCard label="Suspensos"     value={totalSuspended}   icon={XCircle}      accent="red"    sub="acesso bloqueado" />
        <KpiCard label="Telas Totais"  value={totalScreens}     icon={Monitor}      accent="violet" sub="em toda a rede" />
      </div>

      {/* ── PENDING APPROVALS ──────────────────────────────────────────── */}
      {pending.length > 0 && (
        <div className="rounded-2xl border border-orange-500/25 overflow-hidden"
          style={{ background: "rgba(249,115,22,0.04)" }}>
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-orange-500/15">
            <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center flex-shrink-0">
              <Bell className="w-3.5 h-3.5 text-orange-400" />
            </div>
            <span className="text-sm font-semibold text-orange-300">
              {pending.length} cadastro{pending.length > 1 ? "s" : ""} aguardando aprovação
            </span>
          </div>
          <div className="divide-y divide-orange-500/10">
            {pending.map(op => (
              <div key={op.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(op.id)} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-[11px] font-bold text-white">{initials(op.name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-white">{op.name}</span>
                  <span className="text-xs text-white/40 ml-2">@{op.username}</span>
                  {op.email && <span className="text-xs text-white/40 ml-2 hidden sm:inline">{op.email}</span>}
                  <span className="text-xs text-white/30 ml-2">
                    · {new Date(op.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="ghost"
                    className="h-7 px-2.5 text-xs gap-1 border border-red-500/20 text-red-400 hover:bg-red-500/10"
                    onClick={() => setDeleteDialog(op)}>
                    <X className="w-3 h-3" /> Recusar
                  </Button>
                  <Button size="sm"
                    className="h-7 px-3 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => { setApproveDialog(op); setApproveStatus("trial"); setApproveDays("30"); setApprovePricePerScreen(op.pricePerScreen ?? "50.00"); }}>
                    <CheckCheck className="w-3 h-3" /> Aprovar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CLIENT TABLE ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-white/8 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white/70">
            <Users className="w-4 h-4" />
            <span>Clientes</span>
            <span className="text-white/25 font-normal">({operators.length})</span>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center rounded-lg border border-white/8 overflow-hidden text-xs shrink-0">
            {filterBtns.map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 transition-colors flex items-center gap-1.5 ${
                  statusFilter === f.key
                    ? "bg-white/10 text-white font-semibold"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={`text-[10px] px-1.5 rounded-full ${statusFilter === f.key ? "bg-white/15 text-white" : "bg-white/5 text-white/30"}`}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative sm:ml-auto w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 pl-9 text-xs bg-white/5 border-white/10 text-white placeholder-white/25 focus:border-white/20"
            />
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-white/25 border-b border-white/5">
          <span>Cliente</span>
          <span>Telas</span>
          <span>Plano</span>
          <span>Valor/mês</span>
          <span />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-white/30">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando clientes...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/30">
              {search || statusFilter !== "all" ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(op => {
              const daysLeft = trialDaysLeft(op.trialEndsAt);
              const isExpanded = expandedId === op.id;

              return (
                <div key={op.id}>
                  {/* Row */}
                  <div
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-5 py-4 hover:bg-white/3 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : op.id)}
                  >
                    {/* Cliente */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColor(op.id)} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                        <span className="text-[12px] font-bold text-white">{initials(op.name)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{op.name}</p>
                        <p className="text-[11px] text-white/35 truncate">@{op.username}{op.email ? ` · ${op.email}` : ""}</p>
                      </div>
                    </div>

                    {/* Telas */}
                    <div className="flex items-center gap-1.5 text-sm text-white/60">
                      <Monitor className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
                      <span className="font-semibold text-white">{op.screenCount}</span>
                      <span className="text-white/30 text-[11px]">tela{op.screenCount !== 1 ? "s" : ""}</span>
                    </div>

                    {/* Plano */}
                    <div className="flex flex-col gap-1">
                      <StatusPill status={op.subscriptionStatus} />
                      {op.subscriptionStatus === "trial" && daysLeft !== null && (
                        <span className={`text-[10px] font-medium ${daysLeft <= 3 ? "text-red-400" : "text-white/30"}`}>
                          {daysLeft}d restantes
                        </span>
                      )}
                    </div>

                    {/* Valor */}
                    <div>
                      {op.screenCount > 0 ? (
                        <div>
                          <p className="text-sm font-bold text-white tabular-nums">
                            R$ {parseFloat(op.monthlyAmount || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-white/25">{op.screenCount} × R$ {op.pricePerScreen}</p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-white/25">R$ {op.pricePerScreen}/tela</p>
                      )}
                    </div>

                    {/* Chevron */}
                    <div className="flex items-center">
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-white/30" />
                        : <ChevronDown className="w-4 h-4 text-white/25" />}
                    </div>
                  </div>

                  {/* ── EXPANDED PANEL ── */}
                  {isExpanded && (
                    <div className="border-t border-white/5 bg-black/20 px-5 py-5 space-y-5">

                      {/* Contact + Actions */}
                      <div className="flex flex-wrap items-center gap-3">
                        {op.email && (
                          <a href={`mailto:${op.email}`}
                            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors">
                            <Mail className="w-3.5 h-3.5" /> {op.email}
                          </a>
                        )}
                        {op.phone && (
                          <a href={`https://wa.me/${op.phone.replace(/\D/g, "")}`}
                            target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-emerald-400 transition-colors">
                            <MessageCircle className="w-3.5 h-3.5" /> {op.phone}
                          </a>
                        )}
                        <span className="text-xs text-white/25">
                          Cliente desde {new Date(op.createdAt).toLocaleDateString("pt-BR")}
                        </span>

                        <div className="flex flex-wrap gap-2 sm:ml-auto">
                          <Button size="sm" variant="outline"
                            className="h-7 px-3 text-xs gap-1.5 border-white/10 text-white/60 hover:text-white hover:border-white/20"
                            onClick={() => { setEditInfoDialog(op); setEditInfo({ name: op.name, email: op.email ?? "", phone: op.phone ?? "" }); }}>
                            <Pencil className="w-3 h-3" /> Editar
                          </Button>
                          <Button size="sm" variant="outline"
                            className="h-7 px-3 text-xs gap-1.5 border-white/10 text-white/60 hover:text-white hover:border-white/20"
                            onClick={() => { setSubscriptionDialog(op); setSubStatus(op.subscriptionStatus); setTrialDays(String(op.trialDays)); setPricePerScreen(op.pricePerScreen); }}>
                            <CreditCard className="w-3 h-3" /> Assinatura
                          </Button>
                          <Button size="sm" variant="outline"
                            className="h-7 px-3 text-xs gap-1.5 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => { setPaymentDialog(op); setPayAmount(op.monthlyAmount); }}>
                            <Plus className="w-3 h-3" /> Pagamento
                          </Button>
                          <Button size="sm" variant="outline"
                            className="h-7 px-3 text-xs gap-1.5 border-red-500/20 text-red-400 hover:bg-red-500/10"
                            onClick={() => setDeleteDialog(op)}>
                            <Trash2 className="w-3 h-3" /> Remover
                          </Button>
                        </div>
                      </div>

                      {/* Screens */}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-2.5 flex items-center gap-1.5">
                          <Monitor className="w-3 h-3" /> Telas ({clientScreens.length})
                        </p>
                        {clientScreens.length === 0 ? (
                          <p className="text-xs text-white/25 py-2">Nenhuma tela cadastrada</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {clientScreens.map(s => (
                              <div key={s.id} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 border ${s.blocked ? "border-red-500/20 bg-red-500/5" : "border-white/8 bg-white/3"}`}>
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.status === "online" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-white/20"}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-white truncate">{s.name}</p>
                                  <p className="text-[10px] text-white/35 truncate">
                                    {s.status === "online" ? "Online" : "Offline"}
                                    {s.resolution ? ` · ${s.resolution}` : ""}
                                    {s.location ? ` · ${s.location}` : ""}
                                  </p>
                                </div>
                                {s.blocked && (
                                  <span className="text-[9px] font-bold text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded-full shrink-0">BLOQUEADA</span>
                                )}
                                <button
                                  disabled={toggleBlock.isPending}
                                  onClick={() => toggleBlock.mutate({ screenId: s.id, blocked: !s.blocked })}
                                  className={`p-1 rounded-lg transition-colors shrink-0 ${s.blocked ? "text-emerald-400 hover:bg-emerald-500/15" : "text-white/25 hover:text-red-400 hover:bg-red-500/10"}`}
                                  title={s.blocked ? "Liberar" : "Bloquear"}
                                >
                                  {s.blocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Payments */}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-2.5">
                          Histórico de pagamentos ({payments.length})
                        </p>
                        {payments.length === 0 ? (
                          <p className="text-xs text-white/25 py-2">Nenhum pagamento registrado</p>
                        ) : (
                          <div className="space-y-1.5">
                            {payments.map(p => (
                              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/2 px-3 py-2.5">
                                <span className="text-xs font-semibold text-white/40 w-16 shrink-0 tabular-nums">{formatMonth(p.referenceMonth)}</span>
                                <PayBadge status={p.status} />
                                <span className="text-sm font-bold text-white tabular-nums">R$ {p.amount}</span>
                                {p.paidAt && (
                                  <span className="text-[11px] text-white/30">
                                    {new Date(p.paidAt).toLocaleDateString("pt-BR")}
                                  </span>
                                )}
                                {p.notes && <span className="text-[11px] text-white/30 truncate max-w-40">{p.notes}</span>}
                                <button
                                  className="ml-auto p-1 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors shrink-0"
                                  onClick={() => deletePayment.mutate({ operatorId: op.id, paymentId: p.id })}
                                  title="Excluir"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ────────────────────────── DIALOGS ────────────────────────────── */}

      {/* Novo Cliente */}
      <Dialog open={newClientDialog} onOpenChange={o => !o && setNewClientDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserPlus className="w-4 h-4" /> Novo Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-white/50 mb-1.5">Nome completo *</Label>
                <Input value={nc.name} onChange={e => setNc({ ...nc, name: e.target.value })} placeholder="Ex: João Silva" className="h-9" />
              </div>
              <div>
                <Label className="text-xs text-white/50 mb-1.5">Usuário (login) *</Label>
                <Input value={nc.username} onChange={e => setNc({ ...nc, username: e.target.value.toLowerCase().replace(/\s/g, "") })} placeholder="joao.silva" className="h-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-white/50 mb-1.5">Senha *</Label>
              <Input type="password" value={nc.password} onChange={e => setNc({ ...nc, password: e.target.value })} placeholder="Mínimo 6 caracteres" className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-white/50 mb-1.5">Email</Label>
                <Input type="email" value={nc.email} onChange={e => setNc({ ...nc, email: e.target.value })} placeholder="email@empresa.com" className="h-9" />
              </div>
              <div>
                <Label className="text-xs text-white/50 mb-1.5">Telefone / WhatsApp</Label>
                <Input value={nc.phone} onChange={e => setNc({ ...nc, phone: e.target.value })} placeholder="(11) 99999-9999" className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-white/50 mb-1.5">Plano</Label>
                <Select value={nc.subscriptionStatus} onValueChange={v => setNc({ ...nc, subscriptionStatus: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-white/50 mb-1.5">Valor por tela (R$)</Label>
                <Input value={nc.pricePerScreen} onChange={e => setNc({ ...nc, pricePerScreen: e.target.value })} placeholder="50.00" className="h-9" />
              </div>
            </div>
            {nc.subscriptionStatus === "trial" && (
              <div>
                <Label className="text-xs text-white/50 mb-1.5">Dias de trial</Label>
                <Input type="number" min={1} max={365} value={nc.trialDays} onChange={e => setNc({ ...nc, trialDays: e.target.value })} className="h-9" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewClientDialog(false)}>Cancelar</Button>
            <Button size="sm" disabled={createClient.isPending || !nc.name || !nc.username || !nc.password}
              onClick={() => createClient.mutate(nc)}>
              {createClient.isPending ? "Criando..." : "Criar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar Info */}
      <Dialog open={!!editInfoDialog} onOpenChange={o => !o && setEditInfoDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Editar — {editInfoDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-white/50 mb-1.5">Nome completo</Label>
              <Input value={editInfo.name} onChange={e => setEditInfo({ ...editInfo, name: e.target.value })} className="h-9" />
            </div>
            <div>
              <Label className="text-xs text-white/50 mb-1.5">Email</Label>
              <Input type="email" value={editInfo.email} onChange={e => setEditInfo({ ...editInfo, email: e.target.value })} placeholder="email@empresa.com" className="h-9" />
            </div>
            <div>
              <Label className="text-xs text-white/50 mb-1.5">Telefone / WhatsApp</Label>
              <Input value={editInfo.phone} onChange={e => setEditInfo({ ...editInfo, phone: e.target.value })} placeholder="(11) 99999-9999" className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditInfoDialog(null)}>Cancelar</Button>
            <Button size="sm" disabled={updateInfo.isPending || !editInfo.name}
              onClick={() => updateInfo.mutate({ id: editInfoDialog!.id, body: editInfo })}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assinatura */}
      <Dialog open={!!subscriptionDialog} onOpenChange={o => !o && setSubscriptionDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Assinatura — {subscriptionDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-white/50 mb-1.5">Status</Label>
              <Select value={subStatus} onValueChange={setSubStatus}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {subStatus === "trial" && (
              <div>
                <Label className="text-xs text-white/50 mb-1.5">Dias de trial</Label>
                <Input type="number" min={1} max={365} value={trialDays} onChange={e => setTrialDays(e.target.value)} className="h-9" />
                <p className="text-xs text-white/30 mt-1">O prazo será recalculado a partir de agora</p>
              </div>
            )}
            <div>
              <Label className="text-xs text-white/50 mb-1.5">Valor por tela (R$)</Label>
              <Input value={pricePerScreen} onChange={e => setPricePerScreen(e.target.value)} placeholder="50.00" className="h-9" />
              <p className="text-xs text-white/30 mt-1">Cobrança: telas × valor/tela</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSubscriptionDialog(null)}>Cancelar</Button>
            <Button size="sm" disabled={updateSub.isPending}
              onClick={() => updateSub.mutate({ id: subscriptionDialog!.id, body: { subscriptionStatus: subStatus, trialDays: subStatus === "trial" ? parseInt(trialDays) : undefined, pricePerScreen } })}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar Pagamento */}
      <Dialog open={!!paymentDialog} onOpenChange={o => !o && setPaymentDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Registrar pagamento — {paymentDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-white/50 mb-1.5">Mês de referência</Label>
              <Input type="month" value={payMonth} onChange={e => setPayMonth(e.target.value)} className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-white/50 mb-1.5">Status</Label>
                <Select value={payStatus} onValueChange={setPayStatus}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="overdue">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-white/50 mb-1.5">Valor (R$)</Label>
                <Input value={payAmount} onChange={e => setPayAmount(e.target.value)} className="h-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-white/50 mb-1.5">Observações (opcional)</Label>
              <Input value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Ex: Pago via PIX · Banco Cora" className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPaymentDialog(null)}>Cancelar</Button>
            <Button size="sm" disabled={addPayment.isPending}
              onClick={() => addPayment.mutate({ id: paymentDialog!.id, body: { referenceMonth: payMonth, status: payStatus, amount: payAmount, notes: payNotes || undefined } })}>
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aprovar */}
      <Dialog open={!!approveDialog} onOpenChange={o => !o && setApproveDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-emerald-400" /> Aprovar — {approveDialog?.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-white/40 py-1">Defina o plano inicial. O cliente receberá acesso imediato.</p>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs text-white/50 mb-1.5">Plano inicial</Label>
              <Select value={approveStatus} onValueChange={setApproveStatus}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial (período de teste)</SelectItem>
                  <SelectItem value="active">Ativo (já contratado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {approveStatus === "trial" && (
              <div>
                <Label className="text-xs text-white/50 mb-1.5">Dias de trial</Label>
                <Input type="number" min={1} max={365} value={approveDays} onChange={e => setApproveDays(e.target.value)} className="h-9" />
              </div>
            )}
            <div>
              <Label className="text-xs text-white/50 mb-1.5">Valor por tela (R$)</Label>
              <Input value={approvePricePerScreen} onChange={e => setApprovePricePerScreen(e.target.value)} placeholder="50.00" className="h-9" />
              <p className="text-xs text-white/30 mt-1">Total = telas × valor/tela, calculado automaticamente</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setApproveDialog(null)}>Cancelar</Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={approveOp.isPending}
              onClick={() => approveOp.mutate({ id: approveDialog!.id, body: { subscriptionStatus: approveStatus, trialDays: parseInt(approveDays), pricePerScreen: approvePricePerScreen } })}>
              {approveOp.isPending ? "Aprovando..." : "Confirmar aprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remover */}
      <Dialog open={!!deleteDialog} onOpenChange={o => !o && setDeleteDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Remover cliente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/50 py-2">
            Tem certeza que deseja remover <span className="text-white font-medium">{deleteDialog?.name}</span>?
            Esta ação não pode ser desfeita e apagará todos os dados do cliente.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteDialog(null)}>Cancelar</Button>
            <Button size="sm" variant="destructive" disabled={deleteOp.isPending}
              onClick={() => deleteOp.mutate(deleteDialog!.id)}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
