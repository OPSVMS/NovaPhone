"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

const tags = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  li: motion.li,
  span: motion.span,
  header: motion.header,
} as const;

export type FadeInProps = {
  children: ReactNode;
  className?: string;
  /** Seconds. Use multiples of 0.06 for sequential items. */
  delay?: number;
  /** Seconds. Default 0.7. */
  duration?: number;
  /** Rise distance in px. Default 16. Use 0 for a pure fade. */
  y?: number;
  /** Fraction of the element visible before revealing. Default 0.25. */
  amount?: number;
  /** Reveal only the first time it enters the viewport. Default true. */
  once?: boolean;
  /** Animate on mount instead of on scroll-into-view (use above the fold). */
  immediate?: boolean;
  as?: keyof typeof tags;
  id?: string;
};

/** Reveal-on-scroll wrapper. Respects reduced motion via <MotionProvider>. */
export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.7,
  y = 16,
  amount = 0.25,
  once = true,
  immediate = false,
  as = "div",
  id,
}: FadeInProps) {
  const Comp = tags[as] as typeof motion.div;
  const hidden = { opacity: 0, y, filter: "blur(4px)" };
  const shown = { opacity: 1, y: 0, filter: "blur(0px)" };
  return (
    <Comp
      id={id}
      className={className}
      initial={hidden}
      {...(immediate ? { animate: shown } : { whileInView: shown, viewport: { once, amount } })}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Comp>
  );
}
