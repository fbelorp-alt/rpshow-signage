import { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { buildWhatsAppLink } from "../lib/constants";
import { useReducedMotion } from "../lib/useReducedMotion";

// three.js + fiber + drei só entram no bundle quando o globo é realmente
// renderizado — evita bloquear o carregamento inicial da página com ~350kB
// de bibliotecas 3D.
const Globe = lazy(() => import("./Globe"));

export default function Hero() {
  const reducedMotion = useReducedMotion();

  const rise = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
      };

  return (
    <section
      id="topo"
      className="relative flex min-h-screen flex-col items-center overflow-hidden bg-space px-6 pb-16 pt-32 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:pt-24"
    >
      {/* Véu suave para o texto nunca perder contraste sobre o globo em telas médias.
          Fica antes no DOM (sem precisar de z-index) para não criar um contexto de
          empilhamento que poderia "prender" elementos posicionados dentro do Globe,
          como o painel lateral de destino. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-space via-transparent to-transparent lg:bg-gradient-to-r" />

      <div className="relative max-w-xl text-sand lg:w-1/2">
        <motion.p
          {...rise}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="font-brand text-xs uppercase tracking-widest2 text-gold"
        >
          Brasil Tour &amp; Business
        </motion.p>

        <motion.h1
          {...rise}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 font-serif text-h1 leading-[1.05] text-sand"
        >
          Onde começa a sua viagem?
        </motion.h1>

        <motion.p
          {...rise}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 text-lg font-light leading-relaxed text-sand/90"
        >
          Ela começa quando você decide viver uma experiência única e inesquecível.
        </motion.p>

        <motion.p
          {...rise}
          transition={{ duration: 0.8, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 max-w-md text-sm font-light leading-relaxed text-sand/70"
        >
          Uma equipe completa para dar todo o suporte e atenção para você desfrutar o melhor da
          sua viagem.
        </motion.p>

        <motion.div
          {...rise}
          transition={{ duration: 0.8, delay: 0.36, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-4"
        >
          <a
            href={buildWhatsAppLink("Olá! Quero planejar minha experiência com a Brasil Tour & Business.")}
            target="_blank"
            rel="noreferrer"
            className="border border-gold px-8 py-4 text-xs uppercase tracking-label text-sand transition-colors duration-300 hover:bg-gold hover:text-space"
          >
            Planeje sua experiência
          </a>

          {/* Selo discreto ao lado do botão principal */}
          <span className="text-[11px] uppercase tracking-label text-gold/80">
            Suporte dedicado 24h
          </span>
        </motion.div>

        <motion.div
          {...rise}
          transition={{ duration: 0.8, delay: 0.44, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6"
        >
          <a
            href="#experiencias"
            className="link-underline text-xs uppercase tracking-label text-sand/80 transition-colors duration-300 hover:text-gold"
          >
            Conheça nossos destinos
          </a>
        </motion.div>
      </div>

      <div className="relative mt-16 w-full lg:mt-0 lg:w-1/2">
        <Suspense fallback={<div className="mx-auto aspect-square w-full max-w-[640px]" />}>
          <Globe />
        </Suspense>
      </div>
    </section>
  );
}
