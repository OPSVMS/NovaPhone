/**
 * Tipos y constantes de analítica. Solo tipos/constantes: se pueden importar desde cliente, servidor,
 * route handlers y server actions.
 */

/** Contenido de la cookie propia `np_attr` (último toque no directo). */
export type Attribution = {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  /** Ruta de aterrizaje (pathname + search, truncada). */
  landing?: string;
  /** Referrer externo (origen + ruta, truncado). */
  referrer?: string;
  /** Epoch ms del toque. */
  ts: number;
  /** Client id de GA4 (de `_ga`, solo en servidor). */
  gaClientId?: string;
  /** Session id de GA4 (de `_ga_<STREAM>`, solo en servidor). */
  gaSessionId?: string;
};

export const ATTRIBUTION_COOKIE = "np_attr";
export const ATTRIBUTION_MAX_AGE_S = 60 * 60 * 24 * 90; // 90 días

/** Parámetros de la URL que se guardan en `np_attr`. */
export const ATTRIBUTION_PARAMS = [
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;
export type AttributionParam = (typeof ATTRIBUTION_PARAMS)[number];

export const CLICK_ID_PARAMS = ["gclid", "gbraid", "wbraid", "fbclid"] as const;

// ─── Eventos GA4 (esquema de ecommerce recomendado) ───────────────────────────

export type Currency = "MXN";

export type AnalyticsItem = {
  /** Id del plan, p. ej. "MX_20_30". */
  item_id: string;
  item_name: string;
  price?: number;
  quantity?: number;
  item_category?: string;
  item_variant?: string;
  item_brand?: string;
  index?: number;
};

type Money = { currency?: Currency; value: number };

export type EventParams = {
  view_item_list: { item_list_id?: string; items: AnalyticsItem[] };
  view_item: Money & { items: AnalyticsItem[] };
  select_item: { item_list_id?: string; items: AnalyticsItem[] };
  begin_checkout: Money & { items: AnalyticsItem[]; coupon?: string };
  purchase: Money & { transaction_id: string; items: AnalyticsItem[]; coupon?: string };
  sign_up: { method: "password" | "checkout" };
};

export type EventName = keyof EventParams;
