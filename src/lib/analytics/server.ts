import "server-only";
import { GA4_ID } from "./config";
import type { Attribution } from "./types";

export type ServerPurchase = {
  orderId: string;
  /** Total cobrado en MXN (p. ej. 599). */
  valueMxn: number;
  items: { id: string; name: string; price: number; quantity?: number }[];
  attribution?: Attribution | null;
  userId?: string;
};

const MP_ENDPOINT = "https://www.google-analytics.com/mp/collect";

function fallbackClientId(orderId: string): string {
  // Determinista por orden para que los reintentos no creen usuarios falsos.
  let h = 0;
  for (const ch of orderId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${h}.${Math.floor(Date.now() / 1000)}`;
}

/**
 * `purchase` por GA4 Measurement Protocol: respaldo para cuando la página de éxito nunca carga (pestaña cerrada,
 * bloqueador). GA4 deduplica compras por transaction_id, así que convive con <PurchaseTracker />.
 * No-op sin NEXT_PUBLIC_GA4_ID + GA4_API_SECRET. Nunca lanza.
 */
export async function trackServerPurchase(p: ServerPurchase): Promise<void> {
  const secret = process.env.GA4_API_SECRET?.trim();
  if (!GA4_ID || !secret) return;
  try {
    const params: Record<string, unknown> = {
      transaction_id: p.orderId,
      currency: "MXN",
      value: Math.round(p.valueMxn * 100) / 100,
      items: p.items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity ?? 1 })),
      engagement_time_msec: 1,
    };
    if (p.attribution?.gaSessionId) params.session_id = p.attribution.gaSessionId;
    if (p.attribution?.utm_source) params.campaign_source = p.attribution.utm_source;
    if (p.attribution?.utm_medium) params.campaign_medium = p.attribution.utm_medium;
    if (p.attribution?.utm_campaign) params.campaign_name = p.attribution.utm_campaign;
    const body: Record<string, unknown> = { client_id: p.attribution?.gaClientId ?? fallbackClientId(p.orderId), events: [{ name: "purchase", params }] };
    if (p.userId) body.user_id = p.userId;
    await fetch(`${MP_ENDPOINT}?measurement_id=${encodeURIComponent(GA4_ID)}&api_secret=${encodeURIComponent(secret)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
  } catch (err) {
    console.warn("[analytics] trackServerPurchase failed:", err instanceof Error ? err.message : "unknown");
  }
}
