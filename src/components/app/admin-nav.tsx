"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Activity,
  ArrowDownLeft,
  Filter,
  ArrowLeftRight,
  CardSim,
  LayoutDashboard,
  MessageSquareText,
  ServerCog,
  Users,
} from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard, exact: true },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users, exact: false },
  { href: "/admin/esims", label: "eSIMs", icon: CardSim, exact: false },
  { href: "/admin/depositos", label: "Depósitos", icon: ArrowDownLeft, exact: false },
  { href: "/admin/numeros", label: "Números", icon: MessageSquareText, exact: false },
  { href: "/admin/movimientos", label: "Movimientos", icon: ArrowLeftRight, exact: false },
  { href: "/admin/embudo", label: "Embudo", icon: Filter, exact: false },
  { href: "/admin/actividad", label: "Actividad", icon: Activity, exact: false },
  { href: "/admin/sistema", label: "Sistema", icon: ServerCog, exact: false },
];

/** Admin sections as horizontally scrollable tabs. */
export function AdminNav() {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <nav aria-label="Secciones de admin" className="-mb-px overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex w-max items-center gap-1">
        {ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                ref={active ? activeRef : undefined}
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative inline-flex h-11 items-center gap-1.5 whitespace-nowrap px-3 text-sm font-medium transition-colors duration-200",
                  "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors",
                  active ? "text-fg after:bg-lavender" : "text-muted after:bg-transparent hover:text-fg",
                )}
              >
                <Icon aria-hidden className={clsx("size-4", active ? "text-lavender" : "text-subtle")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
