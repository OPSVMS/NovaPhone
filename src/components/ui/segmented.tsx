"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import clsx from "clsx";
import { motion } from "motion/react";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
};

export type SegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  /** Controlled value. */
  value?: T;
  /** Uncontrolled initial value. Defaults to the first option. */
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  /** Renders a hidden input so the value is submitted with a <form>. */
  name?: string;
  /** Required: describes the group, e.g. "Método de pago". */
  "aria-label": string;
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
};

/**
 * Segmented control (radiogroup) with a sliding indicator.
 * Keyboard: ←/→ (and ↑/↓) move + select, Home/End jump.
 */
export function Segmented<T extends string>({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  size = "md",
  fullWidth,
  className,
  ...aria
}: SegmentedProps<T>) {
  const [inner, setInner] = useState<T | undefined>(defaultValue ?? options[0]?.value);
  const current = value ?? inner;
  const layoutId = `seg-${useId()}`;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(v: T) {
    if (value === undefined) setInner(v);
    onValueChange?.(v);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const enabled = options.map((o, i) => ({ o, i })).filter(({ o }) => !o.disabled);
    const pos = enabled.findIndex(({ o }) => o.value === current);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (pos + 1) % enabled.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (pos - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = enabled.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const target = enabled[next];
    select(target.o.value);
    refs.current[target.i]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={aria["aria-label"]}
      onKeyDown={onKeyDown}
      className={clsx(
        "relative inline-flex items-center gap-1 rounded-[14px] border border-border bg-surface p-1",
        fullWidth && "flex w-full",
        className,
      )}
    >
      {name ? <input type="hidden" name={name} value={current ?? ""} /> : null}
      {options.map((opt, i) => {
        const active = opt.value === current;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={opt.disabled}
            onClick={() => select(opt.value)}
            className={clsx(
              "relative z-0 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium transition-colors duration-200",
              "disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
              size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
              fullWidth && "flex-1",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className="absolute inset-0 -z-10 rounded-[10px] border border-border-strong bg-surface-3 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06),0_4px_16px_-6px_rgb(0_0_0/0.6)]"
                transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
              />
            ) : null}
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
