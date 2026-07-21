import React, { useState, useEffect } from "react";
import {
  User, Mail, Phone, Building2, Calendar, Monitor, CreditCard, Lock,
  Hash, Briefcase, Edit3, Check, X, Eye, EyeOff, MessageCircle,
  FileText, IdCard, Shield, ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@workspace/replit-auth-web";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { toast } from "@/hooks/use-toast";

interface OperatorProfile {
  id: number;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  cnpj: string | null;
  cpf: string | null;
  responsible: string | null;
  companyName: string | null;
  jobRole: string | null;
  segment: string | null;
  screenCount: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  trialDays: number | null;
  pricePerScreen: string | null;
  storageQuotaGb: number | null;
  monthlyAmount: string | null;
  createdAt: string;
  totpEnabled: boolean;
  hasGoogleAuth: boolean;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active:           { label: "Ativo",                 variant: "default" },
  trial:            { label: "Trial",                  variant: "secondary" },
  cancelled:        { label: "Cancelado",              variant: "destructive" },
  pending_approval: { label: "Aguardando aprovação",   variant: "outline" },
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium min-h-[1.5rem]">{value || <span className="text-muted-foreground/50 italic">—</span>}</p>
    </div>
  );
}

interface EditableSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
}

function EditableSection({ title, icon: Icon, children, isEditing, onEdit, onCancel, onSave, saving }: EditableSectionProps) {
  return (
    <Card className="border-border/50 bg-card/60">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
              <Icon className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">{title}</span>
          </div>
          {!isEditing ? (
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Edit3 className="w-3 h-3" />
              Editar
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving} className="h-7 gap-1.5 text-xs">
                <X className="w-3 h-3" />
                Cancelar
              </Button>
              <Button size="sm" onClick={onSave} disabled={saving} className="h-7 gap-1.5 text-xs">
                <Check className="w-3 h-3" />
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          )}
        </div>
        <div className="space-y-4">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  editing,
  displayValue,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  editing: boolean;
  displayValue?: string | null;
}) {
  if (!editing) return <Field label={label} value={displayValue ?? value} />;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const isAdmin = (user as { role?: string })?.role === "admin";
  const queryClient = useQueryClient();

  const { data: profile } = useQuery<OperatorProfile>({
    queryKey: ["profile-full"],
    queryFn: () =>
      fetch("/api/auth/profile", { credentials: "include" })
        .then(r => { if (!r.ok) throw new Error("Erro ao carregar perfil"); return r.json(); }),
  });

  // ── Dados Pessoais state ────────────────────────────────────────────────────
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [personalForm, setPersonalForm] = useState({
    name: "", email: "", phone: "", whatsapp: "", jobRole: "", segment: "",
  });

  useEffect(() => {
    if (profile) {
      setPersonalForm({
        name: profile.name ?? "",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        whatsapp: profile.whatsapp ?? "",
        jobRole: profile.jobRole ?? "",
        segment: profile.segment ?? "",
      });
    }
  }, [profile]);

  // ── Dados da Empresa state ──────────────────────────────────────────────────
  const [editingCompany, setEditingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    companyName: "", cnpj: "", cpf: "", responsible: "",
  });

  useEffect(() => {
    if (profile) {
      setCompanyForm({
        companyName: profile.companyName ?? "",
        cnpj: profile.cnpj ?? "",
        cpf: profile.cpf ?? "",
        responsible: profile.responsible ?? "",
      });
    }
  }, [profile]);

  // ── Senha state ─────────────────────────────────────────────────────────────
  const [editingPassword, setEditingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "", newPassword: "", confirmPassword: "",
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Mutations ───────────────────────────────────────────────────────────────
  const patchProfile = useMutation({
    mutationFn: (body: Record<string, string>) =>
      fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Erro ao salvar");
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-full"] });
      queryClient.invalidateQueries({ queryKey: ["profile-self"] });
      toast({ title: "Perfil atualizado", description: "Suas informações foram salvas com sucesso." });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    },
  });

  const patchPassword = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      fetch("/api/auth/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Erro ao alterar senha");
      }),
    onSuccess: () => {
      toast({ title: "Senha alterada", description: "Sua senha foi atualizada com sucesso." });
      setEditingPassword(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  function savePersonal() {
    patchProfile.mutate({
      name: personalForm.name,
      email: personalForm.email,
      phone: personalForm.phone,
      whatsapp: personalForm.whatsapp,
      jobRole: personalForm.jobRole,
      segment: personalForm.segment,
    }, { onSuccess: () => setEditingPersonal(false) });
  }

  function cancelPersonal() {
    if (profile) setPersonalForm({
      name: profile.name ?? "",
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      whatsapp: profile.whatsapp ?? "",
      jobRole: profile.jobRole ?? "",
      segment: profile.segment ?? "",
    });
    setEditingPersonal(false);
  }

  function saveCompany() {
    patchProfile.mutate({
      companyName: companyForm.companyName,
      cnpj: companyForm.cnpj,
      cpf: companyForm.cpf,
      responsible: companyForm.responsible,
    }, { onSuccess: () => setEditingCompany(false) });
  }

  function cancelCompany() {
    if (profile) setCompanyForm({
      companyName: profile.companyName ?? "",
      cnpj: profile.cnpj ?? "",
      cpf: profile.cpf ?? "",
      responsible: profile.responsible ?? "",
    });
    setEditingCompany(false);
  }

  function savePassword() {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Senhas não coincidem", description: "Nova senha e confirmação devem ser iguais.", variant: "destructive" });
      return;
    }
    patchPassword.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  }

  const displayName = profile?.name || profile?.username || (user as { name?: string })?.name || "Usuário";
  const initials = displayName.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();
  const status = profile?.subscriptionStatus ?? null;
  const statusInfo = status ? STATUS_MAP[status] : null;

  const createdAt = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const trialEndsAt = profile?.trialEndsAt
    ? new Date(profile.trialEndsAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader
        icon={User}
        title="Meu Perfil"
        description="Gerencie suas informações pessoais e dados da conta."
      />

      {/* Avatar + nome */}
      <Card className="border-border/50 bg-card/60">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-xl font-bold text-primary shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold truncate">{displayName}</h2>
                {isAdmin && (
                  <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-[10px] uppercase tracking-widest">
                    Administrador
                  </Badge>
                )}
                {statusInfo && !isAdmin && (
                  <Badge variant={statusInfo.variant} className="text-[10px] uppercase tracking-widest">
                    {statusInfo.label}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">@{profile?.username ?? (user as { username?: string })?.username}</p>
              {trialEndsAt && status === "trial" && (
                <p className="text-xs text-amber-400 mt-0.5">Trial até {trialEndsAt}</p>
              )}
              {createdAt && (
                <p className="text-xs text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Cliente desde {createdAt}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados Pessoais */}
      <EditableSection
        title="Dados Pessoais"
        icon={User}
        isEditing={editingPersonal}
        onEdit={() => setEditingPersonal(true)}
        onCancel={cancelPersonal}
        onSave={savePersonal}
        saving={patchProfile.isPending}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Nome completo"
            value={personalForm.name}
            onChange={v => setPersonalForm(f => ({ ...f, name: v }))}
            placeholder="Seu nome completo"
            editing={editingPersonal}
          />
          <InputField
            label="Login"
            value={profile?.username ?? ""}
            onChange={() => {}}
            editing={false}
            displayValue={profile?.username}
          />
          <InputField
            label="E-mail"
            value={personalForm.email}
            onChange={v => setPersonalForm(f => ({ ...f, email: v }))}
            placeholder="seu@email.com"
            type="email"
            editing={editingPersonal}
          />
          <InputField
            label="WhatsApp"
            value={personalForm.whatsapp}
            onChange={v => setPersonalForm(f => ({ ...f, whatsapp: v }))}
            placeholder="(00) 00000-0000"
            editing={editingPersonal}
          />
          <InputField
            label="Telefone"
            value={personalForm.phone}
            onChange={v => setPersonalForm(f => ({ ...f, phone: v }))}
            placeholder="(00) 0000-0000"
            editing={editingPersonal}
          />
          <InputField
            label="Cargo / Função"
            value={personalForm.jobRole}
            onChange={v => setPersonalForm(f => ({ ...f, jobRole: v }))}
            placeholder="Ex: Gerente de Marketing"
            editing={editingPersonal}
          />
          <div className={editingPersonal ? "sm:col-span-2" : ""}>
            <InputField
              label="Segmento"
              value={personalForm.segment}
              onChange={v => setPersonalForm(f => ({ ...f, segment: v }))}
              placeholder="Ex: Varejo, Alimentação, Saúde…"
              editing={editingPersonal}
            />
          </div>
        </div>
      </EditableSection>

      {/* Dados da Empresa */}
      <EditableSection
        title="Dados da Empresa"
        icon={Building2}
        isEditing={editingCompany}
        onEdit={() => setEditingCompany(true)}
        onCancel={cancelCompany}
        onSave={saveCompany}
        saving={patchProfile.isPending}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <InputField
              label="Razão Social / Nome da Empresa"
              value={companyForm.companyName}
              onChange={v => setCompanyForm(f => ({ ...f, companyName: v }))}
              placeholder="Nome da sua empresa"
              editing={editingCompany}
            />
          </div>
          <InputField
            label="Responsável"
            value={companyForm.responsible}
            onChange={v => setCompanyForm(f => ({ ...f, responsible: v }))}
            placeholder="Nome do responsável legal"
            editing={editingCompany}
          />
          <InputField
            label="CPF do Responsável"
            value={companyForm.cpf}
            onChange={v => setCompanyForm(f => ({ ...f, cpf: v }))}
            placeholder="000.000.000-00"
            editing={editingCompany}
          />
          <InputField
            label="CNPJ"
            value={companyForm.cnpj}
            onChange={v => setCompanyForm(f => ({ ...f, cnpj: v }))}
            placeholder="00.000.000/0000-00"
            editing={editingCompany}
          />
        </div>
      </EditableSection>

      {/* Alterar Senha */}
      <Card className="border-border/50 bg-card/60">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                <Lock className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Segurança & Senha</span>
            </div>
            {!editingPassword ? (
              <Button variant="ghost" size="sm" onClick={() => setEditingPassword(true)} className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <Edit3 className="w-3 h-3" />
                Alterar senha
              </Button>
            ) : (
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => { setEditingPassword(false); setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" }); }} disabled={patchPassword.isPending} className="h-7 gap-1.5 text-xs">
                  <X className="w-3 h-3" />
                  Cancelar
                </Button>
                <Button size="sm" onClick={savePassword} disabled={patchPassword.isPending} className="h-7 gap-1.5 text-xs">
                  <Check className="w-3 h-3" />
                  {patchPassword.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            )}
          </div>

          {!editingPassword ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="w-4 h-4" />
                  Senha de acesso
                </div>
                <span className="text-sm font-mono tracking-widest text-muted-foreground/50">••••••••••</span>
              </div>
              {profile?.totpEnabled && (
                <div className="flex items-center justify-between py-2 border-b border-border/30">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="w-4 h-4" />
                    Autenticação de dois fatores
                  </div>
                  <Badge variant="default" className="text-[10px]">Ativo</Badge>
                </div>
              )}
              {profile?.hasGoogleAuth && (
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="w-4 h-4" />
                    Login com Google
                  </div>
                  <Badge variant="outline" className="text-[10px]">Vinculado</Badge>
                </div>
              )}
              <div className="pt-1">
                <Link href="/security">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                    <Shield className="w-3 h-3" />
                    Configurações avançadas
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-w-sm">
              {profile?.hasGoogleAuth && !profile.hasGoogleAuth && (
                <p className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2">
                  Sua conta usa login com Google. Defina uma senha para poder fazer login sem o Google.
                </p>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Senha atual</Label>
                <div className="relative">
                  <Input
                    type={showCurrent ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                    placeholder="Sua senha atual"
                    className="h-8 text-sm pr-9"
                  />
                  <button type="button" onClick={() => setShowCurrent(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nova senha</Label>
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                    placeholder="Mínimo 10 caracteres"
                    className="h-8 text-sm pr-9"
                  />
                  <button type="button" onClick={() => setShowNew(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Confirmar nova senha</Label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="Repita a nova senha"
                    className="h-8 text-sm pr-9"
                  />
                  <button type="button" onClick={() => setShowConfirm(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                  <p className="text-[11px] text-destructive">As senhas não coincidem</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conta & Plano */}
      {!isAdmin && (
        <Card className="border-border/50 bg-card/60">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Conta & Plano</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {profile?.screenCount && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Monitor className="w-3 h-3" />Telas</p>
                  <p className="text-sm font-semibold">{profile.screenCount}</p>
                </div>
              )}
              {profile?.pricePerScreen && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="w-3 h-3" />Por tela</p>
                  <p className="text-sm font-semibold">R$ {parseFloat(profile.pricePerScreen).toFixed(2).replace(".", ",")}</p>
                </div>
              )}
              {profile?.storageQuotaGb != null && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Armazenamento</p>
                  <p className="text-sm font-semibold">{profile.storageQuotaGb} GB</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
