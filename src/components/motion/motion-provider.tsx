"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Makes every `motion` animation respect the OS "reduce motion" setting
 * (transforms/layout are skipped, opacity fades remain). Mounted once in the root layout.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
