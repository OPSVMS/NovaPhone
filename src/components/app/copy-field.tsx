import clsx from "clsx";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/ui/copy-button";

/** Label + monospace value + copy button. For CLABE, referencias, direcciones, códigos. */
export function CopyField({
  label,
  value,
  display,
  hint,
  size = "md",
  copyLabel,
  className,
}: {
  label: ReactNode;
  value: string;
  /** Optional formatted display (defaults to value). */
  display?: ReactNode;
  hint?: ReactNode;
  size?: "md" | "lg";
  copyLabel: string;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-3 rounded-2xl border border-border bg-surface-2/60 px-4 py-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[13px] text-muted">{label}</span>
        <span
          className={clsx(
            "break-all font-mono text-fg tabular-nums",
            size === "lg" ? "text-xl font-semibold tracking-wide sm:text-2xl" : "text-[15px]",
          )}
        >
          {display ?? value}
        </span>
        {hint ? <span className="text-[13px] text-subtle">{hint}</span> : null}
      </div>
      <CopyButton value={value} ariaLabel={copyLabel} size="icon" />
    </div>
  );
}

/** Plain read-only row (label → value). */
export function InfoRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 text-right text-fg">{children}</span>
    </div>
  );
}
