import "server-only";
import { desc, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Embudo propio (tabla `funnel_events`, anónima). Una "sesión" = visitante + ruta de aterrizaje: cada paso cuenta
 * las sesiones (visitante+ruta) que dispararon ese evento al menos una vez en el rango.
 */

export const FUNNEL_RANGES = [
  { value: "hoy", label: "Hoy" },
  { value: "3d", label: "3 días" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
] as const;
export type FunnelRange = (typeof FUNNEL_RANGES)[number]["value"];
export const parseFunnelRange = (v: string): FunnelRange => (FUNNEL_RANGES.some((r) => r.value === v) ? (v as FunnelRange) : "hoy");

/** Inicio del rango ("hoy" = desde la medianoche de CDMX). */
export function rangeStart(r: FunnelRange, now = Date.now()): Date {
  if (r === "3d") return new Date(now - 3 * 86_400_000);
  if (r === "7d") return new Date(now - 7 * 86_400_000);
  if (r === "30d") return new Date(now - 30 * 86_400_000);
  const d = new Date(now);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" }).formatToParts(d);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return new Date(now - ((n("hour") * 60 + n("minute")) * 60 + n("second")) * 1000 - d.getMilliseconds());
}

export const STEPS = [
  { key: "page_view", label: "Aterrizaje" },
  { key: "plan_select", label: "Elige plan" },
  { key: "buy_click", label: "Clic en comprar" },
  { key: "checkout_redirect", label: "Va a Stripe" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];

export type FunnelRow = { key: string; sessions: number } & Record<StepKey, number>;

const DIMS = {
  all: sql`'Total'`,
  ads: sql`case when s.ads then 'Anuncios' else 'Orgánico' end`,
  device: sql`coalesce(s.device, '—')`,
  path: sql`coalesce(s.path, '—')`,
  campaign: sql`coalesce(s.campaign, '(sin campaña)') || ' · ' || coalesce(s.term, '(sin término)')`,
} as const;
export type FunnelDim = keyof typeof DIMS;

/** Pasos del embudo agrupados por una dimensión, ordenados por aterrizajes. */
export async function getFunnel(dim: FunnelDim, since: Date, limit = 50): Promise<FunnelRow[]> {
  const res = await db.execute(sql`
    with s as (
      select visitor, path,
        bool_or(ads) as ads, max(device) as device, max(campaign) as campaign, max(term) as term,
        bool_or(event = 'page_view') as page_view,
        bool_or(event = 'plan_select') as plan_select,
        bool_or(event = 'buy_click') as buy_click,
        bool_or(event = 'checkout_redirect') as checkout_redirect
      from funnel_events
      where ts >= ${since} and visitor is not null and path is not null
      group by visitor, path
    )
    select ${DIMS[dim]} as key,
      count(*)::int as sessions,
      count(*) filter (where page_view)::int as page_view,
      count(*) filter (where plan_select)::int as plan_select,
      count(*) filter (where buy_click)::int as buy_click,
      count(*) filter (where checkout_redirect)::int as checkout_redirect
    from s
    group by 1
    order by page_view desc, sessions desc
    limit ${limit}
  `);
  return (res.rows as Record<string, unknown>[]).map((r) => ({
    key: String(r.key),
    sessions: Number(r.sessions ?? 0),
    page_view: Number(r.page_view ?? 0),
    plan_select: Number(r.plan_select ?? 0),
    buy_click: Number(r.buy_click ?? 0),
    checkout_redirect: Number(r.checkout_redirect ?? 0),
  }));
}

/** Totales de eventos del rango (incluye los del servidor: checkout_started, paid). */
export async function getEventTotals(since: Date): Promise<Record<string, number>> {
  const res = await db.execute(sql`select event, count(*)::int as n from funnel_events where ts >= ${since} group by event`);
  return Object.fromEntries((res.rows as { event: string; n: number }[]).map((r) => [r.event, Number(r.n)]));
}

/** Errores de compra por código. */
export async function getBuyErrors(since: Date): Promise<{ code: string; n: number }[]> {
  const res = await db.execute(sql`
    select coalesce(props->>'code', '—') as code, count(*)::int as n
    from funnel_events where ts >= ${since} and event = 'buy_error'
    group by 1 order by 2 desc limit 20`);
  return (res.rows as { code: string; n: number }[]).map((r) => ({ code: String(r.code), n: Number(r.n) }));
}

/** Ventas con tarjeta del rango (checkouts pagados y su monto). */
export async function getCardSales(since: Date) {
  const res = await db.execute(sql`
    select count(*) filter (where paid_at is not null)::int as paid,
      count(*)::int as started,
      coalesce(sum(amount_paid_cents) filter (where paid_at is not null), 0)::bigint as cents
    from card_checkouts where created_at >= ${since}`);
  const r = (res.rows[0] ?? {}) as Record<string, unknown>;
  return { paid: Number(r.paid ?? 0), started: Number(r.started ?? 0), cents: Number(r.cents ?? 0) };
}

export async function getRecentEvents(limit = 100) {
  return db.select().from(schema.funnelEvents).orderBy(desc(schema.funnelEvents.ts)).limit(limit);
}
