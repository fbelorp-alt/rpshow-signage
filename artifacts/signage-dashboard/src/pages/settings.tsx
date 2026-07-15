import { Settings, Bell, Globe, Palette, Clock, Shield } from "lucide-react";
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

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="Configuração"
        description="Gerencie as preferências e configurações da sua conta."
      />

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
    </div>
  );
}
