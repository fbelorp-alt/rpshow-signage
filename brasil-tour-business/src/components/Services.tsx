import { motion } from "framer-motion";
import { useReducedMotion } from "../lib/useReducedMotion";

const SERVICES = [
  {
    title: "Turismo & Viagens",
    description:
      "Planejamento e organização de viagens nacionais e internacionais, experiências personalizadas, roteiros e suporte ao viajante.",
  },
  {
    title: "Assessoria Internacional",
    description:
      "Orientação e suporte para pessoas e empresas que desejam viajar, estabelecer conexões ou desenvolver projetos no exterior.",
  },
  {
    title: "Business & Negócios",
    description:
      "Aproximação entre empresas, empreendedores e parceiros, identificação de oportunidades e apoio na construção de relações comerciais internacionais.",
  },
  {
    title: "Intermediação & Conexões",
    description:
      "Facilitamos o contato entre clientes, empresas, fornecedores e parceiros, criando pontes para novos negócios e projetos.",
  },
  {
    title: "Representação & Articulação",
    description:
      "Atuamos na articulação de projetos e na representação institucional e comercial, conectando interesses e oportunidades entre diferentes mercados.",
  },
];

export default function Services() {
  const reducedMotion = useReducedMotion();
  const rise = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-60px" },
      };

  return (
    <section id="servicos" className="bg-sand px-6 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto max-w-5xl">
        <motion.h2
          {...rise}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-h2 text-deep"
        >
          O que fazemos
        </motion.h2>

        <ul className="mt-14 border-t border-ink/15">
          {SERVICES.map((service, index) => (
            <motion.li
              key={service.title}
              {...rise}
              transition={{ duration: 0.6, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="group relative border-b border-ink/15"
            >
              <span className="absolute left-0 top-0 h-full w-0 bg-gold transition-[width] duration-500 ease-silk group-hover:w-[3px]" />
              <div className="grid grid-cols-1 gap-2 py-8 pl-0 transition-transform duration-500 ease-silk group-hover:translate-x-3 sm:grid-cols-12 sm:gap-6">
                <span className="font-brand text-xs text-gold sm:col-span-1">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="font-serif text-xl font-normal text-ink sm:col-span-4">
                  {service.title}
                </h3>
                <p className="text-sm font-light leading-relaxed text-mute sm:col-span-7">
                  {service.description}
                </p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
