"use client";

import { useEffect } from "react";
import { gtag } from "@/lib/analytics/browser";
import { track } from "@/lib/analytics/track";
import type { AnalyticsItem } from "@/lib/analytics/types";

export type PurchaseTrackerOrder = {
  /** Id de la orden: se usa como transaction_id. */
  id: string;
  /** Total cobrado en MXN (p. ej. 599). */
  valueMxn: number;
  items: { id: string; name: string; price: number; quantity?: number; category?: string }[];
  /** Correo del comprador para conversiones mejoradas de Google Ads (gtag lo normaliza y hashea). */
  email?: string | null;
  coupon?: string | null;
};

const memoryGuard = new Set<string>();

function alreadySent(key: string): boolean {
  if (memoryGuard.has(key)) return true;
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function markSent(key: string): void {
  memoryGuard.add(key);
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    /* almacenamiento bloqueado: solo memoria */
  }
}

/**
 * Dispara GA4 `purchase` + la conversión de compra de Google Ads una sola vez por orden (guardado en localStorage).
 * Renderízalo en la página de éxito solo cuando la orden esté pagada. No pinta nada.
 */
export function PurchaseTracker({ order, enabled = true }: { order: PurchaseTrackerOrder; enabled?: boolean }) {
  useEffect(() => {
    if (!enabled || !order.id || !(order.valueMxn > 0)) return;
    const key = `np_purchase_${order.id}`;
    if (alreadySent(key)) return;
    markSent(key);

    const email = order.email?.trim().toLowerCase();
    if (email) gtag("set", "user_data", { email });

    const items: AnalyticsItem[] = order.items.map((i, index) => ({
      item_id: i.id,
      item_name: i.name,
      price: i.price,
      quantity: i.quantity ?? 1,
      index,
      item_brand: "NovaPhone",
      ...(i.category ? { item_category: i.category } : {}),
    }));

    track("purchase", {
      transaction_id: order.id,
      value: Math.round(order.valueMxn * 100) / 100,
      currency: "MXN",
      items,
      ...(order.coupon ? { coupon: order.coupon } : {}),
    });
  }, [enabled, order]);

  return null;
}
