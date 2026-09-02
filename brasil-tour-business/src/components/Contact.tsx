import { motion } from "framer-motion";
import { Mail, MessageCircle } from "lucide-react";
import { buildWhatsAppLink, CONTACT_EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from "../lib/constants";
import { useReducedMotion } from "../lib/useReducedMotion";
import InstagramIcon from "./icons/InstagramIcon";

export default function Contact() {
  const reducedMotion = useReducedMotion();
  const rise = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-80px" },
      };

  return (
    <section id="contato" className="bg-sand px-6 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <motion.h2
          {...rise}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-h2 text-deep"
        >
          Conte o que você precisa. Nós abrimos a porta.
        </motion.h2>

        <motion.div
          {...rise}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6"
        >
          <a
            href={buildWhatsAppLink("Olá! Gostaria de falar com a Brasil Tour & Business.")}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 border border-deep px-7 py-3.5 text-xs uppercase tracking-label text-deep transition-colors duration-300 hover:bg-deep hover:text-sand"
          >
            <MessageCircle size={18} strokeWidth={1} aria-hidden="true" />
            WhatsApp
          </a>

          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="flex items-center gap-2 border border-deep px-7 py-3.5 text-xs uppercase tracking-label text-deep transition-colors duration-300 hover:bg-deep hover:text-sand"
          >
            <Mail size={18} strokeWidth={1} aria-hidden="true" />
            E-mail
          </a>

          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 border border-deep px-7 py-3.5 text-xs uppercase tracking-label text-deep transition-colors duration-300 hover:bg-deep hover:text-sand"
          >
            <InstagramIcon size={18} strokeWidth={1} aria-hidden="true" />
            {INSTAGRAM_HANDLE}
          </a>
        </motion.div>
      </div>
    </section>
  );
}
