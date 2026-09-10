import Logo from "./Logo";
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  CNPJ_PLACEHOLDER,
  CONTACT_EMAIL,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
} from "../lib/constants";

const QUICK_LINKS = [
  { href: "#sobre", label: "Quem somos" },
  { href: "#servicos", label: "O que fazemos" },
  { href: "#experiencias", label: "Experiências" },
  { href: "#contato", label: "Contato" },
];

export default function Footer() {
  return (
    <footer className="bg-moss px-6 py-16 text-sand sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 sm:flex-row sm:justify-between">
        <div className="max-w-xs">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8 text-gold" />
            <span className="font-brand text-sm tracking-widest2">{BRAND_NAME}</span>
          </div>
          <p className="mt-4 text-xs font-light leading-relaxed text-sand/70">
            Conectando pessoas, empresas e oportunidades entre o Brasil e o mundo.
          </p>
        </div>

        <nav aria-label="Links rápidos">
          <p className="text-[11px] uppercase tracking-label text-gold/80">Links rápidos</p>
          <ul className="mt-4 space-y-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="link-underline text-sm font-light text-sand/85 transition-colors duration-300 hover:text-gold"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="text-[11px] uppercase tracking-label text-gold/80">Redes e contato</p>
          <ul className="mt-4 space-y-2 text-sm font-light text-sand/85">
            <li>
              <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="link-underline hover:text-gold">
                {INSTAGRAM_HANDLE}
              </a>
            </li>
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="link-underline hover:text-gold">
                {CONTACT_EMAIL}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-14 flex max-w-6xl flex-col items-center gap-2 border-t border-sand/15 pt-8 text-center text-[11px] text-sand/50 sm:flex-row sm:justify-between sm:text-left">
        <p>CNPJ {CNPJ_PLACEHOLDER}</p>
        <p className="font-brand tracking-widest2 text-gold/80">{BRAND_TAGLINE}</p>
      </div>
    </footer>
  );
}
