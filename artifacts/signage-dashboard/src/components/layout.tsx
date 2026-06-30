import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Monitor, Image as ImageIcon, ListVideo, CalendarClock, LogOut, ChevronDown, BarChart3, Users, Activity, Siren, X, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@workspace/replit-auth-web";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useListEmergencyAlerts, useCreateEmergencyAlert, useCancelEmergencyAlert, getListEmergencyAlertsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { OnboardingWizard } from "@/components/onboarding-wizard";

function EmergencyAlertButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [bgColor, setBgColor] = useState("#cc0000");
  const [textColor, setTextColor] = useState("#ffffff");
  const [durationMinutes, setDurationMinutes] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: alerts } = useListEmergencyAlerts();
  const createAlert = useCreateEmergencyAlert();
  const cancelAlert = useCancelEmergencyAlert();

  const active = alerts?.find(a => a.isActive);

  const handleCreate = () => {
    if (!message.trim()) return;
    createAlert.mutate(
      { data: { message: message.trim(), bgColor, textColor, durationMinutes: durationMinutes ? parseInt(durationMinutes) : undefined } },
      {
        onSuccess: () => {
          toast({ title: "Alerta enviado!", description: "Todas as telas exibirão o alerta de emergência." });
          setMessage(""); setOpen(false);
          qc.invalidateQueries({ queryKey: getListEmergencyAlertsQueryKey() });
        },
        onError: () => toast({ title: "Erro ao enviar alerta", variant: "destructive" }),
      }
    );
  };

  const handleCancel = () => {
    if (!active) return;
    cancelAlert.mutate(
      { id: active.id },
      {
        onSuccess: () => {
          toast({ title: "Alerta cancelado" });
          qc.invalidateQueries({ queryKey: getListEmergencyAlertsQueryKey() });
        },
        onError: () => toast({ title: "Erro ao cancelar alerta", variant: "destructive" }),
      }
    );
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-bold transition-all",
          active
            ? "bg-red-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.6)] animate-pulse"
            : "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
        )}
      >
        <Siren className="w-4 h-4 flex-shrink-0" />
        <span>{active ? "🚨 Alerta ATIVO" : "Alerta de Emergência"}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Siren className="w-5 h-5" />
              {active ? "Alerta de Emergência Ativo" : "Novo Alerta de Emergência"}
            </DialogTitle>
          </DialogHeader>

          {active ? (
            <div className="space-y-4">
              <div className="rounded-lg p-4 border border-red-500/40 bg-red-500/10">
                <p className="text-sm text-muted-foreground mb-1">Mensagem atual</p>
                <p className="font-bold text-red-300 text-lg">{active.message}</p>
              </div>
              <p className="text-sm text-muted-foreground">Este alerta está sendo exibido em todas as telas. Clique em Cancelar Alerta para removê-lo.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
                <Button variant="destructive" onClick={handleCancel} disabled={cancelAlert.isPending}>
                  {cancelAlert.isPending ? "Cancelando..." : "Cancelar Alerta"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Mensagem de emergência *</Label>
                <Textarea
                  placeholder="Ex: EVACUE O PRÉDIO IMEDIATAMENTE"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="resize-none h-24 font-bold text-lg uppercase"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Cor de fundo</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-10 h-9 rounded cursor-pointer border border-white/15 bg-transparent" />
                    <Input value={bgColor} onChange={e => setBgColor(e.target.value)} className="font-mono text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Cor do texto</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-10 h-9 rounded cursor-pointer border border-white/15 bg-transparent" />
                    <Input value={textColor} onChange={e => setTextColor(e.target.value)} className="font-mono text-sm" />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Duração (minutos, opcional)</Label>
                <Input type="number" placeholder="Indefinido" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} min={1} />
              </div>
              <div className="rounded-lg p-3 border" style={{ backgroundColor: bgColor, borderColor: bgColor }}>
                <p className="font-bold text-center uppercase" style={{ color: textColor, fontSize: 18 }}>
                  {message || "Pré-visualização da mensagem"}
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={handleCreate} disabled={!message.trim() || createAlert.isPending}>
                  {createAlert.isPending ? "Enviando..." : "🚨 Enviar Alerta"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AppLayout({ children, fullscreen = false }: { children: React.ReactNode; fullscreen?: boolean }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const extUser = user as (typeof user & { onboardingDone?: boolean }) | null;
  const showOnboarding = !onboardingDismissed && extUser && extUser.onboardingDone === false;

  const handleOnboardingComplete = async (data: { jobRole: string; segment: string; screenCount: string }) => {
    setOnboardingDismissed(true);
    try {
      await fetch("/api/auth/onboarding", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch { }
  };

  const handleOnboardingSkip = () => setOnboardingDismissed(true);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/screens", label: "Minhas Telas", icon: Monitor },
    { href: "/monitoring", label: "Monitoramento", icon: Activity },
    { href: "/media", label: "Biblioteca de Mídia", icon: ImageIcon },
    { href: "/playlists", label: "Playlists", icon: ListVideo },
    { href: "/schedules", label: "Agendamento", icon: CalendarClock },
    { href: "/reports", label: "Relatórios", icon: BarChart3 },
    { href: "/security", label: "Segurança", icon: ShieldCheck },
  ];

  const adminItems = [
    { href: "/users", label: "Usuários", icon: Users },
  ];

  const displayName = user?.name || user?.username || "Usuário";

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/20">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col text-sidebar-foreground shadow-xl z-10">
        <div className="h-20 flex items-center justify-center px-4 border-b border-sidebar-border bg-black/20">
          <img src="/logo-rpshow.png" alt="RPShow onSign" className="h-16 w-auto object-contain" style={{ maxWidth: "220px" }} />
        </div>

        <div className="px-5 py-4 border-b border-sidebar-border/50 bg-black/10">
          <div className="text-[10px] font-mono font-bold text-sidebar-foreground/50 tracking-widest uppercase mb-1">System Status</div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            <span className="text-xs font-mono font-bold text-emerald-400">OPERATIONAL</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(var(--primary),0.3)]"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className={cn("w-4 h-4", isActive ? "text-white" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground")} />
                {item.label}
              </Link>
            );
          })}

          {user?.role === "admin" && (
            <>
              <div className="pt-3 pb-1 px-3">
                <span className="text-[9px] font-bold text-sidebar-foreground/30 uppercase tracking-widest">Administração</span>
              </div>
              {adminItems.map((item) => {
                const isActive = location === item.href || location.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all group",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(var(--primary),0.3)]"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className={cn("w-4 h-4", isActive ? "text-white" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground")} />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Emergency alert button */}
        <div className="px-3 pb-3">
          <EmergencyAlertButton />
        </div>

        {/* User menu at bottom */}
        <div className="px-3 py-4 border-t border-sidebar-border/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all">
                <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                  {displayName[0]?.toUpperCase()}
                </div>
                <span className="flex-1 text-left truncate">{displayName}</span>
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-[0.015] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
        {fullscreen ? (
          <div className="flex-1 overflow-hidden relative z-10 flex flex-col">
            {children}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-10">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </div>
        )}
      </main>
      {showOnboarding && (
        <OnboardingWizard onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />
      )}
    </div>
  );
}
