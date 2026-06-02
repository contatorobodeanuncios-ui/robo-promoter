import robotImg from "@/assets/robot-mascot.jpg";

export type OrbState = "idle" | "analyzing" | "ok" | "error";

const palette: Record<OrbState, { core: string; ring: string; glow: string; label: string; spin: string }> = {
  idle:      { core: "from-primary to-accent",          ring: "border-primary/40",  glow: "oklch(0.65 0.21 265 / 0.55)", label: "Robô em standby",   spin: "8s" },
  analyzing: { core: "from-primary via-accent to-primary", ring: "border-primary/70", glow: "oklch(0.65 0.21 265 / 0.85)", label: "IA analisando…",    spin: "1.6s" },
  ok:        { core: "from-success to-primary",         ring: "border-success/60",  glow: "oklch(0.72 0.18 155 / 0.75)", label: "Tudo operando",     spin: "12s" },
  error:     { core: "from-warning to-destructive",     ring: "border-destructive/70", glow: "oklch(0.65 0.24 25 / 0.8)",  label: "Atenção necessária", spin: "3s" },
};

export type OrbLabelPosition = "top" | "bottom";

export function EnergyOrb({
  state = "ok",
  size = 220,
  label,
  labelPosition = "bottom",
}: {
  state?: OrbState;
  size?: number;
  label?: string;
  labelPosition?: OrbLabelPosition;
}) {
  const p = palette[state];
  const gap = 28;
  return (
    <div
      className="relative grid place-items-center mx-auto"
      style={{ width: size, height: size }}
    >
      {/* status pill — top */}
      {labelPosition === "top" && (
        <StatusPill label={label ?? p.label} glow={p.glow} position="top" gap={gap} />
      )}
      {/* outer halo */}
      <div
        className="absolute inset-0 rounded-full blur-3xl opacity-80"
        style={{ background: `radial-gradient(circle, ${p.glow}, transparent 65%)` }}
      />
      {/* rotating ring */}
      <div
        className={`absolute inset-2 rounded-full border-2 border-dashed ${p.ring}`}
        style={{ animation: `spin ${p.spin} linear infinite` }}
      />
      <div
        className={`absolute inset-6 rounded-full border ${p.ring}`}
        style={{ animation: `spin ${p.spin} linear infinite reverse` }}
      />
      {/* core */}
      <div
        className={`relative grid place-items-center rounded-full bg-gradient-to-br ${p.core} animate-pulse-glow`}
        style={{ width: size * 0.55, height: size * 0.55, boxShadow: `0 0 60px -5px ${p.glow}` }}
      >
        <div className="absolute inset-1 rounded-full bg-background/40 backdrop-blur-sm overflow-hidden">
          <img
            src={robotImg}
            alt="Robô de Lucro"
            className="absolute inset-0 h-full w-full object-cover animate-float"
          />
          {/* scan line */}
          <div
            className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-primary/30 to-transparent animate-scan pointer-events-none"
          />
          {/* subtle tint */}
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-accent/20 mix-blend-overlay" />
        </div>
      </div>
      {/* status pill — bottom */}
      {labelPosition === "bottom" && (
        <StatusPill label={label ?? p.label} glow={p.glow} position="bottom" gap={gap} />
      )}
    </div>
  );
}

function StatusPill({
  label,
  glow,
  position,
  gap,
}: {
  label: string;
  glow: string;
  position: OrbLabelPosition;
  gap: number;
}) {
  const posStyle =
    position === "top"
      ? { bottom: `calc(100% + ${gap}px)` }
      : { top: `calc(100% + ${gap}px)` };
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 glass rounded-full px-3 py-1.5 text-[11px] flex items-center gap-2 whitespace-nowrap border overflow-hidden"
      style={{ ...posStyle, animation: "neon-pulse 2.4s ease-in-out infinite" }}
    >
      {/* sweep highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent"
        style={{ animation: "neon-sweep 2.8s linear infinite" }}
      />
      <span
        className="relative h-1.5 w-1.5 rounded-full animate-pulse"
        style={{ background: glow, boxShadow: `0 0 8px ${glow}` }}
      />
      <span className="relative font-medium tracking-wide">{label}</span>
    </div>
  );
}