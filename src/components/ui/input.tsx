import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

/** Shared control styles (input, textarea, select). Invalid state via aria-invalid. */
export const controlClass =
  "w-full rounded-control border border-border bg-surface-2/70 text-[15px] text-fg placeholder:text-subtle " +
  "shadow-[inset_0_1px_0_0_rgb(255_255_255/0.03)] transition-[border-color,box-shadow,background-color] duration-200 " +
  "hover:border-border-strong focus:border-lavender/60 focus:bg-surface-2 focus:outline-none focus:ring-4 focus:ring-primary/20 " +
  "focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 " +
  "aria-invalid:border-danger/60 aria-invalid:focus:ring-danger/20 " +
  "autofill:shadow-[inset_0_0_0_1000px_var(--color-surface-2)] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--color-fg)]";

export type InputProps = ComponentProps<"input"> & {
  /** Element rendered inside the field on the left (icon, "$", "+52"). */
  leading?: ReactNode;
  /** Element rendered inside the field on the right (unit, button). */
  trailing?: ReactNode;
};

export function Input({ className, leading, trailing, ...props }: InputProps) {
  if (!leading && !trailing) {
    return <input className={clsx(controlClass, "h-11 px-3.5", className)} {...props} />;
  }
  return (
    <div className="relative flex items-center">
      {leading ? (
        <span className="pointer-events-none absolute left-3.5 flex items-center text-subtle [&_svg]:size-[18px]">
          {leading}
        </span>
      ) : null}
      <input
        className={clsx(controlClass, "h-11", leading ? "pl-10" : "pl-3.5", trailing ? "pr-12" : "pr-3.5", className)}
        {...props}
      />
      {trailing ? (
        <span className="absolute right-2 flex items-center text-sm text-muted">{trailing}</span>
      ) : null}
    </div>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={clsx(controlClass, "min-h-24 px-3.5 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={clsx(controlClass, "h-11 appearance-none pl-3.5 pr-10", className)} {...props}>
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 8 4 4 4-4" />
      </svg>
    </div>
  );
}
