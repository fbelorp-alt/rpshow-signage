import { motion } from "framer-motion";
import { Clock, Gem, Network, ShieldCheck } from "lucide-react";
import { useReducedMotion } from "../lib/useReducedMotion";

const ITEMS = [
  { icon: Clock, label: "Atendimento 24 horas" },
  { icon: Gem, label: "Curadoria de alto padrão" },
  { icon: Network, label: "Rede de conexões exclusivas" },
  { icon: ShieldCheck, label: "Praticidade e segurança" },
];

export default function Differentials() {
  const reducedMotion = useReducedMotion();
  const rise = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-60px" },
      };

  return (
    <section aria-label="Diferenciais" className="bg-sand px-6 py-20 sm:px-10">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 sm:grid-cols-4 sm:gap-6">
        {ITEMS.map(({ icon: Icon, label }, index) => (
          <motion.div
            key={label}
            {...rise}
            transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-4 text-center"
          >
            <Icon size={24} strokeWidth={1} className="text-moss" aria-hidden="true" />
            <p className="text-xs uppercase tracking-label text-ink">{label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
