import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { Market } from "../data/destinations";
import { buildWhatsAppLink } from "../lib/constants";

type DestinationPanelProps = {
  market: Market | null;
  onClose: () => void;
};

export default function DestinationPanel({ market, onClose }: DestinationPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!market) return;
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [market, onClose]);

  // Renderizado via portal direto no <body>: garante que o painel fique
  // sempre acima de qualquer outro elemento da página (ex.: o cabeçalho fixo),
  // independente de contextos de empilhamento criados por seções ancestrais.
  return createPortal(
    <AnimatePresence>
      {market ? (
        <motion.div
          className="fixed inset-0 z-40 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* clique fora fecha o painel */}
          <button
            type="button"
            aria-label="Fechar painel de destino"
            className="absolute inset-0 bg-space/70 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`Destino: ${market.country}`}
            className="relative flex h-full w-full max-w-md flex-col gap-8 overflow-y-auto bg-sand px-8 py-12 sm:px-12"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="absolute right-6 top-6 text-ink/70 transition-colors duration-300 hover:text-gold"
            >
              <X size={22} strokeWidth={1} />
            </button>

            <div>
              <p className="text-xs uppercase tracking-label text-gold">Destino</p>
              <h3 className="mt-2 font-serif text-h2 text-deep">{market.country}</h3>
              <p className="mt-4 text-sm leading-relaxed text-mute">{market.summary}</p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-label text-mute">Cidades atendidas</p>
              <ul className="mt-3 space-y-2">
                {market.cities.map((city) => (
                  <li key={city} className="border-t border-ink/10 pt-2 text-sm text-ink first:border-t-0 first:pt-0">
                    {city}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs uppercase tracking-label text-mute">Serviços disponíveis</p>
              <ul className="mt-3 space-y-2">
                {market.services.map((service) => (
                  <li key={service} className="border-t border-ink/10 pt-2 text-sm text-ink first:border-t-0 first:pt-0">
                    {service}
                  </li>
                ))}
              </ul>
            </div>

            <a
              href={buildWhatsAppLink(
                `Olá! Tenho interesse em experiências da Brasil Tour & Business em ${market.country}.`
              )}
              target="_blank"
              rel="noreferrer"
              className="mt-auto inline-flex w-fit items-center gap-2 border border-deep px-6 py-3 text-xs uppercase tracking-label text-deep transition-colors duration-300 hover:bg-deep hover:text-sand"
            >
              Solicitar detalhes
            </a>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
