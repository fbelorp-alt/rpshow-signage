import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Megaphone, TrendingUp, CalendarRange, Users, Download, Printer, Search, ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

type Campaign = {
  campaignGroupId: string | null;
  name: string;
  clientName: string | null;
  startAt: string | null;
  endAt: string | null;
  active: boolean;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function buildReportLink(c: Campaign) {
  const params = new URLSearchParams();
  if (c.startAt) params.set("from", c.startAt.slice(0, 10));
  if (c.endAt)   params.set("to",   c.endAt.slice(0, 10));
  if (c.campaignGroupId) params.set("campaignGroupId", c.campaignGroupId);
  if (c.clientName)      params.set("clientName", c.clientName);
  return `/reports?${params.toString()}`;
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportCsv(rows: Campaign[]) {
  const header = ["Campanha", "Cliente", "Início", "Fim", "Status"];
  const body = rows.map(c => [
    c.name,
    c.clientName ?? "",
    fmtDate(c.startAt),
    fmtDate(c.endAt),
    c.active ? "Ativa" : "Pausada",
  ]);
  downloadCsv([header, ...body].map(r => r.map(v => `"${v}"`).join(",")).join("\n"),
    `relatorio_campanhas_${new Date().toISOString().slice(0, 10)}.csv`);
}

function printReport(rows: Campaign[]) {
  const logoUrl = `${window.location.origin}/logo-rpshow.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const rowsHtml = rows.map(c => `
    <tr>
      <td>${c.name}</td>
      <td>${c.clientName ?? "—"}</td>
      <td class="mono">${fmtDate(c.startAt)}</td>
      <td class="mono">${fmtDate(c.endAt)}</td>
      <td class="center">${c.active ? "Ativa" : "Pausada"}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
  <title>Relatório de Campanhas — RPShow OnSign</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff}
    .header{display:flex;align-items:center;gap:20px;padding:20px 28px 16px;border-bottom:3px solid #111}
    .header img{height:64px;width:auto}
    .header-text h1{font-size:22px;font-weight:900;color:#111}
    .header-text p{font-size:12px;color:#555;margin-top:2px}
    .header-right{margin-left:auto;text-align:right;font-size:10px;color:#666;line-height:1.6}
    .header-right strong{font-size:13px;color:#111;display:block}
    .meta{display:flex;gap:32px;padding:12px 28px;background:#f4f4f4;border-bottom:1px solid #ddd;font-size:11px}
    .meta-item label{font-weight:700;text-transform:uppercase;font-size:9px;letter-spacing:.8px;color:#888;display:block;margin-bottom:2px}
    .meta-item span{font-size:13px;font-weight:600;color:#111}
    .table-wrap{padding:20px 28px}
    .table-title{font-size:13px;font-weight:700;margin-bottom:10px;color:#333;border-left:4px solid #111;padding-left:10px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    thead tr{background:#111;color:#fff}
    thead th{padding:9px 12px;text-align:left;font-weight:700;font-size:10px;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}
    tbody tr{border-bottom:1px solid #e5e5e5}
    tbody tr:nth-child(even){background:#f9f9f9}
    td{padding:7px 12px;vertical-align:middle}
    td.mono{font-family:monospace;font-size:10.5px;white-space:nowrap}
    td.center{text-align:center}
    .footer{padding:14px 28px 20px;font-size:9px;color:#aaa;text-align:center;border-top:1px solid #e0e0e0;margin-top:10px}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:10mm}}
  </style></head><body>
  <div class="header">
    <img src="${logoUrl}" alt="RPShow"/>
    <div class="header-text"><h1>RPShow OnSign</h1><p>Sistema de Sinalização Digital</p></div>
    <div class="header-right"><strong>RELATÓRIO DE CAMPANHAS</strong>${now}</div>
  </div>
  <div class="meta">
    <div class="meta-item"><label>Total de Campanhas</label><span>${rows.length}</span></div>
    <div class="meta-item"><label>Ativas</label><span>${rows.filter(c => c.active).length}</span></div>
    <div class="meta-item"><label>Com Período</label><span>${rows.filter(c => c.startAt && c.endAt).length}</span></div>
    <div class="meta-item"><label>Gerado em</label><span>${now}</span></div>
  </div>
  <div class="table-wrap">
    <div class="table-title">Campanhas</div>
    <table>
      <thead><tr>
        <th>Campanha</th><th>Cliente</th><th>Início</th><th>Fim</th><th>Status</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
  <div class="footer">RPShow OnSign — Relatório gerado em ${now}</div>
  </body></html>`;

  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) { alert("Permita popups para imprimir."); return; }
  win.document.write(html); win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

export default function ReportsCampanhasAdmin() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["admin-report-campaigns"],
    queryFn: () => fetch("/api/reports/campaigns", { credentials: "include" }).then(r => r.json()),
  });

  const filtered = useMemo(() => {
    return campaigns.filter(c => {
      if (statusFilter === "active" && !c.active) return false;
      if (statusFilter === "paused" && c.active) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !c.name.toLowerCase().includes(q) &&
          !(c.clientName ?? "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [campaigns, search, statusFilter]);

  const total        = filtered.length;
  const activeCount  = filtered.filter(c => c.active).length;
  const withPeriod   = filtered.filter(c => c.startAt && c.endAt).length;
  const uniqueClients = new Set(filtered.map(c => c.clientName).filter(Boolean)).size;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatório de Campanhas</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão consolidada de todas as campanhas cadastradas na plataforma.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total de Campanhas", value: total,        icon: Megaphone,    color: "bg-primary/10",      iconColor: "text-primary" },
          { label: "Ativas",             value: activeCount,  icon: TrendingUp,   color: "bg-emerald-500/10",  iconColor: "text-emerald-400" },
          { label: "Com Período",        value: withPeriod,   icon: CalendarRange, color: "bg-blue-500/10",    iconColor: "text-blue-400" },
          { label: "Clientes Únicos",    value: uniqueClients, icon: Users,        color: "bg-violet-500/10",  iconColor: "text-violet-400" },
        ].map(stat => (
          <div key={stat.label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center shrink-0`}>
              <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{stat.label}</p>
              {isLoading
                ? <Skeleton className="h-8 w-16 mt-1" />
                : <p className="text-2xl font-black tabular-nums">{stat.value}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-card border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por campanha ou cliente..."
              className="h-8 text-xs pl-8"
            />
          </div>

          {/* Status filter pills */}
          <div className="flex gap-1">
            {(["all", "active", "paused"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {s === "all" ? "Todas" : s === "active" ? "Ativas" : "Pausadas"}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <Button variant="outline" size="sm" className="h-8 gap-2 text-xs" onClick={() => printReport(filtered)}>
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </Button>
          <Button size="sm" className="h-8 gap-2 text-xs" onClick={() => exportCsv(filtered)}>
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Campanha</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Cliente</th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Início</th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Fim</th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Relatório</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-3 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    Nenhuma campanha encontrada
                  </td>
                </tr>
              ) : filtered.map((c, i) => (
                <tr key={c.campaignGroupId ?? i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5">
                    <p className="text-sm font-medium">{c.name}</p>
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-xs text-muted-foreground">
                    {c.clientName ?? <span className="italic opacity-50">—</span>}
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell text-center text-xs tabular-nums text-muted-foreground">
                    {fmtDate(c.startAt)}
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell text-center text-xs tabular-nums text-muted-foreground">
                    {fmtDate(c.endAt)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge variant="outline" className={c.active
                      ? "text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "text-[10px] bg-muted text-muted-foreground border-border"}>
                      {c.active ? "Ativa" : "Pausada"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {c.startAt && c.endAt ? (
                      <Link href={buildReportLink(c)}>
                        <button className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                          <ExternalLink className="w-3 h-3" />
                          Ver
                        </button>
                      </Link>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">Sem período</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
