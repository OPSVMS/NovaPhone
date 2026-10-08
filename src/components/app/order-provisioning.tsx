"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { LogoMark } from "@/components/brand/logo";

const MESSAGES = [
  "Reservando tu eSIM…",
  "Conectando con la red Telcel…",
  "Generando tu código QR…",
  "Casi lista…",
];
const EASE = [0.16, 1, 0.3, 1] as const;

/** "Generando tu eSIM…" hero state. Polls the order every 3s and refreshes when it changes. */
export function OrderProvisioning({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();

    async function poll() {
      try {
        const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        if (res.ok) {
          const { status } = (await res.json()) as { status: string };
          if (status !== "provisioning") {
            router.refresh();
            return;
          }
        } else if (res.status === 401 || res.status === 404) {
          router.refresh();
          return;
        }
      } catch {
        // Network blip: keep polling.
      }
      if (cancelled) return;
      const elapsed = Date.now() - started;
      if (elapsed > 90_000) setSlow(true);
      // Back off after a few minutes so we don't hammer the provider.
      timer = setTimeout(poll, elapsed > 180_000 ? 10_000 : 3_000);
    }

    timer = setTimeout(poll, 1_500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId, router]);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, MESSAGES.length - 1)), 4_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center gap-8 px-2 py-10 text-center sm:py-14" aria-live="polite">
      <div className="relative flex size-40 items-center justify-center">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute inset-0 rounded-full border border-lavender/30"
            initial={{ scale: 0.55, opacity: 0 }}
            animate={{ scale: [0.55, 1.15], opacity: [0, 0.7, 0] }}
            transition={{ duration: 3, ease: "easeOut", repeat: Infinity, delay: i * 1 }}
          />
        ))}
        <motion.div
          aria-hidden
          className="relative flex size-20 items-center justify-center rounded-[22px] border border-border-strong bg-surface-2 shadow-glow"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3.2, ease: "easeInOut", repeat: Infinity }}
        >
          <LogoMark size={40} title={null} />
        </motion.div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <h2 className="text-2xl font-semibold text-fg sm:text-3xl">Generando tu eSIM…</h2>
        <div className="relative h-6 w-full max-w-xs overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="text-[15px] text-muted"
            >
              {MESSAGES[step]}
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="mt-2 h-1 w-48 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
          <motion.div
            className="h-full w-1/3 rounded-full bg-linear-to-r from-transparent via-lavender to-transparent"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity }}
          />
        </div>
      </div>

      <p className="max-w-sm text-[13px] leading-relaxed text-subtle">
        {slow
          ? "Está tardando un poco más de lo normal. Puedes salir de esta pantalla: te enviaremos tu eSIM por correo en cuanto esté lista."
          : "Suele tardar menos de un minuto. No cierres esta pantalla; también te la enviaremos por correo."}
      </p>
    </div>
  );
}
