import clsx from "clsx";

export type AuroraProps = {
  className?: string;
  /**
   * "hero": rich, top-weighted glow for landing heroes.
   * "subtle": low-intensity wash for app pages / auth.
   * "spot": single centered glow behind a card or CTA.
   */
  variant?: "hero" | "subtle" | "spot";
  /** Overlay a faint 48px grid that fades out. Default true for hero. */
  grid?: boolean;
  /** Overlay film grain. Default true. */
  noise?: boolean;
};

/**
 * Animated aurora background. Pure CSS (transform-only keyframes on radial
 * gradients — no blur filters, no JS), paused under prefers-reduced-motion.
 * Place inside a `relative` (ideally `overflow-hidden` / `isolate`) parent; it sits at -z-10.
 */
export function Aurora({ className, variant = "hero", grid, noise = true }: AuroraProps) {
  const showGrid = grid ?? variant === "hero";
  const blob = "absolute rounded-full will-change-transform motion-reduce:animate-none";
  return (
    <div
      aria-hidden
      className={clsx("pointer-events-none absolute inset-0 -z-10 overflow-hidden", noise && "noise", className)}
    >
      {variant === "hero" ? (
        <>
          <div
            className={clsx(blob, "animate-aurora-a left-[-20%] top-[-35%] h-[80%] w-[90%]")}
            style={{ background: "radial-gradient(closest-side, rgb(118 82 240 / 0.45), transparent)" }}
          />
          <div
            className={clsx(blob, "animate-aurora-b right-[-25%] top-[-20%] h-[70%] w-[80%]")}
            style={{ background: "radial-gradient(closest-side, rgb(167 139 250 / 0.28), transparent)" }}
          />
          <div
            className={clsx(blob, "animate-aurora-c left-[20%] top-[10%] h-[55%] w-[60%]")}
            style={{ background: "radial-gradient(closest-side, rgb(125 227 244 / 0.12), transparent)" }}
          />
        </>
      ) : variant === "subtle" ? (
        <>
          <div
            className={clsx(blob, "animate-aurora-a left-[-15%] top-[-40%] h-[70%] w-[70%]")}
            style={{ background: "radial-gradient(closest-side, rgb(118 82 240 / 0.22), transparent)" }}
          />
          <div
            className={clsx(blob, "animate-aurora-b right-[-20%] top-[-30%] h-[60%] w-[60%]")}
            style={{ background: "radial-gradient(closest-side, rgb(125 227 244 / 0.07), transparent)" }}
          />
        </>
      ) : (
        <div
          className={clsx(blob, "animate-aurora-c left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2")}
          style={{ background: "radial-gradient(closest-side, rgb(118 82 240 / 0.35), transparent 70%)" }}
        />
      )}
      {showGrid ? <div className="bg-grid mask-fade-radial absolute inset-0 opacity-70" /> : null}
      {variant !== "spot" ? (
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-b from-transparent to-bg" />
      ) : null}
    </div>
  );
}
