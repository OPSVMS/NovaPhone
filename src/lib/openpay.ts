import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { completeDeposit } from "./deposits";

/**
 * Openpay (BBVA) — cobro con tarjeta por redirección (página segura de Openpay con 3D Secure).
 * No tocamos datos de tarjeta: creamos el cargo con confirm=false y redirigimos a payment_method.url.
 */
export const openpayEnabled = () => !!(process.env.OPENPAY_MERCHANT_ID && process.env.OPENPAY_PRIVATE_KEY);
const BASE = () =>
  process.env.OPENPAY_BASE_URL ?? (process.env.OPENPAY_PRODUCTION === "true" ? "https://api.openpay.mx" : "https://sandbox-api.openpay.mx");

type OpenpayCharge = {
  id: string;
  status: "charge_pending" | "completed" | "failed" | "cancelled" | "in_progress" | string;
  amount: number;
  order_id?: string;
  error_message?: string | null;
  payment_method?: { type: string; url?: string };
};

async function op<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(`${process.env.OPENPAY_PRIVATE_KEY}:`).toString("base64");
  const res = await fetch(`${BASE()}/v1/${process.env.OPENPAY_MERCHANT_ID}${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Openpay ${res.status}: ${(json as { description?: string }).description ?? JSON.stringify(json)}`);
  return json as T;
}

/** Comisión de tarjeta que se le suma al cliente: 2.9% + $2.50, más IVA (configurable). */
export function cardFeeCents(amountCents: number) {
  if (process.env.OPENPAY_PASS_FEES === "false") return 0;
  const pct = Number(process.env.OPENPAY_FEE_PCT ?? 2.9) / 100;
  const fixed = Number(process.env.OPENPAY_FEE_FIXED ?? 2.5) * 100;
  const iva = 1.16;
  // El cliente paga total T tal que T - comisión(T) = monto.
  const total = (amountCents + fixed * iva) / (1 - pct * iva);
  return Math.ceil(total / 100) * 100 - amountCents;
}

/** Crea el depósito con tarjeta y regresa la URL de pago de Openpay. */
export async function createCardDeposit(user: { id: string; name: string; email: string }, amountMxn: number) {
  const amountCents = Math.round(amountMxn * 100);
  const feeCents = cardFeeCents(amountCents);
  const [dep] = await db
    .insert(schema.deposits)
    .values({
      userId: user.id,
      method: "card",
      amountCents,
      reference: `T${Date.now().toString().slice(-9)}`,
      meta: { feeCents, chargedCents: amountCents + feeCents },
    })
    .returning();
  const [first, ...rest] = user.name.trim().split(/\s+/);
  const charge = await op<OpenpayCharge>("POST", "/charges", {
    method: "card",
    amount: (amountCents + feeCents) / 100,
    currency: "MXN",
    description: `Saldo NovaPhone ${amountMxn} MXN`,
    order_id: dep.id,
    confirm: "false",
    send_email: "false",
    use_3d_secure: "true",
    redirect_url: `${process.env.APP_URL}/api/pagos/openpay/retorno?deposito=${dep.id}`,
    customer: { name: first ?? user.name, last_name: rest.join(" ") || "-", email: user.email },
  });
  await db
    .update(schema.deposits)
    .set({ meta: { feeCents, chargedCents: amountCents + feeCents, chargeId: charge.id } })
    .where(eq(schema.deposits.id, dep.id));
  if (!charge.payment_method?.url) throw new Error("Openpay no regresó URL de pago");
  return { depositId: dep.id, url: charge.payment_method.url };
}

/** Consulta el cargo en Openpay y acredita si está completado. Idempotente. */
export async function syncCardDeposit(depositId: string) {
  const dep = await db.query.deposits.findFirst({ where: and(eq(schema.deposits.id, depositId), eq(schema.deposits.method, "card")) });
  const chargeId = (dep?.meta as { chargeId?: string } | null)?.chargeId;
  if (!dep || !chargeId || dep.status !== "pending") return dep?.status ?? "unknown";
  const charge = await op<OpenpayCharge>("GET", `/charges/${chargeId}`);
  if (charge.status === "completed") {
    await completeDeposit(dep.id, { externalId: `openpay:${charge.id}` });
    return "completed";
  }
  if (charge.status === "failed" || charge.status === "cancelled") {
    await db
      .update(schema.deposits)
      .set({ status: "cancelled", meta: { ...(dep.meta ?? {}), error: charge.error_message ?? charge.status } })
      .where(and(eq(schema.deposits.id, dep.id), eq(schema.deposits.status, "pending")));
    return "failed";
  }
  return "pending";
}
