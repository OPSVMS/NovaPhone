/**
 * Eventos tipados para GA4 + Google Ads (gtag). Cada evento también se refleja, con props compactas y anónimas, en
 * el embudo propio (`/api/events`, ver funnel-client.ts).
 */
import { ADS_PURCHASE_LABEL, adsSendTo } from "./config";
import { gtag, isBrowser } from "./browser";
import { logEvent } from "./funnel-client";
import type { EventName, EventParams } from "./types";

/** Resumen pequeño y anónimo de los parámetros de GA (sin transaction id ni arreglos). */
function funnelProps(p: Record<string, unknown>): Record<string, unknown> {
  const items = (p.items as { item_id?: string }[] | undefined) ?? [];
  return { value: p.value, currency: p.currency, plan: items[0]?.item_id, items: items.length || undefined, method: p.method };
}

export function track<E extends EventName>(event: E, params: EventParams[E]): void {
  if (!isBrowser()) return;
  const p: Record<string, unknown> = { ...params };
  if ("value" in p && p.currency === undefined) p.currency = "MXN";

  logEvent(event, funnelProps(p));
  gtag("event", event, p);

  if (event === "purchase") {
    const sendTo = adsSendTo(ADS_PURCHASE_LABEL);
    if (sendTo) gtag("event", "conversion", { send_to: sendTo, value: p.value, currency: p.currency, transaction_id: p.transaction_id });
  }
}
