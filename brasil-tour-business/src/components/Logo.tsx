type LogoProps = {
  className?: string;
  title?: string;
};

/**
 * Emblema da marca: uma arara estilizada em traço fino, asas abertas em
 * padrão decorativo — a mesma composição usada no material gráfico do
 * cliente, redesenhada em vetor para nitidez em qualquer resolução.
 */
export default function Logo({ className, title = "Brasil Tour & Business" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>{title}</title>

      {/* corpo e cabeça */}
      <path d="M52 74c-6 6-8 14-4 22 3 6 9 9 15 8-4-4-6-9-5-15" />
      <path d="M52 74c-10-2-17-9-19-19-1-7 1-14 6-19 6-6 14-8 21-5" />
      <path d="M60 31c5-4 12-5 18-2 5 2 8 6 9 11-1 5-4 9-9 11-6 2-13 1-18-3" />
      <circle cx="66" cy="38" r="1.6" fill="currentColor" stroke="none" />
      <path d="M78 40c4 1 7 3 9 6-3 1-6 1-9-1" />

      {/* asa — camadas de penas em leque */}
      <path d="M56 45c10-14 27-22 45-22-6 12-17 20-30 24" />
      <path d="M52 52c14-16 34-24 55-23-9 13-23 21-39 25" />
      <path d="M49 60c17-14 39-19 61-15-11 12-27 18-45 20" />
      <path d="M47 68c18-9 40-10 60-2-13 9-30 12-47 10" />
      <path d="M46 76c17-4 36-2 52 6-14 6-30 6-45 1" />

      {/* espirais decorativas nas pontas das penas */}
      <path d="M99 24c3-2 6-1 7 2s0 6-3 7" />
      <path d="M105 39c3-1 5 1 5 4s-2 5-5 5" />
      <path d="M104 58c3 0 5 2 4 5-1 3-3 4-6 3" />

      {/* cauda */}
      <path d="M40 63c-9 2-16 8-19 17-2 6 0 12 5 15 3-6 3-12 0-18" />
      <path d="M34 68c-6 4-9 11-8 18" />

      {/* filete inferior / poleiro */}
      <path d="M28 100c16-3 32-3 48 0" opacity={0.6} />
    </svg>
  );
}
