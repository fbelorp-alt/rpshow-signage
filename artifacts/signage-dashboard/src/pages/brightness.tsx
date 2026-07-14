import { useState } from "react";
import { Sun, Monitor, Loader2, CheckCircle2, WifiOff } from "lucide-react";
import { useListScreens } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function BrightnessCard({ screen }: { screen: { id: number; name: string; status: string; location?: string | null } }) {
  const [value, setValue] = useState(80);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const apply = async () => {
    setSending(true);
    setSent(false);
    try {
      const res = await fetch(`/api/screens/${screen.id}/brightness`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brightness: value }),
      });
      if (!res.ok) throw new Error("Falha ao enviar comando");
      setSent(true);
      setTimeout(() => setSent(false), 3000);
      toast({ title: "Brilho enviado", description: `${screen.name} receberá o comando no próximo heartbeat (~10s).` });
    } catch {
      toast({ title: "Erro", description: "Não foi possível enviar o comando de brilho.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const isOnline = screen.status === "online";

  const brightnessColor =
    value <= 20 ? "text-slate-400" :
    value <= 50 ? "text-amber-400" :
    value <= 80 ? "text-yellow-400" :
    "text-orange-400";

  return (
    <div className={cn(
      "rounded-2xl border bg-card p-5 flex flex-col gap-4 transition-all",
      !isOnline && "opacity-60"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Monitor className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{screen.name}</p>
            {screen.location && <p className="text-xs text-muted-foreground">{screen.location}</p>}
          </div>
        </div>
        <Badge variant={isOnline ? "default" : "secondary"} className={cn("text-[10px] shrink-0", isOnline ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground")}>
          {isOnline ? "Online" : "Offline"}
        </Badge>
      </div>

      {/* Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Brilho</span>
          <span className={cn("text-lg font-bold tabular-nums leading-none", brightnessColor)}>{value}%</span>
        </div>
        <div className="flex items-center gap-3">
          <Sun className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <Slider
            min={0}
            max={100}
            step={5}
            value={[value]}
            onValueChange={([v]) => setValue(v)}
            disabled={!isOnline}
            className="flex-1"
          />
          <Sun className="w-4 h-4 text-amber-400 shrink-0" />
        </div>
        {/* Quick presets */}
        <div className="flex gap-1.5 mt-0.5">
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              onClick={() => setValue(p)}
              disabled={!isOnline}
              className={cn(
                "flex-1 text-[10px] py-1 rounded-md border transition-all",
                value === p
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-400 font-semibold"
                  : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/60"
              )}
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      {/* Apply button */}
      <Button
        size="sm"
        onClick={apply}
        disabled={!isOnline || sending}
        className={cn("w-full gap-2", sent && "bg-emerald-600 hover:bg-emerald-600")}
      >
        {sending ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando…</>
        ) : sent ? (
          <><CheckCircle2 className="w-3.5 h-3.5" /> Enviado!</>
        ) : !isOnline ? (
          <><WifiOff className="w-3.5 h-3.5" /> Offline</>
        ) : (
          <><Sun className="w-3.5 h-3.5" /> Aplicar Brilho</>
        )}
      </Button>
    </div>
  );
}

export default function BrightnessPage() {
  const { data: screens = [], isLoading } = useListScreens();

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <PageHeader
        icon={Sun}
        title="Controle de Brilho"
        description="Ajuste o brilho de cada tela remotamente. O comando é enviado no próximo heartbeat do player (~10 segundos)."
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : screens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Monitor className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">Nenhuma tela cadastrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {screens.map((s) => (
            <BrightnessCard key={s.id} screen={s} />
          ))}
        </div>
      )}
    </div>
  );
}
