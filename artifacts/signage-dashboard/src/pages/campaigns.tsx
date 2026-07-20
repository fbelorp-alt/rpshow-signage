import { useMemo, useState } from "react";
import { Link } from "wouter";
import { QuickCampaignWizard } from "@/components/quick-campaign-wizard";
import {
  useListSchedules,
  useListScreens,
  useListPlaylists,
  useCreateSchedule,
  useDeleteSchedule,
  useUpdateSchedule,
  getListSchedulesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Megaphone, CalendarDays, Monitor, ListVideo, BarChart2,
  Plus, Search, Clock, CheckCircle2, Building2, Trash2,
  RefreshCw, Play, Pause, FileText, X, Check, Zap, ArrowRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

// ─── helpers ────────────────────────────────────────────────────────────────
function todayBRT() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
function fmtDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
  });
}
function fmtDateShort(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit",
  });
}
function fmtDateLong(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric",
  });
}

type CampaignStatus = "ativa" | "agendada" | "encerrada" | "recorrente" | "pausada";
function getCampaignStatus(s: {
  active: boolean; startAt?: string | null; endAt?: string | null;
  startTime?: string | null; daysOfWeek?: string | null;
}): CampaignStatus {
  if (!s.active) return "pausada";
  const today = todayBRT();
  if (s.startAt || s.endAt) {
    const start = s.startAt ? s.startAt.slice(0, 10) : null;
    const end   = s.endAt   ? s.endAt.slice(0, 10)   : null;
    if (start && today < start) return "agendada";
    if (end   && today > end)   return "encerrada";
    return "ativa";
  }
  if (s.startTime || s.daysOfWeek) return "recorrente";
  return "ativa";
}
const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; dot: string }> = {
  ativa:      { label: "Em andamento", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
  agendada:   { label: "Agendada",     color: "bg-blue-500/15 text-blue-400 border-blue-500/30",         dot: "bg-blue-400"    },
  encerrada:  { label: "Encerrada",    color: "bg-white/5 text-white/30 border-white/10",                dot: "bg-white/30"    },
  recorrente: { label: "Recorrente",   color: "bg-violet-500/15 text-violet-400 border-violet-500/30",   dot: "bg-violet-400"  },
  pausada:    { label: "Pausada",      color: "bg-amber-500/15 text-amber-400 border-amber-500/30",      dot: "bg-amber-400"   },
};
function StatusBadge({ status }: { status: CampaignStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border", cfg.color)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
function progressPercent(startAt?: string | null, endAt?: string | null): number | null {
  if (!startAt || !endAt) return null;
  const start = new Date(startAt).getTime(), end = new Date(endAt).getTime(), now = Date.now();
  if (now <= start) return 0;
  if (now >= end)   return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}
function daysRemaining(endAt?: string | null): number | null {
  if (!endAt) return null;
  return Math.max(0, Math.ceil((new Date(endAt).getTime() - Date.now()) / 86400000));
}

// ─── Campaign group (one logical campaign = N schedule rows with same campaignGroupId) ──
interface CampaignGroup {
  groupId: string | null;       // null = single-screen legacy
  ids: number[];                // all schedule IDs in this group
  name: string;
  clientName: string | null;
  playlistId: number;
  playlistName: string | null;
  startAt: string | null;
  endAt: string | null;
  startTime: string | null;
  endTime: string | null;
  daysOfWeek: string | null;
  active: boolean;
  status: CampaignStatus;
  progress: number | null;
  daysLeft: number | null;
  screens: Array<{ id: number; name: string | null }>;
  createdAt: string | null;
}

// ─── Proof of Play generator ────────────────────────────────────────────────
async function openProofOfPlay(group: CampaignGroup) {
  const logoUrl = `${window.location.origin}/logo-rpshow.png`;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const win = window.open("", "_blank", "width=1100,height=750");
  if (!win) { alert("Permita popups para gerar o Proof of Play."); return; }

  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Proof of Play — ${group.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff}
.header{display:flex;align-items:center;gap:20px;padding:20px 28px 16px;border-bottom:3px solid #111}
.header img{height:60px;width:auto}
.header-text h1{font-size:20px;font-weight:900;color:#111}
.header-text p{font-size:11px;color:#555;margin-top:2px}
.header-right{margin-left:auto;text-align:right;font-size:10px;color:#666;line-height:1.7}
.header-right strong{font-size:13px;color:#111;display:block}
.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:0;padding:14px 28px;background:#f4f4f4;border-bottom:2px solid #ddd}
.meta-item{padding:4px 12px 4px 0}
.meta-item label{font-weight:700;text-transform:uppercase;font-size:8.5px;letter-spacing:.8px;color:#888;display:block;margin-bottom:3px}
.meta-item span{font-size:13px;font-weight:700;color:#111}
.section{padding:20px 28px 0}
.section-title{font-size:12px;font-weight:800;margin-bottom:10px;color:#333;border-left:4px solid #111;padding-left:10px;text-transform:uppercase;letter-spacing:.5px}
table{width:100%;border-collapse:collapse;font-size:11px}
thead tr{background:#111;color:#fff}
thead th{padding:9px 12px;text-align:left;font-weight:700;font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;white-space:nowrap}
tbody tr{border-bottom:1px solid #e8e8e8}
tbody tr:nth-child(even){background:#f9f9f9}
td{padding:8px 12px;vertical-align:middle}
td.mono{font-family:monospace;font-size:10px;white-space:nowrap}
td.center{text-align:center}
td.right{text-align:right}
.total-row td{font-weight:800;background:#f0fdf4!important;border-top:2px solid #16a34a;color:#111}
.screens-list{padding:14px 28px}
.screen-badge{display:inline-block;padding:3px 10px;border-radius:20px;background:#f0f0f0;border:1px solid #ddd;font-size:10px;font-weight:600;margin:2px}
.compliance-box{margin:18px 28px;padding:14px 20px;border-radius:8px;background:#f0fdf4;border:1.5px solid #86efac;display:flex;align-items:center;gap:16px}
.compliance-box .pct{font-size:32px;font-weight:900;color:#16a34a}
.compliance-box .label{font-size:11px;color:#333;line-height:1.6}
.footer{padding:16px 28px 20px;font-size:9px;color:#aaa;text-align:center;border-top:1px solid #e0e0e0;margin-top:20px}
.loading{text-align:center;padding:40px;font-size:14px;color:#888}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:10mm}}
</style></head><body>
<div class="header">
  <img src="${logoUrl}" alt="RPShow" onerror="this.style.display='none'"/>
  <div class="header-text"><h1>RPShow OnSign</h1><p>Proof of Play — Comprovante de Exibição</p></div>
  <div class="header-right"><strong>${group.name}</strong>${group.clientName ? `<br/>${group.clientName}` : ""}<br/>Gerado em ${now}</div>
</div>
<div class="meta">
  <div class="meta-item"><label>Campanha</label><span>${group.name}</span></div>
  <div class="meta-item"><label>Marca / Cliente</label><span>${group.clientName || "—"}</span></div>
  <div class="meta-item"><label>Início</label><span>${fmtDateLong(group.startAt)}</span></div>
  <div class="meta-item"><label>Término</label><span>${fmtDateLong(group.endAt)}</span></div>
</div>
<div class="screens-list">
  <strong style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;">Telas desta campanha:</strong><br/><br/>
  ${group.screens.map(s => `<span class="screen-badge">📺 ${s.name || "Tela " + s.id}</span>`).join("")}
</div>
<div class="section">
  <div class="section-title">Registros de Exibição por Tela</div>
  <div class="loading" id="loading">Buscando dados de exibição…</div>
  <div id="report-table" style="display:none"></div>
</div>
<div class="footer">RPShow OnSign · Sistema de Sinalização Digital · Documento gerado automaticamente</div>
<script>
(async function() {
  const from = ${group.startAt ? `"${group.startAt.slice(0,10)}"` : `new Date(Date.now() - 7*86400000).toISOString().slice(0,10)`};
  const to   = ${group.endAt   ? `"${group.endAt.slice(0,10)}"` : `new Date().toISOString().slice(0,10)`};
  const screenIds = [${group.screens.map(s => s.id).join(",")}];

  try {
    const results = await Promise.all(screenIds.map(async (sid) => {
      const r = await fetch("/api/reports/overview?from="+from+"&to="+to+"&screenId="+sid, {credentials:"include"});
      if (!r.ok) return { screenId: sid, items: [] };
      const data = await r.json();
      return { screenId: sid, items: Array.isArray(data) ? data : (data.items ?? []) };
    }));

    const screenMap = {${group.screens.map(s => `${s.id}:"${(s.name||"Tela "+s.id).replace(/"/g,"'")}"`).join(",")}};
    let allRows = "";
    let grandTotal = 0, grandPlays = 0;

    for (const res of results) {
      const sname = screenMap[res.screenId] || ("Tela " + res.screenId);
      const items = res.items;
      if (items.length === 0) {
        allRows += \`<tr><td colspan="5" class="center" style="color:#aaa;font-style:italic;padding:12px">\${sname} — sem registros no período</td></tr>\`;
        continue;
      }
      allRows += \`<tr style="background:#e8f5e9!important"><td colspan="5" style="font-weight:800;font-size:10px;padding:8px 12px;letter-spacing:.3px">📺 \${sname}</td></tr>\`;
      for (const i of items) {
        const secs = i.totalSeconds ?? 0;
        const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60);
        const dur = h>0 ? h+"h "+m+"min" : m+"min";
        grandTotal += secs; grandPlays += (i.playCount ?? 0);
        allRows += \`<tr><td>\${i.mediaName??""}</td><td class="mono">\${i.firstPlayedAt ? new Date(i.firstPlayedAt).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"2-digit"}) : "—"}</td><td class="mono">\${i.lastPlayedAt ? new Date(i.lastPlayedAt).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"2-digit"}) : "—"}</td><td class="mono center">\${(i.playCount??0).toLocaleString("pt-BR")}</td><td class="mono right">\${dur}</td></tr>\`;
      }
    }

    const gh = Math.floor(grandTotal/3600), gm = Math.floor((grandTotal%3600)/60);
    const grandDur = gh>0 ? gh+"h "+gm+"min" : gm+"min";

    document.getElementById("loading").style.display = "none";
    document.getElementById("report-table").style.display = "block";
    document.getElementById("report-table").innerHTML = \`
      <table>
        <thead><tr><th>Mídia</th><th>Primeira Exib.</th><th>Última Exib.</th><th class="center">Qtd Exibições</th><th class="right">Tempo Total</th></tr></thead>
        <tbody>\${allRows}<tr class="total-row"><td colspan="3"><strong>TOTAL GERAL</strong></td><td class="center">\${grandPlays.toLocaleString("pt-BR")}</td><td class="right">\${grandDur}</td></tr></tbody>
      </table>\`;
  } catch(e) {
    document.getElementById("loading").textContent = "Erro ao buscar dados. Verifique a conexão.";
  }
  setTimeout(() => window.print(), 1200);
})();
</script></body></html>`);
  win.document.close();
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Campaigns() {
  const { data: schedules = [], isLoading } = useListSchedules();
  const { data: screens = [] } = useListScreens();
  const { data: playlists = [] } = useListPlaylists();
  const createSchedule = useCreateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const updateSchedule = useUpdateSchedule();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "todas">("todas");
  const [showNewModal, setShowNewModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // ── Move campaign modal ────────────────────────────────────────────────────
  const [moveGroup, setMoveGroup] = useState<CampaignGroup | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string>("");
  const [moving, setMoving] = useState(false);

  async function handleMove() {
    if (!moveGroup || !moveTargetId) return;
    setMoving(true);
    try {
      await Promise.all(
        moveGroup.ids.map(id =>
          fetch(`/api/schedules/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ screenId: Number(moveTargetId) }),
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
      const targetScreen = screens?.find(s => s.id === Number(moveTargetId));
      toast({ title: `Campanha movida para "${targetScreen?.name ?? "tela"}"!` });
      setMoveGroup(null);
      setMoveTargetId("");
    } catch {
      toast({ title: "Erro ao mover campanha", variant: "destructive" });
    } finally {
      setMoving(false);
    }
  }

  // ── New campaign form ──────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: "", clientName: "", playlistId: "", startAt: "", endAt: "",
    startTime: "", endTime: "", daysOfWeek: "", selectedScreenIds: [] as number[],
  });

  function resetForm() {
    setForm({ name: "", clientName: "", playlistId: "", startAt: "", endAt: "", startTime: "", endTime: "", daysOfWeek: "", selectedScreenIds: [] });
  }
  function toggleScreen(id: number) {
    setForm(p => ({
      ...p,
      selectedScreenIds: p.selectedScreenIds.includes(id)
        ? p.selectedScreenIds.filter(x => x !== id)
        : [...p.selectedScreenIds, id],
    }));
  }

  function handleCreate() {
    if (!form.name.trim()) { toast({ title: "Informe o nome da campanha", variant: "destructive" }); return; }
    if (!form.playlistId) { toast({ title: "Selecione uma playlist", variant: "destructive" }); return; }
    if (form.selectedScreenIds.length === 0) { toast({ title: "Selecione ao menos uma tela", variant: "destructive" }); return; }

    const data: any = {
      name: form.name.trim(),
      clientName: form.clientName.trim() || undefined,
      playlistId: Number(form.playlistId),
      screenIds: form.selectedScreenIds,
      active: true,
    };
    if (form.startAt) data.startAt = form.startAt;
    if (form.endAt)   data.endAt   = form.endAt;
    if (form.startTime) data.startTime = form.startTime;
    if (form.endTime)   data.endTime   = form.endTime;

    createSchedule.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
        setShowNewModal(false);
        resetForm();
        toast({ title: `Campanha criada em ${form.selectedScreenIds.length} tela${form.selectedScreenIds.length > 1 ? "s" : ""}!` });
      },
      onError: () => toast({ title: "Erro ao criar campanha", variant: "destructive" }),
    });
  }

  // ── Group schedules by campaignGroupId ────────────────────────────────────
  const campaignGroups = useMemo<CampaignGroup[]>(() => {
    const groups: Map<string, CampaignGroup> = new Map();

    for (const s of schedules) {
      const key = (s as any).campaignGroupId ?? `single-${s.id}`;
      if (groups.has(key)) {
        const g = groups.get(key)!;
        g.ids.push(s.id);
        if (s.screenId && !g.screens.find(sc => sc.id === s.screenId)) {
          g.screens.push({ id: s.screenId, name: s.screenName ?? null });
        }
      } else {
        const status = getCampaignStatus({ active: s.active ?? false, startAt: s.startAt, endAt: s.endAt, startTime: s.startTime, daysOfWeek: s.daysOfWeek });
        groups.set(key, {
          groupId: (s as any).campaignGroupId ?? null,
          ids: [s.id],
          name: s.name ?? s.playlistName ?? "Sem nome",
          clientName: s.clientName ?? null,
          playlistId: s.playlistId,
          playlistName: s.playlistName ?? null,
          startAt: s.startAt ?? null,
          endAt: s.endAt ?? null,
          startTime: s.startTime ?? null,
          endTime: s.endTime ?? null,
          daysOfWeek: s.daysOfWeek ?? null,
          active: s.active ?? false,
          status,
          progress: progressPercent(s.startAt, s.endAt),
          daysLeft: daysRemaining(s.endAt),
          screens: s.screenId ? [{ id: s.screenId, name: s.screenName ?? null }] : [],
          createdAt: (s as any).createdAt ?? null,
        });
      }
    }

    return Array.from(groups.values());
  }, [schedules]);

  const counts = useMemo(() => ({
    total:      campaignGroups.length,
    ativas:     campaignGroups.filter(g => g.status === "ativa").length,
    agendadas:  campaignGroups.filter(g => g.status === "agendada").length,
    recorrentes:campaignGroups.filter(g => g.status === "recorrente").length,
    encerradas: campaignGroups.filter(g => g.status === "encerrada").length,
  }), [campaignGroups]);

  const filtered = useMemo(() => {
    return campaignGroups.filter(g => {
      const q = search.toLowerCase();
      const matchSearch = !q
        || g.name.toLowerCase().includes(q)
        || (g.clientName ?? "").toLowerCase().includes(q)
        || g.screens.some(s => (s.name ?? "").toLowerCase().includes(q))
        || (g.playlistName ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "todas" || g.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [campaignGroups, search, statusFilter]);

  function handleToggleGroup(group: CampaignGroup) {
    const newActive = !group.active;
    Promise.all(group.ids.map(id =>
      updateSchedule.mutateAsync({ id, data: { active: newActive } as any })
    )).then(() => {
      queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
      toast({ title: newActive ? "Campanha ativada." : "Campanha pausada." });
    }).catch(() => toast({ title: "Erro ao atualizar campanha", variant: "destructive" }));
  }

  function handleDeleteGroup(group: CampaignGroup) {
    const screenCount = group.screens.length;
    const msg = screenCount > 1
      ? `Excluir campanha "${group.name}" e remover de ${screenCount} telas? Esta ação não pode ser desfeita.`
      : `Excluir campanha "${group.name}"? Esta ação não pode ser desfeita.`;
    if (!confirm(msg)) return;

    const doDelete = group.groupId
      // Atomic group delete — removes all rows for this campaignGroupId in one request
      ? fetch(`/api/schedules/group/${group.groupId}`, { method: "DELETE", credentials: "include" })
          .then(r => { if (!r.ok) throw new Error("delete failed"); })
      // Fallback: delete individual IDs (single-screen campaigns without groupId)
      : Promise.all(group.ids.map(id =>
          deleteSchedule.mutateAsync({ id } as any)
        ));

    doDelete
      .then(() => {
        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
        toast({ title: "Campanha excluída." });
      })
      .catch(() => toast({ title: "Erro ao excluir campanha", variant: "destructive" }));
  }

  function gKey(g: CampaignGroup) { return g.groupId ?? String(g.ids[0]); }

  async function handleBulkDelete() {
    if (selectedKeys.size === 0) return;
    if (!confirm(`Excluir ${selectedKeys.size} campanha${selectedKeys.size > 1 ? "s" : ""} selecionada${selectedKeys.size > 1 ? "s" : ""}? Esta ação não pode ser desfeita.`)) return;
    setBulkDeleting(true);
    const toDelete = campaignGroups.filter(g => selectedKeys.has(gKey(g)));
    try {
      await Promise.all(toDelete.map(g =>
        g.groupId
          ? fetch(`/api/schedules/group/${g.groupId}`, { method: "DELETE", credentials: "include" }).then(r => { if (!r.ok) throw new Error(); })
          : Promise.all(g.ids.map(id => deleteSchedule.mutateAsync({ id } as any)))
      ));
      queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
      setSelectedKeys(new Set());
      toast({ title: `${toDelete.length} campanha${toDelete.length > 1 ? "s" : ""} excluída${toDelete.length > 1 ? "s" : ""}.` });
    } catch {
      toast({ title: "Erro ao excluir campanhas", variant: "destructive" });
    } finally {
      setBulkDeleting(false);
    }
  }

  function buildComprovanteLink(g: CampaignGroup) {
    const params = new URLSearchParams();
    if (g.startAt)    params.set("startDate", g.startAt.slice(0, 10));
    if (g.endAt)      params.set("endDate",   g.endAt.slice(0, 10));
    if (g.groupId)    params.set("campaignGroupId", g.groupId);
    if (g.clientName) params.set("clientName", g.clientName);
    return `/comprovante?${params.toString()}`;
  }

  function buildReportLink(g: CampaignGroup) {
    const params = new URLSearchParams();
    if (g.startAt) params.set("from", g.startAt.slice(0, 10));
    if (g.endAt)   params.set("to",   g.endAt.slice(0, 10));
    if (g.groupId) params.set("campaignGroupId", g.groupId);
    if (g.clientName) params.set("clientName", g.clientName);
    if (!g.groupId && g.screens.length === 1) params.set("screenId", String(g.screens[0].id));
    return `/reports?${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 space-y-6">

      <PageHeader
        icon={Megaphone}
        title="Campanhas"
        description="Gerencie e acompanhe todas as campanhas publicitárias"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10" onClick={() => setShowWizard(true)}>
              <Zap className="w-3.5 h-3.5" />
              Campanha Rápida
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setShowNewModal(true)}>
              <Plus className="w-3.5 h-3.5" />
              Nova Campanha
            </Button>
          </div>
        }
      />

      {/* ── Stats cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.total },
          { label: "Em andamento", value: counts.ativas, color: "text-emerald-400" },
          { label: "Agendadas", value: counts.agendadas, color: "text-blue-400" },
          { label: "Recorrentes", value: counts.recorrentes, color: "text-violet-400" },
        ].map(stat => (
          <Card key={stat.label} className="border-border/50 bg-card/50">
            <CardContent className="p-4">
              <div className={cn("text-2xl font-bold leading-none", stat.color ?? "text-foreground")}>{stat.value}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-xs" placeholder="Buscar por campanha, cliente, tela…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["todas", "ativa", "agendada", "recorrente", "encerrada", "pausada"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all",
                statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/60")}>
              {s === "todas" ? "Todas" : STATUS_CONFIG[s].label}
              {s !== "todas" && (
                <span className="ml-1 opacity-70">
                  {s === "ativa" ? counts.ativas : s === "agendada" ? counts.agendadas : s === "recorrente" ? counts.recorrentes : s === "encerrada" ? counts.encerradas : 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bulk action bar ─────────────────────────────────────────────────── */}
      {selectedKeys.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30">
          <button
            onClick={() => setSelectedKeys(new Set())}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Desmarcar tudo"
          >
            <X className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium flex-1">
            {selectedKeys.size} campanha{selectedKeys.size > 1 ? "s" : ""} selecionada{selectedKeys.size > 1 ? "s" : ""}
          </span>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 gap-1.5 text-xs"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {bulkDeleting ? "Excluindo…" : "Excluir selecionadas"}
          </Button>
        </div>
      )}

      {/* ── Campaign list ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-28 rounded-xl bg-muted/20 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
            <Megaphone className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {search || statusFilter !== "todas" ? "Nenhuma campanha encontrada" : "Nenhuma campanha criada ainda"}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {search || statusFilter !== "todas" ? "Tente outros filtros" : "Crie sua primeira campanha com o botão acima"}
          </p>
          {!search && statusFilter === "todas" && (
            <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowNewModal(true)}>
              <Plus className="w-3.5 h-3.5" />
              Nova Campanha
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select-all row */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <button
                onClick={() => {
                  const allKeys = new Set(filtered.map(g => gKey(g)));
                  const allSelected = filtered.every(g => selectedKeys.has(gKey(g)));
                  setSelectedKeys(allSelected ? new Set() : allKeys);
                }}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <div className={cn(
                  "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                  filtered.every(g => selectedKeys.has(gKey(g)))
                    ? "bg-primary border-primary"
                    : filtered.some(g => selectedKeys.has(gKey(g)))
                    ? "bg-primary/40 border-primary"
                    : "border-muted-foreground/40"
                )}>
                  {filtered.every(g => selectedKeys.has(gKey(g))) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                  {!filtered.every(g => selectedKeys.has(gKey(g))) && filtered.some(g => selectedKeys.has(gKey(g))) && <div className="w-2 h-0.5 bg-primary-foreground rounded" />}
                </div>
                {filtered.every(g => selectedKeys.has(gKey(g))) ? "Desmarcar todos" : "Selecionar todos"}
              </button>
            </div>
          )}

          {filtered.map(g => {
            const hasDateRange = !!(g.startAt || g.endAt);
            const key = gKey(g);
            const isSelected = selectedKeys.has(key);
            return (
              <div key={g.groupId ?? g.ids[0]}
                className={cn("rounded-xl border bg-card/60 backdrop-blur-sm hover:border-border transition-all overflow-hidden",
                  isSelected ? "border-primary/50 bg-primary/5" : "border-border/50")}>
                {g.status === "ativa" && g.progress !== null && (
                  <div className="h-0.5 bg-muted/30">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${g.progress}%` }} />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => setSelectedKeys(prev => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key); else next.add(key);
                        return next;
                      })}
                      className={cn("w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-3 transition-colors",
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30 hover:border-primary/60")}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </button>
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                      g.status === "ativa" ? "bg-emerald-500/15" : g.status === "agendada" ? "bg-blue-500/15" :
                      g.status === "recorrente" ? "bg-violet-500/15" : "bg-muted/30")}>
                      <Megaphone className={cn("w-4 h-4",
                        g.status === "ativa" ? "text-emerald-400" : g.status === "agendada" ? "text-blue-400" :
                        g.status === "recorrente" ? "text-violet-400" : "text-muted-foreground/40")} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold leading-tight">{g.name}</h3>
                            <StatusBadge status={g.status} />
                            {g.screens.length > 1 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                <Monitor className="w-2.5 h-2.5" />
                                {g.screens.length} telas
                              </span>
                            )}
                          </div>
                          {g.clientName && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3 text-muted-foreground/50" />
                              <span className="text-[11px] text-muted-foreground font-medium">{g.clientName}</span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {/* Comprovante de Veiculação */}
                          {hasDateRange && (
                            <a href={buildComprovanteLink(g)} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline"
                                className="h-7 px-2 gap-1 text-[10px] border-violet-500/40 text-violet-400 hover:bg-violet-500/10">
                                <FileText className="w-3 h-3" />
                                Comprovante
                              </Button>
                            </a>
                          )}
                          {/* Proof of Play — visible for campaigns with date range */}
                          {hasDateRange && (
                            <Button size="sm" variant="outline"
                              className="h-7 px-2 gap-1 text-[10px] border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                              onClick={() => openProofOfPlay(g)}>
                              <FileText className="w-3 h-3" />
                              Proof of Play
                            </Button>
                          )}
                          {/* Report link */}
                          {hasDateRange && (
                            <Link href={buildReportLink(g)}>
                              <Button size="sm" className="h-7 px-2.5 gap-1.5 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-sm">
                                <BarChart2 className="w-3.5 h-3.5" />
                                Ver Relatório
                              </Button>
                            </Link>
                          )}
                          {/* Mover para outro aparelho — apenas single-screen */}
                          {g.screens.length === 1 && (
                            <button
                              title="Mover para outro aparelho"
                              onClick={() => { setMoveGroup(g); setMoveTargetId(""); }}
                              className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            title={g.active ? "Pausar" : "Ativar"}
                            onClick={() => handleToggleGroup(g)}
                            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                            {g.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            title="Excluir"
                            onClick={() => handleDeleteGroup(g)}
                            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {/* Screens list */}
                        {g.screens.length > 0 && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Monitor className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[200px]">
                              {g.screens.map(s => s.name || "Tela").join(", ")}
                            </span>
                          </div>
                        )}
                        {g.playlistName && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <ListVideo className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[120px]">{g.playlistName}</span>
                          </div>
                        )}
                        {(g.startAt || g.endAt) ? (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <CalendarDays className="w-3 h-3 shrink-0" />
                            <span>{fmtDateShort(g.startAt) ?? "—"} → {fmtDateShort(g.endAt) ?? "∞"}</span>
                          </div>
                        ) : g.createdAt ? (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground" title="Data de criação">
                            <CalendarDays className="w-3 h-3 shrink-0" />
                            <span>Criada em {fmtDate(g.createdAt)}</span>
                          </div>
                        ) : null}
                        {g.startTime && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{g.startTime} – {g.endTime ?? "23:59"}</span>
                          </div>
                        )}
                        {g.status === "recorrente" && !g.startAt && !g.endAt && (
                          <span className="text-[10px] text-muted-foreground/50 italic">
                            transmissão contínua · sem data fim
                          </span>
                        )}
                      </div>

                      {/* Progress bar for active campaigns */}
                      {g.status === "ativa" && g.progress !== null && g.daysLeft !== null && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                            <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${g.progress}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {g.daysLeft === 0 ? "Último dia" : `${g.daysLeft} dia${g.daysLeft !== 1 ? "s" : ""} restantes`}
                          </span>
                        </div>
                      )}
                      {g.status === "agendada" && g.startAt && (
                        <div className="mt-1.5">
                          <span className="text-[10px] text-blue-400/80">Inicia em {fmtDate(g.startAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {counts.total > 0 && (
        <p className="text-center text-[10px] text-muted-foreground/40 pb-2">
          {counts.total} campanha{counts.total !== 1 ? "s" : ""} · Use "Proof of Play" para gerar comprovante de exibição
        </p>
      )}

      {/* ── Nova Campanha Modal ─────────────────────────────────────────────── */}
      <Dialog open={showNewModal} onOpenChange={v => { setShowNewModal(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" />
              Nova Campanha
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nome da campanha *</label>
              <Input placeholder="Ex: Black Friday Boticário" className="h-9 text-sm"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>

            {/* Client */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Marca / Cliente</label>
              <Input placeholder="Ex: O Boticário, Fiat, Chevrolet…" className="h-9 text-sm"
                value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} />
            </div>

            {/* Playlist */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Playlist *</label>
              <Select value={form.playlistId} onValueChange={v => setForm(p => ({ ...p, playlistId: v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione uma playlist…" />
                </SelectTrigger>
                <SelectContent>
                  {playlists.map(pl => (
                    <SelectItem key={pl.id} value={String(pl.id)}>{pl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Screens multi-select */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Telas *
                {form.selectedScreenIds.length > 0 && (
                  <span className="ml-2 text-primary font-semibold">{form.selectedScreenIds.length} selecionada{form.selectedScreenIds.length > 1 ? "s" : ""}</span>
                )}
              </label>
              <div className="rounded-lg border border-border/60 bg-muted/10 max-h-40 overflow-y-auto divide-y divide-border/30">
                {screens.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">Nenhuma tela cadastrada</p>
                ) : screens.map(s => {
                  const sel = form.selectedScreenIds.includes(s.id);
                  return (
                    <button key={s.id} onClick={() => toggleScreen(s.id)}
                      className={cn("w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/30",
                        sel && "bg-primary/8")}>
                      <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        sel ? "bg-primary border-primary" : "border-border/60")}>
                        {sel && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </div>
                      <Monitor className={cn("w-3.5 h-3.5 shrink-0", sel ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("text-xs font-medium", sel ? "text-foreground" : "text-muted-foreground")}>{s.name}</span>
                    </button>
                  );
                })}
              </div>
              {screens.length > 3 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Selecione múltiplas telas para campanhas em rede. Cada tela receberá a mesma playlist.
                </p>
              )}
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Data de início</label>
                <Input type="date" className="h-9 text-sm"
                  value={form.startAt} onChange={e => setForm(p => ({ ...p, startAt: e.target.value }))}
                  onWheel={e => e.currentTarget.blur()} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Data de término</label>
                <Input type="date" className="h-9 text-sm"
                  value={form.endAt} onChange={e => setForm(p => ({ ...p, endAt: e.target.value }))}
                  onWheel={e => e.currentTarget.blur()} />
              </div>
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Horário início</label>
                <Input type="time" className="h-9 text-sm"
                  value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                  onWheel={e => e.currentTarget.blur()} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Horário fim</label>
                <Input type="time" className="h-9 text-sm"
                  value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                  onWheel={e => e.currentTarget.blur()} />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowNewModal(false); resetForm(); }}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={createSchedule.isPending} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {createSchedule.isPending ? "Criando…" : `Criar em ${form.selectedScreenIds.length || "?"} tela${form.selectedScreenIds.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickCampaignWizard open={showWizard} onOpenChange={setShowWizard} />

      {/* ── Mover para outro aparelho ──────────────────────────────────────── */}
      <Dialog open={!!moveGroup} onOpenChange={v => { if (!v) { setMoveGroup(null); setMoveTargetId(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-primary" />
              Mover para outro aparelho
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-sm">
              <p className="text-muted-foreground">Campanha:</p>
              <p className="font-semibold mt-0.5">{moveGroup?.name}</p>
              {moveGroup?.screens[0] && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Monitor className="w-3 h-3" />
                  Atual: {moveGroup.screens[0].name ?? `Tela ${moveGroup.screens[0].id}`}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mover para</label>
              <Select value={moveTargetId} onValueChange={setMoveTargetId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione o aparelho destino…" />
                </SelectTrigger>
                <SelectContent>
                  {(screens ?? [])
                    .filter(s => !moveGroup?.screens.some(ms => ms.id === s.id))
                    .map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name ?? `Tela ${s.id}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setMoveGroup(null); setMoveTargetId(""); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleMove} disabled={!moveTargetId || moving} className="gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              {moving ? "Movendo…" : "Mover campanha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

