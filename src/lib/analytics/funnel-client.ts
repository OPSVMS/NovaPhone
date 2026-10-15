/**
 * Lado del navegador del embudo propio: encola eventos y los manda a /api/events en lotes pequeños (cada 3 s, y con
 * navigator.sendBeacon al salir de la página o antes de ir a Stripe). Anónimo: el único id es `np_vid`.
 *
 *   import { logEvent, flushEvents } from "@/lib/analytics/funnel-client";
 *   logEvent("plan_select", { plan: "MX_20_30", price: 599 });
 */
import { isBrowser, readCookie, writeCookie } from "./browser";
import { MAX_BATCH, VISITOR_COOKIE, VISITOR_MAX_AGE_S, VISITOR_RE, cleanProps, type ClientFunnelEvent } from "./funnel";

export type { ClientFunnelEvent } from "./funnel";

const ENDPOINT = "/api/events";
const FLUSH_MS = 3000;

type Queued = { event: ClientFunnelEvent; path: string; props: Record<string, string | number | boolean | null> };

let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes); // también funciona en orígenes HTTP (randomUUID no)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Asegura la cookie `np_vid` (estrictamente necesaria, sin datos personales). */
export function ensureVisitorId(): string | undefined {
  if (!isBrowser()) return undefined;
  const v = readCookie(VISITOR_COOKIE);
  if (v && VISITOR_RE.test(v)) return v;
  const id = randomId();
  writeCookie(VISITOR_COOKIE, id, VISITOR_MAX_AGE_S);
  return id;
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener("pagehide", () => flushEvents(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushEvents(true);
  });
}

/** Manda todo lo encolado. `beacon` = la página puede estar por cerrarse (sendBeacon, con keepalive de respaldo). */
export function flushEvents(beacon = false): void {
  if (!isBrowser()) return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  while (queue.length) {
    const batch = queue.slice(0, MAX_BATCH);
    queue = queue.slice(MAX_BATCH);
    const body = JSON.stringify(batch);
    try {
      if (beacon && typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))) continue;
      void fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" }, credentials: "same-origin" }).catch(() => {});
    } catch {
      /* registrar nunca debe romper la página */
    }
  }
}

/** Encola un evento del embudo para la página actual. Nunca lanza. */
export function logEvent(event: ClientFunnelEvent, props?: Record<string, unknown>): void {
  if (!isBrowser()) return;
  try {
    ensureVisitorId();
    listen();
    queue.push({ event, path: window.location.pathname, props: cleanProps(props) });
    if (queue.length >= MAX_BATCH) flushEvents();
    else if (!timer) timer = setTimeout(() => flushEvents(), FLUSH_MS);
  } catch {
    /* ignorar */
  }
}
