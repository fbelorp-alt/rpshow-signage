import { useEffect, useState } from "react";
import Logo from "./Logo";

const LINKS = [
  { href: "#sobre", label: "Quem somos" },
  { href: "#servicos", label: "O que fazemos" },
  { href: "#experiencias", label: "Experiências" },
  { href: "#contato", label: "Contato" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-30 transition-colors duration-500 ${
        scrolled ? "bg-space/85 backdrop-blur-sm" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 sm:px-10">
        <a href="#topo" className="flex items-center gap-3 text-sand">
          <Logo className="h-8 w-8 text-gold" />
          <span className="font-brand text-sm tracking-widest2">BRASIL TOUR &amp; BUSINESS</span>
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="link-underline text-xs uppercase tracking-label text-sand/90 transition-colors duration-300 hover:text-gold"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
