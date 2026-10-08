import { ArrowLeftRight, CardSim, House, MessageSquareText, ShoppingBag, Wallet, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  short?: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Ocultar en la barra inferior móvil (sigue en el menú de cuenta). */
  desktopOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Inicio", icon: House, exact: true },
  { href: "/app/comprar", label: "Comprar", icon: ShoppingBag },
  { href: "/app/esims", label: "Mis eSIM", icon: CardSim },
  { href: "/app/numero", label: "Número", icon: MessageSquareText },
  { href: "/app/fondos", label: "Fondos", icon: Wallet },
  { href: "/app/movimientos", label: "Movimientos", short: "Historial", icon: ArrowLeftRight, desktopOnly: true },
];

export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((i) => !i.desktopOnly);

export function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
