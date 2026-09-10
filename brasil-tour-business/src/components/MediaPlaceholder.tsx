type MediaPlaceholderProps = {
  label: string;
  className?: string;
};

/**
 * Espaço reservado para mídia que o cliente ainda vai enviar. Usamos um bloco
 * sólido na cor "moss" com um texto discreto — nunca uma imagem de banco de
 * imagens genérica, para não comprometer a identidade da marca.
 */
export default function MediaPlaceholder({ label, className = "" }: MediaPlaceholderProps) {
  return (
    <div
      className={`flex items-center justify-center bg-moss px-6 text-center ${className}`}
      role="img"
      aria-label={`Espaço reservado para: ${label}`}
    >
      <span className="text-[11px] uppercase tracking-label text-sand/70">
        Mídia pendente
        <br />
        <span className="text-sand/50">{label}</span>
      </span>
    </div>
  );
}
