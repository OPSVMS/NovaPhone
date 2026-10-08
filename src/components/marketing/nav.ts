export type NavLink = { href: string; label: string };

export const NAV_LINKS: NavLink[] = [
  { href: "/planes", label: "Planes" },
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#preguntas", label: "Preguntas" },
];

export const AUTH_LINKS = {
  login: "/entrar",
  signup: "/registro",
} as const;

export const planHref = (id: string) => `${AUTH_LINKS.signup}?plan=${encodeURIComponent(id)}`;
