"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUTH_LINKS, type NavLink } from "./nav";

const EASE = [0.16, 1, 0.3, 1] as const;
const noopSubscribe = () => () => {};

/** Mobile navigation: a top sheet under the sticky header (below `md`). */
export function MobileMenu({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";

    const close = () => {
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && panelRef.current) {
        // Keep focus inside the sheet + its toggle.
        const focusables = [
          buttonRef.current,
          ...panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
        ].filter(Boolean) as HTMLElement[];
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const mq = window.matchMedia("(min-width: 768px)");
    const onMq = () => mq.matches && setOpen(false);

    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      root.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        className="-mr-2 md:hidden"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="relative size-5">
          <Menu
            aria-hidden
            className={`absolute inset-0 transition-[opacity,transform] duration-200 ease-out-expo ${open ? "rotate-90 scale-75 opacity-0" : "opacity-100"}`}
          />
          <X
            aria-hidden
            className={`absolute inset-0 transition-[opacity,transform] duration-200 ease-out-expo ${open ? "opacity-100" : "-rotate-90 scale-75 opacity-0"}`}
          />
        </span>
      </Button>

      {mounted
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <div className="fixed inset-x-0 bottom-0 top-[calc(4rem+env(safe-area-inset-top))] z-40 md:hidden">
                  <motion.div
                    aria-hidden
                    className="absolute inset-0 bg-bg/80 backdrop-blur-md"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    onClick={close}
                  />
                  <motion.div
                    ref={panelRef}
                    id={panelId}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Menú"
                    className="relative mx-3 mt-2 overflow-hidden rounded-panel border border-border bg-surface/95 p-3 shadow-card"
                    initial={{ opacity: 0, y: -12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.35, ease: EASE }}
                  >
                    <nav aria-label="Principal">
                      <ul className="flex flex-col">
                        {links.map((link, i) => (
                          <motion.li
                            key={link.href}
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.04 + i * 0.05, ease: EASE }}
                          >
                            <Link
                              href={link.href}
                              onClick={close}
                              className="flex h-12 items-center justify-between rounded-control px-3 text-base font-medium text-fg transition-colors duration-200 hover:bg-white/[0.04]"
                            >
                              {link.label}
                              <ArrowRight aria-hidden className="size-4 text-subtle" />
                            </Link>
                          </motion.li>
                        ))}
                      </ul>
                    </nav>
                    <div className="hairline my-3" />
                    <div className="grid grid-cols-2 gap-2">
                      <Button href={AUTH_LINKS.login} variant="secondary" onClick={close}>
                        Entrar
                      </Button>
                      <Button href={AUTH_LINKS.signup} onClick={close}>
                        Crear cuenta
                      </Button>
                    </div>
                  </motion.div>
                </div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
