"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { motion } from "motion/react";
import { MOBILE_NAV_ITEMS, NAV_ITEMS, isActive } from "./nav-items";

const SPRING = { type: "spring", bounce: 0.15, duration: 0.45 } as const;

/** Desktop sidebar navigation. */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "relative flex h-11 items-center gap-3 rounded-control px-3 text-[15px] font-medium transition-colors duration-200",
              active ? "text-fg" : "text-muted hover:bg-white/[0.04] hover:text-fg",
            )}
          >
            {active ? (
              <motion.span
                layoutId="sidebar-active"
                aria-hidden
                transition={SPRING}
                className="absolute inset-0 -z-10 rounded-control border border-border bg-surface-2 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05)]"
              />
            ) : null}
            <Icon aria-hidden className={clsx("size-[18px] transition-colors duration-200", active ? "text-lavender" : "")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile bottom tab bar (fixed, safe-area aware). */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="glass-strong fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5 px-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-200",
                  active ? "text-fg" : "text-subtle hover:text-muted",
                )}
              >
                <span className="relative flex h-7 w-12 items-center justify-center">
                  {active ? (
                    <motion.span
                      layoutId="tab-active"
                      aria-hidden
                      transition={SPRING}
                      className="absolute inset-0 rounded-full bg-primary/15 ring-1 ring-lavender/20"
                    />
                  ) : null}
                  <Icon aria-hidden className={clsx("relative size-5", active && "text-lavender")} />
                </span>
                <span className="max-w-full truncate px-0.5">{item.short ?? item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
