import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users, UserCheck, Clock, Monitor, Download, Printer, Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Operator = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  trialDays: number;
  pricePerScreen: string;
  monthlyAmount: string;
  screenCount: number;
  createdAt: string;
};

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  trial:     { label: "Em Trial",  cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  active:    { label: "Ativo",     cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  overdue:   { label: "Atrasado",  cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, cls: "bg-muted text-muted-foreground border-border" };
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportClientsCsv(rows: Operator[]) {
  const header = ["Cliente", "Usuário", "E-mail", "Telefone", "Status", "Telas", "Valor/Tela", "Mensalidade", "Cliente desde"];
  const body = rows.map(o => [
    o.name, o.username, o.email ?? "", o.phone ?? "", statusMeta(o.subscriptionStatus).label,
    o.screenCount, o.pricePerScreen, o.monthlyAmount, fmtDate(o.createdAt),
  ]);
  downloadCsv([header, ...body].map(r => r.map(c => `"${c}"`).join(",")).join("\n"), `relatorio_clientes_${new Date().toISOString().slice(0, 10)}.csv`);
}

function printClientsReport(rows: Operator[]) {
  const logoUrl = `${window.location.origin}/logo-rpshow.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const totalMonthly = rows.reduce((s, o) => s + parseFloat(o.monthlyAmount || "0"), 0);
  const totalScreens = rows.reduce((s, o) => s + o.screenCount, 0);
  const rowsHtml = rows.map(o => `<tr><td>${o.name}</td><td>${o.username}</td><td>${o.email ?? "—"}</td><td>${o.phone ?? "—"}</td><td class="center">${statusMeta(o.subscriptionStatus).label}</td><td class="mono center">${o.screenCount}</td><td class="mono">${brl(parseFloat(o.pricePerScreen || "0"))}</td><td class="mono">${brl(parseFloat(o.monthlyAmount || "0"))}</td><td class="mono">${fmtDate(o.createdAt)}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Relatório de Clientes — RPShow OnSign</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff}.header{display:flex;align-items:center;gap:20px;padding:20px 28px 16px;border-bottom:3px solid #111}.header img{height:64px;width:auto}.header-text h1{font-size:22px;font-weight:900;color:#111}.header-text p{font-size:12px;color:#555;margin-top:2px}.header-right{margin-left:auto;text-align:right;font-size:10px;color:#666;line-height:1.6}.header-right strong{font-size:13px;color:#111;display:block}.meta{display:flex;gap:32px;padding:12px 28px;background:#f4f4f4;border-bottom:1px solid #ddd;font-size:11px}.meta-item label{font-weight:700;text-transform:uppercase;font-size:9px;letter-spacing:.8px;color:#888;display:block;margin-bottom:2px}.meta-item span{font-size:13px;font-weight:600;color:#111}.table-wrap{padding:20px 28px}.table-title{font-size:13px;font-weight:700;margin-bottom:10px;color:#333;border-left:4px solid #111;padding-left:10px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#111;color:#fff}thead th{padding:9px 12px;text-align:left;font-weight:700;font-size:10px;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}tbody tr{border-bottom:1px solid #e5e5e5}tbody tr:nth-child(even){background:#f9f9f9}td{padding:7px 12px;vertical-align:middle}td.mono{font-family:monospace;font-size:10.5px;white-space:nowrap}td.center{text-align:center}.footer{padding:14px 28px 20px;font-size:9px;color:#aaa;text-align:center;border-top:1px solid #e0e0e0;margin-top:10px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:10mm}}</style></head><body><div class="header"><img src="${logoUrl}" alt="RPShow"/><div class="header-text"><h1>RPShow OnSign</h1><p>Sistema de Sinalização Digital</p></div><div class="header-right"><strong>RELATÓRIO DE CLIENTES</strong>Gerado em: ${now}</div></div><div class="meta"><div class="meta-item"><label>Total de clientes</label><span>${rows.length}</span></div><div class="meta-item"><label>Total de telas</label><span>${totalScreens}</span></div><div class="meta-item"><label>Mensalidade total</label><span>${brl(totalMonthly)}</span></div></div><div class="table-wrap"><div class="table-title">Clientes Cadastrados</div><table><thead><tr><th>Cliente</th><th>Usuário</th><th>E-mail</th><th>Telefone</th><th>Status</th><th>Telas</th><th>Valor/Tela</th><th>Mensalidade</th><th>Desde</th></tr></thead><tbody>${rowsHtml}</tbody></table></div><div class="footer">RPShow OnSign · Relatório gerado em ${now} · Horários em BRT (Brasília)</div><script>window.onload=()=>{window.print();}<\/script></body></html>`;
  const win = window.open("", "_blank", "width=1200,height=800");
  if (!win) { alert("Permita popups para imprimir."); return; }
  win.document.write(html); win.document.close();
}

export default function ReportsClientesAdmin() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: operators = [], isLoading } = useQuery<Operator[]>({
    queryKey: ["admin-report-clients"],
    queryFn: () => fetch("/api/admin/operators", { credentials: "include" }).then(r => r.json()),
  });

  const filtered = useMemo(() => {
    return operators.filter(o => {
      if (statusFilter !== "all" && o.subscriptionStatus !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!o.name.toLowerCase().includes(q) && !o.email?.toLowerCase().includes(q) && !o.username.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [operators, search, statusFilter]);

  const totalClients  = filtered.length;
  const trialCount    = filtered.filter(o => o.subscriptionStatus === "trial").length;
  const activeCount   = filtered.filter(o => o.subscriptionStatus === "active").length;
  const totalScreens  = filtered.reduce((s, o) => s + o.screenCount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatório de Clientes</h1>
        <p className="text-muted-foreground text-sm mt-1">Base completa de clientes cadastrados na plataforma, pronta para impressão.</p>
      </div>

      <div className="bg-card border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, usuário ou e-mail..." className="h-8 text-xs pl-8" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="trial">Em Trial</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="overdue">Atrasado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="h-8 gap-2 text-xs" onClick={() => printClientsReport(filtered)}>
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </Button>
          <Button size="sm" className="h-8 gap-2 text-xs" onClick={() => exportClientsCsv(filtered)}>
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total de Clientes</p>
            {isLoading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-black tabular-nums">{totalClients}</p>}
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Em Trial</p>
            {isLoading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-black tabular-nums">{trialCount}</p>}
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Ativos</p>
            {isLoading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-black tabular-nums">{activeCount}</p>}
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
            <Monitor className="w-6 h-6 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total de Telas</p>
            {isLoading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-black tabular-nums">{totalScreens}</p>}
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">E-mail</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Telefone</th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Telas</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Valor/Tela</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mensalidade</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-3 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">Nenhum cliente encontrado</td></tr>
              ) : filtered.map(o => {
                const meta = statusMeta(o.subscriptionStatus);
                return (
                  <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-medium">{o.name}</p>
                      <p className="text-[11px] text-muted-foreground">@{o.username}</p>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell text-xs text-muted-foreground">{o.email ?? "—"}</td>
                    <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">{o.phone ?? "—"}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs font-medium tabular-nums">{o.screenCount}</td>
                    <td className="px-3 py-2.5 hidden md:table-cell text-right text-xs tabular-nums">{brl(parseFloat(o.pricePerScreen || "0"))}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums">{brl(parseFloat(o.monthlyAmount || "0"))}</td>
                    <td className="px-3 py-2.5 hidden lg:table-cell text-right text-xs text-muted-foreground">{fmtDate(o.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
