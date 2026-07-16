import { Settings, Bell, Globe, Palette, Clock, Shield, Activity, Play, Sun, Power, Volume2, RefreshCw, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

const sections = [
  {
    icon: Shield,
    label: "Segurança",
    description: "Senha, autenticação em dois fatores e dispositivos confiáveis.",
    href: "/security",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Bell,
    label: "Notificações",
    description: "Em breve — preferências de alertas e e-mails.",
    href: "#",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    soon: true,
  },
  {
    icon: Globe,
    label: "Fuso Horário",
    description: "Em breve — configurar o fuso horário padrão das telas.",
    href: "#",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    soon: true,
  },
  {
    icon: Palette,
    label: "Aparência",
    description: "Em breve — tema e preferências visuais do painel.",
    href: "#",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    soon: true,
  },
  {
    icon: Clock,
    label: "Agendamento Padrão",
    description: "Em breve — horário padrão para novas campanhas.",
    href: "#",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    soon: true,
  },
];

const playerControls = [
  {
    icon: Activity,
    label: "Monitoramento",
    description: "Visualize o status e screenshots das telas em tempo real.",
    href: "/monitoring",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    icon: Play,
    label: "Reprodução",
    description: "Gerencie o conteúdo em reprodução nas telas.",
    href: "/screens",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Sun,
    label: "Brilho",
    description: "Controle o nível de brilho dos painéis LED.",
    href: "/brightness",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: Power,
    label: "Liga / Desliga",
    description: "Agende o horário de ligação e desligamento automático das telas.",
    href: "/schedules",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    icon: Volume2,
    label: "Volume",
    description: "Em breve — controle remoto do volume das telas.",
    href: "#",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    soon: true,
  },
  {
    icon: RefreshCw,
    label: "Reiniciar",
    description: "Em breve — reinicialização remota dos players.",
    href: "#",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    soon: true,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={Settings}
        title="Configuração"
        description="Gerencie as preferências e configurações da sua conta."
      />

      {/* ── Preferências ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((s) => {
          const inner = (
            <Card className={`relative border-border/50 bg-card/60 hover:bg-card transition-colors ${s.soon ? "opacity-60 cursor-default" : "cursor-pointer hover:border-primary/30"}`}>
              {s.soon && (
                <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  Em breve
                </span>
              )}
              <CardHeader className="pb-2">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-2`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <CardTitle className="text-sm font-semibold">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs leading-relaxed">{s.description}</CardDescription>
              </CardContent>
            </Card>
          );

          return s.soon ? (
            <div key={s.label}>{inner}</div>
          ) : (
            <Link key={s.label} href={s.href}>{inner}</Link>
          );
        })}
      </div>

      {/* ── Controles do Player ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-primary" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Controles do Player</h2>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/60 divide-y divide-border/40 overflow-hidden">
          {playerControls.map((c) => {
            const inner = (
              <div className={`flex items-center gap-4 px-4 py-3.5 transition-colors ${c.soon ? "opacity-50 cursor-default" : "hover:bg-muted/30 cursor-pointer"}`}>
                <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
                  <c.icon className={`w-4 h-4 ${c.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.label}</span>
                    {c.soon && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        Em breve
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.description}</p>
                </div>
                {!c.soon && <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
              </div>
            );

            return c.soon ? (
              <div key={c.label}>{inner}</div>
            ) : (
              <Link key={c.label} href={c.href}>{inner}</Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
