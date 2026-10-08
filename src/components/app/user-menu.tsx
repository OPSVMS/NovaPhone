"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeftRight, LayoutDashboard, LogOut, Smartphone } from "lucide-react";
import { logout } from "@/app/actions/auth";

export function UserMenu({
  name,
  email,
  isAdmin,
  align = "end",
  side = "bottom",
}: {
  name: string;
  email: string;
  isAdmin: boolean;
  align?: "start" | "end";
  side?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-sm text-muted transition-colors duration-200 hover:bg-white/[0.05] hover:text-fg [&_svg]:size-4";

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="true"
        aria-label="Menú de cuenta"
        className="flex size-10 items-center justify-center rounded-full border border-border-strong bg-surface-2 font-display text-[13px] font-semibold text-lavender-soft transition-colors duration-200 hover:border-lavender/40"
      >
        {initials || "?"}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            id={menuId}
            initial={{ opacity: 0, y: side === "bottom" ? -6 : 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: side === "bottom" ? -4 : 4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={clsx(
              "absolute z-50 w-64 rounded-2xl border border-border bg-surface p-1.5 shadow-card",
              align === "end" ? "right-0" : "left-0",
              side === "bottom" ? "top-full mt-2 origin-top-right" : "bottom-full mb-2 origin-bottom-left",
            )}
          >
            <div className="px-3 pb-2.5 pt-2">
              <p className="truncate text-sm font-medium text-fg">{name}</p>
              <p className="truncate text-[13px] text-subtle">{email}</p>
            </div>
            <div className="hairline mb-1" />
            <Link href="/app/esims" className={item} onClick={() => setOpen(false)}>
              <Smartphone aria-hidden /> Mis eSIM
            </Link>
            <Link href="/app/movimientos" className={item} onClick={() => setOpen(false)}>
              <ArrowLeftRight aria-hidden /> Movimientos
            </Link>
            {isAdmin ? (
              <Link href="/admin" className={item} onClick={() => setOpen(false)}>
                <LayoutDashboard aria-hidden /> Panel de admin
              </Link>
            ) : null}
            <div className="hairline my-1" />
            <form action={logout}>
              <button type="submit" className={clsx(item, "hover:text-danger")}>
                <LogOut aria-hidden /> Cerrar sesión
              </button>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
