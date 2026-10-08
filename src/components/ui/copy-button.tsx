"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Copy } from "lucide-react";
import { buttonVariants, type ButtonSize, type ButtonVariant } from "./button";

export type CopyButtonProps = {
  /** Text placed on the clipboard. */
  value: string;
  /** Visible label (omit for icon-only). Accessible name falls back to `ariaLabel`. */
  label?: string;
  copiedLabel?: string;
  /** Accessible name, e.g. "Copiar CLABE". Default "Copiar". */
  ariaLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  onCopied?: () => void;
};

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for insecure contexts / older iOS
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

/** Copies `value` and confirms with a check for 1.6s. Announced to screen readers. */
export function CopyButton({
  value,
  label,
  copiedLabel = "Copiado",
  ariaLabel = "Copiar",
  variant = "secondary",
  size,
  className,
  onCopied,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function handleClick() {
    const ok = await writeClipboard(value);
    if (!ok) return;
    setCopied(true);
    onCopied?.();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  const iconOnly = !label;
  const Icon = copied ? Check : Copy;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={iconOnly ? (copied ? copiedLabel : ariaLabel) : undefined}
      className={buttonVariants({
        variant,
        size: size ?? (iconOnly ? "icon-sm" : "sm"),
        className: clsx(copied && "text-success hover:text-success", className),
      })}
    >
      <Icon aria-hidden className={clsx("transition-transform duration-200", copied && "scale-110")} />
      {label ? <span>{copied ? copiedLabel : label}</span> : null}
      <span className="sr-only" aria-live="polite">
        {copied ? copiedLabel : ""}
      </span>
    </button>
  );
}
