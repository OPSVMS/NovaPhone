import "server-only";
import type { CheckoutSession, CreateCheckoutInput, PaymentProvider } from "./index";
import { verifyStripeSignature } from "./stripe-signature";

/**
 * Adaptador de Stripe vía REST (fetch, sin SDK). `STRIPE_API_BASE` permite apuntar al simulador E2E.
 * La versión del API se fija para que los objetos tengan siempre la misma forma.
 * Solo pesos mexicanos: `unit_amount` = precio en MXN × 100.
 */
const API_BASE = () => (process.env.STRIPE_API_BASE || "https://api.stripe.com").replace(/\/+$/, "");
const API_VERSION = "2024-06-20";
const CURRENCY = "mxn";

type Json = Record<string, unknown>;

/** Codifica objetos anidados como form-urlencoded estilo Stripe: a[b][0][c]=v. */
export function formEncode(obj: Json, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === "object") out.push(...formEncode(item as Json, `${key}[${i}]`));
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === "object") {
      out.push(...formEncode(v as Json, key));
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

export class StripeError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

async function stripe<T = Json>(method: "GET" | "POST", path: string, params?: Json, idempotencyKey?: string): Promise<T> {
  const body = params ? formEncode(params).join("&") : "";
  const url = method === "GET" && body ? `${API_BASE()}${path}?${body}` : `${API_BASE()}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Stripe-Version": API_VERSION,
      ...(method !== "GET" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method !== "GET" && body ? body : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as Json & { error?: { message?: string; code?: string } };
  if (!res.ok) throw new StripeError(res.status, json.error?.code, `Stripe ${method} ${path}: ${res.status} ${json.error?.message ?? ""}`);
  return json as T;
}

const idOf = (v: unknown): string | null =>
  typeof v === "string" ? v : v && typeof v === "object" && typeof (v as Json).id === "string" ? ((v as Json).id as string) : null;
const obj = (v: unknown): Json | null => (v && typeof v === "object" ? (v as Json) : null);

function receiptFromIntent(pi: Json | null): string | null {
  const charge = obj(pi?.latest_charge);
  return typeof charge?.receipt_url === "string" ? charge.receipt_url : null;
}

/** Primer código promocional: su `code` si viene expandido, si no el id `promo_…` (se resuelve en getCheckout). */
function promoOf(s: Json): string | null {
  const discounts = Array.isArray(s.discounts) ? (s.discounts as unknown[]) : [];
  for (const d of discounts) {
    const pc = obj(d)?.promotion_code;
    if (typeof pc === "string") return pc;
    if (obj(pc) && typeof obj(pc)!.code === "string") return obj(pc)!.code as string;
  }
  return null;
}

export function toSession(s: Json): CheckoutSession {
  const details = obj(s.customer_details);
  return {
    id: String(s.id),
    url: typeof s.url === "string" ? s.url : null,
    status: (s.status as CheckoutSession["status"]) ?? "open",
    paid: s.status === "complete" && (s.payment_status === "paid" || s.payment_status === "no_payment_required"),
    referenceId: typeof s.client_reference_id === "string" ? s.client_reference_id : null,
    metadata: (obj(s.metadata) ?? {}) as Record<string, string>,
    email: (typeof details?.email === "string" ? details.email : null) ?? (typeof s.customer_email === "string" ? s.customer_email : null),
    name: typeof details?.name === "string" ? details.name : null,
    customerId: idOf(s.customer),
    paymentIntentId: idOf(s.payment_intent),
    amountTotal: typeof s.amount_total === "number" ? s.amount_total : null,
    currency: typeof s.currency === "string" ? s.currency.toUpperCase() : null,
    receiptUrl: receiptFromIntent(obj(s.payment_intent)),
    discountAmount: typeof obj(s.total_details)?.amount_discount === "number" ? (obj(s.total_details)!.amount_discount as number) : null,
    promotionCode: promoOf(s),
  };
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",

  async createCheckout(input: CreateCheckoutInput) {
    const expires = Math.max(30, Math.min(24 * 60, input.expiresInMinutes ?? 60));
    const total = input.lines.reduce((t, l) => t + l.amountCents, 0);
    const metadata = { ...input.metadata, kind: input.kind, ref: input.referenceId, amount_cents: String(total) };
    const params: Json = {
      mode: "payment",
      client_reference_id: input.referenceId,
      // Cuenta conocida → prellenado; invitado → Stripe Checkout pide el correo (customer_details.email).
      ...(input.email ? { customer_email: input.email } : {}),
      customer_creation: "if_required",
      locale: "es-419",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + expires * 60,
      metadata,
      payment_intent_data: { metadata, description: input.lines.map((l) => l.name).join(" + ").slice(0, 200) },
      line_items: input.lines.map((l) => ({
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: l.amountCents,
          product_data: { name: l.name, ...(l.description ? { description: l.description } : {}) },
        },
      })),
      ...(input.allowPromotionCodes ? { allow_promotion_codes: true } : {}),
    };
    const s = await stripe<Json>("POST", "/v1/checkout/sessions", params, `checkout:${input.kind}:${input.referenceId}`);
    if (typeof s.url !== "string") throw new Error("Stripe: la sesión no trae URL");
    return { id: String(s.id), url: s.url };
  },

  async getCheckout(id: string) {
    const s = await stripe<Json>("GET", `/v1/checkout/sessions/${encodeURIComponent(id)}`, { expand: ["payment_intent.latest_charge"] });
    const session = toSession(s);
    // Muestra el código legible ("NOVA10") en vez del id promo_…; nunca falla el cumplimiento por esto.
    if (session.promotionCode?.startsWith("promo_")) {
      const pc = await stripe<Json>("GET", `/v1/promotion_codes/${encodeURIComponent(session.promotionCode)}`).catch(() => null);
      if (pc && typeof pc.code === "string") session.promotionCode = pc.code;
    }
    return session;
  },

  async refund(paymentIntentId, opts = {}) {
    const r = await stripe<Json>(
      "POST",
      "/v1/refunds",
      { payment_intent: paymentIntentId, ...(opts.amountCents ? { amount: opts.amountCents } : {}), metadata: opts.reason ? { reason: opts.reason } : undefined },
      `refund:${paymentIntentId}:${opts.amountCents ?? "all"}:${opts.reason ?? ""}`,
    );
    return { id: String(r.id) };
  },
};

// ─── Webhooks ────────────────────────────────────────────────────────────────

export type StripeEvent = { id: string; type: string; created?: number; data: { object: Json } };

/** Verifica la firma y parsea el evento. null si la firma no es válida o falta STRIPE_WEBHOOK_SECRET. */
export function parseStripeEvent(rawBody: string, signature: string | null): StripeEvent | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return null;
  const v = verifyStripeSignature(rawBody, signature, secret);
  if (!v.ok) return null;
  try {
    const evt = JSON.parse(rawBody) as StripeEvent;
    return evt?.id && evt.type && evt.data?.object ? evt : null;
  } catch {
    return null;
  }
}
