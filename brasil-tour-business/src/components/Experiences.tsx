import { motion } from "framer-motion";
import MediaPlaceholder from "./MediaPlaceholder";
import { buildWhatsAppLink } from "../lib/constants";
import { useReducedMotion } from "../lib/useReducedMotion";

type Experience = {
  id: string;
  title: string;
  description: string;
  whatsappMessage: string;
  /** Troque para `true` e informe `videoSrc`/`poster` assim que o cliente enviar o material. */
  videoAvailable: boolean;
  videoSrc?: string;
  poster?: string;
  placeholderLabel: string;
};

const EXPERIENCES: Experience[] = [
  {
    id: "parintins",
    title: "Festival de Parintins",
    description:
      "Acesso exclusivo ao maior festival folclórico do Brasil, no coração da Amazônia. Camarote, hospedagem e logística fluvial resolvidos.",
    whatsappMessage:
      "Olá! Tenho interesse na experiência exclusiva do Festival de Parintins com a Brasil Tour & Business.",
    videoAvailable: false,
    placeholderLabel: "Cenas do Festival de Parintins",
    poster: undefined,
  },
  {
    id: "rio",
    title: "Rio de Janeiro",
    description:
      "Roteiros de tranquilidade na cidade: helicóptero sobre a Baía de Guanabara, villas com vista para o mar e mesas reservadas.",
    whatsappMessage:
      "Olá! Tenho interesse nos roteiros exclusivos no Rio de Janeiro com a Brasil Tour & Business.",
    videoAvailable: false,
    placeholderLabel: "Cenas aéreas do Rio de Janeiro / piscina",
    poster: undefined,
  },
];

export default function Experiences() {
  const reducedMotion = useReducedMotion();
  const rise = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-80px" },
      };

  return (
    <section id="experiencias" className="bg-space px-6 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          {...rise}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-h2 text-sand"
        >
          Experiências exclusivas
        </motion.h2>

        <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-10">
          {EXPERIENCES.map((experience, index) => (
            <motion.article
              key={experience.id}
              {...rise}
              transition={{ duration: 0.7, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden">
                {experience.videoAvailable && experience.videoSrc ? (
                  <video
                    className="h-full w-full object-cover"
                    src={experience.videoSrc}
                    poster={experience.poster}
                    autoPlay
                    muted
                    loop
                    playsInline
                    aria-hidden="true"
                  />
                ) : (
                  <MediaPlaceholder label={experience.placeholderLabel} className="h-full w-full" />
                )}
              </div>

              <h3 className="mt-6 font-serif text-2xl font-normal text-sand">{experience.title}</h3>
              <p className="mt-3 max-w-md text-sm font-light leading-relaxed text-sand/70">
                {experience.description}
              </p>

              <a
                href={buildWhatsAppLink(experience.whatsappMessage)}
                target="_blank"
                rel="noreferrer"
                className="link-underline mt-6 inline-block text-xs uppercase tracking-label text-gold"
              >
                Solicitar detalhes
              </a>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
