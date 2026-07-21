import { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard, Users, Monitor, Activity, CreditCard,
  BarChart3, Shield, Smartphone, Zap, ChevronRight,
  Eye, Settings, RefreshCw, Download, Trash2,
  AlertTriangle, CheckCircle2, Clock, Wifi, Play,
  MapPin, BookOpen, Star, TrendingUp, Camera,
  HardDrive, Bell, Radio, DollarSign,
  Send, Layers, Cpu, ShieldAlert, Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function MockupFrame({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="my-3 rounded-xl border-2 border-border overflow-hidden shadow-lg">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/80 border-b border-border">
        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <div className="flex-1 mx-2 h-5 rounded-md bg-muted flex items-center px-2">
          <span className="text-[9px] text-muted-foreground">app.rpshow.com.br{label ? `/${label}` : ""}</span>
        </div>
        <span className="text-[8px] text-amber-400 font-bold bg-amber-500/15 px-1.5 py-0.5 rounded">ADMIN</span>
      </div>
      <div className="bg-background">{children}</div>
    </div>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
            {i + 1}
          </span>
          <span className="text-foreground/80 leading-snug">{s}</span>
        </li>
      ))}
    </ol>
  );
}

function CardGrid({ items }: { items: { icon: React.ElementType; label: string; desc: string }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex gap-3 p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <item.icon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TipBox({ content }: { content: string }) {
  return (
    <div className="flex gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
      <Star className="w-4 h-4 text-primary shrink-0 mt-0.5" />
      <p className="text-sm text-foreground/80 leading-snug">{content}</p>
    </div>
  );
}

function WarningBox({ content }: { content: string }) {
  return (
    <div className="flex gap-3 p-3 rounded-xl border border-amber-400/30 bg-amber-400/5">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-700 dark:text-amber-400 leading-snug">{content}</p>
    </div>
  );
}

// ─── Admin Mockup Components ──────────────────────────────────────────────────

function AdminDashMockup() {
  return (
    <MockupFrame label="admin">
      <div className="p-3 space-y-3">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Operadores", value: "24", sub: "+2 este mês", color: "text-primary" },
            { label: "Telas ativas", value: "147", sub: "12 offline", color: "text-emerald-500" },
            { label: "Receita/mês", value: "R$4.620", sub: "8 faturas pend.", color: "text-violet-500" },
            { label: "Plays hoje", value: "31.840", sub: "todas as contas", color: "text-sky-500" },
          ].map(k => (
            <div key={k.label} className="rounded-lg border bg-muted/30 p-2">
              <p className="text-[7px] text-muted-foreground">{k.label}</p>
              <p className={cn("text-sm font-black", k.color)}>{k.value}</p>
              <p className="text-[7px] text-muted-foreground">{k.sub}</p>
            </div>
          ))}
        </div>
        {/* Charts row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 rounded-lg border bg-muted/20 p-2">
            <p className="text-[8px] text-muted-foreground mb-1">Crescimento de operadores (6 meses)</p>
            <div className="flex items-end gap-1 h-12">
              {[60, 72, 78, 85, 91, 100].map((h, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 5 ? "#79B4B0" : "hsl(176 28% 59% / 0.35)" }} />
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 p-2">
            <p className="text-[8px] text-muted-foreground mb-1">Status dos clientes</p>
            {[
              { label: "Ativos", count: 14, color: "bg-emerald-500" },
              { label: "Trial", count: 7, color: "bg-amber-400" },
              { label: "Suspenso", count: 2, color: "bg-red-400" },
              { label: "Aguardando", count: 1, color: "bg-orange-400" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1 mb-0.5">
                <div className={cn("w-1.5 h-1.5 rounded-full", s.color)} />
                <span className="text-[7px] text-muted-foreground flex-1">{s.label}</span>
                <span className="text-[7px] font-bold text-foreground/70">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Quick access bar */}
        <div className="flex gap-1.5 flex-wrap">
          {["Financeiro", "Relatórios", "Monitoramento", "+ Novo Cliente"].map((l, i) => (
            <div key={l} className={cn("h-5 px-2 rounded text-[7px] font-bold flex items-center gap-1",
              i === 3 ? "bg-primary text-primary-foreground" : "bg-muted border text-foreground/60")}>
              {l}
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

function OperatorsMockup() {
  const rows = [
    { name: "Mídia Indoor SP",   cnpj: "12.345.678/0001-99", telas: 12, status: "active",           valor: "R$480" },
    { name: "Agência TopMídia",  cnpj: "98.765.432/0001-11", telas: 5,  status: "trial",            valor: "—" },
    { name: "Reclame Bem",       cnpj: "55.123.456/0001-33", telas: 0,  status: "pending_approval", valor: "—" },
    { name: "Outdoor Digital",   cnpj: "33.999.000/0001-77", telas: 8,  status: "suspended",        valor: "R$320" },
  ];
  const badgeColor = (s: string) => ({
    active:           "bg-emerald-500/15 text-emerald-600",
    trial:            "bg-amber-400/15 text-amber-600",
    pending_approval: "bg-orange-500/15 text-orange-600",
    suspended:        "bg-red-500/15 text-red-500",
  }[s] ?? "bg-muted text-muted-foreground");
  const badgeLabel = (s: string) => ({
    active: "Ativo", trial: "Trial", pending_approval: "Aguardando", suspended: "Suspenso",
  }[s] ?? s);

  return (
    <MockupFrame label="users">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold">Clientes / Operadores</span>
          <div className="h-5 px-2 rounded bg-primary text-primary-foreground text-[7px] font-bold flex items-center gap-1">+ Novo</div>
        </div>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-[8px]">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Operador</th>
                <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Telas</th>
                <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Mensal</th>
                <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Status</th>
                <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.name} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-2 py-1.5">
                    <p className="font-semibold text-foreground/80">{r.name}</p>
                    <p className="text-muted-foreground">{r.cnpj}</p>
                  </td>
                  <td className="px-2 py-1.5 font-bold text-center">{r.telas}</td>
                  <td className="px-2 py-1.5 text-primary font-bold">{r.valor}</td>
                  <td className="px-2 py-1.5">
                    <span className={cn("px-1.5 py-0.5 rounded-full text-[7px] font-bold", badgeColor(r.status))}>
                      {badgeLabel(r.status)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <div className="h-4 px-1 rounded bg-muted border text-[6px] flex items-center">Editar</div>
                      <div className="h-4 px-1 rounded bg-muted border text-[6px] flex items-center">···</div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MockupFrame>
  );
}

function ApproveDeviceMockup() {
  return (
    <MockupFrame label="devices">
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold">Gestão de Telas</span>
          <div className="flex gap-1">
            <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-600 font-semibold">2 Aguardando aprovação</span>
          </div>
        </div>
        {/* Pending device row */}
        <div className="rounded-lg border-2 border-orange-500/40 bg-orange-500/5 p-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold text-foreground/80">Tela #1024 — Loja Rio Sul</span>
                <span className="text-[7px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-600 font-bold">Novo</span>
              </div>
              <p className="text-[7px] text-muted-foreground">Operador: Mídia Indoor SP · Código: TB8A3F · S/N: TBS-98720</p>
            </div>
            <div className="flex gap-1">
              <div className="h-6 px-2 rounded bg-emerald-500 text-white text-[7px] font-bold flex items-center gap-1">✓ Aprovar</div>
              <div className="h-6 px-2 rounded bg-muted border text-[7px] font-bold flex items-center">Negar</div>
            </div>
          </div>
        </div>
        {/* Approved device row */}
        <div className="rounded-lg border bg-muted/20 p-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-semibold text-foreground/70">Tela #1018 — Recepção Central</p>
              <p className="text-[7px] text-muted-foreground">Operador: Agência TopMídia · Online agora</p>
            </div>
            <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-bold">● Ativo</span>
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}

function ApkVersionsMockup() {
  return (
    <MockupFrame label="settings">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-bold">Versões de APK</span>
          </div>
          <div className="h-5 px-2 rounded bg-primary text-primary-foreground text-[7px] font-bold flex items-center">+ Nova versão</div>
        </div>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-[8px]">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Perfil</th>
                <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Versão</th>
                <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Build</th>
                <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Status</th>
                <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {[
                { profile: "TB10 Plus (t10plus)", version: "1.15.34", build: 11534, active: true  },
                { profile: "TB50 Fat ARM (fat)",  version: "1.15.33", build: 11533, active: true  },
                { profile: "TB10 (t10)",          version: "1.15.30", build: 11530, active: true  },
                { profile: "TB1 (t1)",            version: "1.14.90", build: 11490, active: false },
              ].map(r => (
                <tr key={r.profile} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-2 py-1.5 font-medium text-foreground/80">{r.profile}</td>
                  <td className="px-2 py-1.5 font-mono text-primary font-bold">v{r.version}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">#{r.build}</td>
                  <td className="px-2 py-1.5">
                    <span className={cn("px-1.5 py-0.5 rounded-full text-[7px] font-bold",
                      r.active ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground")}>
                      {r.active ? "✓ Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <div className="h-4 px-1 rounded bg-sky-500/15 text-sky-600 text-[6px] font-bold flex items-center gap-0.5">
                        <Send className="w-2 h-2" /> Instalar
                      </div>
                      <div className="h-4 px-1 rounded bg-muted border text-[6px] flex items-center">🗑</div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[7px] text-muted-foreground mt-2 text-center">
          Clique em "Instalar" no Monitoramento → painel da tela para enviar o APK remotamente
        </p>
      </div>
    </MockupFrame>
  );
}

function ApkPushMockup() {
  return (
    <MockupFrame label="monitoring">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold">Monitoramento — Tela: Recepção Loja Centro</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-semibold">● Online</span>
        </div>
        {/* Status cards */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          {[
            { l: "Status", v: "Online", c: "text-emerald-500" },
            { l: "Plays hoje", v: "247", c: "text-violet-500" },
            { l: "APK atual", v: "v1.15.30", c: "text-primary" },
          ].map(k => (
            <div key={k.l} className="rounded border bg-muted/30 p-1.5">
              <p className="text-[7px] text-muted-foreground">{k.l}</p>
              <p className={cn("text-[9px] font-bold", k.c)}>{k.v}</p>
            </div>
          ))}
        </div>
        {/* APK Push panel */}
        <div className="rounded-xl border-2 border-sky-500/40 bg-sky-500/5 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 text-sky-400 font-semibold text-[9px]">
            <Smartphone className="w-3 h-3" />
            Instalar / Atualizar APK nesta tela
            <span className="ml-auto text-[7px] text-sky-400/60">▼ aberto</span>
          </div>
          <div className="px-3 pb-3 border-t border-sky-500/20 pt-2 space-y-1.5">
            <p className="text-[7px] text-muted-foreground">Selecione a versão e envie o comando. O player instala no próximo heartbeat (~30s).</p>
            <div className="h-5 rounded border border-border bg-background text-[7px] text-muted-foreground flex items-center px-2">
              TB10 (t10) · v1.15.34 (build 11534) ✓ ativo ▼
            </div>
            <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[7px] text-emerald-600 font-semibold">
              ✓ Comando enviado! O player instalará no próximo heartbeat (~30s).
            </div>
            <div className="h-5 px-2 rounded bg-sky-500 text-white text-[7px] font-bold flex items-center gap-1 w-fit">
              <Send className="w-2 h-2" /> Enviar para o player
            </div>
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}

function FinanceiroMockup() {
  return (
    <MockupFrame label="financeiro-admin">
      <div className="flex h-52">
        <div className="w-24 border-r bg-muted/20 p-2 shrink-0">
          <p className="text-[7px] uppercase text-muted-foreground tracking-widest mb-1 px-1">Financeiro</p>
          {["Visão Geral", "Faturas", "Planos", "Recebimentos"].map((l, i) => (
            <div key={l} className={cn("h-5 rounded px-1.5 flex items-center mb-0.5", i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              <span className="text-[7px]">{l}</span>
            </div>
          ))}
        </div>
        <div className="flex-1 p-2 overflow-hidden">
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {[{ l: "MRR", v: "R$4.620", c: "text-primary" }, { l: "Pendente", v: "R$840", c: "text-amber-500" }, { l: "Vencido", v: "R$160", c: "text-red-500" }].map(k => (
              <div key={k.l} className="rounded border bg-muted/30 p-1.5 text-center">
                <p className="text-[7px] text-muted-foreground">{k.l}</p>
                <p className={cn("text-xs font-black", k.c)}>{k.v}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border overflow-hidden text-[7px]">
            <div className="border-b bg-muted/30 flex px-2 py-1 text-muted-foreground font-medium">
              <span className="flex-1">Operador</span><span className="w-12 text-center">Valor</span><span className="w-12 text-center">Status</span>
            </div>
            {[
              { op: "Mídia Indoor SP", val: "R$480", s: "Pago",     c: "text-emerald-600 bg-emerald-500/10" },
              { op: "Agência TopMídia",val: "R$200", s: "Pendente", c: "text-amber-600 bg-amber-400/10" },
              { op: "Outdoor Digital", val: "R$320", s: "Vencido",  c: "text-red-600 bg-red-500/10" },
            ].map(r => (
              <div key={r.op} className="flex items-center px-2 py-1.5 border-b last:border-0 hover:bg-muted/20">
                <span className="flex-1 text-foreground/80">{r.op}</span>
                <span className="w-12 text-center font-bold text-primary">{r.val}</span>
                <span className={cn("w-12 text-center px-1 py-0.5 rounded-full text-[6px] font-bold", r.c)}>{r.s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}

function ReportsAdminMockup() {
  return (
    <MockupFrame label="reports-admin">
      <div className="flex h-56">
        <div className="w-32 border-r bg-muted/30 p-2 space-y-0.5 shrink-0">
          <p className="text-[7px] text-muted-foreground uppercase tracking-widest px-1 mb-1">Relatórios Admin</p>
          {["Visão Geral", "Exibições", "Campanhas", "Clientes", "Financeiro", "Disponibilidade", "Por Tela", "Top Mídias", "Locais", "Assinaturas", "Atividade", "Armazenamento"].map((l, i) => (
            <div key={l} className={cn("h-5 rounded px-2 flex items-center", i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              <span className="text-[7px]">{l}</span>
            </div>
          ))}
        </div>
        <div className="flex-1 p-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold">Visão Geral — Toda a Plataforma</span>
            <div className="flex gap-1">
              <div className="h-4 px-1.5 rounded bg-muted border text-[7px] flex items-center">CSV</div>
              <div className="h-4 px-1.5 rounded bg-primary text-primary-foreground text-[7px] flex items-center">Imprimir</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 mb-2">
            {[{ l: "Total Plays", v: "1.2M" }, { l: "Telas ativas", v: "147" }].map(k => (
              <div key={k.l} className="rounded border bg-muted/30 p-1.5">
                <p className="text-[7px] text-muted-foreground">{k.l}</p>
                <p className="text-sm font-black text-primary">{k.v}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border bg-muted/20 p-1.5">
            <p className="text-[7px] text-muted-foreground mb-1">Plays / dia (plataforma toda)</p>
            <div className="flex items-end gap-0.5 h-10">
              {[55, 70, 48, 88, 65, 92, 80].map((h, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: "hsl(176 28% 59% / 0.5)" }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}

function EmergencyAdminMockup() {
  return (
    <MockupFrame label="alertas">
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center">
            <Bell className="w-3.5 h-3.5 text-red-500" />
          </div>
          <span className="text-[10px] font-bold">Alerta de Emergência Global</span>
        </div>
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2 space-y-1.5">
          <div className="space-y-1">
            <label className="text-[7px] text-muted-foreground font-medium">Mensagem do alerta</label>
            <div className="h-12 rounded border border-border bg-background p-1.5 flex items-start">
              <span className="text-[8px] text-foreground/60">Evacuação — Saída de emergência: use a porta lateral.</span>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[7px] text-muted-foreground font-medium">Cor de fundo</label>
              <div className="h-5 rounded border border-border bg-red-800 mt-0.5" />
            </div>
            <div className="flex-1">
              <label className="text-[7px] text-muted-foreground font-medium">Destino</label>
              <div className="h-5 rounded border border-border bg-background flex items-center px-1.5 mt-0.5">
                <span className="text-[7px] text-foreground/60">Todas as telas</span>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <div className="h-5 flex-1 rounded bg-red-500 text-white text-[7px] font-bold flex items-center justify-center gap-1">
              🚨 Disparar em todas as telas
            </div>
            <div className="h-5 px-2 rounded bg-muted border text-[7px] text-muted-foreground flex items-center">Cancelar</div>
          </div>
        </div>
        {/* Active alert preview */}
        <div className="rounded-lg border border-red-500/50 overflow-hidden">
          <div className="bg-red-500/15 px-2 py-1 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[7px] font-bold text-red-600">Alerta ativo em 147 telas</span>
            <div className="ml-auto h-4 px-1.5 rounded bg-red-500 text-white text-[6px] font-bold flex items-center">Desativar</div>
          </div>
          <div className="px-2 py-1.5 text-[7px] text-muted-foreground">
            "Evacuação — Saída de emergência: use a porta lateral." · Enviado às 14:32
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}

function SecurityAdminMockup() {
  return (
    <MockupFrame label="security-admin">
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-bold">Segurança — Conta Admin</span>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold text-emerald-600">2FA Ativo</p>
            <p className="text-[7px] text-muted-foreground">Google Authenticator · Habilitado em 12/07/2026</p>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[7px] text-emerald-600 font-bold">Protegido</span>
          </div>
        </div>
        <div className="rounded-lg border bg-muted/30 p-2 space-y-1">
          <p className="text-[8px] font-bold text-foreground/80">⚠ Dispositivos confiáveis da conta admin</p>
          {["Chrome · Windows 11 · Ribeirão Preto · Hoje", "Firefox · macOS · São Paulo · há 3 dias"].map((d, i) => (
            <div key={i} className="flex items-center justify-between py-0.5">
              <span className="text-[7px] text-muted-foreground">{d}</span>
              <span className="text-[6px] text-red-400 cursor-pointer font-bold">Revogar</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-1.5">
          <p className="text-[7px] text-amber-600 font-semibold">⚠ A conta admin tem acesso total. Nunca compartilhe credenciais.</p>
        </div>
      </div>
    </MockupFrame>
  );
}

// ─── MockupSwitch ─────────────────────────────────────────────────────────────

function MockupSwitch({ component }: { component: string }) {
  switch (component) {
    case "admin-dash":      return <AdminDashMockup />;
    case "operators":       return <OperatorsMockup />;
    case "approve-device":  return <ApproveDeviceMockup />;
    case "apk-versions":    return <ApkVersionsMockup />;
    case "apk-push":        return <ApkPushMockup />;
    case "financeiro":      return <FinanceiroMockup />;
    case "reports-admin":   return <ReportsAdminMockup />;
    case "emergency":       return <EmergencyAdminMockup />;
    case "security-admin":  return <SecurityAdminMockup />;
    default: return null;
  }
}

// ─── Section definitions ──────────────────────────────────────────────────────

type SectionItem =
  | { type: "mockup"; component: string }
  | { type: "steps"; label: string; steps: string[] }
  | { type: "cards"; label: string; content: { icon: React.ElementType; label: string; desc: string }[] }
  | { type: "tip"; content: string }
  | { type: "warning"; content: string };

interface Section {
  id: string; label: string; icon: React.ElementType; color: string; bg: string;
  title: string; intro: string; items: SectionItem[];
}

const sections: Section[] = [
  {
    id: "visao-geral",
    label: "Visão Geral",
    icon: LayoutDashboard,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    title: "Dashboard Admin — Visão Global da Plataforma",
    intro: "O painel administrativo exibe em tempo real os KPIs de toda a plataforma: operadores, telas, receita e atividade. É o ponto de partida para gerenciar todos os clientes.",
    items: [
      { type: "mockup", component: "admin-dash" },
      {
        type: "cards",
        label: "KPIs globais disponíveis",
        content: [
          { icon: Users,        label: "Operadores cadastrados",  desc: "Total de contas no sistema (ativos, trial, suspensos, aguardando aprovação)." },
          { icon: Monitor,      label: "Telas ativas",            desc: "Quantidade de telas com conteúdo publicado e online agora." },
          { icon: DollarSign,   label: "Receita mensal (MRR)",    desc: "Soma dos valores mensais de todos os clientes com plano ativo." },
          { icon: Play,         label: "Plays totais hoje",       desc: "Exibições de mídia acumuladas em todas as contas e telas do dia." },
          { icon: TrendingUp,   label: "Crescimento",             desc: "Gráfico de evolução de operadores novos e ativos nos últimos 6 meses." },
          { icon: AlertTriangle, label: "Alertas pendentes",      desc: "Contas aguardando aprovação, faturas vencidas ou telas offline há muito tempo." },
        ],
      },
      {
        type: "steps",
        label: "Rotina diária recomendada para o admin",
        steps: [
          "Acesse /admin → confira o painel de KPIs no topo.",
          "Verifique se há operadores com status \"Aguardando aprovação\" — aprovar rapidamente é essencial para a experiência do cliente.",
          "Veja a lista de faturas pendentes/vencidas em /financeiro-admin.",
          "Acesse /monitoring para uma varredura visual das telas de todos os clientes.",
          "Consulte /reports-admin para o resumo de atividade da plataforma.",
        ],
      },
      { type: "tip", content: "Use os atalhos rápidos no topo do dashboard admin: Financeiro, Relatórios e Monitoramento — são os 3 módulos que você mais acessará no dia a dia." },
    ],
  },
  {
    id: "clientes",
    label: "Gestão de Clientes",
    icon: Users,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    title: "Gestão de Clientes / Operadores",
    intro: "Central de gerenciamento de todos os clientes da plataforma. Aqui você aprova novos cadastros, define planos, ajusta quotas de armazenamento, suspende ou remove contas.",
    items: [
      { type: "mockup", component: "operators" },
      {
        type: "steps",
        label: "Como aprovar um novo operador",
        steps: [
          'Acesse /admin → veja operadores com status "Aguardando aprovação" (badge laranja).',
          'Clique no botão "Aprovar" na linha do operador ou nos 3 pontos → Aprovar.',
          'Selecione o status inicial: Trial (período gratuito) ou Ativo (já pagante).',
          'Se Trial: defina o número de dias de trial (padrão: 30 dias).',
          'Se Ativo: informe o valor mensal (R$) e o plano contratado.',
          'Clique em "Confirmar aprovação" — o operador recebe acesso imediato.',
        ],
      },
      {
        type: "cards",
        label: "Status de assinatura dos operadores",
        content: [
          { icon: CheckCircle2,  label: "Ativo",              desc: "Plano pago em dia. Acesso completo à plataforma." },
          { icon: Clock,         label: "Trial",              desc: "Período gratuito de teste. Expira após os dias definidos. Converta em Ativo ao fechar contrato." },
          { icon: AlertTriangle, label: "Aguardando",         desc: "Operador se cadastrou mas ainda não foi aprovado. Sem acesso ao sistema." },
          { icon: ShieldAlert,   label: "Suspenso",           desc: "Conta bloqueada por inadimplência ou violação. O operador vê mensagem de suspensão." },
        ],
      },
      {
        type: "steps",
        label: "Como criar um cliente manualmente",
        steps: [
          'No topo do /admin, clique em "+ Novo Cliente".',
          "Preencha: Nome da empresa, usuário (login), senha inicial, e-mail e telefone.",
          "Defina o status: Trial (com número de dias) ou Ativo (com valor mensal).",
          'Clique em "Criar" — o cliente já pode fazer login imediatamente.',
          "Envie as credenciais ao cliente por e-mail ou WhatsApp.",
        ],
      },
      {
        type: "cards",
        label: "Outras ações por operador",
        content: [
          { icon: HardDrive,  label: "Quota de armazenamento", desc: "Defina o limite em GB para uploads de mídia. Padrão: 5GB. Aumentar conforme o plano." },
          { icon: CreditCard, label: "Lançar cobrança",        desc: "Registre faturas avulsas ou por plano. Defina valor, vencimento e descrição." },
          { icon: Trash2,     label: "Excluir operador",       desc: "Remove o operador e todos os dados (telas, mídias, playlists). Ação irreversível." },
          { icon: Eye,        label: "Ver histórico",          desc: "Acesse relatórios específicos do operador: plays, campanhas, armazenamento." },
        ],
      },
      { type: "warning", content: "A exclusão de um operador remove permanentemente todas as telas, mídias, playlists e relatórios desse cliente. Sempre confirme antes de excluir — não há recuperação." },
    ],
  },
  {
    id: "telas",
    label: "Gestão de Telas",
    icon: Monitor,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    title: "Gestão Global de Telas (Devices)",
    intro: "O admin enxerga todas as telas de todos os operadores em /devices. Quando um operador instala o app pela primeira vez, a tela aparece como \"Aguardando aprovação\" até que o admin libere.",
    items: [
      { type: "mockup", component: "approve-device" },
      {
        type: "steps",
        label: "Fluxo de auto-registro de dispositivo",
        steps: [
          "O operador instala o APK no dispositivo Taurus/TB50/TB10 etc.",
          "Na primeira execução, o player gera um código de 6 dígitos e envia para o sistema como \"pendente\".",
          'No /devices do admin, a tela aparece com badge laranja "Aguardando aprovação".',
          'O admin clica em "Aprovar" — o dispositivo fica ativo e começa a receber playlists.',
          "O operador pode então publicar conteúdo normalmente para essa tela.",
        ],
      },
      {
        type: "cards",
        label: "O que o admin pode fazer por tela",
        content: [
          { icon: CheckCircle2, label: "Aprovar / Negar",     desc: "Libera ou rejeita um novo dispositivo. Apenas dispositivos aprovados aceitam playlists." },
          { icon: Eye,          label: "Ver detalhes",        desc: "Acesse a tela de detalhe com histórico de conexões, screenshots e configurações." },
          { icon: Activity,     label: "Monitorar",           desc: "Veja o status online/offline em tempo real no painel de monitoramento." },
          { icon: Settings,     label: "Configurar",          desc: "Ajuste resolução, rotação, brilho, dimensões do painel LED e foto de identificação." },
        ],
      },
      { type: "tip", content: "No menu /devices, o admin vê todas as telas de todos os operadores. Use o campo de busca para filtrar por nome, operador ou código de dispositivo." },
    ],
  },
  {
    id: "apk",
    label: "APK — Versões e Install",
    icon: Smartphone,
    color: "text-sky-500",
    bg: "bg-sky-500/10",
    title: "Gerenciamento de APK — Versões e Instalação Remota",
    intro: "O sistema possui uma gestão completa de versões de APK: você cadastra os builds por perfil de hardware, e pode forçar a atualização de qualquer tela remotamente via monitoramento — sem precisar ir ao local físico.",
    items: [
      { type: "mockup", component: "apk-versions" },
      {
        type: "steps",
        label: "Como cadastrar uma nova versão de APK",
        steps: [
          'Acesse /settings → role até a seção "Versões de APK".',
          'Clique em "+ Nova versão".',
          'Preencha: Perfil de hardware (ex: t10plus = TB10 Plus), Versão (ex: 1.15.34), Build number (ex: 11534).',
          'Cole a URL pública do APK (GitHub Releases, servidor próprio, etc.).',
          'Opcionalmente adicione notas de lançamento.',
          'Clique em "Criar" — a versão já aparece disponível para push install.',
        ],
      },
      {
        type: "cards",
        label: "Perfis de hardware (dispositivos Taurus)",
        content: [
          { icon: Cpu,        label: "t10plus → TB10 Plus",  desc: "armeabi-v7a. Taurus TB10 Plus — o mais comum na rede RPShow." },
          { icon: Cpu,        label: "fat → TB50 Fat ARM",   desc: "arm64-v8a + armeabi-v7a. Universal para TB50 e dispositivos 64-bit." },
          { icon: Cpu,        label: "t10 → TB10",           desc: "armeabi-v7a. Taurus TB10 standard (modelo básico)." },
          { icon: Cpu,        label: "t1 → TB1",             desc: "armeabi-v7a. Taurus TB1 (modelo compacto)." },
        ],
      },
      { type: "mockup", component: "apk-push" },
      {
        type: "steps",
        label: "Como instalar APK remotamente em uma tela",
        steps: [
          'Acesse /monitoring e localize a tela desejada.',
          "Clique no card da tela para abrir o painel expandido.",
          'Role até a seção azul "Instalar / Atualizar APK nesta tela" e clique para abrir.',
          "No select, escolha a versão do APK compatível com o hardware da tela.",
          'Clique em "Enviar para o player".',
          "Em até 30 segundos (próximo heartbeat), o player recebe o comando e inicia o download via NovaStar API.",
          "O NovaStar instala o APK automaticamente e reinicia o app.",
        ],
      },
      {
        type: "cards",
        label: "Como funciona o push install internamente",
        content: [
          { icon: Send,        label: "Heartbeat delivery",   desc: "O comando é armazenado em memória no servidor. Na próxima chamada de heartbeat do player (~30s), o servidor inclui installApkUrl na resposta." },
          { icon: Smartphone,  label: "NovaStar HTTP API",    desc: "O player chama a API local do NovaStar na porta 7788. Faz login (admin/123456) e envia o comando de install com a URL do APK." },
          { icon: Download,    label: "3 endpoints tentados", desc: "/api/v1/appMgr/install → /api/v1/system/app/install → /api/v2/appPkg/install. O primeiro que aceitar executa a instalação." },
          { icon: CheckCircle2, label: "Confirmação",         desc: "O NovaStar faz download do APK a partir da URL fornecida e instala silenciosamente, sem interação do usuário no dispositivo." },
        ],
      },
      { type: "warning", content: "O push install só funciona em dispositivos Taurus com NovaStar configurado (porta 7788). Dispositivos sem NovaStar (tablets Android genéricos) não suportam este recurso." },
      { type: "tip", content: "Sempre verifique o perfil de hardware antes de fazer push install. Instalar um APK do perfil errado pode corromper o player. Use a aba de detalhes da tela para ver o modelo." },
    ],
  },
  {
    id: "monitoramento",
    label: "Monitoramento",
    icon: Activity,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    title: "Monitoramento Global — Todas as Telas",
    intro: "O admin enxerga em /monitoring todas as telas de todos os operadores em tempo real. É a central de controle para verificar saúde, forçar screenshots, instalar APKs remotamente e investigar problemas.",
    items: [
      {
        type: "cards",
        label: "O que o admin vê a mais que o operador",
        content: [
          { icon: Users,       label: "Todas as contas",     desc: "O admin enxerga telas de todos os operadores, não só da própria conta." },
          { icon: Smartphone,  label: "Instalar APK",        desc: "Painel de push install disponível em cada tela — exclusivo para admin." },
          { icon: Camera,      label: "Forçar screenshot",   desc: "Solicita screenshot em qualquer tela de qualquer operador." },
          { icon: BarChart3,   label: "Stats por tela",      desc: "Plays hoje, última exibição, status de conexão e timeline de conexões." },
        ],
      },
      {
        type: "steps",
        label: "Como investigar uma tela com problema",
        steps: [
          "Acesse /monitoring — telas offline aparecem com borda vermelha.",
          "Clique no card da tela suspeita para abrir o painel expandido.",
          'Na aba "Status", veja: status atual, último contato, plays hoje, última mídia exibida.',
          'Na aba "Screenshots", force um novo screenshot para ver o que está (ou não está) na tela.',
          'Na aba "Conexões", veja o histórico de entradas/saídas (online/offline) com timestamps.',
          'Na aba "Últimas Mídias", confirme se o conteúdo está sendo exibido corretamente.',
          "Se necessário, use o push APK para atualizar o player com uma versão corrigida.",
        ],
      },
      { type: "tip", content: "O monitoramento atualiza a cada 30 segundos automaticamente. Para uma varredura rápida, use o filtro de status (online/offline) no topo da página." },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: CreditCard,
    color: "text-green-500",
    bg: "bg-green-500/10",
    title: "Gestão Financeira e Cobrança",
    intro: "O módulo financeiro (/financeiro-admin) centraliza todas as faturas, recebimentos e planos da plataforma. Aqui você lança cobranças, registra pagamentos e acompanha o MRR.",
    items: [
      { type: "mockup", component: "financeiro" },
      {
        type: "cards",
        label: "Tipos de cobrança disponíveis",
        content: [
          { icon: CreditCard, label: "Plano mensal",     desc: "Valor fixo mensal por número de telas ativas. Configurado ao aprovar ou editar o operador." },
          { icon: DollarSign, label: "Cobrança avulsa",  desc: "Valor pontual para serviços extras: instalação, suporte presencial, configuração inicial." },
          { icon: Download,   label: "Comprovante PDF",  desc: "Gere um comprovante formatado para enviar ao cliente via e-mail ou WhatsApp." },
          { icon: AlertTriangle, label: "Alertas de vencimento", desc: "Faturas com mais de 30 dias aparecem como Vencido em vermelho — prioridade de cobrança." },
        ],
      },
      {
        type: "steps",
        label: "Como lançar uma fatura para um operador",
        steps: [
          'Acesse /financeiro-admin → clique em "Nova Cobrança".',
          "Selecione o operador na lista.",
          "Escolha o tipo: Plano (mensal, por telas) ou Avulsa (valor livre).",
          "Informe o valor (R$), descrição e data de vencimento.",
          'Clique em "Criar fatura" — aparece na lista do operador como Pendente.',
          "Quando o cliente pagar, marque como Pago para atualizar o status.",
        ],
      },
      { type: "tip", content: "Dados de recebimento: PIX claudio@rpshow.com.br | CNPJ 43.738.727/0001-83. Para gerar um comprovante formatado para o cliente, use o botão de impressão na fatura." },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios Admin",
    icon: BarChart3,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    title: "Relatórios Administrativos — 12 Visões da Plataforma",
    intro: "O admin tem acesso a 12 relatórios diferentes em /reports-admin, cobrindo desde exibições e campanhas até financeiro, armazenamento e disponibilidade de telas — sempre com filtros por período e exportação CSV.",
    items: [
      { type: "mockup", component: "reports-admin" },
      {
        type: "cards",
        label: "Catálogo completo de relatórios",
        content: [
          { icon: Play,         label: "Exibições",         desc: "Total de plays por dia, semana ou mês. Agrega todos os operadores ou filtra por conta." },
          { icon: Megaphone,    label: "Campanhas",         desc: "Campanhas ativas e encerradas com número de telas, plays e período de exibição." },
          { icon: Users,        label: "Clientes",          desc: "Performance por operador: plays, uptime, mídias mais exibidas." },
          { icon: CreditCard,   label: "Financeiro",        desc: "MRR, inadimplência, recebimentos por período, projeção de receita." },
          { icon: Wifi,         label: "Disponibilidade",   desc: "Uptime % de cada tela, histórico de quedas e tempo offline acumulado." },
          { icon: Monitor,      label: "Por Tela",          desc: "Detalhamento por dispositivo: plays, duração de exibição, última mídia." },
          { icon: Star,         label: "Top Mídias",        desc: "As mídias mais exibidas na plataforma toda ou por operador." },
          { icon: MapPin,       label: "Locais",            desc: "Mapa e listagem dos locais cadastrados com coordenadas geográficas." },
          { icon: CreditCard,   label: "Assinaturas",       desc: "Status de todos os planos: ativos, trial, vencimentos próximos." },
          { icon: Activity,     label: "Atividade",         desc: "Logins, edições e ações realizadas por operadores (auditoria)." },
          { icon: HardDrive,    label: "Armazenamento",     desc: "Uso de storage por operador: total utilizado vs. quota disponível." },
          { icon: LayoutDashboard, label: "Visão Geral",   desc: "Dashboard consolidado com os principais KPIs de toda a plataforma." },
        ],
      },
      {
        type: "steps",
        label: "Como exportar um relatório",
        steps: [
          "Acesse o relatório desejado em /reports-admin/[tipo].",
          "Use os filtros de período (início/fim) e operador (se aplicável).",
          'Clique em "CSV" para baixar os dados brutos para Excel.',
          'Clique em "Imprimir" para abrir a versão formatada para PDF/impressão.',
          "Para Prova de Exibição de campanhas, use o botão específico na página de Campanhas.",
        ],
      },
      { type: "tip", content: "O relatório de Disponibilidade é o mais útil para negociação de SLA com clientes: mostra o uptime % de cada tela no período selecionado." },
    ],
  },
  {
    id: "emergencia",
    label: "Alertas de Emergência",
    icon: Bell,
    color: "text-red-500",
    bg: "bg-red-500/10",
    title: "Alertas de Emergência — Broadcast para Todas as Telas",
    intro: "O sistema de alertas permite ao admin (e aos operadores) disparar uma mensagem de emergência que sobrepõe imediatamente o conteúdo de todas as telas, com destaque visual em vermelho.",
    items: [
      { type: "mockup", component: "emergency" },
      {
        type: "steps",
        label: "Como disparar um alerta de emergência",
        steps: [
          'No menu lateral, acesse "Alertas de Emergência" (ícone de sino).',
          "Escreva a mensagem clara e objetiva (ex: \"Evacuação — use a saída lateral\").",
          "Selecione a cor de fundo (vermelho padrão, personalizável).",
          "Escolha o destino: todas as telas da conta ou grupos/telas específicas.",
          'Clique em "Disparar" — o alerta é entregue ao próximo heartbeat de cada player (até 30s).',
          "Para encerrar, acesse o painel novamente e clique em \"Desativar alerta\".",
        ],
      },
      {
        type: "cards",
        label: "Características do sistema de alertas",
        content: [
          { icon: Zap,          label: "Prioridade máxima",   desc: "O alerta sobrepõe 100% do conteúdo exibido. Não há como ignorar — aparece em overlay sobre tudo." },
          { icon: Radio,        label: "Entrega via heartbeat", desc: "Cada player recebe o alerta no próximo ciclo de heartbeat (máximo 30 segundos após o disparo)." },
          { icon: Layers,       label: "Persistente",          desc: "O alerta permanece ativo até ser desativado explicitamente. Não some sozinho." },
          { icon: Bell,         label: "Histórico de alertas", desc: "Todos os alertas disparados ficam registrados com timestamp, mensagem e quem disparou." },
        ],
      },
      { type: "warning", content: "Use o alerta de emergência APENAS para situações reais (evacuação, queda de energia, comunicado urgente). Alertas falsos ou de teste devem ser cancelados imediatamente para não causar pânico." },
    ],
  },
  {
    id: "seguranca",
    label: "Segurança Admin",
    icon: Shield,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    title: "Segurança — Proteção da Conta Admin",
    intro: "A conta admin tem acesso total à plataforma. Por isso, a segurança é crítica: o 2FA é obrigatório, os dispositivos confiáveis devem ser revisados periodicamente, e as credenciais nunca devem ser compartilhadas.",
    items: [
      { type: "mockup", component: "security-admin" },
      {
        type: "steps",
        label: "Como ativar o 2FA na conta admin",
        steps: [
          'Acesse /security-admin → seção "Autenticação em Dois Fatores".',
          'Clique em "Ativar 2FA".',
          "Escaneie o QR Code com o Google Authenticator ou Authy.",
          "Digite o código de 6 dígitos gerado pelo app para confirmar.",
          "O 2FA estará ativo. No próximo login, o sistema pedirá o código após a senha.",
          'Para dispositivos de confiança, marque "Confiar neste dispositivo por 30 dias" para não pedir o código repetidamente.',
        ],
      },
      {
        type: "cards",
        label: "Boas práticas de segurança para o admin",
        content: [
          { icon: Shield,       label: "2FA sempre ativo",         desc: "Nunca desative o 2FA da conta admin. É a principal barreira contra acessos não autorizados." },
          { icon: RefreshCw,    label: "Revise dispositivos",      desc: "Mensalmente, revise e remova dispositivos confiáveis desconhecidos ou inativos em /security-admin." },
          { icon: ShieldAlert,  label: "Senha forte",              desc: "Use uma senha com 12+ caracteres, letras maiúsculas/minúsculas, números e símbolos." },
          { icon: Users,        label: "Nunca compartilhe",        desc: "Cada operador tem sua própria conta. Nunca passe as credenciais admin para clientes." },
        ],
      },
      { type: "warning", content: "Se suspeitar que a conta admin foi comprometida: (1) altere a senha imediatamente, (2) revogue todos os dispositivos confiáveis, (3) verifique o log de atividade em /reports-admin/atividade." },
    ],
  },
];


// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminAjuda() {
  const [active, setActive] = useState(sections[0].id);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => {
      for (const s of sections) {
        const ref = sectionRefs.current[s.id];
        if (ref && ref.getBoundingClientRect().top < window.innerHeight * 0.45) {
          setActive(s.id);
        }
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    const ref = sectionRefs.current[id];
    if (ref) ref.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b bg-gradient-to-r from-amber-500/10 to-primary/5 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Manual do Administrador</h1>
            <p className="text-sm text-muted-foreground">RPShow OnSign · Guia completo para operação da plataforma</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-500/30">
            <Star className="w-3 h-3" /> Exclusivo Admin
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 text-sky-600 border-sky-500/30">
            <Smartphone className="w-3 h-3" /> APK Remote Install
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 text-emerald-600 border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> {sections.length} seções
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 text-purple-600 border-purple-500/30">
            <Shield className="w-3 h-3" /> v1.16
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-0">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 border-r overflow-y-auto px-2 py-4 space-y-0.5 hidden lg:block">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                active === s.id
                  ? "bg-amber-500 text-white font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <s.icon className="w-3.5 h-3.5 shrink-0" />
              {s.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-12">
          {sections.map((section) => (
            <section
              key={section.id}
              ref={(el) => { sectionRefs.current[section.id] = el; }}
              id={section.id}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", section.bg)}>
                  <section.icon className={cn("w-5 h-5", section.color)} />
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">{section.title}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{section.intro}</p>
                </div>
              </div>

              <div className="space-y-5 pl-0">
                {section.items.map((item, i) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const si = item as any;
                  return (
                    <div key={i}>
                      {si.type !== "tip" && si.type !== "warning" && si.type !== "mockup" && si.label && (
                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                          <ChevronRight className="w-3.5 h-3.5 text-amber-500" />
                          {si.label}
                        </h3>
                      )}
                      {si.type === "steps"   && <StepList steps={si.steps} />}
                      {si.type === "cards"   && <CardGrid items={si.content} />}
                      {si.type === "tip"     && <TipBox content={si.content} />}
                      {si.type === "warning" && <WarningBox content={si.content} />}
                      {si.type === "mockup"  && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Exemplo visual interativo
                          </p>
                          <MockupSwitch component={si.component} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-10 border-t border-dashed" />
            </section>
          ))}

          {/* Footer */}
          <div className="pb-8 text-center text-xs text-muted-foreground space-y-1">
            <p className="font-semibold">RPShow OnSign · Manual do Administrador · v1.16</p>
            <p>Suporte técnico: WhatsApp (16) 98220-8695 · contato@rpshow.com.br</p>
            <p className="text-[10px] text-muted-foreground/60">Este manual é confidencial. Não compartilhar com operadores.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
