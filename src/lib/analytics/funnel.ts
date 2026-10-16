/**
 * Embudo propio y anónimo (constantes compartidas). Puro: sirve en cliente y servidor.
 *
 * Los eventos van a la tabla `funnel_events` por `POST /api/events` (cliente) o `logServerEvent` (servidor).
 * No llevan correo, IP ni id de orden: solo ruta, dispositivo, país, si vino de anuncio (campaña/término) y un id
 * aleatorio por navegador (`np_vid`, estrictamente necesario, sin datos personales).
 */

export const VISITOR_COOKIE = "np_vid";
export const VISITOR_MAX_AGE_S = 60 * 60 * 24 * 90; // 90 días
export const VISITOR_RE = /^[A-Za-z0-9-]{16,64}$/;

/** Eventos que puede mandar el navegador. Los del servidor (`checkout_started`, `paid`) no se aceptan del cliente. */
export const CLIENT_FUNNEL_EVENTS = [
  // Pasos del embudo (solo registro propio).
  "page_view",
  "plan_select",
  "email_focus",
  "addon_toggle",
  "buy_click",
  "checkout_redirect",
  "buy_error",
  "cta_click",
  // Espejos de los eventos de GA4 enviados con track().
  "view_item_list",
  "view_item",
  "select_item",
  "begin_checkout",
  "purchase",
  "sign_up",
] as const;
export type ClientFunnelEvent = (typeof CLIENT_FUNNEL_EVENTS)[number];

export const SERVER_FUNNEL_EVENTS = ["checkout_started", "paid"] as const;
export type FunnelEventName = ClientFunnelEvent | (typeof SERVER_FUNNEL_EVENTS)[number];

export type FunnelProps = Record<string, string | number | boolean | null>;

export const MAX_BATCH = 20;
export const MAX_PROPS = 12;
export const MAX_PROP_LEN = 100;
const EMAIL_LIKE = /[^\s@]+@[^\s@]+/;

/** Solo props escalares y planas, truncadas; descarta lo que parezca correo. */
export function cleanProps(input: Record<string, unknown> | null | undefined): FunnelProps {
  const out: FunnelProps = {};
  if (!input) return out;
  for (const [k, v] of Object.entries(input)) {
    if (Object.keys(out).length >= MAX_PROPS) break;
    const key = k.slice(0, 40);
    if (typeof v === "string") {
      if (EMAIL_LIKE.test(v)) continue;
      out[key] = v.slice(0, MAX_PROP_LEN);
    } else if (typeof v === "number") {
      if (Number.isFinite(v)) out[key] = v;
    } else if (typeof v === "boolean" || v === null) {
      out[key] = v;
    }
  }
  return out;
}

/** Solo pathname (sin query/hash), truncado. */
export function cleanPath(p: string | null | undefined): string | null {
  if (!p || typeof p !== "string") return null;
  const path = p.split(/[?#]/)[0].slice(0, 200);
  return path.startsWith("/") ? path : null;
}
