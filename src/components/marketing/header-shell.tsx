"use client";

import clsx from "clsx";
import { useSyncExternalStore, type ReactNode } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/** Sticky header that turns into a frosted white bar once the page scrolls. */
export function HeaderShell({ children }: { children: ReactNode }) {
  const scrolled = useSyncExternalStore(
    subscribe,
    () => window.scrollY > 8,
    () => false,
  );
  return (
    <header
      data-scrolled={scrolled || undefined}
      className={clsx(
        "sticky top-0 z-50 border-b pt-[env(safe-area-inset-top)] transition-[background-color,border-color,backdrop-filter] duration-300 ease-out-expo",
        scrolled
          ? "border-border bg-surface/90 shadow-[0_1px_8px_-4px_rgb(11_27_51/0.12)] backdrop-blur-xl backdrop-saturate-150"
          : "border-transparent bg-bg",
      )}
    >
      {children}
    </header>
  );
}
