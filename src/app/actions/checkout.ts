"use server";

import { getUser } from "@/lib/session";
import { startCardCheckout as start, type StartCardCheckoutInput, type StartCardCheckoutResult } from "@/lib/checkout";

/**
 * Compra directa con tarjeta (Stripe Checkout, MXN). No requiere cuenta, pero sí el correo: con él se busca o crea la
 * cuenta y se prellena en Stripe. `addNumber` agrega el número para recibir códigos (MXN 79 / 30 días).
 * Regresa `{ url }` (redirige el navegador a Stripe) o `{ error, code }`. Contrato completo en docs/CHECKOUT.md.
 *
 *   const r = await startCardCheckout({ planId: "MX_20_30", email, addNumber: true });
 *   if ("url" in r) window.location.assign(r.url);
 */
export async function startCardCheckout(input: StartCardCheckoutInput): Promise<StartCardCheckoutResult> {
  const user = await getUser().catch(() => null);
  return start({ planId: String(input?.planId ?? ""), email: typeof input?.email === "string" ? input.email : "", addNumber: input?.addNumber === true }, user);
}
