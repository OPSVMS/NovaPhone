"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LayoutDashboard, MessageSquareText } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Panel", icon: LayoutDashboard, exact: true },
  { href: "/admin/numeros", label: "Números", icon: MessageSquareText, exact: false },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex items-center gap-1">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "inline-flex h-10 items-center gap-1.5 rounded-control px-3 text-sm font-medium transition-colors duration-200",
              active ? "bg-surface-2 text-fg" : "text-muted hover:bg-white/[0.05] hover:text-fg",
            )}
          >
            <Icon aria-hidden className={clsx("size-4", active && "text-lavender")} />
            <span className="max-sm:sr-only">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
