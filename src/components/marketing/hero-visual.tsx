import clsx from "clsx";
import { Check, Signal } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { FadeIn } from "@/components/motion/fade-in";

/** Slow, ambient orbit ring. Pure CSS; frozen under reduced motion. */
function Orbit({
  size,
  duration,
  reverse,
  dotClass,
  dotAngle = 0,
}: {
  size: string;
  duration: string;
  reverse?: boolean;
  dotClass?: string;
  dotAngle?: number;
}) {
  return (
    <div
      className={clsx(
        "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06]",
        size,
      )}
    >
      <div
        className="absolute inset-0 animate-spin motion-reduce:animate-none"
        style={{ animationDuration: duration, animationDirection: reverse ? "reverse" : "normal" }}
      >
        <div className="absolute inset-0" style={{ transform: `rotate(${dotAngle}deg)` }}>
          <span
            className={clsx(
              "absolute left-1/2 top-0 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
              dotClass ?? "bg-lavender shadow-[0_0_12px_2px_rgb(167_139_250/0.6)]",
            )}
          />
        </div>
      </div>
    </div>
  );
}

/** Chip contacts, drawn as SVG hairlines. */
function ChipGlyph() {
  return (
    <svg viewBox="0 0 44 34" className="h-[34px] w-11" aria-hidden>
      <defs>
        <linearGradient id="np-chip" x1="0" y1="0" x2="44" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--color-lavender-soft)", stopOpacity: 0.55 }} />
          <stop offset="1" style={{ stopColor: "var(--color-primary)", stopOpacity: 0.35 }} />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="43" height="33" rx="7" fill="url(#np-chip)" stroke="rgb(255 255 255 / 0.25)" />
      <g stroke="rgb(255 255 255 / 0.35)" strokeWidth="1" fill="none">
        <path d="M0.5 11.5H14M0.5 22.5H14M30 11.5H43.5M30 22.5H43.5M14 0.5V33.5M30 0.5V33.5" />
        <rect x="14" y="8" width="16" height="18" rx="3" />
      </g>
    </svg>
  );
}

/** Premium eSIM "card" mock with orbiting signal rings — built in CSS/SVG. */
export function HeroVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[360px] sm:max-w-[460px]" aria-hidden>
      {/* soft core glow */}
      <div className="absolute left-1/2 top-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(118_82_240/0.28),transparent)]" />

      <Orbit size="size-[98%]" duration="90s" dotAngle={40} />
      <Orbit size="size-[76%]" duration="70s" reverse dotAngle={200} dotClass="bg-accent shadow-[0_0_12px_2px_rgb(125_227_244/0.55)]" />
      <Orbit size="size-[54%]" duration="55s" dotAngle={120} />

      {/* eSIM card */}
      <div className="absolute left-1/2 top-1/2 w-[78%] max-w-[320px] -translate-x-1/2 -translate-y-1/2">
      <FadeIn immediate delay={0.25} y={20}>
        <div className="glass relative overflow-hidden rounded-panel p-5 shadow-card sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-[radial-gradient(closest-side,rgb(167_139_250/0.25),transparent)]" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LogoMark size={22} title={null} />
              <span className="text-[13px] font-medium text-fg">eSIM México</span>
            </div>
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2.5 text-[11px] font-medium text-success">
              <span className="size-1.5 animate-pulse-ring rounded-full bg-current motion-reduce:animate-none" />
              Conectada
            </span>
          </div>

          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Datos disponibles</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums sm:text-3xl tracking-tight text-fg">
                18.6 <span className="text-base font-medium text-muted">/ 20 GB</span>
              </p>
            </div>
            <ChipGlyph />
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full w-[93%] rounded-full bg-linear-to-r from-primary via-lavender to-lavender-soft" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
            <div>
              <p className="text-[11px] text-subtle">Red</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-fg">
                <Signal className="size-3.5 text-lavender" />
                Telcel 5G
              </p>
            </div>
            <div>
              <p className="text-[11px] text-subtle">Vigencia</p>
              <p className="mt-0.5 text-sm font-medium tabular-nums text-fg">27 días</p>
            </div>
          </div>
        </div>
      </FadeIn>
      </div>

      {/* floating chips */}
      <FadeIn immediate delay={0.55} y={10} className="absolute left-0 top-[12%] sm:left-[2%]">
        <div className="glass flex items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-3 text-xs text-fg shadow-card">
          <span className="grid size-6 place-items-center rounded-full bg-success/15 text-success">
            <Check className="size-3.5" />
          </span>
          Instalada en <span className="tabular-nums">1:42</span>
        </div>
      </FadeIn>
      <FadeIn immediate delay={0.7} y={10} className="absolute bottom-[10%] right-0 sm:right-[2%]">
        <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted shadow-card">
          <span className="font-mono text-[11px] text-lavender-soft">SPEI</span>
          <span className="h-3 w-px bg-border-strong" />
          <span className="font-mono text-[11px] text-lavender-soft">USDT</span>
        </div>
      </FadeIn>
    </div>
  );
}
