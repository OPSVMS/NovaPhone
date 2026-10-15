import "server-only";
import { cookies } from "next/headers";
import { GA4_ID } from "./config";
import { ATTRIBUTION_COOKIE, ATTRIBUTION_PARAMS, type Attribution } from "./types";

export type { Attribution } from "./types";

const MAX_LEN = 200;

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v.slice(0, MAX_LEN) : undefined;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch {
      return null;
    }
  }
}

/** Sanea la cookie (no confiable) a una Attribution con solo llaves conocidas. */
export function parseAttribution(raw: string | undefined): Attribution | null {
  if (!raw) return null;
  const v = parseJson(raw);
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const out: Attribution = { ts: typeof o.ts === "number" && Number.isFinite(o.ts) ? o.ts : 0 };
  for (const k of ATTRIBUTION_PARAMS) {
    const s = str(o[k]);
    if (s) out[k] = s;
  }
  const landing = str(o.landing);
  const referrer = str(o.referrer);
  if (landing) out.landing = landing;
  if (referrer) out.referrer = referrer;
  return out;
}

/** `_ga` = "GA1.1.123456789.1700000000" → "123456789.1700000000". */
export function parseGaClientId(raw: string | undefined): string | undefined {
  const m = raw?.match(/^GA\d\.\d+\.(\d+\.\d+)$/);
  return m?.[1];
}

/** `_ga_<STREAM>` → session id (formatos "GS1.1.1700000000.3.1…" y "GS2.1.s1700000000$o3…"). */
export function parseGaSessionId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const v2 = raw.match(/^GS2\.\d+\.s(\d+)/);
  if (v2) return v2[1];
  const v1 = raw.match(/^GS1\.\d+\.(\d+)\./);
  return v1?.[1];
}

/**
 * Lee `np_attr` y los ids de GA4 de las cookies de la petición. Se usa en `startCardCheckout` y se guarda en la
 * orden pendiente (`card_checkouts.attribution`). null si no hay nada que atribuir.
 */
export async function readAttribution(): Promise<Attribution | null> {
  try {
    const jar = await cookies();
    const attr = parseAttribution(jar.get(ATTRIBUTION_COOKIE)?.value);
    const gaClientId = parseGaClientId(jar.get("_ga")?.value);
    const streamCookie = GA4_ID ? `_ga_${GA4_ID.replace(/^G-/, "")}` : undefined;
    const gaSessionId = streamCookie ? parseGaSessionId(jar.get(streamCookie)?.value) : undefined;
    if (!attr && !gaClientId) return null;
    const out: Attribution = attr ?? { ts: Date.now() };
    if (gaClientId) out.gaClientId = gaClientId;
    if (gaSessionId) out.gaSessionId = gaSessionId;
    return out;
  } catch {
    return null;
  }
}
