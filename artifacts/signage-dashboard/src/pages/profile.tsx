import { User, Mail, Phone, Building2, Calendar, Monitor, CreditCard, Lock, Edit3, Hash, Briefcase } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useQuery } from "@tanstack/react-query";

interface OperatorProfile {
  id: number;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  cnpj: string | null;
  role: string;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  trialDays: number | null;
  pricePerScreen: string | null;
  storageQuotaGb: number | null;
  createdAt: string;
  screenCount?: number;
  jobRole?: string | null;
  segment?: string | null;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active:   { label: "Ativo",     variant: "default" },
  trial:    { label: "Trial",     variant: "secondary" },
  cancelled:{ label: "Cancelado", variant: "destructive" },
  pending_approval: { label: "Aguardando aprovação", variant: "outline" },
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/30 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium mt-0.5 break-all">{value}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin";

  const { data: profile } = useQuery<OperatorProfile>({
    queryKey: ["profile-self"],
    queryFn: () =>
      fetch("/api/auth/user", { credentials: "include" })
        .then(r => { if (!r.ok) throw new Error("Erro ao carregar perfil"); return r.json(); }),
  });

  const displayName = (profile?.name || profile?.username || (user as any)?.name || "Usuário");
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
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        icon={User}
        title="Meu Perfil"
        description="Suas informações pessoais e dados da conta."
      />

      {/* Avatar + nome */}
      <Card className="border-border/50 bg-card/60">
        <CardContent className="pt-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-2xl font-bold text-primary shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold truncate">{displayName}</h2>
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
              <p className="text-sm text-muted-foreground mt-0.5">@{profile?.username ?? (user as any)?.username}</p>
              {trialEndsAt && status === "trial" && (
                <p className="text-xs text-amber-400 mt-1">Trial até {trialEndsAt}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados pessoais */}
      <Card className="border-border/50 bg-card/60">
        <CardContent className="pt-2 pb-2">
          <div className="pt-3 pb-1 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Dados pessoais</span>
          </div>
          <InfoRow icon={Mail}      label="E-mail"    value={profile?.email} />
          <InfoRow icon={Phone}     label="Telefone"  value={profile?.phone} />
          <InfoRow icon={Hash}      label="Login"     value={profile?.username} />
          <InfoRow icon={Building2} label="CNPJ"      value={profile?.cnpj} />
          <InfoRow icon={Briefcase} label="Cargo / Função" value={(profile as any)?.jobRole} />
          <InfoRow icon={Building2} label="Segmento"  value={(profile as any)?.segment} />
          <InfoRow icon={Calendar}  label="Cliente desde" value={createdAt} />
        </CardContent>
      </Card>

      {/* Plano / conta */}
      {!isAdmin && (
        <Card className="border-border/50 bg-card/60">
          <CardContent className="pt-2 pb-2">
            <div className="pt-3 pb-1 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Conta & Plano</span>
            </div>
            <InfoRow icon={Monitor}    label="Telas contratadas" value={profile?.screenCount != null ? String(profile.screenCount) : undefined} />
            <InfoRow icon={CreditCard} label="Valor por tela"    value={profile?.pricePerScreen ? `R$ ${parseFloat(profile.pricePerScreen).toFixed(2).replace(".", ",")}` : undefined} />
            <InfoRow icon={CreditCard} label="Armazenamento"     value={profile?.storageQuotaGb != null ? `${profile.storageQuotaGb} GB` : undefined} />
          </CardContent>
        </Card>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-3">
        <Link href="/security">
          <Button variant="outline" className="gap-2">
            <Lock className="w-4 h-4" />
            Segurança & Senha
          </Button>
        </Link>
        <Link href="/settings">
          <Button variant="outline" className="gap-2">
            <Edit3 className="w-4 h-4" />
            Configurações
          </Button>
        </Link>
      </div>
    </div>
  );
}
