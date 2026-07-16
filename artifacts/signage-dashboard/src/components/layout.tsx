import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Monitor, Image as ImageIcon, ListVideo, CalendarClock, LogOut, ChevronDown, BarChart3, Users, Activity, Siren, X, ShieldCheck, CreditCard, Cpu, Film, Menu, Sun, Volume2, RefreshCw, Power, Play, Wifi, Megaphone, ScrollText, Building2, MapPin, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@workspace/replit-auth-web";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
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
            : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
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
  const [reportsExpanded, setReportsExpanded] = useState(true);
  const [operReportsExpanded, setOperReportsExpanded] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  const isAdmin = user?.role === "admin";

  // Items shown only to operators/clients
  const operatorNavItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/screens", label: "Minhas Telas", icon: Monitor },
    { href: "/media", label: "Biblioteca de Mídia", icon: ImageIcon },
    { href: "/playlists", label: "Playlists", icon: ListVideo },
    { href: "/campaigns", label: "Campanhas", icon: Megaphone },
    { href: "/schedules", label: "Agendamento", icon: CalendarClock },
  ];

  const operatorReportsChildren = [
    { href: "/reports", label: "Relatórios", icon: BarChart3 },
    { href: "/logs", label: "Logs de Atividade", icon: ScrollText },
  ];

  const operatorBottomItems = [
    { href: "/locais", label: "Locais", icon: MapPin },
    { href: "/financeiro", label: "Financeiro", icon: CreditCard },
    { href: "/banner-editor", label: "Mídia Edit", icon: Film },
  ];

  const operatorSystemItems = [
    { href: "/security", label: "Segurança", icon: ShieldCheck },
    { href: "/settings", label: "Configuração", icon: Settings },
  ];

  // Items shown only to admin (full management access)
  const adminNavItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/users", label: "Clientes", icon: Users },
    { href: "/devices", label: "Telas", icon: Monitor },
    { href: "/monitoring", label: "Monitoramento Telas", icon: Activity },
    { href: "/financeiro-admin", label: "Financeiro", icon: CreditCard },
    { href: "/security-admin", label: "Segurança", icon: ShieldCheck },
  ];

  const adminReportChildren = [
    { href: "/reports-admin", label: "Telas" },
    { href: "/reports-admin/clientes", label: "Clientes" },
    { href: "/reports-admin/financeiro", label: "Financeiro" },
    { href: "/reports-admin/campanhas", label: "Campanhas" },
  ];

  const displayName = user?.name || user?.username || "Usuário";

  const closeMobileNav = () => setMobileNavOpen(false);

  const sidebarInner = (
    <>
        <div className="flex flex-col items-center justify-center px-4 py-3 border-b border-sidebar-border bg-black/20">
          <div className="overflow-hidden w-full flex justify-center" style={{ height: "46px" }}>
            <img src="/logo-rpshow.png" alt="RPShow onSign" className="object-top" style={{ height: "84px", maxWidth: "240px", objectFit: "cover", objectPosition: "top" }} />
          </div>
          <p className="text-[9px] font-bold text-white/30 tracking-[0.2em] uppercase mt-1">Sistemas Integrados</p>
          <p className="text-[8px] text-white/20 tracking-wide mt-0.5">www.rpshow.com.br</p>
        </div>

        {/* ── Indicador de papel (Admin vs Operador) ── */}
        {isAdmin ? (
          <div className="flex items-center justify-center gap-2 px-4 py-2 border-b border-amber-500/40 bg-amber-500/15">
            <Cpu className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest">Modo Administrador</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 px-4 py-2 border-b border-emerald-500/30 bg-emerald-500/10">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">Painel do Operador</span>
          </div>
        )}

        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          {isAdmin ? (
            /* ── Admin: only management items ── */
            <>
              <div className="pb-1 px-3">
                <span className="text-[9px] font-bold text-sidebar-foreground/30 uppercase tracking-widest">Administração</span>
              </div>
              {adminNavItems.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobileNav}
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

              {/* Relatórios — expandable parent with sub-items */}
              <div>
                <button
                  type="button"
                  onClick={() => setReportsExpanded((v) => !v)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all group",
                    location.startsWith("/reports-admin")
                      ? "text-sidebar-accent-foreground bg-sidebar-accent/60"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <BarChart3 className="w-4 h-4 text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground" />
                  <span className="flex-1 text-left">Relatórios</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 opacity-60 transition-transform", reportsExpanded && "rotate-180")} />
                </button>
                {reportsExpanded && (
                  <div className="mt-1 ml-4 pl-3 border-l border-sidebar-border/50 space-y-1">
                    {adminReportChildren.map((child) => {
                      const isActive = location === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={closeMobileNav}
                          className={cn(
                            "block px-3 py-2 rounded text-sm font-medium transition-all",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(var(--primary),0.3)]"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Campanhas */}
              {(() => {
                const isActive = location === "/campaigns";
                return (
                  <Link
                    href="/campaigns"
                    onClick={closeMobileNav}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all group",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(var(--primary),0.3)]"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Megaphone className={cn("w-4 h-4", isActive ? "text-white" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground")} />
                    Campanhas
                  </Link>
                );
              })()}

              {/* Locais */}
              {(() => {
                const isActive = location === "/locais";
                return (
                  <Link
                    href="/locais"
                    onClick={closeMobileNav}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all group",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(var(--primary),0.3)]"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <MapPin className={cn("w-4 h-4", isActive ? "text-white" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground")} />
                    Locais
                  </Link>
                );
              })()}
            </>
          ) : (
            /* ── Operator: full operational menu ── */
            <>
              {/* Main nav items */}
              {operatorNavItems.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobileNav}
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

              {/* Relatórios / Clientes / Logs — expandable group */}
              <div>
                <button
                  type="button"
                  onClick={() => setOperReportsExpanded((v) => !v)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all group",
                    ["/reports", "/clientes", "/logs"].some(p => location.startsWith(p))
                      ? "text-sidebar-accent-foreground bg-sidebar-accent/60"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <BarChart3 className="w-4 h-4 text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground" />
                  <span className="flex-1 text-left">Relatórios</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 opacity-60 transition-transform", operReportsExpanded && "rotate-180")} />
                </button>
                {operReportsExpanded && (
                  <div className="mt-1 ml-4 pl-3 border-l border-sidebar-border/50 space-y-1">
                    {operatorReportsChildren.map((child) => {
                      const isActive = location === child.href || location.startsWith(child.href + "/");
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={closeMobileNav}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-all group",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(var(--primary),0.3)]"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <child.icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-sidebar-foreground/40 group-hover:text-sidebar-accent-foreground")} />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Locais · Financeiro · Mídia Edit */}
              {operatorBottomItems.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobileNav}
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

              {/* ── Sistema ── */}
              <div className="pt-3 pb-1 px-3">
                <span className="text-[9px] font-bold text-sidebar-foreground/30 uppercase tracking-widest">Sistema</span>
              </div>
              {operatorSystemItems.map((item) => {
                const isActive = location === item.href || location.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobileNav}
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
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/20">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar flex-col text-sidebar-foreground shadow-xl z-10">
        {sidebarInner}
      </aside>

      {/* Sidebar — mobile drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground border-sidebar-border flex flex-col">
          {sidebarInner}
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-sidebar-border bg-sidebar text-sidebar-foreground shrink-0 relative z-10">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="p-1.5 rounded hover:bg-sidebar-accent"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img src="/logo-rpshow.png" alt="RPShow onSign" className="h-6 object-contain" />
        </div>
        <div className="absolute inset-0 pointer-events-none opacity-[0.015] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
        {fullscreen ? (
          <div className="flex-1 overflow-hidden relative z-10 flex flex-col">
            {children}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto relative z-10 flex flex-col">
            <div className="flex-1 p-6 md:p-8">
              {children}
            </div>
            <footer className="shrink-0 px-6 md:px-8 py-3 border-t border-border/30">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] text-muted-foreground/80">
                <span className="font-medium tracking-wide">RPShow · Sistemas Integrados</span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
                  <span>Rua Marechal Deodoro, 319 — Centro, Ribeirão Preto SP 14010-190</span>
                  <a href="https://wa.me/551639001809" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground/70 transition-colors">(16) 3900-1809</a>
                  <a href="mailto:contato@rpshow.com.br" className="hover:text-muted-foreground/70 transition-colors">contato@rpshow.com.br</a>
                </div>
              </div>
            </footer>
          </div>
        )}
      </main>
      {showOnboarding && !isAdmin && (
        <OnboardingWizard onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />
      )}
    </div>
  );
}
