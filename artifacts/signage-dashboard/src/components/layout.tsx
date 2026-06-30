import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Monitor, Image as ImageIcon, ListVideo, CalendarClock, LogOut, ChevronDown, BarChart3, Users, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@workspace/replit-auth-web";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OnboardingWizard } from "@/components/onboarding-wizard";

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
          <img src="/logo.png" alt="RPShow" className="h-16 w-auto object-contain" style={{ maxWidth: "210px" }} />
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
