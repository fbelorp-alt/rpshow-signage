import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, CreditCard, CheckCircle2, XCircle, Clock, Trash2,
  ChevronDown, ChevronUp, Plus, RefreshCw, ShieldAlert, Pencil
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
    case "active":
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Ativo</Badge>;
    case "trial":
      return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30">Trial</Badge>;
    case "suspended":
      return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">Suspenso</Badge>;
    case "cancelled":
      return <Badge className="bg-white/10 text-white/40 border-white/15">Cancelado</Badge>;
    default:
      return <Badge className="bg-white/10 text-white/40">{status}</Badge>;
  }
}

function paymentBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Pago</Badge>;
    case "pending":
      return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs">Pendente</Badge>;
    case "overdue":
      return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">Vencido</Badge>;
    default:
      return <Badge className="text-xs">{status}</Badge>;
  }
}

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m!) - 1]} ${y}`;
}

export default function AdminPanel() {
  const { user } = useAuth() as { user: { role?: string } | null };
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [subscriptionDialog, setSubscriptionDialog] = useState<Operator | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<Operator | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Operator | null>(null);

  const [subStatus, setSubStatus] = useState("active");
  const [trialDays, setTrialDays] = useState("30");
  const [monthlyAmount, setMonthlyAmount] = useState("80.00");

  const [payMonth, setPayMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [payStatus, setPayStatus] = useState("paid");
  const [payAmount, setPayAmount] = useState("80.00");
  const [payNotes, setPayNotes] = useState("");

  const { data: operators = [], isLoading } = useQuery<Operator[]>({
    queryKey: ["admin-operators"],
    queryFn: () => fetch("/api/admin/operators", { credentials: "include" }).then(r => r.json()),
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["admin-payments", expandedId],
    queryFn: () =>
      fetch(`/api/admin/operators/${expandedId}/payments`, { credentials: "include" }).then(r => r.json()),
    enabled: expandedId !== null,
  });

  const updateSub = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      fetch(`/api/admin/operators/${id}/subscription`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-operators"] });
      setSubscriptionDialog(null);
      toast({ title: "Assinatura atualizada!" });
    },
  });

  const addPayment = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      fetch(`/api/admin/operators/${id}/payments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payments", paymentDialog?.id] });
      setPaymentDialog(null);
      setPayNotes("");
      toast({ title: "Pagamento registrado!" });
    },
  });

  const deleteOp = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/operators/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-operators"] });
      setDeleteDialog(null);
      toast({ title: "Cliente removido" });
    },
  });

  if ((user as any)?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <ShieldAlert className="w-10 h-10 text-red-400" />
        <p className="text-white/60">Acesso restrito a administradores.</p>
        <Button variant="outline" onClick={() => navigate("/")}>Voltar</Button>
      </div>
    );
  }

  const totalActive = operators.filter(o => o.subscriptionStatus === "active").length;
  const totalTrial = operators.filter(o => o.subscriptionStatus === "trial").length;
  const totalSuspended = operators.filter(o => o.subscriptionStatus === "suspended").length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Painel Administrativo</h1>
          <p className="text-sm text-white/45 mt-0.5">Gestão de clientes e assinaturas</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin-operators"] })} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total clientes", value: operators.length, icon: Users, color: "text-blue-400" },
          { label: "Ativos", value: totalActive, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Em trial", value: totalTrial, icon: Clock, color: "text-yellow-400" },
          { label: "Suspensos", value: totalSuspended, icon: XCircle, color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="bg-white/4 border border-white/10 rounded-xl p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color} flex-shrink-0`} />
            <div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/45">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Clients table */}
      <div className="bg-white/4 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
          <Users className="w-4 h-4 text-white/50" />
          <span className="text-sm font-medium text-white/80">Clientes</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-white/30" />
          </div>
        ) : operators.length === 0 ? (
          <div className="text-center py-16 text-white/30 text-sm">Nenhum cliente cadastrado</div>
        ) : (
          <div className="divide-y divide-white/6">
            {operators.map(op => (
              <div key={op.id}>
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === op.id ? null : op.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{op.name}</span>
                      {op.role === "admin" && (
                        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]">Admin</Badge>
                      )}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">
                      @{op.username} · {op.screenCount} tela{op.screenCount !== 1 ? "s" : ""}
                      {op.email ? ` · ${op.email}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(op.subscriptionStatus)}
                    {op.subscriptionStatus === "trial" && op.trialEndsAt && (
                      <span className="text-xs text-white/35">
                        {Math.max(0, Math.ceil((new Date(op.trialEndsAt).getTime() - Date.now()) / 86400000))}d restantes
                      </span>
                    )}
                    {expandedId === op.id
                      ? <ChevronUp className="w-4 h-4 text-white/30" />
                      : <ChevronDown className="w-4 h-4 text-white/30" />
                    }
                  </div>
                </div>

                {/* Expanded */}
                {expandedId === op.id && (
                  <div className="bg-white/2 border-t border-white/6 px-4 py-4 space-y-4">
                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8 text-xs"
                        onClick={() => {
                          setSubscriptionDialog(op);
                          setSubStatus(op.subscriptionStatus);
                          setTrialDays(String(op.trialDays));
                          setMonthlyAmount(op.monthlyAmount);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Editar assinatura
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => {
                          setPaymentDialog(op);
                          setPayAmount(op.monthlyAmount);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" /> Registrar pagamento
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 ml-auto"
                        onClick={() => setDeleteDialog(op)}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remover
                      </Button>
                    </div>

                    {/* Payments list */}
                    <div>
                      <p className="text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">Histórico de pagamentos</p>
                      {payments.length === 0 ? (
                        <p className="text-xs text-white/25 py-2">Nenhum pagamento registrado</p>
                      ) : (
                        <div className="space-y-1.5">
                          {payments.map(p => (
                            <div key={p.id} className="flex items-center gap-3 bg-white/3 rounded-lg px-3 py-2">
                              <CreditCard className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                              <span className="text-sm text-white/80 flex-1">{formatMonth(p.referenceMonth)}</span>
                              <span className="text-xs text-white/45">R$ {p.amount}</span>
                              {paymentBadge(p.status)}
                              {p.paidAt && (
                                <span className="text-xs text-white/30">
                                  {new Date(p.paidAt).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                              {p.notes && <span className="text-xs text-white/30 truncate max-w-32">{p.notes}</span>}
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

      {/* Subscription dialog */}
      <Dialog open={!!subscriptionDialog} onOpenChange={o => !o && setSubscriptionDialog(null)}>
        <DialogContent className="bg-[#131720] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Editar assinatura — {subscriptionDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-white/60 mb-1.5">Status</Label>
              <Select value={subStatus} onValueChange={setSubStatus}>
                <SelectTrigger className="bg-[#1a1f2e] border-white/15 text-white h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1f2e] border-white/15 text-white">
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {subStatus === "trial" && (
              <div>
                <Label className="text-xs text-white/60 mb-1.5">Dias de trial</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={trialDays}
                  onChange={e => setTrialDays(e.target.value)}
                  className="bg-[#1a1f2e] border-white/15 text-white h-9"
                />
                <p className="text-xs text-white/35 mt-1">O prazo será recalculado a partir de agora</p>
              </div>
            )}

            <div>
              <Label className="text-xs text-white/60 mb-1.5">Valor mensal (R$)</Label>
              <Input
                value={monthlyAmount}
                onChange={e => setMonthlyAmount(e.target.value)}
                className="bg-[#1a1f2e] border-white/15 text-white h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSubscriptionDialog(null)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={() =>
                updateSub.mutate({
                  id: subscriptionDialog!.id,
                  body: {
                    subscriptionStatus: subStatus,
                    trialDays: subStatus === "trial" ? parseInt(trialDays) : undefined,
                    monthlyAmount,
                  },
                })
              }
              disabled={updateSub.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={!!paymentDialog} onOpenChange={o => !o && setPaymentDialog(null)}>
        <DialogContent className="bg-[#131720] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Registrar pagamento — {paymentDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-white/60 mb-1.5">Mês de referência</Label>
              <Input
                type="month"
                value={payMonth}
                onChange={e => setPayMonth(e.target.value)}
                className="bg-[#1a1f2e] border-white/15 text-white h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-white/60 mb-1.5">Status</Label>
              <Select value={payStatus} onValueChange={setPayStatus}>
                <SelectTrigger className="bg-[#1a1f2e] border-white/15 text-white h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1f2e] border-white/15 text-white">
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-white/60 mb-1.5">Valor (R$)</Label>
              <Input
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="bg-[#1a1f2e] border-white/15 text-white h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-white/60 mb-1.5">Observações (opcional)</Label>
              <Input
                value={payNotes}
                onChange={e => setPayNotes(e.target.value)}
                placeholder="Ex: Pago via Banco Cora"
                className="bg-[#1a1f2e] border-white/15 text-white h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPaymentDialog(null)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={() =>
                addPayment.mutate({
                  id: paymentDialog!.id,
                  body: { referenceMonth: payMonth, status: payStatus, amount: payAmount, notes: payNotes || undefined },
                })
              }
              disabled={addPayment.isPending}
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={o => !o && setDeleteDialog(null)}>
        <DialogContent className="bg-[#131720] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Remover cliente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/60 py-2">
            Tem certeza que deseja remover <span className="text-white font-medium">{deleteDialog?.name}</span>?
            Esta ação não pode ser desfeita e apagará todos os dados do cliente.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteDialog(null)}>Cancelar</Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => deleteOp.mutate(deleteDialog!.id)}
              disabled={deleteOp.isPending}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
