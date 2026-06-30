import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, X } from "lucide-react";

interface OnboardingData {
  jobRole: string;
  segment: string;
  screenCount: string;
}

interface Props {
  onComplete: (data: OnboardingData) => void;
  onSkip: () => void;
}

// ── Step 1: Cargo / Função ────────────────────────────────────────────────────
const JOB_ROLES = [
  { value: "proprietario", label: "Proprietário / Gestor", emoji: "🏢" },
  { value: "ti",           label: "TI / Tecnologia",       emoji: "💻" },
  { value: "marketing",    label: "Marketing / Comunicação", emoji: "📢" },
  { value: "operacoes",    label: "Operações",              emoji: "⚙️" },
  { value: "direcao",      label: "Diretor / Administrador", emoji: "👔" },
  { value: "outro",        label: "Outro",                  emoji: "🙋" },
];

// ── Step 2: Setor / Segmento ──────────────────────────────────────────────────
const SEGMENTS = [
  "Posto de Combustível",
  "Supermercado / Mercado",
  "Farmácia / Drogaria",
  "Loja de Roupas / Calçados",
  "Clínica / Consultório",
  "Hotel / Pousada",
  "Restaurante / Lanchonete",
  "Academia / Fitness",
  "Salão de Beleza / Barbearia",
  "Concessionária / Autopeças",
  "Escola / Cursos",
  "Banco / Financeiro",
  "Indústria / Fábrica",
  "Comércio em Geral",
  "Serviços Profissionais",
  "Outro",
];

// ── Step 3: Quantidade de Telas ───────────────────────────────────────────────
const SCREEN_COUNTS = [
  { value: "1",      label: "1 tela",      sub: "Começando pequeno" },
  { value: "2-5",    label: "2 a 5 telas", sub: "Pequeno porte" },
  { value: "6-20",   label: "6 a 20 telas", sub: "Médio porte" },
  { value: "21-50",  label: "21 a 50 telas", sub: "Grande porte" },
  { value: "50+",    label: "50+ telas",   sub: "Rede / Franquia" },
];

const TOTAL_STEPS = 3;

export function OnboardingWizard({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState(1);
  const [jobRole, setJobRole] = useState("");
  const [segment, setSegment] = useState("");
  const [screenCount, setScreenCount] = useState("");

  const progress = (step / TOTAL_STEPS) * 100;

  const canNext =
    (step === 1 && !!jobRole) ||
    (step === 2 && !!segment) ||
    (step === 3 && !!screenCount);

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      onComplete({ jobRole, segment, screenCount });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">

        {/* Orange progress bar */}
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-orange-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Card content */}
        <div className="p-8 pb-6">
          {/* Step indicator */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            {step} de {TOTAL_STEPS}
          </p>

          {/* ── STEP 1: Cargo ── */}
          {step === 1 && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Qual é o seu cargo ou função?
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Isso nos ajuda a personalizar a experiência para você.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {JOB_ROLES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setJobRole(r.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all text-gray-700 bg-gray-50 hover:bg-orange-50",
                      jobRole === r.value
                        ? "border-orange-500 bg-orange-50 text-orange-700"
                        : "border-gray-200"
                    )}
                  >
                    <span className="text-3xl">{r.emoji}</span>
                    <span className="text-center leading-tight">{r.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── STEP 2: Setor ── */}
          {step === 2 && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Em qual setor você atua?
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Isso nos ajuda a entender onde o RPShow OnSign está sendo implantado.
              </p>
              <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
                {SEGMENTS.map((seg) => (
                  <button
                    key={seg}
                    onClick={() => setSegment(seg)}
                    className={cn(
                      "px-4 py-2 rounded-full border-2 text-sm font-medium transition-all",
                      segment === seg
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:border-orange-300 hover:bg-orange-50"
                    )}
                  >
                    {seg}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── STEP 3: Telas ── */}
          {step === 3 && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Quantas telas você planeja instalar?
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Nos ajuda a oferecer o suporte certo para o seu projeto.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {SCREEN_COUNTS.map((sc) => (
                  <button
                    key={sc.value}
                    onClick={() => setScreenCount(sc.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-5 rounded-xl border-2 transition-all",
                      screenCount === sc.value
                        ? "border-orange-500 bg-orange-50"
                        : "border-gray-200 bg-gray-50 hover:bg-orange-50 hover:border-orange-300"
                    )}
                  >
                    <span className={cn(
                      "text-base font-bold",
                      screenCount === sc.value ? "text-orange-700" : "text-gray-800"
                    )}>
                      {sc.label}
                    </span>
                    <span className="text-xs text-gray-400">{sc.sub}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onSkip}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-3 h-3" />
            Pular configuração
          </button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
                className="gap-1 text-gray-600"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </Button>
            )}
            <Button
              size="sm"
              disabled={!canNext}
              onClick={handleNext}
              className="gap-1 bg-orange-500 hover:bg-orange-600 text-white border-0 disabled:opacity-40"
            >
              {step === TOTAL_STEPS ? "Concluir" : "Próximo"}
              {step < TOTAL_STEPS && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
