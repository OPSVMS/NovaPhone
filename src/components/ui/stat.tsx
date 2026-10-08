import clsx from "clsx";
import type { ReactNode } from "react";

export type StatProps = {
  label: ReactNode;
  value: ReactNode;
  /** Secondary line under the value (e.g. "de 10 GB", "Vence 12 nov"). */
  hint?: ReactNode;
  icon?: ReactNode;
  /** Small trailing element next to the label (Badge, link). */
  aside?: ReactNode;
  size?: "md" | "lg";
  className?: string;
};

/** Key figure: balance, data left, days remaining. Values use tabular numerals. */
export function Stat({ label, value, hint, icon, aside, size = "md", className }: StatProps) {
  return (
    <div className={clsx("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm text-muted [&_svg]:size-4 [&_svg]:text-lavender">
          {icon}
          {label}
        </span>
        {aside}
      </div>
      <div
        className={clsx(
          "truncate font-display font-semibold tracking-tight text-fg tabular-nums",
          size === "lg" ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl",
        )}
      >
        {value}
      </div>
      {hint ? <div className="text-[13px] text-subtle">{hint}</div> : null}
    </div>
  );
}
