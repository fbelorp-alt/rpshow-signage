import { motion } from "framer-motion";
import MediaPlaceholder from "./MediaPlaceholder";
import { useReducedMotion } from "../lib/useReducedMotion";

export default function About() {
  const reducedMotion = useReducedMotion();
  const rise = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-80px" },
      };

  return (
    <section id="sobre" className="bg-sand px-6 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <motion.p
          {...rise}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-center font-serif text-2xl font-normal leading-relaxed text-deep sm:text-3xl"
        >
          Somos uma empresa brasileira especializada em turismo, assessoria internacional e
          desenvolvimento de negócios, criada para conectar pessoas, empresas e oportunidades
          entre o Brasil e o mundo.
        </motion.p>

        <div className="mt-24 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
          <motion.div {...rise} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="lg:col-span-3">
            <h2 className="font-serif text-h2 text-deep">Quem somos</h2>
          </motion.div>

          <motion.div
            {...rise}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6 text-base font-light leading-relaxed text-ink lg:col-span-5"
          >
            <p>
              A Brasil Tour &amp; Business nasceu em 2023 com o propósito de tornar experiências
              internacionais mais acessíveis, estratégicas e seguras. Unimos conhecimento,
              atendimento personalizado e uma rede de conexões para oferecer soluções que vão
              muito além de uma simples viagem.
            </p>
            <p>
              Atuamos ao lado de nossos clientes desde o planejamento até a realização de seus
              projetos, viagens e negócios, buscando sempre proporcionar confiança, excelência e
              novas oportunidades.
            </p>
          </motion.div>

          <motion.div
            {...rise}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-4"
          >
            <MediaPlaceholder
              label="Foto vertical de natureza brasileira"
              className="aspect-[3/4] w-full"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
