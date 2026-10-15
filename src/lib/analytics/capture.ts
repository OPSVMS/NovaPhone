/**
 * Captura de atribución en el cliente → cookie `np_attr` (90 días).
 *
 * Modelo: gana el último toque no directo. Una visita es "no directa" si la URL trae un click id / utm_* o el
 * referrer es externo (ni nuestro dominio ni Stripe regresando al cliente). Si el toque nuevo no trae click id se
 * conservan los del anterior, para que las conversiones offline de Google Ads sigan siendo posibles.
 */
import { ATTRIBUTION_COOKIE, ATTRIBUTION_MAX_AGE_S, ATTRIBUTION_PARAMS, CLICK_ID_PARAMS, type Attribution } from "./types";
import { isBrowser, readCookie, writeCookie } from "./browser";

const MAX_LEN = 200;

/** Referrers que son parte de nuestro propio embudo, nunca un toque de marketing. */
const IGNORED_REFERRER_HOSTS = ["stripe.com", "checkout.stripe.com", "link.com", "pay.google.com", "novaphone.lat"];

const trunc = (s: string) => s.slice(0, MAX_LEN);

function hostIgnored(host: string): boolean {
  if (host === window.location.hostname) return true;
  return IGNORED_REFERRER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

export function parseAttributionCookie(raw: string | undefined): Attribution | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && typeof (v as Attribution).ts === "number" ? (v as Attribution) : null;
  } catch {
    return null;
  }
}

/** Corre una vez por carga de página (desde <Analytics />). Regresa lo guardado, si hubo algo. */
export function captureAttribution(): Attribution | null {
  if (!isBrowser()) return null;
  const url = new URL(window.location.href);
  const touch: Attribution = { ts: Date.now() };
  let hasParams = false;

  for (const key of ATTRIBUTION_PARAMS) {
    const val = url.searchParams.get(key);
    if (val) {
      touch[key] = trunc(val);
      hasParams = true;
    }
  }

  let externalRef: string | undefined;
  if (document.referrer) {
    try {
      const ref = new URL(document.referrer);
      if (!hostIgnored(ref.hostname)) externalRef = trunc(ref.origin + ref.pathname);
    } catch {
      /* referrer inválido */
    }
  }

  if (!hasParams && !externalRef) return null; // directo / interno: se conserva el anterior

  touch.landing = trunc(url.pathname + url.search);
  if (externalRef) touch.referrer = externalRef;

  const prev = parseAttributionCookie(readCookie(ATTRIBUTION_COOKIE));
  const touchHasClickId = CLICK_ID_PARAMS.some((k) => touch[k]);
  if (prev && !touchHasClickId) {
    for (const k of CLICK_ID_PARAMS) if (prev[k]) touch[k] = prev[k];
  }

  writeCookie(ATTRIBUTION_COOKIE, JSON.stringify(touch), ATTRIBUTION_MAX_AGE_S);
  return touch;
}
