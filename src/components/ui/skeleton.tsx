import clsx from "clsx";
import type { ComponentProps } from "react";

/** Loading placeholder. Size it with Tailwind (`h-4 w-32`, `h-24 rounded-card`). */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={clsx("shimmer rounded-lg bg-surface-2 motion-reduce:animate-none", className)}
      {...props}
    />
  );
}
