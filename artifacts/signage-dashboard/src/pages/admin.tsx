import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, CreditCard, CheckCircle2, XCircle, Clock, Trash2,
  RefreshCw, ShieldAlert,
  Monitor, UserPlus,
  Bell, CheckCheck, Wifi, WifiOff, Play, Ban,
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

// ── helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.floor(d)}s atrás`;
  if (d < 3600) return `${Math.floor(d / 60)}min atrás`;
  if (d < 86400) return `${Math.floor(d / 3600)}h atrás`;
  return `${Math.floor(d / 86400)}d atrás`;
}

function resolveScreenshot(p: string | null): string | null {
  if (!p) return null;
  if (p.startsWith("http")) return p;
  if (p.startsWith("/objects/")) return `/api/storage${p}`;
  return p;
}

function mediaTypeLabel(t: string | null): string {
  if (!t) return "";
  const map: Record<string, string> = {
    video: "Vídeo", image: "Imagem", youtube: "YouTube",
    webpage: "Web", weather: "Clima", clock: "Relógio", rss: "RSS",
  };
  return map[t] ?? t;
}

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
  monthlyAmount: string; // computed: screenCount × pricePerScreen
  screenCount: number;
};

type ScreenItem = {
  id: number;
  name: string;
  code: string;
  status: string;
  resolution: string | null;
  location: string | null;
  blocked: boolean;
  lastSeen: string | null;
  lastScreenshot: string | null;
  playsToday: number;
  lastPlayName: string | null;
  lastPlayType: string | null;
  lastPlayAt: string | null;
};

type GlobalStats = {
  totalScreens: number;
  onlineCount: number;
  offlineCount: number;
  blockedCount: number;
  playsToday: number;
  totalClients: number;
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
    case "active":          return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Ativo</Badge>;
    case "trial":           return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30">Trial</Badge>;
    case "suspended":       return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">Suspenso</Badge>;
    case "cancelled":       return <Badge className="bg-white/10 text-muted-foreground border-white/15">Cancelado</Badge>;
    case "pending_approval":return <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30">Aguardando</Badge>;
    default:                return <Badge className="bg-white/10 text-muted-foreground">{status}</Badge>;
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

  // Dialogs
  const [newClientDialog, setNewClientDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<Operator | null>(null);
  const [approveDialog, setApproveDialog] = useState<Operator | null>(null);

  // Approve form
  const [approveStatus, setApproveStatus] = useState("trial");
  const [approveDays, setApproveDays] = useState("30");
  const [approvePricePerScreen, setApprovePricePerScreen] = useState("50.00");

  // New client form
  const [nc, setNc] = useState({
    name: "", username: "", password: "", email: "", phone: "",
    pricePerScreen: "50.00", subscriptionStatus: "trial", trialDays: "30",
  });

  const { data: operators = [], isLoading } = useQuery<Operator[]>({
    queryKey: ["admin-operators"],
    queryFn: () => adminFetch("/api/admin/operators").then(r => r.json()),
  });

  const { data: globalStats } = useQuery<GlobalStats>({
    queryKey: ["admin-global-stats"],
    queryFn: () => adminFetch("/api/admin/global-stats").then(r => r.json()),
    refetchInterval: 30_000,
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
      setNc({ name: "", username: "", password: "", email: "", phone: "", pricePerScreen: "50.00", subscriptionStatus: "trial", trialDays: "30" });
      toast({ title: "Cliente criado com sucesso!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const approveOp = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      adminFetch(`/api/admin/operators/${id}/approve`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      invalidateAll();
      setApproveDialog(null);
      toast({ title: "✅ Cliente aprovado! Já pode acessar o sistema." });
    },
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

  const pending        = operators.filter(o => o.subscriptionStatus === "pending_approval");
  const totalActive    = operators.filter(o => o.subscriptionStatus === "active").length;
  const totalTrial     = operators.filter(o => o.subscriptionStatus === "trial").length;
  const totalSuspended = operators.filter(o => o.subscriptionStatus === "suspended").length;
  const mrr            = operators
    .filter(o => o.subscriptionStatus === "active")
    .reduce((s, o) => s + parseFloat(o.monthlyAmount || "0"), 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão de clientes, assinaturas e telas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["admin-operators"] });
              qc.invalidateQueries({ queryKey: ["admin-global-stats"] });
              qc.invalidateQueries({ queryKey: ["admin-screens"] });
              qc.invalidateQueries({ queryKey: ["admin-payments"] });
            }}
            className="gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
          <Button size="sm" onClick={() => setNewClientDialog(true)} className="gap-2">
            <UserPlus className="w-3.5 h-3.5" /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* Pending approvals alert */}
      {pending.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-orange-300">
              {pending.length} cadastro{pending.length > 1 ? "s" : ""} aguardando aprovação
            </span>
          </div>
          <div className="space-y-2">
            {pending.map(op => (
              <div key={op.id} className="flex items-center justify-between bg-orange-500/5 rounded-lg px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-foreground">{op.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">@{op.username}</span>
                  {op.email && <span className="text-xs text-muted-foreground ml-2">{op.email}</span>}
                  <span className="text-xs text-muted-foreground ml-2">
                    · {new Date(op.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => setDeleteDialog(op)}>
                    <Trash2 className="w-3 h-3" /> Recusar
                  </Button>
                  <Button size="sm" className="h-7 px-3 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => { setApproveDialog(op); setApproveStatus("trial"); setApproveDays("30"); setApprovePricePerScreen(op.pricePerScreen ?? "50.00"); }}>
                    <CheckCheck className="w-3 h-3" /> Aprovar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats — assinaturas */}
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

      {/* Stats globais de telas — exclusivo admin */}
      {globalStats && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Visão global de telas</span>
            <span className="text-[10px] text-muted-foreground ml-1">(todos os clientes)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x">
            {[
              { label: "Total de Telas",   value: globalStats.totalScreens,  icon: Monitor,       color: "text-blue-400",    bg: "bg-blue-500/10" },
              { label: "Online agora",     value: globalStats.onlineCount,   icon: Wifi,          color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Offline",          value: globalStats.offlineCount,  icon: WifiOff,       color: "text-red-400",     bg: "bg-red-500/10" },
              { label: "Bloqueadas",       value: globalStats.blockedCount,  icon: Ban,           color: "text-orange-400",  bg: "bg-orange-500/10" },
              { label: "Exibições hoje",   value: globalStats.playsToday,    icon: Play,          color: "text-violet-400",  bg: "bg-violet-500/10" },
              { label: "Clientes",         value: globalStats.totalClients,  icon: Users,         color: "text-sky-400",     bg: "bg-sky-500/10" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div>
                  <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value.toLocaleString("pt-BR")}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


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
                <Label className="text-xs text-muted-foreground mb-1.5">Valor por tela (R$)</Label>
                <Input value={nc.pricePerScreen} onChange={e => setNc({ ...nc, pricePerScreen: e.target.value })} placeholder="50.00" className="h-9" />
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

      {/* ── Dialog: Aprovar cliente ──────────────────────────────────── */}
      <Dialog open={!!approveDialog} onOpenChange={o => !o && setApproveDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-emerald-400" /> Aprovar cadastro — {approveDialog?.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground py-1">
            Defina o plano inicial do cliente. Ele receberá acesso imediato após aprovação.
          </p>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Plano inicial</Label>
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
                <Label className="text-xs text-muted-foreground mb-1.5">Dias de trial</Label>
                <Input type="number" min={1} max={365} value={approveDays} onChange={e => setApproveDays(e.target.value)} className="h-9" />
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Valor por tela (R$)</Label>
              <Input value={approvePricePerScreen} onChange={e => setApprovePricePerScreen(e.target.value)} placeholder="50.00" className="h-9" />
              <p className="text-xs text-muted-foreground mt-1">O total será calculado automaticamente conforme o cliente cadastrar telas</p>
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
