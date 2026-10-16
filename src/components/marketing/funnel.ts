"use client";

import { flushEvents, logEvent } from "@/lib/analytics/funnel-client";
import { track } from "@/lib/analytics/track";

/** Landing picker micro-funnel (first-party, → /api/events). */
export type FunnelEvent = "plan_select" | "email_focus" | "addon_toggle" | "buy_click" | "checkout_redirect" | "buy_error";

export function funnel(event: FunnelEvent, props: Record<string, string | number | boolean | undefined>) {
  logEvent(event, props);
}

/** Send queued events right before leaving for Stripe. */
export function flushFunnel() {
  flushEvents(true);
}

type GaPlan = { id: string; dataGb: number; days: number; priceMxn: number };

const gaItem = (p: GaPlan, index?: number) => ({
  item_id: p.id,
  item_name: `eSIM México ${p.dataGb} GB ${p.days} días`,
  price: p.priceMxn,
  item_category: "esim-datos",
  item_variant: `${p.dataGb}GB-${p.days}d`,
  item_brand: "NovaPhone",
  index,
});

/** GA4 ecommerce mirrors (track() also logs them to the first-party funnel). */
export const ga = {
  viewList: (plans: GaPlan[]) => track("view_item_list", { item_list_id: "landing-plans", items: plans.map((p, i) => gaItem(p, i)) }),
  select: (p: GaPlan) => track("select_item", { item_list_id: "landing-plans", items: [gaItem(p)] }),
  beginCheckout: (p: GaPlan) => track("begin_checkout", { value: p.priceMxn, currency: "MXN", items: [gaItem(p)] }),
};
