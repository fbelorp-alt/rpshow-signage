type InstagramIconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
  "aria-hidden"?: React.AriaAttributes["aria-hidden"];
};

/** Ícone de traço fino no mesmo estilo do lucide-react (não incluído no pacote atual). */
export default function InstagramIcon({
  size = 24,
  strokeWidth = 1,
  className,
  "aria-hidden": ariaHidden = true,
}: InstagramIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <rect x={3} y={3} width={18} height={18} rx={5} />
      <circle cx={12} cy={12} r={4} />
      <circle cx={17.2} cy={6.8} r={0.6} fill="currentColor" stroke="none" />
    </svg>
  );
}
