"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Copy, Mail } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Decorative inbox: the number waits → a WhatsApp code arrives → "también en tu correo".
 * Plays once when it scrolls into view; under reduced motion it shows the final state.
 */
export function NumberInboxVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    if (reduce || !inView) return;
    const t = setTimeout(() => setArrived(true), 1100);
    return () => clearTimeout(t);
  }, [inView, reduce]);

  const done = reduce || arrived;

  return (
    <div ref={ref} aria-hidden className="relative mx-auto w-full max-w-[420px]">
      <div className="pointer-events-none absolute left-1/2 top-1/3 -z-10 size-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(118_82_240/0.2),transparent)]" />

      <div className="glass relative overflow-hidden rounded-panel p-5 shadow-card sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark size={20} title={null} />
            <span className="text-[13px] font-medium text-fg">Mi número</span>
          </div>
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-white/[0.03] px-2.5 text-[11px] font-medium text-muted">
            <span className="size-1.5 rounded-full bg-accent" />
            En vivo
          </span>
        </div>

        <p className="mt-5 text-[11px] uppercase tracking-[0.16em] text-subtle">Reino Unido</p>
        <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-fg tabular-nums sm:text-[1.7rem]">
          +44 7428 523385
        </p>

        <div className="mt-5 border-t border-border pt-5">
          <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-subtle">Mensajes</p>
          <div className="relative min-h-[132px]">
            <AnimatePresence initial={false} mode="popLayout">
              {done ? (
                <motion.div
                  key="msg"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: EASE }}
                  className="flex flex-col gap-2.5 rounded-2xl border border-lavender/30 bg-primary/[0.07] p-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-fg">WhatsApp</span>
                    <span className="text-[12px] text-subtle">ahora</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-lavender/25 bg-primary/10 py-1.5 pl-3.5 pr-1.5">
                    <span className="font-mono text-xl font-semibold tracking-[0.18em] text-fg tabular-nums">482913</span>
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-border bg-surface-2 px-2.5 text-[12px] font-medium text-fg">
                      <Copy className="size-3.5" />
                      Copiar
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-muted">Tu código de WhatsApp es 482-913. No lo compartas.</p>
                </motion.div>
              ) : (
                <motion.div
                  key="wait"
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-strong text-[13px] text-subtle"
                >
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="size-1.5 animate-pulse rounded-full bg-lavender/60 motion-reduce:animate-none"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </span>
                  Esperando tu código…
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div
        className={clsx(
          "glass absolute -bottom-4 right-3 flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-xs text-fg shadow-card transition-[opacity,transform] duration-700 ease-out-expo motion-reduce:transition-none sm:-right-4",
          done ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-lavender">
          <Mail className="size-3.5" />
        </span>
        También llega a tu correo
      </div>
    </div>
  );
}
