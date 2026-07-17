import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useQuery, useMutation, useQueryClient, useIsFetching } from "@tanstack/react-query";
import { useGetReportSummary, useListSchedules } from "@workspace/api-client-react";
import {
  Users, CreditCard, CheckCircle2, XCircle, Clock, Trash2,
  RefreshCw, ShieldAlert,
  Monitor, UserPlus, LayoutDashboard,
  Bell, CheckCheck, Wifi, WifiOff, Play, Ban,
  CalendarClock, BarChart3, ListVideo, ExternalLink, TrendingUp, HardDrive,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";

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
  storageQuotaGb: number;
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
    case "active":          return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Ativo</Badge>;
    case "trial":           return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Trial</Badge>;
    case "suspended":       return <Badge className="bg-red-100 text-red-700 border-red-200">Suspenso</Badge>;
    case "cancelled":       return <Badge className="bg-gray-100 text-gray-500 border-gray-200">Cancelado</Badge>;
    case "pending_approval":return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Aguardando</Badge>;
    default:                return <Badge className="bg-gray-100 text-muted-foreground">{status}</Badge>;
  }
}

function paymentBadge(status: string) {
  switch (status) {
    case "paid":    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Pago</Badge>;
    case "pending": return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Pendente</Badge>;
    case "overdue": return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Vencido</Badge>;
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
  const isFetching = useIsFetching() > 0;

  // Dialogs
  const [newClientDialog, setNewClientDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<Operator | null>(null);
  const [approveDialog, setApproveDialog] = useState<Operator | null>(null);
  const [quotaDialog, setQuotaDialog] = useState<Operator | null>(null);
  const [quotaValue, setQuotaValue] = useState("5");

  // Approve form
  const [approveStatus, setApproveStatus] = useState("trial");
  const [approveDays, setApproveDays] = useState("30");

  // New client form
  const [nc, setNc] = useState({
    name: "", username: "", password: "", email: "", phone: "",
    subscriptionStatus: "trial", trialDays: "30",
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

  const { data: reportSummary } = useGetReportSummary();
  const { data: schedules = [] } = useListSchedules();

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
      setNc({ name: "", username: "", password: "", email: "", phone: "", subscriptionStatus: "trial", trialDays: "30" });
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

  const updateQuota = useMutation({
    mutationFn: ({ id, gb }: { id: number; gb: number }) =>
      adminFetch(`/api/admin/operators/${id}/storage-quota`, { method: "PATCH", body: JSON.stringify({ storageQuotaGb: gb }) }),
    onSuccess: () => {
      invalidateAll();
      setQuotaDialog(null);
      toast({ title: "Quota atualizada com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao atualizar quota", variant: "destructive" }),
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

  const recentClients = [...operators]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const activeSchedules   = schedules.filter(s => s.active !== false);
  const upcomingSchedules = [...schedules]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description="Visão geral de clientes, telas, agendamentos, financeiro e relatórios"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["admin-operators"] });
                qc.invalidateQueries({ queryKey: ["admin-global-stats"] });
                qc.invalidateQueries({ queryKey: ["admin-screens"] });
                qc.invalidateQueries({ queryKey: ["admin-payments"] });
              }}
              className="gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              {isFetching ? "Atualizando..." : "Atualizar"}
            </Button>
            <Button size="sm" onClick={() => setNewClientDialog(true)} className="gap-2">
              <UserPlus className="w-3.5 h-3.5" /> Novo Cliente
            </Button>
          </>
        }
      />

      {/* Pending approvals alert */}
      {pending.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-semibold text-orange-700">
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
                    onClick={() => { setApproveDialog(op); setApproveStatus("trial"); setApproveDays("30"); }}>
                    <CheckCheck className="w-3 h-3" /> Aprovar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats — assinaturas — cards elegantes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Receita Mensal", sub: "MRR",             value: `R$ ${mrr.toFixed(0)}`,  icon: CreditCard,   accent: "border-l-violet-400", iconBg: "bg-violet-50", iconColor: "text-violet-600" },
          { label: "Clientes",       sub: "Total cadastrado", value: operators.length,         icon: Users,        accent: "border-l-sky-400",    iconBg: "bg-sky-50",    iconColor: "text-sky-600"    },
          { label: "Ativos",         sub: "Assinatura ativa", value: totalActive,              icon: CheckCircle2, accent: "border-l-emerald-400", iconBg: "bg-emerald-50",iconColor: "text-emerald-600"},
          { label: "Em Trial",       sub: "Período gratuito", value: totalTrial,               icon: Clock,        accent: "border-l-amber-400",   iconBg: "bg-amber-50",  iconColor: "text-amber-600"  },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-8 h-8 ${s.iconBg} rounded-lg flex items-center justify-center`}>
                <s.icon className={`w-4 h-4 ${s.iconColor}`} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{s.sub}</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {typeof s.value === "number" ? s.value.toLocaleString("pt-BR") : s.value}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">{s.label}</p>
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
              { label: "Total de Telas",   value: globalStats.totalScreens,  icon: Monitor,       color: "text-blue-600",    bg: "bg-blue-100" },
              { label: "Online agora",     value: globalStats.onlineCount,   icon: Wifi,          color: "text-emerald-600", bg: "bg-emerald-100" },
              { label: "Offline",          value: globalStats.offlineCount,  icon: WifiOff,       color: "text-red-600",     bg: "bg-red-100" },
              { label: "Bloqueadas",       value: globalStats.blockedCount,  icon: Ban,           color: "text-orange-600",  bg: "bg-orange-100" },
              { label: "Exibições hoje",   value: globalStats.playsToday,    icon: Play,          color: "text-violet-600",  bg: "bg-violet-100" },
              { label: "Clientes",         value: globalStats.totalClients,  icon: Users,         color: "text-sky-600",     bg: "bg-sky-100" },
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

      {/* Relatórios / Exibições — global */}
      {reportSummary && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Relatórios de exibições</span>
              <span className="text-[10px] text-muted-foreground ml-1">(todos os clientes)</span>
            </div>
            <Link href="/reports-admin">
              <span className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer">
                Ver relatórios completos <ExternalLink className="w-3 h-3" />
              </span>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x">
            {[
              { label: "Hoje",       value: reportSummary.playsToday,    color: "text-violet-600" },
              { label: "Na semana",  value: reportSummary.playsThisWeek, color: "text-blue-600" },
              { label: "No mês",     value: reportSummary.playsThisMonth,color: "text-emerald-600" },
              { label: "Total geral",value: reportSummary.totalPlays,    color: "text-sky-600" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3 px-4 py-3">
                <TrendingUp className={`w-4 h-4 ${s.color}`} />
                <div>
                  <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value.toLocaleString("pt-BR")}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
          {reportSummary.topMedia.length > 0 && (
            <div className="px-4 py-3 border-t">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Mídias mais exibidas</p>
              <div className="space-y-1.5">
                {reportSummary.topMedia.slice(0, 5).map((m, i) => (
                  <div key={`${m.mediaName}-${i}`} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                      <span className="truncate text-foreground">{m.mediaName}</span>
                      {m.mediaType && <span className="text-[10px] text-muted-foreground shrink-0">{mediaTypeLabel(m.mediaType)}</span>}
                    </div>
                    <span className="text-xs font-medium text-muted-foreground shrink-0 ml-2">{m.playCount.toLocaleString("pt-BR")} exibições</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Duas colunas: Clientes recentes + Agendamentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Clientes recentes */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clientes recentes</span>
            </div>
            <Link href="/users">
              <span className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer">
                Ver todos <ExternalLink className="w-3 h-3" />
              </span>
            </Link>
          </div>
          <div className="divide-y">
            {recentClients.length === 0 && (
              <p className="text-sm text-muted-foreground px-4 py-4">Nenhum cliente cadastrado ainda.</p>
            )}
            {recentClients.map(op => (
              <div key={op.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{op.name}</p>
                  <p className="text-xs text-muted-foreground">
                    @{op.username} · {op.screenCount} tela{op.screenCount !== 1 ? "s" : ""} · {timeAgo(op.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 ml-2 flex items-center gap-2">
                  <button
                    title="Editar quota de armazenamento"
                    onClick={() => { setQuotaDialog(op); setQuotaValue(String(op.storageQuotaGb ?? 5)); }}
                    className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <HardDrive className="w-3 h-3" />
                    {op.storageQuotaGb ?? 5} GB
                  </button>
                  {statusBadge(op.subscriptionStatus)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agendamentos */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agendamentos</span>
              <span className="text-[10px] text-muted-foreground ml-1">
                ({activeSchedules.length} ativo{activeSchedules.length !== 1 ? "s" : ""} de {schedules.length})
              </span>
            </div>
          </div>
          <div className="divide-y">
            {upcomingSchedules.length === 0 && (
              <p className="text-sm text-muted-foreground px-4 py-4">Nenhum agendamento cadastrado ainda.</p>
            )}
            {upcomingSchedules.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0 flex items-center gap-2">
                  <ListVideo className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.name || s.playlistName || "Agendamento"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.screenName ?? "—"} · {s.playlistName ?? "—"}
                    </p>
                  </div>
                </div>
                <Badge className={s.active !== false
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-xs shrink-0 ml-2"
                  : "bg-gray-100 text-gray-500 border-gray-200 text-xs shrink-0 ml-2"}>
                  {s.active !== false ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setApproveDialog(null)}>Cancelar</Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={approveOp.isPending}
              onClick={() => approveOp.mutate({ id: approveDialog!.id, body: { subscriptionStatus: approveStatus, trialDays: parseInt(approveDays) } })}>
              {approveOp.isPending ? "Aprovando..." : "Confirmar aprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Quota de armazenamento ──────────────────────────── */}
      <Dialog open={!!quotaDialog} onOpenChange={o => !o && setQuotaDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" /> Quota de Armazenamento
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground pb-1">
            Defina o limite de armazenamento de mídia para <span className="font-semibold text-foreground">{quotaDialog?.name}</span>.
          </p>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Limite (GB)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={quotaValue}
                  onChange={e => setQuotaValue(e.target.value)}
                  className="h-9"
                />
                <span className="text-sm text-muted-foreground shrink-0">GB</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Padrão: 5 GB. O cliente vê o uso em tempo real na biblioteca de mídia.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[5, 10, 20, 50, 100].map(gb => (
                <button
                  key={gb}
                  onClick={() => setQuotaValue(String(gb))}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    quotaValue === String(gb)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {gb} GB
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setQuotaDialog(null)}>Cancelar</Button>
            <Button
              size="sm"
              disabled={updateQuota.isPending || !quotaValue || parseInt(quotaValue) < 1}
              onClick={() => updateQuota.mutate({ id: quotaDialog!.id, gb: parseInt(quotaValue) })}
            >
              {updateQuota.isPending ? "Salvando..." : "Salvar quota"}
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
