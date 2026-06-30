import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff, Smartphone, Loader2, Trash2, Monitor, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

interface TrustedDevice {
  id: number;
  deviceName: string | null;
  createdAt: string;
  expiresAt: string;
}

function parseUA(ua: string | null): string {
  if (!ua) return "Dispositivo desconhecido";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad/i.test(ua)) return "iPhone / iPad";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return ua.slice(0, 60);
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#0e1018] border border-white/8 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/8 bg-white/2">
        <span className="text-white/60">{icon}</span>
        <h2 className="text-sm font-bold text-white">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Step 1: QR code display ────────────────────────────────────────────────────
function TotpSetupFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"idle" | "qr" | "confirm">("idle");
  const [qrData, setQrData] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const startSetup = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/auth/totp/setup", { method: "POST" });
      setQrData(data);
      setStep("qr");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const confirmCode = async () => {
    if (code.length !== 6) return;
    setError("");
    setLoading(true);
    try {
      await apiFetch("/auth/totp/enable", { method: "POST", body: JSON.stringify({ code }) });
      toast({ title: "2FA ativado com sucesso!" });
      onDone();
    } catch (e: any) {
      setError(e.message);
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  if (step === "idle") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/50">
          A verificação em 2 etapas adiciona uma camada extra de segurança. Após ativar, você precisará do app
          <span className="text-white/80"> Google Authenticator</span> ao entrar de um novo dispositivo.
        </p>
        <div className="flex items-start gap-3 bg-blue-500/8 border border-blue-500/20 rounded-lg p-3">
          <ShieldCheck className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-300/80">
            Dispositivos confiáveis ficam liberados por 30 dias — você só será perguntado em dispositivos novos ou após expirar.
          </p>
        </div>
        <button
          onClick={startSetup}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
          Ativar autenticação em 2 etapas
        </button>
      </div>
    );
  }

  if (step === "qr" && qrData) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-sm text-white/60 mb-1">
            <span className="font-semibold text-white">Passo 1:</span> Abra o Google Authenticator e escaneie o QR Code abaixo.
          </p>
          <p className="text-xs text-white/40">Ou insira o código manualmente no app.</p>
        </div>
        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-xl inline-block">
            <img src={qrData.qrDataUrl} alt="QR Code 2FA" className="w-44 h-44" />
          </div>
        </div>
        <div className="bg-white/4 border border-white/8 rounded-lg p-3">
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Código manual</p>
          <p className="font-mono text-sm text-white tracking-widest break-all">{qrData.secret}</p>
        </div>
        <button
          onClick={() => setStep("confirm")}
          className="w-full px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-all"
        >
          Já escaneei → Confirmar código
        </button>
      </div>
    );
  }

  // step === "confirm"
  return (
    <div className="space-y-4">
      <p className="text-sm text-white/60">
        <span className="font-semibold text-white">Passo 2:</span> Digite o código de 6 dígitos exibido no Google Authenticator para confirmar a ativação.
      </p>
      <input
        type="text"
        inputMode="numeric"
        value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000 000"
        autoFocus
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-xl font-mono text-white text-center tracking-[0.5em] placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
      />
      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => { setStep("qr"); setCode(""); setError(""); }}
          className="flex-1 px-4 py-2 border border-white/10 text-white/50 hover:text-white text-sm rounded-lg transition-all"
        >
          ← Voltar
        </button>
        <button
          onClick={confirmCode}
          disabled={loading || code.length !== 6}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Confirmar e ativar
        </button>
      </div>
    </div>
  );
}

// ── Disable 2FA ────────────────────────────────────────────────────────────────
function DisableTotp({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDisable = async () => {
    if (code.length !== 6) return;
    setError("");
    setLoading(true);
    try {
      await apiFetch("/auth/totp/disable", { method: "POST", body: JSON.stringify({ code }) });
      toast({ title: "2FA desativado" });
      onDone();
    } catch (e: any) {
      setError(e.message);
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-lg p-3">
        <ShieldOff className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-300/80">
          Desativar o 2FA remove a proteção extra. Todos os dispositivos confiáveis também serão removidos.
        </p>
      </div>
      <p className="text-sm text-white/60">Digite o código do Google Authenticator para confirmar:</p>
      <input
        type="text"
        inputMode="numeric"
        value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000 000"
        autoFocus
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-xl font-mono text-white text-center tracking-[0.5em] placeholder-white/20 focus:outline-none focus:border-red-500/50 transition-all"
      />
      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <button
        onClick={handleDisable}
        disabled={loading || code.length !== 6}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
        Desativar 2FA
      </button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SecurityPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showDisable, setShowDisable] = useState(false);

  const { data: status, isLoading: statusLoading } = useQuery<{ totpEnabled: boolean }>({
    queryKey: ["totp-status"],
    queryFn: () => apiFetch("/auth/totp/status"),
  });

  const { data: devices = [], isLoading: devicesLoading } = useQuery<TrustedDevice[]>({
    queryKey: ["totp-devices"],
    queryFn: () => apiFetch("/auth/totp/devices"),
    enabled: status?.totpEnabled === true,
  });

  const removeDevice = useMutation({
    mutationFn: (id: number) => apiFetch(`/auth/totp/devices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["totp-devices"] });
      toast({ title: "Dispositivo removido" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["totp-status"] });
    qc.invalidateQueries({ queryKey: ["totp-devices"] });
    setShowDisable(false);
  };

  const totpEnabled = status?.totpEnabled ?? false;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="border-b border-white/8 pb-4">
        <h1 className="text-3xl font-extrabold tracking-tighter uppercase">Segurança</h1>
        <p className="text-muted-foreground font-mono text-xs mt-1 tracking-widest uppercase">Proteção da sua conta</p>
      </div>

      {/* 2FA section */}
      <SectionCard
        title="Autenticação em 2 Etapas (2FA)"
        icon={<ShieldCheck className="w-4 h-4" />}
      >
        {statusLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-white/30" />
          </div>
        ) : totpEnabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-semibold text-green-400">Ativo</span>
              <span className="text-xs text-white/40 ml-1">— sua conta está protegida</span>
            </div>
            {showDisable ? (
              <DisableTotp onDone={invalidateAll} />
            ) : (
              <button
                onClick={() => setShowDisable(true)}
                className="flex items-center gap-2 px-3 py-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold rounded-lg transition-all"
              >
                <ShieldOff className="w-3.5 h-3.5" />
                Desativar 2FA
              </button>
            )}
          </div>
        ) : (
          <TotpSetupFlow onDone={invalidateAll} />
        )}
      </SectionCard>

      {/* Trusted devices — only shown when 2FA is active */}
      {totpEnabled && (
        <SectionCard
          title="Dispositivos Confiáveis"
          icon={<Monitor className="w-4 h-4" />}
        >
          {devicesLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-white/30" />
            </div>
          ) : devices.length === 0 ? (
            <p className="text-sm text-white/35 text-center py-4">Nenhum dispositivo confiável registrado.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-white/40 mb-3">
                Estes dispositivos podem entrar sem pedir o código por 30 dias. Remova qualquer dispositivo que não reconhecer.
              </p>
              {devices.map(d => (
                <div key={d.id} className="flex items-center justify-between bg-white/3 border border-white/6 rounded-lg px-4 py-3 group">
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{parseUA(d.deviceName)}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-white/30" />
                      <p className="text-xs text-white/35">
                        Expira {new Date(d.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeDevice.mutate(d.id)}
                    disabled={removeDevice.isPending}
                    className="ml-3 p-1.5 text-white/25 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Remover dispositivo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
