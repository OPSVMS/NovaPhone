import "server-only";
import { cookies, headers } from "next/headers";
import { db, schema } from "@/db";
import { parseAttribution } from "./attribution";
import { ATTRIBUTION_COOKIE, type Attribution } from "./types";
import { VISITOR_COOKIE, VISITOR_RE, cleanPath, cleanProps, type FunnelEventName } from "./funnel";

/** Contexto anónimo derivado de la petición que se guarda con cada evento. */
export type FunnelContext = {
  visitor: string | null;
  country: string | null;
  device: "mobile" | "desktop" | null;
  ads: boolean;
  campaign: string | null;
  term: string | null;
};

type HeaderLike = { get(name: string): string | null };

export function normalizeCountry(country: string | null | undefined): string | null {
  const c = country?.trim().toUpperCase();
  if (!c || !/^[A-Z]{2}$/.test(c) || c === "XX" || c === "T1") return null;
  return c === "UK" ? "GB" : c;
}

export function deviceFrom(h: HeaderLike): "mobile" | "desktop" | null {
  const hint = h.get("sec-ch-ua-mobile");
  if (hint === "?1") return "mobile";
  const ua = h.get("user-agent");
  if (!ua) return hint === "?0" ? "desktop" : null;
  return /Mobi|Android|iPhone|iPod|iPad|Opera Mini|IEMobile/i.test(ua) ? "mobile" : "desktop";
}

/** Visita de anuncio = click id (gclid/gbraid/wbraid) o utm_medium=cpc en la cookie de atribución. */
export function adsFrom(a: Pick<Attribution, "gclid" | "gbraid" | "wbraid" | "utm_medium" | "utm_campaign" | "utm_term"> | null | undefined) {
  const ads = !!(a && (a.gclid || a.gbraid || a.wbraid || a.utm_medium?.toLowerCase() === "cpc"));
  return { ads, campaign: a?.utm_campaign?.slice(0, 120) ?? null, term: a?.utm_term?.slice(0, 120) ?? null };
}

export function validVisitor(v: string | null | undefined): string | null {
  return v && VISITOR_RE.test(v) ? v : null;
}

export function contextFrom(h: HeaderLike, cookie: (name: string) => string | undefined): FunnelContext {
  return {
    visitor: validVisitor(cookie(VISITOR_COOKIE)),
    country: normalizeCountry(h.get("x-vercel-ip-country")),
    device: deviceFrom(h),
    ...adsFrom(parseAttribution(cookie(ATTRIBUTION_COOKIE))),
  };
}

/** Contexto de la petición actual (server actions, route handlers). Nunca lanza. */
export async function currentFunnelContext(): Promise<FunnelContext | null> {
  try {
    const [h, jar] = await Promise.all([headers(), cookies()]);
    return contextFrom(h, (n) => jar.get(n)?.value);
  } catch {
    return null;
  }
}

export type FunnelRow = { event: FunnelEventName; path?: string | null; props?: Record<string, unknown> | null };

/** Inserta eventos con un contexto común. Nunca lanza (registrar no debe romper el embudo). */
export async function insertFunnelEvents(rows: FunnelRow[], ctx: Partial<FunnelContext> | null): Promise<void> {
  if (!rows.length) return;
  try {
    await db.insert(schema.funnelEvents).values(
      rows.map((r) => ({
        event: r.event,
        path: cleanPath(r.path),
        device: ctx?.device ?? null,
        country: ctx?.country ?? null,
        ads: ctx?.ads ?? false,
        campaign: ctx?.campaign ?? null,
        term: ctx?.term ?? null,
        visitor: ctx?.visitor ?? null,
        props: cleanProps(r.props),
      })),
    );
  } catch (e) {
    console.warn("[funnel] insert failed:", e instanceof Error ? e.message : "unknown");
  }
}

/** Evento espejo del servidor (`checkout_started`, `paid`). Usa la cookie de visitante de la petición si la hay. */
export async function logServerEvent(row: FunnelRow, override?: Partial<FunnelContext>): Promise<void> {
  const ctx = await currentFunnelContext();
  await insertFunnelEvents([row], { ...(ctx ?? {}), ...(override ?? {}) });
}
