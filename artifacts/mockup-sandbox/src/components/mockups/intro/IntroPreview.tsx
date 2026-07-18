import { useEffect, useRef, useState } from "react";

export default function IntroPreview() {
  const [phase, setPhase] = useState<"in" | "hold" | "out" | "done">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 550);
    const t2 = setTimeout(() => setPhase("out"),  1650);
    const t3 = setTimeout(() => setPhase("in"),   2300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [phase === "in" && phase]);

  useEffect(() => {
    if (phase !== "in") return;
    const t1 = setTimeout(() => setPhase("hold"), 550);
    const t2 = setTimeout(() => setPhase("out"),  1650);
    const t3 = setTimeout(() => setPhase("in"),   2300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const logoStyle: React.CSSProperties = {
    transition: phase === "in"
      ? "transform 0.55s cubic-bezier(0.34,1.56,0.64,1), opacity 0.52s ease"
      : phase === "out"
      ? "transform 0.52s ease-in, opacity 0.48s ease-in"
      : "none",
    transform: phase === "in"   ? "scale(0.72)" :
               phase === "hold" ? "scale(1.0)"  :
               phase === "out"  ? "scale(1.28)" : "scale(0.72)",
    opacity: phase === "in" ? 0 : phase === "hold" ? 1 : 0,
    width: 260,
    height: 260,
    objectFit: "contain" as const,
    position: "relative" as const,
    zIndex: 2,
  };

  const glowStyle: React.CSSProperties = {
    position: "absolute" as const,
    width: 420,
    height: 420,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(121,180,176,0.28) 0%, rgba(121,180,176,0.08) 55%, transparent 75%)",
    transition: phase === "in"
      ? "opacity 0.52s ease"
      : phase === "out"
      ? "opacity 0.4s ease-in"
      : "none",
    opacity: phase === "in" ? 0 : phase === "hold" ? 1 : 0,
    zIndex: 1,
  };

  return (
    <div style={{
      width: 412,
      height: 232,
      background: "#0d1117",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      overflow: "hidden",
      position: "relative",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
      flexDirection: "column",
    }}>
      {/* TVBox frame hint */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(135deg, rgba(121,180,176,0.03) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />

      {/* glow ring */}
      <div style={glowStyle} />

      {/* logo */}
      <img src="/logo.png" alt="RPShow" style={logoStyle} />

      {/* label */}
      <div style={{
        position: "absolute", bottom: 12,
        fontSize: 10, color: "rgba(255,255,255,0.2)",
        fontFamily: "monospace", letterSpacing: 2,
      }}>
        RPSHOW TV — intro animada
      </div>
    </div>
  );
}
