"use client";

import clsx from "clsx";
import { useId, useState } from "react";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import type { FaqItem } from "./faq-data";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Accessible single-open accordion (WAI-ARIA disclosure pattern). */
export function FaqAccordion({ items, defaultOpen = 0 }: { items: FaqItem[]; defaultOpen?: number | null }) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  const baseId = useId();

  return (
    <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {items.map((item, i) => {
        const isOpen = open === i;
        const buttonId = `${baseId}-q-${i}`;
        const panelId = `${baseId}-a-${i}`;
        return (
          <div key={item.q}>
            <h3 className="font-sans text-base tracking-normal">
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="group flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-medium text-fg transition-colors duration-200 ease-out-expo hover:bg-white/[0.02] focus-visible:-outline-offset-2 sm:px-6 sm:text-base"
              >
                {item.q}
                <span
                  aria-hidden
                  className={clsx(
                    "grid size-7 shrink-0 place-items-center rounded-full border transition-[transform,border-color,color,background-color] duration-300 ease-out-expo",
                    isOpen
                      ? "rotate-45 border-lavender/30 bg-primary/10 text-lavender"
                      : "border-border text-muted group-hover:border-border-strong group-hover:text-fg",
                  )}
                >
                  <Plus className="size-3.5" />
                </span>
              </button>
            </h3>
            <motion.div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              aria-hidden={!isOpen}
              inert={!isOpen}
              initial={false}
              animate={isOpen ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
              transition={{ height: { duration: 0.4, ease: EASE }, opacity: { duration: 0.25, ease: EASE } }}
              className="overflow-hidden"
            >
              <p className="max-w-[62ch] px-5 pb-5 text-[15px] leading-relaxed text-muted sm:px-6">{item.a}</p>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
