import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { parseStripeEvent } from "@/lib/payments/stripe";
import { flagPayment, reconcileCheckout } from "@/lib/checkout";

export const maxDuration = 60;

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : v && typeof v === "object" && typeof (v as Obj).id === "string" ? ((v as Obj).id as string) : null);

/**
 * Webhook de Stripe. Firma `Stripe-Signature` (t=,v1=) con STRIPE_WEBHOOK_SECRET y deduplicación en webhook_events.
 * Eventos: checkout.session.completed / async_payment_succeeded / async_payment_failed / expired (se re-verifica la
 * sesión con el API antes de cumplir), charge.refunded y charge.dispute.created (se marca y se audita).
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const event = parseStripeEvent(raw, req.headers.get("stripe-signature"));
  if (!event) return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 400 });

  const dedupeId = `stripe:${event.id}`;
  const [fresh] = await db.insert(schema.webhookEvents).values({ id: dedupeId, type: event.type, payload: event }).onConflictDoNothing().returning();
  if (!fresh) return NextResponse.json({ ok: true, result: "duplicate" });

  const o = event.data.object;
  try {
    let result = "ignored";
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        result = await reconcileCheckout(String(o.id));
        break;
      case "charge.refunded": {
        const pi = str(o.payment_intent);
        if (pi) result = await flagPayment({ paymentIntentId: pi, kind: "refund", amountRefundedCents: Number(o.amount_refunded ?? 0), fullyRefunded: !!o.refunded, eventId: event.id });
        break;
      }
      case "charge.dispute.created": {
        const pi = str(o.payment_intent);
        if (pi) result = await flagPayment({ paymentIntentId: pi, kind: "dispute", eventId: event.id, reason: typeof o.reason === "string" ? o.reason : null });
        break;
      }
    }
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    // Libera el id para que Stripe reintente.
    await db.delete(schema.webhookEvents).where(eq(schema.webhookEvents.id, dedupeId)).catch(() => null);
    console.error("stripe webhook", event.type, event.id, e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
