import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Monitor, Image as ImageIcon, ListVideo, CalendarClock, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/clients", label: "Clients", icon: Users },
    { href: "/screens", label: "Screens", icon: Monitor },
    { href: "/media", label: "Media Library", icon: ImageIcon },
    { href: "/playlists", label: "Playlists", icon: ListVideo },
    { href: "/schedules", label: "Broadcast Schedule", icon: CalendarClock },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/20">
      {/* Sidebar - Control Panel Vibe */}
      <aside className="w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col text-sidebar-foreground shadow-xl z-10">
        <div className="h-16 flex items-center px-5 border-b border-sidebar-border bg-black/20">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="RPShow" className="h-10 w-auto object-contain" />
            <div className="flex flex-col leading-none">
              <span className="text-[11px] font-mono font-bold text-sidebar-foreground/40 tracking-widest uppercase">Signage-on</span>
            </div>
          </div>
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
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-[0.015] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
        <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
