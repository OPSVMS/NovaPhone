"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import clsx from "clsx";
import { X } from "lucide-react";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Action row (Buttons). Stacks full-width on mobile. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const widths = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-xl" } as const;

/**
 * Modal built on native <dialog> (focus trap, Esc, top layer for free).
 * Bottom sheet on mobile, centered card from `sm` up. Closes on backdrop click.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      className={clsx(
        "m-0 mt-auto w-full max-w-none rounded-t-panel border border-border bg-surface p-0 text-fg shadow-card",
        "sm:m-auto sm:rounded-panel",
        widths[size],
        "backdrop:bg-black/60 backdrop:backdrop-blur-sm",
        "opacity-0 translate-y-6 transition-[opacity,translate,display,overlay] transition-discrete duration-300 ease-out-expo",
        "open:opacity-100 open:translate-y-0 starting:open:opacity-0 starting:open:translate-y-6",
        "motion-reduce:translate-y-0 motion-reduce:transition-none",
        className,
      )}
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
          <div className="flex flex-col gap-1.5">
            <h2 id={titleId} className="font-display text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="text-sm leading-relaxed text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
            className="-mr-1.5 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-white/5 hover:text-fg"
          >
            <X className="size-[18px]" aria-hidden />
          </button>
        </div>
        {children ? <div className="overflow-y-auto px-5 py-3 sm:px-6">{children}</div> : null}
        {footer ? (
          <div className="flex flex-col-reverse gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-end sm:px-6 sm:pb-6">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
