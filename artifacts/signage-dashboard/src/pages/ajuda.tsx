import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Monitor, Image as ImageIcon, ListVideo, LayoutList,
  Megaphone, CalendarClock, BarChart3, MapPin, CreditCard,
  HelpCircle, ChevronRight, BookOpen, Lightbulb, AlertCircle,
  Upload, Play, Eye, Settings, Clock, Wifi, Film,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

// ─── Section definitions ──────────────────────────────────────────────────────
const sections = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    title: "Dashboard — Visão Geral",
    intro: "A tela inicial do sistema apresenta um resumo em tempo real de tudo que está acontecendo com as suas telas e conteúdos.",
    items: [
      {
        type: "cards",
        label: "Indicadores principais",
        content: [
          { icon: Monitor, label: "Telas ativas", desc: "Quantas telas estão com conteúdo publicado e online no momento." },
          { icon: Play,    label: "Exibições hoje", desc: "Total de vezes que algum conteúdo foi exibido no dia atual." },
          { icon: Clock,   label: "Tempo em ar", desc: "Horas acumuladas de exibição nas telas no dia." },
          { icon: Wifi,    label: "Online / Offline", desc: "Status atual de cada dispositivo registrado na sua conta." },
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
      {
        type: "tip",
        content: "Se uma tela aparecer Offline por mais de 15 minutos, verifique a conexão de internet do local. O dispositivo envia heartbeat a cada 30 segundos.",
      },
    ],
  },
  {
    id: "telas",
    label: "Minhas Telas",
    icon: Monitor,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    title: "Minhas Telas",
    intro: "Gerenciamento completo dos dispositivos de exibição. Cada tela é um dispositivo físico (TV, tablet, totem) registrado no sistema.",
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
      {
        type: "tip",
        content: 'Dê nomes descritivos às telas: inclua o local e a posição (ex.: "Shopping Norte — Entrada Principal"). Facilita muito na hora de publicar e gerar relatórios.',
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
    intro: "Repositório central de todos os conteúdos disponíveis para exibição: vídeos, imagens, widgets e aplicativos.",
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
          { icon: Film,       label: "Vídeo",         desc: "MP4, MOV — Recomendado 1920×1080 (Full HD) ou 1280×720 (HD)." },
          { icon: ImageIcon,  label: "Imagem",         desc: "JPG, PNG, GIF — Qualquer resolução, preferencialmente landscape." },
          { icon: Clock,      label: "Widgets",        desc: "Relógio digital/analógico, previsão do tempo, feed RSS, contador." },
          { icon: Play,       label: "Aplicativos",    desc: "YouTube, Google Slides, páginas web, streaming e outros." },
        ],
      },
      {
        type: "tip",
        content: "Vídeos em loop: o sistema reproduz automaticamente em loop. Para imagens, defina ao menos 5 segundos de duração para uma exibição confortável.",
      },
    ],
  },
  {
    id: "playlists",
    label: "Playlists",
    icon: ListVideo,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    title: "Playlists",
    intro: "Uma playlist é a sequência de mídias que será exibida nas telas. Você organiza as mídias em ordem, define duração de cada uma e publica nas telas desejadas.",
    items: [
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
      {
        type: "tip",
        content: "Crie playlists temáticas: uma para manhã, outra para tarde, outra para promoções sazonais. Assim fica fácil trocar rapidamente usando o agendamento.",
      },
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
          { icon: Play,         label: "Publicar agora",      desc: "A playlist começa a tocar imediatamente em todas as telas selecionadas." },
          { icon: CalendarClock, label: "Agendar",            desc: "Define data e horário de início para a publicação entrar no ar." },
          { icon: Clock,         label: "Por período",        desc: "Define início e fim — ideal para promoções com prazo determinado." },
        ],
      },
      {
        type: "tip",
        content: "Prefira publicar fora do horário de pico (manhã cedo ou noite) quando as telas têm menos movimento. Isso evita que os clientes vejam a transição de conteúdo.",
      },
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
          { icon: Eye,       label: "Prova de Exibição",  desc: "Gera relatório com horários, contagem de exibições e telas usadas — ideal para enviar ao cliente." },
          { icon: BarChart3, label: "Relatório por Campanha", desc: "Filtre os relatórios de exibição por nome de campanha para ver o desempenho completo." },
          { icon: Monitor,   label: "Multi-tela",          desc: "Uma campanha pode envolver dezenas de telas simultaneamente." },
        ],
      },
      {
        type: "tip",
        content: "Vincule sempre o nome do cliente à campanha. Isso permite filtrar relatórios por cliente e gerar a Prova de Exibição com apenas um clique.",
      },
    ],
  },
  {
    id: "agendamento",
    label: "Agendamento",
    icon: CalendarClock,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    title: "Agendamento",
    intro: "O agendamento permite programar qual playlist é exibida em cada horário do dia, sem precisar publicar manualmente. Ideal para grade de programação fixa.",
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
      {
        type: "tip",
        content: "Monte uma grade completa: playlist de abertura (7h–9h), programação padrão (9h–18h) e playlist noturna (18h–22h). Funciona como uma emissora de TV!",
      },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    icon: BarChart3,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    title: "Relatórios",
    intro: "Acompanhe tudo que foi exibido nas suas telas: quantas vezes, por quanto tempo, em quais dispositivos. Exporte em CSV ou imprima para enviar a clientes.",
    items: [
      {
        type: "cards",
        label: "Tipos de relatório disponíveis",
        content: [
          { icon: BarChart3,    label: "Visão Geral",        desc: "Dashboard com KPIs, gráfico de exibições por dia e top 5 conteúdos." },
          { icon: ListVideo,    label: "Por Conteúdo",       desc: "Cada mídia exibida com contagem, tempo total e dias únicos de exibição." },
          { icon: Eye,          label: "Detalhado",          desc: "Log completo de cada exibição: horário exato de início e fim." },
          { icon: Megaphone,    label: "Por Campanha",       desc: "Filtra as exibições por campanha — base da Prova de Exibição." },
          { icon: Monitor,      label: "Por Player",         desc: "Agrupa as exibições por tela — veja qual dispositivo mais reproduziu." },
          { icon: Wifi,         label: "Ativação dos Players", desc: "Uptime % de cada tela: tempo online vs offline no período." },
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
      {
        type: "tip",
        content: 'Para Prova de Exibição: use o relatório "Por Campanha", clique em "Ver relatório" e depois em "Imprimir". O PDF gerado é formatado para envio ao cliente.',
      },
    ],
  },
  {
    id: "locais",
    label: "Locais",
    icon: MapPin,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    title: "Locais",
    intro: "Cadastre os endereços físicos onde as telas estão instaladas. Isso facilita o gerenciamento de múltiplas unidades e a geração de relatórios por localidade.",
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
      {
        type: "tip",
        content: "Vincular telas a locais facilita relatórios por unidade e ajuda a identificar rapidamente qual tela está offline em qual endereço.",
      },
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
        ],
      },
      {
        type: "tip",
        content: 'Se o status do plano aparecer como "Vencido", o acesso ao sistema pode ser limitado. Entre em contato com o suporte pelo WhatsApp (16) 98220-8695.',
      },
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
          { icon: HelpCircle, label: "WhatsApp",      desc: "(16) 98220-8695 — atendimento de seg a sex, 8h–18h." },
          { icon: AlertCircle, label: "E-mail",       desc: "contato@rpshow.com.br — resposta em até 24h úteis." },
          { icon: Lightbulb,  label: "Base de conhecimento", desc: "Consulte este manual a qualquer momento pelo menu lateral → Ajuda." },
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Ajuda() {
  const [active, setActive] = useState(sections[0].id);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const handler = () => {
      let current = sections[0].id;
      for (const s of sections) {
        const el = sectionRefs.current[s.id];
        if (el && el.offsetTop - container.scrollTop <= 120) current = s.id;
      }
      setActive(current);
    };
    container.addEventListener("scroll", handler, { passive: true });
    return () => container.removeEventListener("scroll", handler);
  }, []);

  const scrollTo = (id: string) => {
    const el = sectionRefs.current[id];
    if (el && contentRef.current) {
      contentRef.current.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
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
        <div className="flex items-center gap-2 mt-2 pb-4">
          <Badge variant="outline" className="text-xs gap-1 text-primary border-primary/30">
            <Wifi className="w-3 h-3" /> Modo Cliente
          </Badge>
          <span className="text-xs text-muted-foreground">· versão 1.14</span>
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
                    {"label" in item && item.type !== "tip" && (
                      <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5 text-primary" />
                        {item.label}
                      </h3>
                    )}
                    {item.type === "steps" && "steps" in item && <StepList steps={(item as any).steps} />}
                    {item.type === "cards" && "content" in item && <CardGrid items={item.content as any} />}
                    {item.type === "tip" && "content" in item && <TipBox content={item.content as string} />}
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="mt-10 border-t border-dashed" />
            </section>
          ))}

          {/* Footer */}
          <div className="pb-8 text-center text-xs text-muted-foreground space-y-1">
            <p className="font-semibold">RPShow OnSign · Manual do Operador</p>
            <p>Dúvidas? WhatsApp (16) 98220-8695 · contato@rpshow.com.br</p>
          </div>
        </div>
      </div>
    </div>
  );
}
