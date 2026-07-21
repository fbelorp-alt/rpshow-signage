import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Monitor, Image as ImageIcon, ListVideo, LayoutList,
  Megaphone, CalendarClock, BarChart3, MapPin, CreditCard,
  HelpCircle, ChevronRight, BookOpen, Lightbulb, AlertCircle,
  Upload, Play, Eye, Settings, Clock, Wifi, Film, Radio,
  Users, Shield, Zap, HardDrive, Grid3X3, Bell, Layers,
  TrendingUp, CheckCircle2, Star, Smartphone, Send, Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

// ─── Mockup components ───────────────────────────────────────────────────────

function MockupFrame({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="my-3 rounded-xl border-2 border-border overflow-hidden shadow-lg">
      {/* Browser bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/80 border-b border-border">
        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <div className="flex-1 mx-2 h-5 rounded-md bg-muted flex items-center px-2">
          <span className="text-[9px] text-muted-foreground">app.rpshow.com.br{label ? `/${label}` : ""}</span>
        </div>
      </div>
      <div className="bg-background">{children}</div>
    </div>
  );
}

function DashboardMockup() {
  return (
    <MockupFrame label="dashboard">
      <div className="flex h-56">
        {/* Sidebar */}
        <div className="w-36 bg-[#0f1923] border-r border-white/10 flex flex-col py-3 px-2 gap-1 shrink-0">
          <div className="h-6 rounded bg-white/10 mb-2" />
          {["Dashboard", "Telas", "Mídia", "Playlists", "Publicação"].map((l, i) => (
            <div key={l} className={cn("h-7 rounded flex items-center px-2 gap-1.5", i === 0 ? "bg-[#79B4B0]" : "bg-white/5")}>
              <div className="w-2.5 h-2.5 rounded-sm bg-white/40 shrink-0" />
              <span className="text-[9px] text-white/70">{l}</span>
            </div>
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 p-3 overflow-hidden">
          <p className="text-[10px] font-bold mb-2 text-foreground/80">Visão Geral — Hoje</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: "Telas online", value: "12", color: "text-emerald-500" },
              { label: "Exibições hoje", value: "1.847", color: "text-primary" },
              { label: "Tempo em ar", value: "98h", color: "text-blue-500" },
              { label: "Alertas", value: "0", color: "text-muted-foreground" },
            ].map(k => (
              <div key={k.label} className="rounded-lg border bg-muted/30 p-2">
                <p className="text-[8px] text-muted-foreground">{k.label}</p>
                <p className={cn("text-sm font-black", k.color)}>{k.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {/* Chart bar */}
            <div className="col-span-2 rounded-lg border bg-muted/20 p-2">
              <p className="text-[8px] text-muted-foreground mb-1">Exibições por dia</p>
              <div className="flex items-end gap-1 h-14">
                {[40, 65, 45, 80, 60, 90, 75].map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 6 ? "#79B4B0" : "hsl(176 28% 59% / 0.35)" }} />
                ))}
              </div>
            </div>
            {/* Top media */}
            <div className="rounded-lg border bg-muted/20 p-2">
              <p className="text-[8px] text-muted-foreground mb-1.5">Top Mídias</p>
              {["Promoção Julho", "Institucional", "Cardápio"].map((m, i) => (
                <div key={m} className="flex items-center gap-1 mb-1">
                  <span className="text-[7px] text-muted-foreground w-3">{i + 1}°</span>
                  <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full bg-primary/70 rounded-full" style={{ width: `${90 - i * 22}%` }} />
                  </div>
                  <span className="text-[7px] text-foreground/60 w-10 truncate">{m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}

function MonitoringMockup() {
  const screens = [
    { name: "Recepção", status: "online" }, { name: "Sala Espera", status: "online" },
    { name: "Hall Entrada", status: "offline" }, { name: "Refeitório", status: "online" },
    { name: "Corredor A", status: "online" }, { name: "Loja Norte", status: "online" },
  ];
  return (
    <MockupFrame label="monitoring">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-foreground/80">Central de Monitoramento</span>
          <div className="flex gap-1">
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-semibold">5 Online</span>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-600 font-semibold">1 Offline</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {screens.map(s => (
            <div key={s.name} className={cn("rounded-lg border p-2", s.status === "online" ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-400/30 bg-red-500/5")}>
              <div className={cn("w-full rounded aspect-video mb-1.5 flex items-center justify-center text-[8px] font-semibold", s.status === "online" ? "bg-emerald-900/30 text-emerald-400" : "bg-red-900/20 text-red-400")}>
                {s.status === "online" ? "▶ Ao vivo" : "⚠ Offline"}
              </div>
              <div className="flex items-center gap-1">
                <div className={cn("w-1.5 h-1.5 rounded-full", s.status === "online" ? "bg-emerald-500" : "bg-red-500")} />
                <span className="text-[8px] text-foreground/70 truncate">{s.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

function PlaylistMockup() {
  const items = [
    { name: "Promoção Verão.mp4", dur: "30s", type: "vídeo" },
    { name: "Logo Institucional.png", dur: "10s", type: "imagem" },
    { name: "Cardápio do Dia.jpg", dur: "15s", type: "imagem" },
    { name: "Widget — Relógio", dur: "∞", type: "widget" },
  ];
  return (
    <MockupFrame label="playlists">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-foreground/80">Promoções Julho — Editor</span>
          <div className="h-5 px-2 rounded bg-primary text-primary-foreground text-[8px] font-bold flex items-center">Salvar</div>
        </div>
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
              <div className="w-5 text-[9px] text-muted-foreground font-mono">{i + 1}</div>
              <div className={cn("w-8 h-6 rounded flex items-center justify-center text-[8px] font-bold shrink-0",
                item.type === "vídeo" ? "bg-blue-500/20 text-blue-500" :
                item.type === "widget" ? "bg-amber-500/20 text-amber-500" : "bg-purple-500/20 text-purple-500"
              )}>
                {item.type === "vídeo" ? "▶" : item.type === "widget" ? "⏱" : "🖼"}
              </div>
              <span className="flex-1 text-[9px] text-foreground/80 truncate">{item.name}</span>
              <span className="text-[8px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">{item.dur}</span>
              <div className="w-3 text-muted-foreground text-[9px]">⠿</div>
            </div>
          ))}
        </div>
        <p className="text-[8px] text-muted-foreground mt-2 pl-1">↕ Arraste para reordenar · Clique no tempo para editar</p>
      </div>
    </MockupFrame>
  );
}

function CampaignMockup() {
  return (
    <MockupFrame label="campanhas">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold">Campanha: Black Friday — Cliente XYZ</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-semibold">● Ativa</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {[{ l: "Telas", v: "8" }, { l: "Exibições", v: "4.290" }, { l: "Período", v: "25–30/11" }].map(k => (
            <div key={k.l} className="rounded border bg-muted/30 p-1.5 text-center">
              <p className="text-[7px] text-muted-foreground">{k.l}</p>
              <p className="text-xs font-bold text-primary">{k.v}</p>
            </div>
          ))}
        </div>
        {/* Proof row */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold text-foreground">Prova de Exibição</p>
            <p className="text-[8px] text-muted-foreground">PDF formatado para envio ao cliente</p>
          </div>
          <div className="flex gap-1">
            <div className="h-5 px-2 rounded bg-muted text-[7px] font-bold flex items-center text-foreground/70">CSV</div>
            <div className="h-5 px-2 rounded bg-primary text-primary-foreground text-[7px] font-bold flex items-center">🖨 Imprimir</div>
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}

function EmergencyMockup() {
  return (
    <MockupFrame label="alertas">
      <div className="relative p-3 bg-black/80">
        {/* Background "content playing" */}
        <div className="rounded-lg overflow-hidden border border-white/10 h-28 bg-gradient-to-br from-blue-900/40 to-purple-900/40 flex items-center justify-center">
          <span className="text-[10px] text-white/30">Conteúdo normal em exibição…</span>
        </div>
        {/* Emergency overlay */}
        <div className="absolute inset-3 rounded-lg border-4 border-red-500 bg-red-950/95 flex flex-col items-center justify-center gap-1 animate-pulse">
          <div className="text-lg">🚨</div>
          <p className="text-[11px] font-black text-red-300 uppercase tracking-widest">Alerta de Emergência</p>
          <p className="text-[9px] text-red-200 text-center px-4">Saída de emergência — Ala B em manutenção. Utilize a saída principal.</p>
          <span className="text-[8px] text-red-400 mt-1">Enviado às 14:23 · Em todas as telas</span>
        </div>
      </div>
    </MockupFrame>
  );
}

function WidgetsMockup() {
  return (
    <MockupFrame label="midia">
      <div className="p-3">
        <p className="text-[10px] font-bold mb-2 text-foreground/80">Galeria de Aplicativos e Widgets</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: "🕐", name: "Relógio Digital", color: "bg-blue-500/10 border-blue-500/30" },
            { icon: "🌤", name: "Clima / Temperatura", color: "bg-sky-500/10 border-sky-500/30" },
            { icon: "📰", name: "Feed RSS / Ticker", color: "bg-amber-500/10 border-amber-500/30" },
            { icon: "▶", name: "YouTube", color: "bg-red-500/10 border-red-500/30" },
            { icon: "📊", name: "Google Slides", color: "bg-orange-500/10 border-orange-500/30" },
            { icon: "⏳", name: "Contador Regressivo", color: "bg-purple-500/10 border-purple-500/30" },
          ].map(w => (
            <div key={w.name} className={cn("rounded-lg border p-2 flex flex-col items-center gap-1", w.color)}>
              <span className="text-lg">{w.icon}</span>
              <span className="text-[8px] text-center text-foreground/70 font-medium leading-tight">{w.name}</span>
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

function GroupsMockup() {
  return (
    <MockupFrame label="grupos">
      <div className="p-3">
        <p className="text-[10px] font-bold mb-2 text-foreground/80">Grupos de Telas</p>
        <div className="space-y-2">
          {[
            { name: "Rede Norte", telas: 5, cor: "bg-blue-500/10 border-blue-400/30" },
            { name: "Lojas Sul", telas: 3, cor: "bg-emerald-500/10 border-emerald-400/30" },
          ].map(g => (
            <div key={g.name} className={cn("rounded-lg border p-2", g.cor)}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-bold text-foreground/80">{g.name}</span>
                <span className="text-[8px] text-muted-foreground">{g.telas} telas</span>
              </div>
              <div className="flex gap-1">
                {Array(g.telas).fill(0).map((_, i) => (
                  <div key={i} className="w-8 h-6 rounded bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <Monitor className="w-3 h-3 text-primary/60" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-lg border border-dashed border-primary/30 p-2 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span className="text-[8px] text-muted-foreground">Publicar em "Rede Norte" atualiza as 5 telas de uma vez</span>
        </div>
      </div>
    </MockupFrame>
  );
}

function ReportsMockup() {
  return (
    <MockupFrame label="reports">
      <div className="flex h-52">
        {/* Sub-sidebar */}
        <div className="w-32 border-r bg-muted/30 p-2 space-y-0.5">
          <p className="text-[7px] text-muted-foreground uppercase tracking-widest px-1 mb-1">Relatórios</p>
          {["Visão Geral", "Exibições", "Campanhas", "Clientes", "Por Tela", "Top Mídias", "Disponibilidade"].map((l, i) => (
            <div key={l} className={cn("h-5 rounded px-2 flex items-center", i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              <span className="text-[8px]">{l}</span>
            </div>
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 p-2 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-foreground/80">Visão Geral</span>
            <div className="flex gap-1">
              <div className="h-4 px-1.5 rounded bg-muted border text-[7px] flex items-center">CSV</div>
              <div className="h-4 px-1.5 rounded bg-primary text-primary-foreground text-[7px] flex items-center">Imprimir</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 mb-2">
            {[{ l: "Total Plays", v: "24.180" }, { l: "Telas Ativas", v: "14" }].map(k => (
              <div key={k.l} className="rounded border bg-muted/30 p-1.5">
                <p className="text-[7px] text-muted-foreground">{k.l}</p>
                <p className="text-xs font-bold text-primary">{k.v}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border bg-muted/20 p-1.5">
            <p className="text-[7px] text-muted-foreground mb-1">Últimos 7 dias</p>
            <div className="flex items-end gap-0.5 h-10">
              {[50, 70, 45, 85, 60, 90, 75].map((h, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: "hsl(176 28% 59% / 0.5)" }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}

function SecurityMockup() {
  return (
    <MockupFrame label="security">
      <div className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-bold text-foreground/80">Segurança da Conta</span>
        </div>
        <div className="space-y-2">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold text-emerald-600">Autenticação 2FA</p>
              <p className="text-[8px] text-muted-foreground">Google Authenticator / Authy</p>
            </div>
            <div className="h-5 px-2 rounded-full bg-emerald-500 text-white text-[7px] font-bold flex items-center">✓ Ativo</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2">
            <p className="text-[9px] font-bold mb-1.5 text-foreground/80">Dispositivos confiáveis</p>
            {["Chrome · Windows · São Paulo", "Safari · iPhone · Rio de Janeiro"].map((d, i) => (
              <div key={i} className="flex items-center justify-between py-0.5">
                <span className="text-[8px] text-muted-foreground">{d}</span>
                <span className="text-[7px] text-red-400 cursor-pointer">Remover</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}

// ─── Section definitions ──────────────────────────────────────────────────────
const sections = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    title: "Dashboard — Visão Geral",
    intro: "A tela inicial apresenta um resumo em tempo real de tudo que está acontecendo com as suas telas e conteúdos.",
    items: [
      { type: "mockup", component: "dashboard" },
      {
        type: "cards",
        label: "Indicadores principais",
        content: [
          { icon: Monitor,   label: "Telas ativas",       desc: "Quantas telas estão com conteúdo publicado e online no momento." },
          { icon: Play,      label: "Exibições hoje",     desc: "Total de vezes que algum conteúdo foi exibido no dia atual." },
          { icon: Clock,     label: "Tempo em ar",        desc: "Horas acumuladas de exibição nas telas no dia." },
          { icon: Wifi,      label: "Online / Offline",   desc: "Status atual de cada dispositivo registrado na sua conta." },
        ],
      },
      {
        type: "steps",
        label: "O que verificar todo dia",
        steps: [
          "Confira se todas as telas aparecem como Online (ponto verde).",
          "Veja os gráficos de exibições — quedas bruscas podem indicar tela desligada.",
          "Confira o Top 5 Conteúdos para saber quais mídias estão sendo mais exibidas.",
          "Se houver algum alerta (ícone laranja), clique para investigar.",
        ],
      },
      { type: "tip", content: "Se uma tela aparecer Offline por mais de 15 minutos, verifique a conexão de internet do local. O dispositivo envia heartbeat a cada 30 segundos." },
    ],
  },
  {
    id: "telas",
    label: "Minhas Telas",
    icon: Monitor,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    title: "Minhas Telas",
    intro: "Gerenciamento completo dos dispositivos de exibição. Cada tela é um dispositivo físico (TV, tablet, totem, painel LED) registrado no sistema.",
    items: [
      {
        type: "steps",
        label: "Como adicionar uma nova tela",
        steps: [
          'Acesse o menu lateral → "Minhas Telas" → clique em "+ Nova Tela".',
          "Informe o nome da tela (ex.: Recepção Loja Centro) e o número de série do dispositivo.",
          "No dispositivo físico, abra o app RPShow TV e anote o código de 6 dígitos exibido na tela.",
          "Insira esse código no sistema para vincular o dispositivo.",
          "A tela aparecerá como Online em poucos segundos.",
        ],
      },
      {
        type: "cards",
        label: "Ações disponíveis por tela",
        content: [
          { icon: Eye,       label: "Monitorar",     desc: "Ver status em tempo real, última conexão e screenshot da tela." },
          { icon: Play,      label: "Publicar",       desc: "Enviar uma playlist para a tela imediatamente." },
          { icon: Settings,  label: "Configurar",     desc: "Ajustar resolução, rotação, brilho e outras opções do dispositivo." },
          { icon: BarChart3, label: "Relatórios",     desc: "Ver histórico de exibições específico desta tela." },
        ],
      },
      { type: "tip", content: 'Dê nomes descritivos às telas: inclua o local e a posição (ex.: "Shopping Norte — Entrada Principal"). Facilita muito na hora de publicar e gerar relatórios.' },
    ],
  },
  {
    id: "monitoramento",
    label: "Monitoramento",
    icon: Radio,
    color: "text-sky-500",
    bg: "bg-sky-500/10",
    title: "Monitoramento em Tempo Real",
    intro: "Central visual de todas as telas da conta. Veja o status online/offline, a última atividade e até uma prévia do conteúdo sendo exibido agora — tudo em uma só tela.",
    items: [
      { type: "mockup", component: "monitoring" },
      {
        type: "cards",
        label: "O que você vê em cada card de tela",
        content: [
          { icon: Wifi,     label: "Status Online/Offline", desc: "Ponto verde = ativa. Ponto vermelho = offline. Exibe há quantas horas está desconectada." },
          { icon: Eye,      label: "Preview ao vivo",       desc: "Screenshot automático tirado a cada minuto — veja exatamente o que está sendo exibido." },
          { icon: Clock,    label: "Última atividade",      desc: "Timestamp do último heartbeat recebido do dispositivo." },
          { icon: MapPin,   label: "Localização",           desc: "Cidade e endereço do local onde a tela está instalada." },
        ],
      },
      {
        type: "steps",
        label: "Como acessar o monitoramento",
        steps: [
          'Clique em "Monitoramento" no menu lateral (ícone de atividade).',
          "Veja o painel com todos os players. Online = borda verde, Offline = borda vermelha.",
          "Clique em qualquer card para abrir os detalhes completos da tela.",
          "Use o botão de câmera para forçar um novo screenshot.",
          "Telas offline por mais de 2h aparecem destacadas automaticamente no topo.",
        ],
      },
      { type: "tip", content: "O monitoramento atualiza automaticamente a cada 30 segundos. Você não precisa ficar recarregando a página." },
      {
        type: "cards",
        label: "Abas disponíveis no painel da tela",
        content: [
          { icon: Wifi,       label: "Status",          desc: "Status atual, plays do dia, última conexão, última mídia exibida e botão de instalar APK (admin)." },
          { icon: Eye,        label: "Screenshots",      desc: "Histórico de capturas de tela. Clique no botão de câmera para tirar um novo screenshot agora." },
          { icon: Film,       label: "Últimas Mídias",  desc: "Lista das últimas mídias exibidas com timestamp — ótimo para confirmar que o conteúdo está sendo veiculado." },
          { icon: Radio,      label: "Conexões",        desc: "Timeline de entrada/saída (online/offline) com data e hora exata de cada evento." },
        ],
      },
    ],
  },
  {
    id: "midia",
    label: "Biblioteca de Mídia",
    icon: ImageIcon,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    title: "Biblioteca de Mídia",
    intro: "Repositório central de todos os conteúdos: vídeos, imagens, widgets dinâmicos e aplicativos integrados. Tudo que você faz upload fica salvo aqui para reutilizar em qualquer playlist.",
    items: [
      {
        type: "steps",
        label: "Como fazer upload de conteúdo",
        steps: [
          'No menu lateral, acesse "Biblioteca de Mídia" → clique em "+ Adicionar Mídia".',
          "Selecione o tipo: Vídeo, Imagem, Widget (relógio, clima, RSS) ou Aplicativo.",
          "Para vídeos e imagens, arraste o arquivo ou clique para selecionar do computador.",
          "Aguarde o upload concluir (a barra de progresso indicará o andamento).",
          "Defina o nome e a duração de exibição (em segundos). Pronto!",
        ],
      },
      {
        type: "cards",
        label: "Tipos de mídia suportados",
        content: [
          { icon: Film,      label: "Vídeo",       desc: "MP4, MOV — Recomendado 1920×1080 (Full HD) ou 1280×720 (HD)." },
          { icon: ImageIcon, label: "Imagem",      desc: "JPG, PNG, GIF — Qualquer resolução, preferencialmente landscape." },
          { icon: Clock,     label: "Widgets",     desc: "Relógio digital/analógico, previsão do tempo, feed RSS, contador regressivo." },
          { icon: Play,      label: "Aplicativos", desc: "YouTube, Google Slides, páginas web, streaming e outros." },
        ],
      },
      { type: "tip", content: "Vídeos em loop: o sistema reproduz automaticamente em loop. Para imagens, defina ao menos 5 segundos de duração para uma exibição confortável." },
    ],
  },
  {
    id: "widgets",
    label: "Widgets e Apps",
    icon: Layers,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    title: "Widgets Dinâmicos e Aplicativos",
    intro: "Conteúdos inteligentes que se atualizam automaticamente sem você precisar fazer nada. Adicione relógio, previsão do tempo, notícias e muito mais direto na sua playlist.",
    items: [
      { type: "mockup", component: "widgets" },
      {
        type: "cards",
        label: "Widgets disponíveis",
        content: [
          { icon: Clock,      label: "Relógio Digital",       desc: "Relógio em tempo real com data, hora e fuso horário configurável." },
          { icon: TrendingUp, label: "Clima / Temperatura",   desc: "Previsão do tempo por cidade, atualiza automaticamente a cada hora." },
          { icon: Radio,      label: "Feed RSS / Ticker",     desc: "Manchetes de portais de notícias rolando na tela em loop." },
          { icon: Clock,      label: "Contador Regressivo",   desc: "Contagem regressiva para datas especiais (Natal, Black Friday, eventos)." },
          { icon: Play,       label: "YouTube",               desc: "Qualquer vídeo ou playlist do YouTube em loop." },
          { icon: ImageIcon,  label: "Google Slides",         desc: "Apresentação em tempo real — edite no Google e atualiza na tela automaticamente." },
          { icon: Eye,        label: "Página Web",            desc: "Qualquer URL pública: cardápio online, dashboard, painel de metas." },
          { icon: Film,       label: "Streaming / IPTV",      desc: "Stream de câmeras IP ou canais de TV via URL RTSP / HLS." },
        ],
      },
      {
        type: "steps",
        label: "Como adicionar um widget",
        steps: [
          'Acesse "Biblioteca de Mídia" → clique em "+ Adicionar Mídia".',
          'Na galeria, clique em "Aplicativos" ou "Widgets".',
          "Escolha o tipo desejado (ex.: Relógio) e configure as opções (cor, tamanho, cidade).",
          "Salve o widget — ele aparecerá na biblioteca como qualquer outra mídia.",
          "Adicione-o à playlist como faria com um vídeo ou imagem.",
        ],
      },
      { type: "tip", content: "O Ticker RSS é ótimo para exibir notícias do setor, atualizações de preço ou comunicados internos — configure a URL do feed RSS do seu blog ou portal." },
    ],
  },
  {
    id: "playlists",
    label: "Playlists",
    icon: ListVideo,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    title: "Playlists",
    intro: "Uma playlist é a sequência de mídias exibida nas telas. Organize os conteúdos em ordem, defina a duração de cada um e publique nas telas desejadas.",
    items: [
      { type: "mockup", component: "playlist" },
      {
        type: "steps",
        label: "Como criar uma playlist",
        steps: [
          'Acesse "Playlists" no menu → clique em "+ Nova Playlist".',
          "Dê um nome para a playlist (ex.: Promoções Julho).",
          'Na tela de edição, clique em "Adicionar Mídia" e escolha os conteúdos da Biblioteca.',
          "Arraste e solte para reordenar as mídias na sequência desejada.",
          "Ajuste a duração de cada mídia clicando no ícone de relógio ao lado dela.",
          'Clique em "Salvar". A playlist está pronta para ser publicada.',
        ],
      },
      { type: "tip", content: "Crie playlists temáticas: uma para manhã, outra para tarde, outra para promoções sazonais. Assim fica fácil trocar rapidamente usando o agendamento." },
    ],
  },
  {
    id: "publicacao",
    label: "Publicação",
    icon: LayoutList,
    color: "text-teal-500",
    bg: "bg-teal-500/10",
    title: "Publicação",
    intro: "Publicação é o ato de enviar uma playlist para uma ou mais telas. Após publicar, o conteúdo começa a ser exibido imediatamente (ou no horário agendado).",
    items: [
      {
        type: "steps",
        label: "Como publicar uma playlist",
        steps: [
          'Acesse "Publicação" no menu lateral.',
          'Clique em "+ Nova Publicação".',
          "Selecione a playlist que deseja exibir.",
          "Selecione as telas de destino (pode ser uma ou várias).",
          'Clique em "Publicar Agora" para enviar imediatamente, ou defina uma data/hora para agendamento futuro.',
          "As telas selecionadas receberão o novo conteúdo em até 30 segundos.",
        ],
      },
      {
        type: "cards",
        label: "Modos de publicação",
        content: [
          { icon: Play,          label: "Publicar agora",  desc: "A playlist começa a tocar imediatamente em todas as telas selecionadas." },
          { icon: CalendarClock, label: "Agendar",          desc: "Define data e horário de início para a publicação entrar no ar." },
          { icon: Clock,         label: "Por período",      desc: "Define início e fim — ideal para promoções com prazo determinado." },
        ],
      },
      { type: "tip", content: "Prefira publicar fora do horário de pico (manhã cedo ou noite) quando as telas têm menos movimento. Isso evita que os clientes vejam a transição de conteúdo." },
    ],
  },
  {
    id: "banner-editor",
    label: "Mídia Edit",
    icon: Palette,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    title: "Mídia Edit — Editor Visual de Banners e Cenas",
    intro: "O Mídia Edit (acessível pelo menu lateral) é um editor visual completo para criar banners, cards e composições diretamente no navegador — sem precisar do Photoshop ou Canva. Combine texto, imagens, formas e widgets em uma tela.",
    items: [
      {
        type: "steps",
        label: "Como criar uma peça no Mídia Edit",
        steps: [
          'Acesse "Mídia Edit" no menu lateral (ícone de filme).',
          'Clique em "+ Nova Cena" para adicionar uma tela em branco ao projeto.',
          "Configure a resolução da cena (ex.: 1920×1080 para Full HD, ou 168×168 para painel LED).",
          "Arraste elementos da barra lateral: texto, retângulos, imagens, relógio, clima, RSS.",
          "Reposicione e redimensione os elementos clicando e arrastando.",
          "Para adicionar texto: clique no botão T, escreva o conteúdo e ajuste fonte, cor e tamanho.",
          'Clique em "Exportar como Imagem" para salvar a cena na biblioteca de mídia.',
        ],
      },
      {
        type: "cards",
        label: "Recursos disponíveis no editor",
        content: [
          { icon: Layers,     label: "Cenas múltiplas",      desc: "Um projeto pode ter várias cenas. Cada cena vira uma imagem independente na biblioteca." },
          { icon: Clock,      label: "Widgets dinâmicos",    desc: "Relógio, temperatura e feed RSS podem ser adicionados como elementos ao vivo na composição." },
          { icon: TrendingUp, label: "Undo/Redo global",     desc: "Ctrl+Z / Ctrl+Y desfazem/refazem ações em todo o projeto (multi-cena)." },
          { icon: Layers,     label: "Guias de alinhamento", desc: "Linhas de snap aparecem ao arrastar elementos, ajudando a alinhar com precisão." },
          { icon: Settings,   label: "Rotação e camadas",    desc: "Cada elemento pode ser rotacionado e tem sua própria ordem de camadas (frente/verso)." },
          { icon: HardDrive,  label: "Exportação automática", desc: "Ao exportar, a imagem é enviada automaticamente à Biblioteca de Mídia, pronta para playlists." },
        ],
      },
      { type: "tip", content: 'Para criar um banner de promoção: acesse Mídia Edit → nova cena → fundo colorido → adicione texto da oferta em destaque → exporte. Em 2 minutos seu conteúdo está na tela!' },
      { type: "warning", content: "Projetos não são salvos automaticamente no servidor — use o botão de exportar para gravar cada cena. Fechar a aba sem exportar perde as alterações não salvas." },
    ],
  },
  {
    id: "grupos",
    label: "Grupos de Telas",
    icon: Grid3X3,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    title: "Grupos de Telas",
    intro: "Agrupe múltiplas telas por localidade, tipo ou cliente. Publique em um grupo inteiro com um único clique — sem precisar selecionar cada tela individualmente.",
    items: [
      { type: "mockup", component: "groups" },
      {
        type: "steps",
        label: "Como criar um grupo",
        steps: [
          'Acesse "Monitoramento" ou "Minhas Telas" → clique em "Grupos" no topo.',
          'Clique em "+ Novo Grupo" e dê um nome (ex.: Rede Norte, Lojas Sul).',
          "Selecione as telas que fazem parte deste grupo.",
          "Salve o grupo. Ele aparecerá como opção ao publicar ou agendar.",
          "Para publicar no grupo inteiro, selecione o grupo no destino da publicação.",
        ],
      },
      {
        type: "cards",
        label: "Casos de uso comuns",
        content: [
          { icon: MapPin,   label: "Por localidade",  desc: '"Unidade Centro", "Filial Sul" — publica em todas as telas de um local de uma vez.' },
          { icon: Users,    label: "Por cliente",      desc: '"Cliente Redes Varejistas" — todas as telas desse cliente em um grupo.' },
          { icon: Monitor,  label: "Por tipo",         desc: '"Totens", "TVs Recepção" — agrupa por tipo de dispositivo.' },
        ],
      },
      { type: "tip", content: 'Grupos de telas economizam muito tempo. Se você tem 30 telas na mesma rede, basta selecionar "Rede Completa" e publicar de uma vez.' },
    ],
  },
  {
    id: "campanhas",
    label: "Campanhas",
    icon: Megaphone,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    title: "Campanhas",
    intro: "Campanhas agrupam publicações em múltiplas telas para um mesmo cliente ou objetivo, facilitando o acompanhamento e os relatórios de Prova de Exibição.",
    items: [
      { type: "mockup", component: "campaign" },
      {
        type: "steps",
        label: "Como criar uma campanha",
        steps: [
          'Acesse "Campanhas" no menu → clique em "+ Nova Campanha".',
          "Informe o nome da campanha, o cliente vinculado e o período (data de início e fim).",
          "Selecione as telas que farão parte desta campanha.",
          "Associe uma playlist a cada tela participante.",
          'Clique em "Salvar". A campanha ficará ativa no período configurado.',
        ],
      },
      {
        type: "cards",
        label: "Funcionalidades da campanha",
        content: [
          { icon: Eye,       label: "Prova de Exibição",       desc: "Relatório com horários, contagem de exibições e telas usadas — ideal para enviar ao cliente." },
          { icon: BarChart3, label: "Relatório por Campanha",   desc: "Filtre os relatórios de exibição por campanha para ver o desempenho completo." },
          { icon: Monitor,   label: "Multi-tela simultânea",   desc: "Uma campanha pode envolver dezenas de telas simultaneamente com conteúdos distintos." },
        ],
      },
      { type: "tip", content: "Vincule sempre o nome do cliente à campanha. Isso permite filtrar relatórios por cliente e gerar a Prova de Exibição com apenas um clique." },
    ],
  },
  {
    id: "agendamento",
    label: "Agendamento",
    icon: CalendarClock,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    title: "Agendamento",
    intro: "Programe qual playlist é exibida em cada horário do dia, sem precisar publicar manualmente. Ideal para grade de programação fixa, como uma emissora de TV.",
    items: [
      {
        type: "steps",
        label: "Como configurar um agendamento",
        steps: [
          'Acesse "Agendamento" no menu.',
          'Clique em um horário vazio no calendário ou em "+ Novo Agendamento".',
          "Selecione a tela e a playlist desejada.",
          "Defina o horário de início e fim.",
          "Escolha os dias da semana em que o agendamento se repete.",
          'Salve. O sistema aplicará a playlist automaticamente no horário programado.',
        ],
      },
      { type: "tip", content: "Monte uma grade completa: playlist de abertura (7h–9h), programação padrão (9h–18h) e playlist noturna (18h–22h). Funciona como uma emissora de TV!" },
    ],
  },
  {
    id: "alerta",
    label: "Alerta de Emergência",
    icon: Bell,
    color: "text-red-500",
    bg: "bg-red-500/10",
    title: "Alerta de Emergência",
    intro: "Interrompa instantaneamente qualquer conteúdo em exibição e mostre uma mensagem de emergência em todas as telas — com um único clique. Ideal para evacuações, avisos urgentes e comunicados críticos.",
    items: [
      { type: "mockup", component: "emergency" },
      {
        type: "steps",
        label: "Como enviar um alerta de emergência",
        steps: [
          'No menu lateral, clique em "Monitoramento" → aba "Alertas" (ou use o atalho no Dashboard).',
          'Clique em "Novo Alerta de Emergência".',
          "Digite a mensagem que será exibida (ex.: \"Evacuação — utilize a saída de emergência\").",
          "Selecione as telas ou grupos afetados (ou selecione \"Todas as telas\").",
          'Clique em "Enviar Alerta". Em segundos, todas as telas exibirão o alerta em sobreposição.',
          'Quando a situação for resolvida, clique em "Encerrar Alerta" para retomar o conteúdo normal.',
        ],
      },
      {
        type: "warning",
        content: "O alerta de emergência interrompe imediatamente todo o conteúdo em exibição. Use somente em situações que realmente justifiquem a interrupção de todas as telas.",
      },
      { type: "tip", content: "O alerta fica salvo no histórico com horário de início e fim. Isso é útil para auditorias de segurança e comprovação de comunicação em emergências." },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    icon: BarChart3,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    title: "Relatórios",
    intro: "Acompanhe tudo que foi exibido nas suas telas: quantas vezes, por quanto tempo, em quais dispositivos. Exporte em CSV ou imprima para enviar aos clientes.",
    items: [
      { type: "mockup", component: "reports" },
      {
        type: "cards",
        label: "Tipos de relatório disponíveis",
        content: [
          { icon: BarChart3,  label: "Visão Geral",           desc: "Dashboard com KPIs, gráfico de exibições por dia e top 5 conteúdos." },
          { icon: ListVideo,  label: "Por Conteúdo",          desc: "Cada mídia exibida com contagem, tempo total e dias únicos de exibição." },
          { icon: Eye,        label: "Exibições Detalhadas",  desc: "Log completo de cada exibição: horário exato de início e fim." },
          { icon: Megaphone,  label: "Por Campanha",          desc: "Filtra as exibições por campanha — base da Prova de Exibição." },
          { icon: Monitor,    label: "Por Player / Tela",     desc: "Agrupa as exibições por tela — veja qual dispositivo mais reproduziu." },
          { icon: Wifi,       label: "Disponibilidade",       desc: "Uptime % de cada tela: tempo online vs offline no período." },
        ],
      },
      {
        type: "steps",
        label: "Como gerar e exportar um relatório",
        steps: [
          'Acesse "Relatórios" no menu.',
          "Na barra de filtros, selecione o período desejado (hoje, 7 dias, 30 dias ou intervalo personalizado).",
          "Opcionalmente filtre por tela, campanha, cliente ou mídia específica.",
          "No menu lateral, escolha o tipo de relatório (Por Conteúdo, Detalhado, etc.).",
          'Clique em "CSV" para exportar ou "Imprimir" para gerar o PDF de Prova de Exibição.',
        ],
      },
      { type: "tip", content: 'Para Prova de Exibição: use o relatório "Por Campanha", clique em "Ver relatório" e depois em "Imprimir". O PDF gerado é formatado para envio ao cliente.' },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    icon: Users,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    title: "Clientes",
    intro: "Cadastre os anunciantes e clientes cujo conteúdo está sendo exibido nas suas telas. Vincule campanhas a clientes e filtre relatórios por cliente para gerar Provas de Exibição personalizadas.",
    items: [
      {
        type: "steps",
        label: "Como cadastrar um cliente",
        steps: [
          'Acesse "Clientes" no menu lateral.',
          'Clique em "+ Novo Cliente".',
          "Preencha nome, CNPJ, segmento de atuação e contato.",
          "Salve. O cliente aparecerá nas opções ao criar campanhas e publicações.",
          "Para filtrar relatórios por cliente: acesse Relatórios → filtro Cliente → selecione o nome.",
        ],
      },
      {
        type: "cards",
        label: "Informações do cadastro de cliente",
        content: [
          { icon: Users,     label: "Nome e CNPJ",      desc: "Identificação fiscal — aparece nas Provas de Exibição e boletos." },
          { icon: Star,      label: "Segmento",          desc: "Varejo, Alimentação, Saúde, etc. — facilita filtros e relatórios." },
          { icon: Megaphone, label: "Campanhas ativas",  desc: "Quantas campanhas vinculadas a esse cliente estão em andamento." },
          { icon: BarChart3, label: "Histórico",         desc: "Todas as exibições desse cliente nos relatórios consolidados." },
        ],
      },
      { type: "tip", content: 'Use o segmento do cliente para filtrar relatórios de desempenho por setor. Por exemplo: "quais clientes do segmento Alimentação tiveram mais exibições este mês?"' },
    ],
  },
  {
    id: "locais",
    label: "Locais",
    icon: MapPin,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    title: "Locais",
    intro: "Cadastre os endereços físicos onde as telas estão instaladas. Visualize no mapa e identifique rapidamente onde está cada dispositivo da sua rede.",
    items: [
      {
        type: "steps",
        label: "Como cadastrar um local",
        steps: [
          'Acesse "Locais" no menu → clique em "+ Novo Local".',
          "Informe o nome do local (ex.: Loja Centro), CNPJ ou responsável.",
          "Digite o endereço completo — o sistema buscará as coordenadas automaticamente.",
          "O local aparecerá no mapa interativo com um pin. Clique para ver as telas vinculadas.",
          "Na edição de cada tela, vincule-a ao local correspondente.",
        ],
      },
      { type: "tip", content: "Vincular telas a locais facilita relatórios por unidade e ajuda a identificar rapidamente qual tela está offline em qual endereço." },
    ],
  },
  {
    id: "seguranca",
    label: "Segurança",
    icon: Shield,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    title: "Segurança da Conta",
    intro: "Proteja o acesso ao sistema com autenticação em dois fatores (2FA) e gerencie os dispositivos confiáveis vinculados à sua conta.",
    items: [
      { type: "mockup", component: "security" },
      {
        type: "steps",
        label: "Como ativar o 2FA",
        steps: [
          'Acesse "Configurações" → aba "Segurança" (ou menu Segurança no topo direito).',
          'Clique em "Ativar autenticação de dois fatores".',
          "Escaneie o QR Code com o app Google Authenticator ou Authy no celular.",
          "Digite o código de 6 dígitos gerado pelo app para confirmar.",
          "Pronto! A partir de agora, todo login pedirá o código do celular além da senha.",
        ],
      },
      {
        type: "cards",
        label: "Recursos de segurança disponíveis",
        content: [
          { icon: Shield,    label: "2FA (Dois Fatores)",       desc: "Código temporário gerado no celular — mesmo com a senha, sem o celular não entra." },
          { icon: CheckCircle2, label: "Dispositivos confiáveis", desc: 'Marque "Confiar por 30 dias" para não pedir o código toda vez em dispositivos seguros.' },
          { icon: Eye,       label: "Histórico de acessos",    desc: "Veja data, hora e localização de cada login na sua conta." },
          { icon: AlertCircle, label: "Revogação remota",      desc: "Remova dispositivos confiáveis de qualquer lugar, a qualquer hora." },
        ],
      },
      { type: "tip", content: "Ative o 2FA mesmo que sua senha seja forte. Em caso de vazamento de senha, o 2FA é a última barreira de proteção da conta." },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: CreditCard,
    color: "text-green-500",
    bg: "bg-green-500/10",
    title: "Financeiro",
    intro: "Consulte o plano contratado, o histórico de cobranças e os boletos/comprovantes da sua assinatura RPShow.",
    items: [
      {
        type: "cards",
        label: "O que você encontra aqui",
        content: [
          { icon: CreditCard, label: "Plano ativo",       desc: "Tipo de plano (Trial, Mensal, Anual) e data de vencimento." },
          { icon: Eye,        label: "Histórico",         desc: "Todas as cobranças realizadas com data, valor e status (Pago / Pendente)." },
          { icon: Upload,     label: "Comprovantes",      desc: "Baixe ou imprima o comprovante de pagamento de qualquer mensalidade." },
          { icon: HardDrive,  label: "Armazenamento",    desc: "Uso atual de espaço em nuvem e o limite do seu plano." },
        ],
      },
      { type: "tip", content: 'Se o status do plano aparecer como "Vencido", o acesso ao sistema pode ser limitado. Entre em contato com o suporte pelo WhatsApp (16) 98220-8695.' },
    ],
  },
  {
    id: "suporte",
    label: "Suporte",
    icon: HelpCircle,
    color: "text-primary",
    bg: "bg-primary/10",
    title: "Suporte & Contato",
    intro: "Precisa de ajuda? Entre em contato com a equipe RPShow pelos canais abaixo.",
    items: [
      {
        type: "cards",
        label: "Canais de atendimento",
        content: [
          { icon: HelpCircle,   label: "WhatsApp",             desc: "(16) 98220-8695 — atendimento de seg a sex, 8h–18h." },
          { icon: AlertCircle,  label: "E-mail",               desc: "contato@rpshow.com.br — resposta em até 24h úteis." },
          { icon: Lightbulb,    label: "Base de conhecimento", desc: "Consulte este manual a qualquer momento pelo menu lateral → Ajuda." },
        ],
      },
      {
        type: "steps",
        label: "Dicas para um chamado mais rápido",
        steps: [
          "Informe o nome da tela com problema.",
          "Descreva o que esperava ver e o que está acontecendo.",
          "Se possível, tire um print da mensagem de erro.",
          "Informe o horário aproximado em que o problema começou.",
        ],
      },
    ],
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2.5 mt-2">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span className="text-sm text-muted-foreground leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function CardGrid({ items }: { items: { icon: React.ElementType; label: string; desc: string }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <item.icon className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TipBox({ content }: { content: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 mt-2">
      <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-sm text-muted-foreground leading-relaxed">
        <span className="font-semibold text-amber-600">Dica: </span>
        {content}
      </p>
    </div>
  );
}

function WarningBox({ content }: { content: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-red-500/40 bg-red-500/8 p-3 mt-2">
      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm text-muted-foreground leading-relaxed">
        <span className="font-semibold text-red-600">Atenção: </span>
        {content}
      </p>
    </div>
  );
}

function MockupSwitch({ component }: { component: string }) {
  switch (component) {
    case "dashboard":  return <DashboardMockup />;
    case "monitoring": return <MonitoringMockup />;
    case "playlist":   return <PlaylistMockup />;
    case "campaign":   return <CampaignMockup />;
    case "emergency":  return <EmergencyMockup />;
    case "widgets":    return <WidgetsMockup />;
    case "groups":     return <GroupsMockup />;
    case "reports":    return <ReportsMockup />;
    case "security":   return <SecurityMockup />;
    default:           return null;
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Ajuda() {
  const [active, setActive] = useState(sections[0].id);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const handler = () => {
      const containerTop = container.getBoundingClientRect().top;
      let current = sections[0].id;
      for (const s of sections) {
        const el = sectionRefs.current[s.id];
        if (el && el.getBoundingClientRect().top - containerTop <= 120) current = s.id;
      }
      setActive(current);
    };
    container.addEventListener("scroll", handler, { passive: true });
    return () => container.removeEventListener("scroll", handler);
  }, []);

  const scrollTo = (id: string) => {
    const el = sectionRefs.current[id];
    const container = contentRef.current;
    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const target = container.scrollTop + elRect.top - containerRect.top - 24;
      container.scrollTo({ top: target, behavior: "smooth" });
    }
    setActive(id);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-0 shrink-0">
        <PageHeader
          icon={BookOpen}
          title="Manual do Operador"
          description="Guia completo para usar todas as funcionalidades do RPShow OnSign."
        />
        <div className="flex items-center gap-2 mt-2 pb-4 flex-wrap">
          <Badge variant="outline" className="text-xs gap-1 text-primary border-primary/30">
            <Wifi className="w-3 h-3" /> Modo Cliente
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
            <BookOpen className="w-3 h-3" /> versão 1.15
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 text-emerald-600 border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> {sections.length} seções
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-0">
        {/* ── Sticky sidebar nav ── */}
        <aside className="w-52 shrink-0 border-r overflow-y-auto px-2 py-4 space-y-0.5 hidden lg:block">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                active === s.id
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <s.icon className="w-3.5 h-3.5 shrink-0" />
              {s.label}
            </button>
          ))}
        </aside>

        {/* ── Scrollable content ── */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-12">
          {sections.map((section) => (
            <section
              key={section.id}
              ref={(el) => { sectionRefs.current[section.id] = el; }}
              id={section.id}
            >
              {/* Section header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", section.bg)}>
                  <section.icon className={cn("w-5 h-5", section.color)} />
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">{section.title}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{section.intro}</p>
                </div>
              </div>

              {/* Section items */}
              <div className="space-y-5 pl-0">
                {section.items.map((item, i) => (
                  <div key={i}>
                    {"label" in item && item.type !== "tip" && item.type !== "warning" && item.type !== "mockup" && (
                      <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5 text-primary" />
                        {item.label}
                      </h3>
                    )}
                    {item.type === "steps"   && "steps"     in item && <StepList steps={(item as any).steps} />}
                    {item.type === "cards"   && "content"   in item && <CardGrid items={item.content as any} />}
                    {item.type === "tip"     && "content"   in item && <TipBox content={item.content as string} />}
                    {item.type === "warning" && "content"   in item && <WarningBox content={item.content as string} />}
                    {item.type === "mockup"  && "component" in item && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Eye className="w-3 h-3" /> Exemplo visual
                        </p>
                        <MockupSwitch component={(item as any).component} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="mt-10 border-t border-dashed" />
            </section>
          ))}

          {/* Footer */}
          <div className="pb-8 text-center text-xs text-muted-foreground space-y-1">
            <p className="font-semibold">RPShow OnSign · Manual do Operador · v1.16</p>
            <p>Dúvidas? WhatsApp (16) 98220-8695 · contato@rpshow.com.br</p>
          </div>
        </div>
      </div>
    </div>
  );
}
