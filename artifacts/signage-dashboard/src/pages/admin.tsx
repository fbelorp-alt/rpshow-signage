import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, CreditCard, CheckCircle2, XCircle, Clock, Trash2,
  ChevronDown, ChevronUp, Plus, RefreshCw, ShieldAlert, Pencil,
  Monitor, Lock, Unlock, Search, UserPlus, Mail, Phone,
  MessageCircle, X
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

function statusBadge(status: string) {
  switch (status) {
    case "active":   return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Ativo</Badge>;
    case "trial":    return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30">Trial</Badge>;
    case "suspended":return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">Suspenso</Badge>;
    case "cancelled":return <Badge className="bg-white/10 text-muted-foreground border-white/15">Cancelado</Badge>;
    default:         return <Badge className="bg-white/10 text-muted-foreground">{status}</Badge>;
  }
}

function paymentBadge(status: string) {
  switch (status) {
    case "paid":    return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Pago</Badge>;
    case "pending": return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs">Pendente</Badge>;
    case "overdue": return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">Vencido</Badge>;
    default:        return <Badge className="text-xs">{status}</Badge>;
  }
}

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${months[parseInt(m!) - 1]} ${y}`;
}

const adminFetch = (url: string, opts?: RequestInit) =>
  fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });

export default function AdminPanel() {
  const { user } = useAuth() as { user: { role?: string } | null };
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // Dialogs
  const [newClientDialog, setNewClientDialog] = useState(false);
  const [editInfoDialog, setEditInfoDialog] = useState<Operator | null>(null);
  const [subscriptionDialog, setSubscriptionDialog] = useState<Operator | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<Operator | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Operator | null>(null);

  // New client form
  const [nc, setNc] = useState({
    name: "", username: "", password: "", email: "", phone: "",
    monthlyAmount: "80.00", subscriptionStatus: "trial", trialDays: "30",
  });

  // Edit info form
  const [editInfo, setEditInfo] = useState({ name: "", email: "", phone: "" });

  // Subscription form
  const [subStatus, setSubStatus] = useState("active");
  const [trialDays, setTrialDays] = useState("30");
  const [monthlyAmount, setMonthlyAmount] = useState("80.00");

  // Payment form
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
      invalidateAll();
      setNewClientDialog(false);
      setNc({ name: "", username: "", password: "", email: "", phone: "", monthlyAmount: "80.00", subscriptionStatus: "trial", trialDays: "30" });
      toast({ title: "Cliente criado com sucesso!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateInfo = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { name: string; email: string; phone: string } }) =>
      adminFetch(`/api/admin/operators/${id}/info`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      invalidateAll();
      setEditInfoDialog(null);
      toast({ title: "Informações atualizadas!" });
    },
  });

  const toggleBlock = useMutation({
    mutationFn: ({ screenId, blocked }: { screenId: number; blocked: boolean }) =>
      adminFetch(`/api/admin/screens/${screenId}/block`, { method: "PATCH", body: JSON.stringify({ blocked }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-screens", expandedId] });
      invalidateAll();
    },
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
      setPaymentDialog(null);
      setPayNotes("");
      toast({ title: "Pagamento registrado!" });
    },
  });

  const deletePayment = useMutation({
    mutationFn: ({ operatorId, paymentId }: { operatorId: number; paymentId: number }) =>
      adminFetch(`/api/admin/operators/${operatorId}/payments/${paymentId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-payments", expandedId] }),
  });

  const deleteOp = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin/operators/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidateAll(); setDeleteDialog(null); toast({ title: "Cliente removido" }); },
  });

  if ((user as any)?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <ShieldAlert className="w-10 h-10 text-red-400" />
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
        <Button variant="outline" onClick={() => navigate("/")}>Voltar</Button>
      </div>
    );
  }

  const totalActive    = operators.filter(o => o.subscriptionStatus === "active").length;
  const totalTrial     = operators.filter(o => o.subscriptionStatus === "trial").length;
  const totalSuspended = operators.filter(o => o.subscriptionStatus === "suspended").length;
  const mrr            = operators
    .filter(o => o.subscriptionStatus === "active")
    .reduce((s, o) => s + parseFloat(o.monthlyAmount || "0"), 0);

  const filtered = operators.filter(op =>
    !search ||
    op.name.toLowerCase().includes(search.toLowerCase()) ||
    op.username.toLowerCase().includes(search.toLowerCase()) ||
    (op.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão de clientes, assinaturas e telas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin-operators"] })} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
          <Button size="sm" onClick={() => setNewClientDialog(true)} className="gap-2">
            <UserPlus className="w-3.5 h-3.5" /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "MRR",          value: `R$ ${mrr.toFixed(0)}`,   icon: CreditCard,    color: "text-emerald-400" },
          { label: "Ativos",       value: totalActive,               icon: CheckCircle2,  color: "text-blue-400"    },
          { label: "Em trial",     value: totalTrial,                icon: Clock,         color: "text-yellow-400"  },
          { label: "Suspensos",    value: totalSuspended,            icon: XCircle,       color: "text-red-400"     },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color} flex-shrink-0`} />
            <div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Client list */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-3">
          <Users className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground">Clientes ({operators.length})</span>
          <div className="relative ml-auto w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, usuário ou email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            {search ? "Nenhum cliente encontrado para esta busca" : "Nenhum cliente cadastrado"}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map(op => (
              <div key={op.id}>
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === op.id ? null : op.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{op.name}</span>
                      {statusBadge(op.subscriptionStatus)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                      <span>@{op.username}</span>
                      <span>·</span>
                      <span>{op.screenCount} tela{op.screenCount !== 1 ? "s" : ""}</span>
                      {op.email && <><span>·</span><span className="truncate max-w-40">{op.email}</span></>}
                      {op.phone && <><span>·</span><span>{op.phone}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {op.subscriptionStatus === "trial" && op.trialEndsAt && (
                      <span className="text-xs text-muted-foreground">
                        {Math.max(0, Math.ceil((new Date(op.trialEndsAt).getTime() - Date.now()) / 86400000))}d restantes
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground font-medium">R$ {op.monthlyAmount}/mês</span>
                    {expandedId === op.id
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>
                </div>

                {/* Expanded */}
                {expandedId === op.id && (
                  <div className="bg-muted/20 border-t px-4 py-4 space-y-4">

                    {/* Contact info */}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {op.email && (
                        <a href={`mailto:${op.email}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                          <Mail className="w-3.5 h-3.5" /> {op.email}
                        </a>
                      )}
                      {op.phone && (
                        <a
                          href={`https://wa.me/${op.phone.replace(/\D/g, "")}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> {op.phone}
                        </a>
                      )}
                      <span className="flex items-center gap-1.5">
                        Cliente desde {new Date(op.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs"
                        onClick={() => { setEditInfoDialog(op); setEditInfo({ name: op.name, email: op.email ?? "", phone: op.phone ?? "" }); }}>
                        <Pencil className="w-3.5 h-3.5" /> Editar dados
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs"
                        onClick={() => { setSubscriptionDialog(op); setSubStatus(op.subscriptionStatus); setTrialDays(String(op.trialDays)); setMonthlyAmount(op.monthlyAmount); }}>
                        <CreditCard className="w-3.5 h-3.5" /> Assinatura
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                        onClick={() => { setPaymentDialog(op); setPayAmount(op.monthlyAmount); }}>
                        <Plus className="w-3.5 h-3.5" /> Registrar pagamento
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 ml-auto"
                        onClick={() => setDeleteDialog(op)}>
                        <Trash2 className="w-3.5 h-3.5" /> Remover cliente
                      </Button>
                    </div>

                    {/* Screens */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                        <Monitor className="w-3 h-3" /> Telas ({clientScreens.length})
                      </p>
                      {clientScreens.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">Nenhuma tela cadastrada</p>
                      ) : (
                        <div className="space-y-1.5">
                          {clientScreens.map(s => (
                            <div key={s.id} className="flex items-center gap-3 bg-muted/40 rounded-lg px-3 py-2">
                              <Monitor className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-foreground">{s.name}</span>
                                {s.location && <span className="text-xs text-muted-foreground ml-2">{s.location}</span>}
                                {s.resolution && <span className="text-xs text-muted-foreground ml-2">{s.resolution}</span>}
                              </div>
                              <span className={`text-xs shrink-0 ${s.status === "online" ? "text-emerald-500" : "text-muted-foreground"}`}>
                                {s.status === "online" ? "● Online" : "○ Offline"}
                              </span>
                              {s.blocked && (
                                <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] shrink-0">Bloqueada</Badge>
                              )}
                              <Button size="sm" variant="outline" disabled={toggleBlock.isPending}
                                className={`h-7 px-2 text-xs gap-1 shrink-0 ${s.blocked
                                  ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                  : "border-red-500/30 text-red-400 hover:bg-red-500/10"}`}
                                onClick={() => toggleBlock.mutate({ screenId: s.id, blocked: !s.blocked })}>
                                {s.blocked ? <><Unlock className="w-3 h-3" /> Liberar</> : <><Lock className="w-3 h-3" /> Bloquear</>}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Payments */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                        Histórico de pagamentos ({payments.length})
                      </p>
                      {payments.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">Nenhum pagamento registrado</p>
                      ) : (
                        <div className="space-y-1.5">
                          {payments.map(p => (
                            <div key={p.id} className="flex items-center gap-3 bg-muted/40 rounded-lg px-3 py-2">
                              <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">{formatMonth(p.referenceMonth)}</span>
                              {paymentBadge(p.status)}
                              <span className="text-sm text-foreground font-medium">R$ {p.amount}</span>
                              {p.paidAt && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(p.paidAt).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                              {p.notes && <span className="text-xs text-muted-foreground truncate max-w-32">{p.notes}</span>}
                              <button
                                className="ml-auto p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors shrink-0"
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
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Dialog: Novo Cliente ─────────────────────────────────────── */}
      <Dialog open={newClientDialog} onOpenChange={o => !o && setNewClientDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Novo Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">Nome completo *</Label>
                <Input value={nc.name} onChange={e => setNc({ ...nc, name: e.target.value })} placeholder="Ex: João Silva" className="h-9" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">Usuário (login) *</Label>
                <Input value={nc.username} onChange={e => setNc({ ...nc, username: e.target.value.toLowerCase().replace(/\s/g, "") })} placeholder="Ex: joao.silva" className="h-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Senha *</Label>
              <Input type="password" value={nc.password} onChange={e => setNc({ ...nc, password: e.target.value })} placeholder="Mínimo 6 caracteres" className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">Email</Label>
                <Input type="email" value={nc.email} onChange={e => setNc({ ...nc, email: e.target.value })} placeholder="email@empresa.com" className="h-9" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">Telefone / WhatsApp</Label>
                <Input value={nc.phone} onChange={e => setNc({ ...nc, phone: e.target.value })} placeholder="(11) 99999-9999" className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">Plano</Label>
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
                <Label className="text-xs text-muted-foreground mb-1.5">Valor mensal (R$)</Label>
                <Input value={nc.monthlyAmount} onChange={e => setNc({ ...nc, monthlyAmount: e.target.value })} className="h-9" />
              </div>
            </div>
            {nc.subscriptionStatus === "trial" && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">Dias de trial</Label>
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

      {/* ── Dialog: Editar Info ──────────────────────────────────────── */}
      <Dialog open={!!editInfoDialog} onOpenChange={o => !o && setEditInfoDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Editar dados — {editInfoDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Nome completo</Label>
              <Input value={editInfo.name} onChange={e => setEditInfo({ ...editInfo, name: e.target.value })} className="h-9" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Email</Label>
              <Input type="email" value={editInfo.email} onChange={e => setEditInfo({ ...editInfo, email: e.target.value })} placeholder="email@empresa.com" className="h-9" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Telefone / WhatsApp</Label>
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

      {/* ── Dialog: Assinatura ──────────────────────────────────────── */}
      <Dialog open={!!subscriptionDialog} onOpenChange={o => !o && setSubscriptionDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Assinatura — {subscriptionDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Status</Label>
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
                <Label className="text-xs text-muted-foreground mb-1.5">Dias de trial</Label>
                <Input type="number" min={1} max={365} value={trialDays} onChange={e => setTrialDays(e.target.value)} className="h-9" />
                <p className="text-xs text-muted-foreground mt-1">O prazo será recalculado a partir de agora</p>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Valor mensal (R$)</Label>
              <Input value={monthlyAmount} onChange={e => setMonthlyAmount(e.target.value)} className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSubscriptionDialog(null)}>Cancelar</Button>
            <Button size="sm" disabled={updateSub.isPending}
              onClick={() => updateSub.mutate({ id: subscriptionDialog!.id, body: { subscriptionStatus: subStatus, trialDays: subStatus === "trial" ? parseInt(trialDays) : undefined, monthlyAmount } })}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Registrar Pagamento ──────────────────────────────── */}
      <Dialog open={!!paymentDialog} onOpenChange={o => !o && setPaymentDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Registrar pagamento — {paymentDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Mês de referência</Label>
              <Input type="month" value={payMonth} onChange={e => setPayMonth(e.target.value)} className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">Status</Label>
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
                <Label className="text-xs text-muted-foreground mb-1.5">Valor (R$)</Label>
                <Input value={payAmount} onChange={e => setPayAmount(e.target.value)} className="h-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Observações (opcional)</Label>
              <Input value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Ex: Pago via Banco Cora · PIX" className="h-9" />
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

      {/* ── Dialog: Remover cliente ──────────────────────────────────── */}
      <Dialog open={!!deleteDialog} onOpenChange={o => !o && setDeleteDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Remover cliente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Tem certeza que deseja remover <span className="text-foreground font-medium">{deleteDialog?.name}</span>?
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
