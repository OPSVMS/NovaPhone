"use client";

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

const item: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: EASE } },
};

export type StaggerProps = {
  children: ReactNode;
  className?: string;
  /** Seconds between children. Default 0.07. */
  gap?: number;
  /** Seconds before the first child. Default 0. */
  delay?: number;
  /** Animate on mount instead of on scroll-into-view. */
  immediate?: boolean;
  amount?: number;
  as?: "div" | "ul" | "ol";
};

/** Parent that reveals its <StaggerItem> children one after another. */
export function Stagger({
  children,
  className,
  gap = 0.07,
  delay = 0,
  immediate = false,
  amount = 0.2,
  as = "div",
}: StaggerProps) {
  const Comp = (as === "ul" ? motion.ul : as === "ol" ? motion.ol : motion.div) as typeof motion.div;
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: gap, delayChildren: delay } },
  };
  return (
    <Comp
      className={className}
      variants={container}
      initial="hidden"
      {...(immediate ? { animate: "show" } : { whileInView: "show", viewport: { once: true, amount } })}
    >
      {children}
    </Comp>
  );
}

export type StaggerItemProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
};

export function StaggerItem({ children, className, as = "div" }: StaggerItemProps) {
  const Comp = (as === "li" ? motion.li : motion.div) as typeof motion.div;
  return (
    <Comp className={className} variants={item}>
      {children}
    </Comp>
  );
}
