import clsx from "clsx";
import type { ComponentProps } from "react";

export type BadgeVariant = "neutral" | "primary" | "accent" | "success" | "warning" | "danger";

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: "border-border bg-surface-2 text-muted",
  primary: "border-primary/20 bg-primary/[0.07] text-primary",
  accent: "border-accent/25 bg-accent/10 text-accent",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  danger: "border-danger/25 bg-danger/10 text-danger",
};

export type BadgeProps = ComponentProps<"span"> & {
  variant?: BadgeVariant;
  /** Leading status dot. `"pulse"` animates it (use for live/active states only). */
  dot?: boolean | "pulse";
};

export function Badge({ variant = "neutral", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium",
        badgeVariants[variant],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden
          className={clsx(
            "size-1.5 rounded-full bg-current",
            dot === "pulse" && "animate-pulse-ring motion-reduce:animate-none",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}
