/** Utilidades solo de navegador (cookies, gtag). Todas son no-op en el servidor. */

type GtagArgs = [string, ...unknown[]];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: GtagArgs) => void;
  }
}

export const isBrowser = (): boolean => typeof window !== "undefined" && typeof document !== "undefined";

export function readCookie(name: string): string | undefined {
  if (!isBrowser()) return undefined;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const p = part.trim();
    if (p.startsWith(prefix)) {
      try {
        return decodeURIComponent(p.slice(prefix.length));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function writeCookie(name: string, value: string, maxAgeS: number): void {
  if (!isBrowser()) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeS}; SameSite=Lax${secure}`;
}

/** Llama a gtag si cargó; si no, encola en dataLayer con el formato de gtag. */
export function gtag(...args: GtagArgs): void {
  if (!isBrowser()) return;
  if (typeof window.gtag === "function") {
    window.gtag(...args);
    return;
  }
  window.dataLayer = window.dataLayer || [];
  // gtag.js solo procesa objetos Arguments, no arreglos.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const queue = function (..._a: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  queue(...args);
}
