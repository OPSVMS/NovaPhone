"use client";

import clsx from "clsx";
import { Gauge, Mail, Wifi, Zap } from "lucide-react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/brand/logo";

/**
 * Decorative story of one eSIM: data runs low → auto-recarga → keeps browsing.
 * Plays once when it scrolls into view; under reduced motion it shows the final state.
 */

type Phase = 0 | 1 | 2;

// Example: a 10 GB / 30 días plan.
const STATES: Record<Phase, { gb: number; days: number }> = {
  0: { gb: 6.4, days: 14 },
  1: { gb: 0.48, days: 2 },
  2: { gb: 10.48, days: 32 },
};
const CAPACITY = 10.5;
const EASE = [0.16, 1, 0.3, 1] as const;

function formatData(v: number) {
  return v < 1 ? `${Math.round(v * 1000)} MB` : `${v.toFixed(1)} GB`;
}

const steps = [
  { icon: Gauge, title: "Quedan 480 MB", body: "Menos de 500 MB o 2 días", from: 1 as Phase },
  { icon: Zap, title: "Auto-recarga", body: "+10 GB y +30 días con tu saldo", from: 2 as Phase },
  { icon: Wifi, title: "Sigues navegando", body: "Misma eSIM, sin QR nuevo", from: 2 as Phase },
];

export function RefillMeter() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Phase>(0);

  const gb = useMotionValue(STATES[0].gb);
  const days = useMotionValue(STATES[0].days);
  const gbText = useTransform(gb, formatData);
  const daysText = useTransform(days, (v) => `${Math.round(v)} días`);
  const width = useTransform(gb, (v) => `${Math.min(v / CAPACITY, 1) * 100}%`);

  // Drive the sequence: 0 → 1 (drain) → 2 (refill). Runs once.
  useEffect(() => {
    if (reduce) {
      gb.set(STATES[2].gb);
      days.set(STATES[2].days);
      return;
    }
    if (!inView) return;
    const t1 = setTimeout(() => setStep(1), 500);
    const t2 = setTimeout(() => setStep(2), 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [inView, reduce, gb, days]);

  useEffect(() => {
    if (step === 0 || reduce) return;
    const target = STATES[step];
    const duration = step === 1 ? 1.8 : 1.2;
    const a = animate(gb, target.gb, { duration, ease: EASE });
    const b = animate(days, target.days, { duration, ease: EASE });
    return () => {
      a.stop();
      b.stop();
    };
  }, [step, reduce, gb, days]);

  // Reduced motion: skip the story and show where it ends.
  const phase: Phase = reduce ? 2 : step;
  const low = phase === 1;

  return (
    <div ref={ref} aria-hidden className="relative mx-auto w-full max-w-[420px]">
      {/* single soft halo behind the card */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 -z-10 size-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(118_82_240/0.2),transparent)]" />

      <div className="glass relative overflow-hidden rounded-panel p-5 shadow-card sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark size={20} title={null} />
            <span className="text-[13px] font-medium text-fg">Mi eSIM</span>
          </div>
          <span
            className={clsx(
              "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-500 ease-out-expo",
              low ? "border-warning/25 bg-warning/10 text-warning" : "border-success/25 bg-success/10 text-success",
            )}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {low ? "Datos bajos" : "Conectada"}
          </span>
        </div>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Datos disponibles</p>
            <motion.p className="mt-1 font-display text-3xl font-semibold tracking-tight tabular-nums text-fg">
              {gbText}
            </motion.p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Vigencia</p>
            <motion.p className="mt-1 text-sm font-medium tabular-nums text-fg">{daysText}</motion.p>
          </div>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            style={{ width }}
            className={clsx(
              "h-full rounded-full bg-linear-to-r transition-colors duration-500",
              low ? "from-warning/70 to-warning" : "from-primary via-lavender to-lavender-soft",
            )}
          />
        </div>

        <ol className="mt-6 flex flex-col gap-1 border-t border-border pt-5">
          {steps.map(({ icon: Icon, title, body, from }, i) => {
            const on = phase >= from;
            const spark = from === 2 && i === 1;
            return (
              <li key={title} className="relative flex items-start gap-3 pb-3 last:pb-0">
                {i < steps.length - 1 ? (
                  <span className="absolute left-[15px] top-9 h-[calc(100%-2.5rem)] w-px bg-border">
                    <span
                      className={clsx(
                        "block h-full w-full origin-top bg-lavender/50 transition-transform duration-700 ease-out-expo",
                        phase >= steps[i + 1].from ? "scale-y-100" : "scale-y-0",
                      )}
                    />
                  </span>
                ) : null}
                <span
                  className={clsx(
                    "relative grid size-8 shrink-0 place-items-center rounded-full border transition-[color,background-color,border-color,box-shadow] duration-500 ease-out-expo",
                    !on && "border-border bg-surface-2 text-subtle",
                    on && !spark && "border-lavender/25 bg-primary/10 text-lavender",
                    on && spark && "border-accent/30 bg-accent/10 text-accent shadow-glow-accent",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-col pt-1">
                  <span
                    className={clsx(
                      "text-sm font-medium transition-colors duration-500",
                      on ? "text-fg" : "text-subtle",
                    )}
                  >
                    {title}
                  </span>
                  <span className="text-[13px] text-muted">{body}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div
        className={clsx(
          "glass absolute -bottom-4 right-3 flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-xs text-fg shadow-card transition-[opacity,transform] duration-700 ease-out-expo sm:-right-4",
          phase === 2 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-lavender">
          <Mail className="size-3.5" />
        </span>
        Te avisamos por correo
      </div>
    </div>
  );
}
