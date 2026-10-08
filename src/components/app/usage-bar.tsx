"use client";

import clsx from "clsx";
import { motion } from "motion/react";

/** Data usage meter. `used`/`total` in bytes. Animates in once. */
export function UsageBar({
  used,
  total,
  className,
  label = "Datos usados",
}: {
  used: number;
  total: number;
  className?: string;
  label?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;
  const low = pct >= 85;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={clsx("relative h-2 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}
    >
      <motion.div
        className={clsx(
          "absolute inset-y-0 left-0 rounded-full",
          low ? "bg-warning" : "bg-linear-to-r from-primary to-lavender",
        )}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      />
    </div>
  );
}
