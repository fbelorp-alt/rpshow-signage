import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";

interface ApkVersion {
  id: number;
  profile: string;
  version: string;
  versionCode: number;
  apkUrl: string;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

const PROFILE_LABELS: Record<string, string> = {
  t10plus: "TB10 Plus (armeabi-v7a)",
  tb10: "TB50 / TB10 (arm64-v8a)",
  tb50: "TB50 fat (arm64+arm32)",
};

export default function ApkReleasesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ profile: "t10plus", version: "", versionCode: "", apkUrl: "", notes: "" });

  const { data: versions = [], isLoading } = useQuery<ApkVersion[]>({
    queryKey: ["/api/admin/apk-versions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/apk-versions");
      if (!res.ok) throw new Error("Erro ao carregar");
      return res.json() as Promise<ApkVersion[]>;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/admin/apk-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, versionCode: parseInt(data.versionCode, 10) }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/apk-versions"] });
      setForm({ profile: "t10plus", version: "", versionCode: "", apkUrl: "", notes: "" });
      toast({ title: "Versão registrada!" });
    },
    onError: () => toast({ title: "Erro ao registrar versão", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/apk-versions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao deletar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/apk-versions"] });
      toast({ title: "Versão removida" });
    },
    onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.version || !form.versionCode || !form.apkUrl) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    addMutation.mutate(form);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <PageHeader icon={Smartphone} title="Versões de APK" description="Registre novos APKs para atualização automática nas TVs" />

      <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Nova versão</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Perfil *</Label>
            <Select value={form.profile} onValueChange={(v) => setForm((f) => ({ ...f, profile: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PROFILE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Versão * (ex: 1.15.31)</Label>
            <Input value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} placeholder="1.15.31" />
          </div>
          <div className="space-y-1">
            <Label>versionCode * (ex: 151)</Label>
            <Input type="number" value={form.versionCode} onChange={(e) => setForm((f) => ({ ...f, versionCode: e.target.value }))} placeholder="151" />
          </div>
          <div className="space-y-1">
            <Label>Notas</Label>
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="RSS fix, intro via URL..." />
          </div>
        </div>
        <div className="space-y-1">
          <Label>URL do APK * (pública, sem autenticação)</Label>
          <Input value={form.apkUrl} onChange={(e) => setForm((f) => ({ ...f, apkUrl: e.target.value }))} placeholder="https://app.rpshow.com.br/apk/rpshow-t10plus.apk" />
        </div>
        <Button type="submit" disabled={addMutation.isPending} className="gap-2">
          <Plus className="w-4 h-4" /> Registrar versão
        </Button>
      </form>

      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Versões registradas</h2>
        {isLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}
        {versions.length === 0 && !isLoading && (
          <p className="text-muted-foreground text-sm">Nenhuma versão registrada ainda.</p>
        )}
        {versions.map((v) => (
          <div key={v.id} className="bg-card border rounded-lg p-4 flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{PROFILE_LABELS[v.profile] ?? v.profile}</Badge>
                <span className="font-semibold">{v.version}</span>
                <span className="text-xs text-muted-foreground">versionCode {v.versionCode}</span>
                {v.active && <Badge className="bg-green-500/10 text-green-600 border-green-500/20">ativo</Badge>}
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-lg">{v.apkUrl}</p>
              {v.notes && <p className="text-xs text-muted-foreground">{v.notes}</p>}
            </div>
            <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => deleteMutation.mutate(v.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
