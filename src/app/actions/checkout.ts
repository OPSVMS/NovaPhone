"use server";

import { getUser } from "@/lib/session";
import { startCardCheckout as start, type StartCardCheckoutInput, type StartCardCheckoutResult } from "@/lib/checkout";

/**
 * Compra directa con tarjeta (Stripe Checkout, MXN). No requiere cuenta ni correo: Stripe lo pide.
 * Regresa `{ url }` (redirige el navegador a Stripe) o `{ error, code }`. Contrato completo en docs/CHECKOUT.md.
 *
 *   const r = await startCardCheckout({ planId: "MX_20_30" });
 *   if ("url" in r) window.location.assign(r.url);
 */
export async function startCardCheckout(input: StartCardCheckoutInput): Promise<StartCardCheckoutResult> {
  const user = await getUser().catch(() => null);
  return start({ planId: String(input?.planId ?? ""), addNumber: !!input?.addNumber }, user);
}
