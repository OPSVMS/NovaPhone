import "server-only";
import { after } from "next/server";
import { and, eq, inArray, isNull, lt, or, sql as dsql } from "drizzle-orm";
import { randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, schema } from "@/db";
import type { CardCheckout, Order } from "@/db/schema";
import { getPlan } from "./catalog";
import { getPaymentProvider, type CheckoutSession } from "./payments";
import { EsimAccessError, orderEsim } from "./esimaccess";
import { adjustBalance } from "./wallet";
import { completeDeposit, MIN_DEPOSIT_MXN } from "./deposits";
import { assignNumber, canSellNumber, getUserNumber, NUMBER_PRICE_MXN } from "./numbers";
import { androidInstallUrl, appleInstallUrl, failAndRefund, pollOrder, refreshOrder } from "./orders";
import { signValue } from "./sign";
import { readAttribution, type Attribution } from "./analytics/attribution";
import { adsFrom, logServerEvent } from "./analytics/funnel-server";
import { trackServerPurchase } from "./analytics/server";

/**
 * Compra directa con tarjeta para tráfico de anuncios (sin cuenta ni correo antes de pagar):
 *
 *   startCardCheckout → card_checkouts "pending" + sesión de Stripe Checkout (MXN)
 *   → webhook checkout.session.completed (o reconsulta desde la página de éxito)
 *   → reconcileCheckout: re-verifica la sesión en el API, busca o crea el usuario por `customer_details.email`,
 *     registra el dinero en el monedero de forma atómica (depósito "card" completado + abono + cargo de la eSIM)
 *     y pide la eSIM a eSIM Access por el mismo camino que la compra con saldo.
 *
 * Contabilidad: el cliente nunca ve saldo; en el ledger quedan "Pago con tarjeta" (+) y "eSIM …" (−), así que el
 * saldo neto no cambia y admin/contabilidad ven el ingreso igual que las compras con saldo.
 */

const appUrl = () => (process.env.APP_URL ?? "").replace(/\/+$/, "");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const successPath = (c: Pick<CardCheckout, "id" | "accessToken">) => `/compra/${c.id}?t=${c.accessToken}`;
export const successUrl = (c: Pick<CardCheckout, "id" | "accessToken">) => `${appUrl()}${successPath(c)}`;

export function tokenMatches(c: Pick<CardCheckout, "accessToken">, token: string | null | undefined) {
  if (!token) return false;
  const a = Buffer.from(c.accessToken);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─── Inicio ──────────────────────────────────────────────────────────────────

export type StartCardCheckoutInput = {
  planId: string;
  /**
   * Correo del comprador (obligatorio sin sesión). Se normaliza (trim + minúsculas), se busca o crea la cuenta
   * (sin verificar, sin contraseña) y se prellena en Stripe Checkout. Con sesión iniciada manda la cuenta de la sesión.
   */
  email: string;
  /**
   * Agrega "Número para recibir códigos · 30 días" (MXN 79) como segunda línea. Se ignora sin cobrar si no hay
   * números que vender o si la cuenta ya tiene uno.
   */
  addNumber?: boolean;
};

export type StartCardCheckoutError = "payments_disabled" | "unavailable" | "invalid_email" | "account_disabled" | "provider_error";
export type StartCardCheckoutResult = { url: string } | { error: string; code: StartCardCheckoutError };

export const NUMBER_LINE_NAME = "Número para recibir códigos · 30 días";

/** Implementación de la server action `startCardCheckout` y de `POST /api/checkout`. */
export async function startCardCheckout(input: StartCardCheckoutInput, sessionUser?: { id: string; email: string } | null): Promise<StartCardCheckoutResult> {
  const provider = await getPaymentProvider();
  if (!provider) return { error: "El pago con tarjeta estará disponible muy pronto.", code: "payments_disabled" };
  const plan = typeof input.planId === "string" && input.planId.length <= 64 ? await getPlan(input.planId) : undefined;
  if (!plan) return { error: "Ese plan ya no está disponible.", code: "unavailable" };

  let session: { id: string; email: string; disabledAt: Date | null } | undefined;
  if (sessionUser) {
    session = await db.query.users.findFirst({ where: eq(schema.users.id, sessionUser.id), columns: { id: true, email: true, disabledAt: true } });
  }
  const email = session ? session.email : normalizeEmail(typeof input.email === "string" ? input.email : null);
  if (!email) return { error: "Escribe un correo válido para enviarte tu eSIM.", code: "invalid_email" };
  if (session?.disabledAt) return { error: "Tu cuenta está suspendida. Escríbenos a hola@novaphone.lat.", code: "account_disabled" };

  try {
    // Cuenta desde antes de pagar: la orden pendiente ya queda ligada y Stripe recibe el correo prellenado.
    const user = session ?? (await findOrCreateBuyer(email));
    if (user.disabledAt) return { error: "Tu cuenta está suspendida. Escríbenos a hola@novaphone.lat.", code: "account_disabled" };

    const priceCents = plan.priceMxn * 100;
    const numberCents = input.addNumber && !(await getUserNumber(user.id)) && (await canSellNumber()) ? NUMBER_PRICE_MXN() * 100 : 0;
    const attribution = (await readAttribution()) as Record<string, unknown> | null;
    const [checkout] = await db
      .insert(schema.cardCheckouts)
      .values({
        userId: user.id,
        email: user.email,
        planId: plan.id,
        planName: plan.name,
        priceCents,
        costUsd: plan.costUsd,
        accessToken: randomBytes(24).toString("base64url"),
        attribution,
        numberCents,
        numberStatus: numberCents > 0 ? "pending" : null,
      })
      .returning();
    const stripeSession = await provider.createCheckout({
      kind: "order",
      referenceId: checkout.id,
      email: user.email,
      lines: [
        {
          name: `eSIM NovaPhone · ${plan.name}`,
          description: `${plan.dataGb} GB por ${plan.days} días en la red Telcel 5G. Llega al instante con QR por correo.`,
          amountCents: priceCents,
        },
        ...(numberCents > 0
          ? [{ name: NUMBER_LINE_NAME, description: "Número para recibir SMS de verificación (WhatsApp, bancos, apps). Los mensajes llegan a tu panel NovaPhone.", amountCents: numberCents }]
          : []),
      ],
      successUrl: successUrl(checkout),
      // La página de planes muestra "no se hizo ningún cargo" con cancelled=1 y preselecciona el plan.
      cancelUrl: `${appUrl()}/planes?plan=${encodeURIComponent(plan.id)}&cancelled=1`,
      metadata: { checkoutId: checkout.id, planId: plan.id, userId: user.id, ...(numberCents > 0 ? { number: "1" } : {}) },
      allowPromotionCodes: process.env.STRIPE_ALLOW_PROMOTION_CODES !== "false",
      expiresInMinutes: 60,
    });
    await db.update(schema.cardCheckouts).set({ paymentRef: stripeSession.id, updatedAt: new Date() }).where(eq(schema.cardCheckouts.id, checkout.id));
    await logServerEvent({
      event: "checkout_started",
      path: "/planes",
      props: { plan: plan.id, price: plan.priceMxn, currency: "MXN", logged: !!session, number: numberCents > 0 },
    });
    return { url: stripeSession.url };
  } catch (e) {
    console.error("startCardCheckout", e);
    return { error: "No pudimos iniciar el pago. Intenta de nuevo.", code: "provider_error" };
  }
}

// ─── Usuarios ────────────────────────────────────────────────────────────────

const emailSchema = z.email().max(254);

export function normalizeEmail(v: string | null | undefined): string | null {
  const e = (v ?? "").trim().toLowerCase();
  return emailSchema.safeParse(e).success ? e : null;
}

/**
 * Busca la cuenta del correo o crea una sin verificar y sin contraseña utilizable. El cliente entra después con
 * "Recuperar contraseña" (código de 6 dígitos al correo), que además verifica el correo.
 */
export async function findOrCreateBuyer(email: string, name?: string | null) {
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) return existing;
  const displayName = (name ?? "").trim().replace(/\s+/g, " ").slice(0, 80) || email.split("@")[0].slice(0, 80);
  const [created] = await db
    .insert(schema.users)
    .values({ email, name: displayName, passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10), role: "user", emailVerifiedAt: null })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.query.users.findFirst({ where: eq(schema.users.email, email) }))!;
}

// ─── Cumplimiento (webhook / reconsulta) ─────────────────────────────────────

/**
 * Re-verifica la sesión con el API de Stripe (nunca confía solo en el cuerpo del webhook) y la cumple.
 * Idempotente: se puede llamar desde el webhook, la página de éxito y el polling.
 */
export async function reconcileCheckout(sessionId: string): Promise<string> {
  const provider = await getPaymentProvider();
  if (!provider) return "payments-disabled";
  const s = await provider.getCheckout(sessionId);
  const ref = s.referenceId ?? s.metadata.ref ?? null;
  if (!ref || !UUID_RE.test(ref)) return "no-reference";
  if (s.metadata.kind === "deposit") return reconcileCardDeposit(ref, s);
  if (!s.paid) return s.status === "expired" ? expireCheckout(ref) : "unpaid";
  return fulfilCheckout(ref, s);
}

async function fulfilCheckout(checkoutId: string, s: CheckoutSession): Promise<string> {
  const checkout = await db.query.cardCheckouts.findFirst({ where: eq(schema.cardCheckouts.id, checkoutId) });
  if (!checkout) return "unknown-checkout";
  if (checkout.paymentRef && checkout.paymentRef !== s.id) return "session-mismatch";
  if (s.currency && s.currency !== "MXN") {
    await db.update(schema.cardCheckouts).set({ error: `currency ${s.currency}`, updatedAt: new Date() }).where(eq(schema.cardCheckouts.id, checkout.id));
    console.error("card checkout: unexpected currency", checkout.id, s.currency);
    return "currency-mismatch";
  }

  // 1) Reclamo atómico: solo una llamada concurrente sigue. Un "processing" de más de 5 min (proceso caído a la mitad)
  //    se puede retomar: los pasos 2–4 son idempotentes y la eSIM se pide hasta después.
  const [claimed] = await db
    .update(schema.cardCheckouts)
    .set({ status: "processing", updatedAt: new Date() })
    .where(
      and(
        eq(schema.cardCheckouts.id, checkout.id),
        or(
          inArray(schema.cardCheckouts.status, ["pending", "expired"]),
          and(eq(schema.cardCheckouts.status, "processing"), lt(schema.cardCheckouts.updatedAt, new Date(Date.now() - 5 * 60_000))),
        ),
      ),
    )
    .returning();
  if (!claimed) return "duplicate";

  // Total cobrado = eSIM + número (si se agregó). Un código promocional se descuenta de la eSIM; el número siempre vale su precio.
  const amountCents = s.amountTotal ?? checkout.priceCents + checkout.numberCents;
  const numberCents = Math.min(checkout.numberCents, amountCents);
  const esimCents = amountCents - numberCents;
  let order: Order;
  let userId: string;
  try {
    // 2) Cuenta: la ligada al iniciar (correo obligatorio) o, en órdenes viejas, la del correo que capturó Stripe.
    const email = normalizeEmail(s.email);
    if (!checkout.userId && !email) throw new Error("paid checkout without email");
    userId = checkout.userId ?? (await findOrCreateBuyer(email!, s.name)).id;

    // 3) Dinero + orden en una sola sentencia (atómica e idempotente por external_id y por el id de la orden):
    //    abono del total, cargo de la eSIM; lo del número queda en el saldo para el paso 4.
    const depositId = randomUUID();
    const reference = `S${Date.now().toString().slice(-9)}${randomInt(100, 999)}`;
    const meta = {
      provider: "stripe",
      kind: "esim",
      checkoutId: checkout.id,
      sessionId: s.id,
      paymentIntentId: s.paymentIntentId,
      listPriceCents: checkout.priceCents + checkout.numberCents,
      chargedCents: amountCents,
      numberCents,
      promotionCode: s.promotionCode,
      discountCents: s.discountAmount,
      receiptUrl: s.receiptUrl,
    };
    const res = await db.execute(dsql`
      with dep as (
        insert into deposits (id, user_id, method, amount_cents, reference, status, external_id, meta, completed_at)
        values (${depositId}::uuid, ${userId}::uuid, 'card', ${amountCents}::int, ${reference}, 'completed', ${`stripe:${s.id}`}, ${JSON.stringify(meta)}::jsonb, now())
        on conflict do nothing
        returning id
      ),
      bal as (
        select balance_cents from users where id = ${userId}::uuid and exists (select 1 from dep) for update
      ),
      ord as (
        insert into orders (id, user_id, plan_id, plan_name, price_cents, cost_usd)
        select ${checkout.id}::uuid, ${userId}::uuid, ${checkout.planId}, ${checkout.planName}, ${esimCents}::int, ${checkout.costUsd}::numeric
        where exists (select 1 from dep)
        on conflict do nothing
        returning id
      ),
      credit as (
        insert into ledger (user_id, amount_cents, kind, ref_id, description, balance_after_cents, created_at)
        select ${userId}::uuid, ${amountCents}::int, 'deposit', (select id::text from dep), 'Pago con tarjeta', bal.balance_cents + ${amountCents}::int, now()
        from bal
        returning id
      ),
      debit as (
        insert into ledger (user_id, amount_cents, kind, ref_id, description, balance_after_cents, created_at)
        select ${userId}::uuid, ${-esimCents}::int, 'purchase', ${checkout.id}, ${`eSIM ${checkout.planName}`}, bal.balance_cents + ${numberCents}::int, now() + interval '1 millisecond'
        from bal
        where exists (select 1 from ord)
        returning id
      ),
      held as (
        update users set balance_cents = balance_cents + ${numberCents}::int
        where id = ${userId}::uuid and ${numberCents}::int <> 0 and exists (select 1 from ord) and exists (select 1 from bal)
        returning id
      )
      select (select id from dep) as deposit_id, (select id from ord) as order_id
    `);
    const row = (res.rows[0] ?? {}) as { deposit_id?: string | null };
    const dep = row.deposit_id
      ? { id: row.deposit_id }
      : await db.query.deposits.findFirst({ where: eq(schema.deposits.externalId, `stripe:${s.id}`), columns: { id: true } });
    const found = await db.query.orders.findFirst({ where: eq(schema.orders.id, checkout.id) });
    if (!found) throw new Error("order row missing after payment");
    order = found;

    // 4) Número: se paga con el saldo por el camino normal (cargo "Número NovaPhone …" en el ledger). Sin número → $79 a la tarjeta.
    if (numberCents > 0) await fulfilNumber(claimed, order, userId, s, numberCents);

    await db
      .update(schema.cardCheckouts)
      .set({
        status: "paid",
        userId,
        email: email ?? checkout.email,
        paymentRef: s.id,
        paymentIntentId: s.paymentIntentId,
        amountPaidCents: amountCents,
        currency: s.currency ?? "MXN",
        promotionCode: s.promotionCode,
        discountCents: s.discountAmount,
        receiptUrl: s.receiptUrl,
        orderId: order.id,
        depositId: dep?.id ?? null,
        paidAt: new Date(),
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.cardCheckouts.id, checkout.id));
  } catch (e) {
    // Todo lo anterior es idempotente: libera el reclamo para que Stripe reintente el webhook.
    await db.update(schema.cardCheckouts).set({ status: "pending", error: e instanceof Error ? e.message.slice(0, 300) : "error", updatedAt: new Date() }).where(eq(schema.cardCheckouts.id, checkout.id));
    throw e;
  }

  const attribution = (checkout.attribution ?? null) as Attribution | null;
  await logServerEvent(
    { event: "paid", path: null, props: { plan: checkout.planId, total: amountCents / 100, currency: "MXN", promo: !!s.promotionCode, number: numberCents > 0 } },
    adsFrom(attribution),
  );

  // 5) eSIM: mismo proveedor y transactionId (= id de la orden) que la compra con saldo.
  const placed = await placeEsimOrder(order, claimed, s);
  after(async () => {
    await trackServerPurchase({
      orderId: order.id,
      valueMxn: amountCents / 100,
      items: purchaseItems(checkout, amountCents),
      attribution,
      userId,
    });
    if (placed === "placed") await pollOrder(order).catch((e) => console.error("pollOrder", order.id, e));
  });
  return placed === "placed" ? "order-placed" : `order-${placed}`;
}

/** Líneas para analítica: eSIM (con el descuento) + número, si se cobró. */
function purchaseItems(c: Pick<CardCheckout, "planId" | "planName" | "numberCents">, paidCents: number) {
  const numberCents = Math.min(c.numberCents, paidCents);
  return [
    { id: c.planId, name: c.planName, price: (paidCents - numberCents) / 100 },
    ...(numberCents > 0 ? [{ id: "NUMBER_30", name: NUMBER_LINE_NAME, price: numberCents / 100 }] : []),
  ];
}

/**
 * Asigna el número comprado junto con la eSIM. El dinero ya está en el saldo (paso 3), así que se usa la compra
 * normal con saldo (`assignNumber`, cargo de $79 en el ledger). Idempotente por `number_status`:
 * pending → assigned | refunded (reembolso parcial a la tarjeta) | failed (no se pudo reembolsar: queda como saldo).
 */
async function fulfilNumber(checkout: CardCheckout, order: Order, userId: string, s: CheckoutSession, numberCents: number) {
  const current = await db.query.cardCheckouts.findFirst({ where: eq(schema.cardCheckouts.id, checkout.id), columns: { numberStatus: true } });
  if (current?.numberStatus !== "pending") return;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId), columns: { id: true, email: true } });
  if (!user) throw new Error("buyer missing");

  // Retomado tras una caída: el número ya quedó asignado a esta orden.
  const existing = await db.query.phoneNumbers.findFirst({
    where: and(eq(schema.phoneNumbers.userId, userId), eq(schema.phoneNumbers.orderId, order.id), eq(schema.phoneNumbers.status, "assigned")),
  });
  const res = existing ? ({ ok: true, number: existing } as const) : await assignNumber(user, { orderId: order.id });
  if (res.ok) {
    await db
      .update(schema.cardCheckouts)
      .set({ numberStatus: "assigned", numberId: res.number.id, updatedAt: new Date() })
      .where(and(eq(schema.cardCheckouts.id, checkout.id), eq(schema.cardCheckouts.numberStatus, "pending")));
    return;
  }

  // Sin número (inventario agotado, ya tenía uno o no alcanzó): se devuelve lo del número a la tarjeta.
  let refunded = false;
  const provider = s.paymentIntentId && process.env.AUTO_REFUND_ON_FAILURE !== "false" ? await getPaymentProvider() : null;
  if (provider && s.paymentIntentId) {
    try {
      await provider.refund(s.paymentIntentId, { amountCents: numberCents, reason: `number-unavailable:${order.id}` });
      refunded = true;
    } catch (e) {
      console.error("number refund failed", order.id, e);
    }
  }
  const [marked] = await db
    .update(schema.cardCheckouts)
    .set({
      numberStatus: refunded ? "refunded" : "failed",
      ...(refunded ? { refundedCents: dsql`greatest(${schema.cardCheckouts.refundedCents}, ${numberCents}::int)` } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.cardCheckouts.id, checkout.id), eq(schema.cardCheckouts.numberStatus, "pending")))
    .returning({ id: schema.cardCheckouts.id });
  if (!marked) return;
  // Reembolsado: sale del saldo. Si Stripe falló, los $79 se quedan como saldo del cliente y admin lo ve en la bitácora.
  if (refunded) await adjustBalance({ userId, amountCents: -numberCents, kind: "adjustment", description: "Reembolso a tu tarjeta (número)", refId: order.id, allowNegative: true });
  await db.insert(schema.adminAudit).values({
    adminId: null,
    action: "card_checkout.number_refund",
    targetType: "order",
    targetId: order.id,
    details: { reason: res.code, error: res.error, amountCents: numberCents, refundedToCard: refunded, paymentIntentId: s.paymentIntentId },
  });
}

/**
 * Pide la eSIM. Error definitivo del proveedor → reembolso (al saldo y luego a la tarjeta). Error de red → la orden
 * queda "provisioning" con el error anotado (se ve como atascada en /admin/esims); nunca se reintenta a ciegas.
 */
async function placeEsimOrder(order: Order, checkout: CardCheckout, s: CheckoutSession): Promise<"placed" | "refunded" | "failed" | "uncertain"> {
  const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, order.planId) });
  try {
    if (!plan) throw new EsimAccessError("plan-missing", "plan-missing");
    const { orderNo } = await orderEsim(order.id, plan.providerCode);
    const [updated] = await db
      .update(schema.orders)
      .set({ providerOrderNo: orderNo, updatedAt: new Date() })
      .where(eq(schema.orders.id, order.id))
      .returning();
    Object.assign(order, updated);
    await db.update(schema.cardCheckouts).set({ status: "fulfilled", fulfilledAt: new Date(), updatedAt: new Date() }).where(eq(schema.cardCheckouts.id, checkout.id));
    return "placed";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "provider error";
    if (!(e instanceof EsimAccessError)) {
      await db.update(schema.orders).set({ error: `order-uncertain: ${msg}`.slice(0, 300), updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
      await db.update(schema.cardCheckouts).set({ error: `order-uncertain: ${msg}`.slice(0, 300), updatedAt: new Date() }).where(eq(schema.cardCheckouts.id, checkout.id));
      console.error("esimaccess order uncertain", order.id, msg);
      return "uncertain";
    }
    // Reembolso al saldo (camino de siempre) y, si se puede, de vuelta a la tarjeta.
    const refundedToWallet = await failAndRefund(order, msg);
    const refunded = refundedToWallet ? await refundToCard(order, checkout, s, msg) : false;
    await db
      .update(schema.cardCheckouts)
      .set({ status: refunded ? "refunded" : "failed", error: msg.slice(0, 300), updatedAt: new Date() })
      .where(eq(schema.cardCheckouts.id, checkout.id));
    await db.insert(schema.adminAudit).values({ adminId: null, action: "card_checkout.failed", targetType: "order", targetId: order.id, details: { error: msg, refundedToCard: refunded } });
    return refunded ? "refunded" : "failed";
  }
}

/**
 * Devuelve a la tarjeta lo cobrado por la eSIM (solo esa parte: si se compró número, el número se queda) y retira
 * ese monto del saldo (que acababa de reembolsarse).
 */
async function refundToCard(order: Order, checkout: CardCheckout, s: CheckoutSession, reason: string) {
  if (!s.paymentIntentId || process.env.AUTO_REFUND_ON_FAILURE === "false") return false;
  if (order.priceCents <= 0) return false;
  const provider = await getPaymentProvider();
  if (!provider) return false;
  try {
    await provider.refund(s.paymentIntentId, { amountCents: order.priceCents, reason: `order-failed:${order.id}` });
  } catch (e) {
    console.error("card refund failed", order.id, e);
    return false;
  }
  await adjustBalance({ userId: order.userId, amountCents: -order.priceCents, kind: "adjustment", description: "Reembolso a tu tarjeta", refId: order.id, allowNegative: true });
  const latest = await db.query.cardCheckouts.findFirst({ where: eq(schema.cardCheckouts.id, checkout.id), columns: { numberStatus: true, numberCents: true, depositId: true } });
  const numberRefunded = latest?.numberStatus === "refunded" ? latest.numberCents : 0;
  const keepsNumber = latest?.numberStatus === "assigned";
  await db
    .update(schema.cardCheckouts)
    .set({
      refundedCents: dsql`greatest(${schema.cardCheckouts.refundedCents}, ${order.priceCents + numberRefunded}::int)`,
      flagReason: `auto-refund: ${reason}`.slice(0, 300),
      updatedAt: new Date(),
    })
    .where(eq(schema.cardCheckouts.id, checkout.id));
  // El depósito solo se marca devuelto si se devolvió todo (sin número que se quede con el cliente).
  const depositId = latest?.depositId ?? checkout.depositId;
  if (depositId && !keepsNumber) await db.update(schema.deposits).set({ status: "returned" }).where(eq(schema.deposits.id, depositId));
  return true;
}

/** Sesión expirada sin pago → orden pendiente expirada. */
export async function expireCheckout(checkoutId: string) {
  await db
    .update(schema.cardCheckouts)
    .set({ status: "expired", updatedAt: new Date() })
    .where(and(eq(schema.cardCheckouts.id, checkoutId), eq(schema.cardCheckouts.status, "pending")));
  return "expired";
}

// ─── Reembolsos y disputas ───────────────────────────────────────────────────

/** charge.refunded / charge.dispute.created: marca el cobro y deja rastro en la auditoría. No toca saldos. */
export async function flagPayment(p: { paymentIntentId: string; kind: "refund" | "dispute"; amountRefundedCents?: number; fullyRefunded?: boolean; eventId: string; reason?: string | null }) {
  const checkout = await db.query.cardCheckouts.findFirst({ where: eq(schema.cardCheckouts.paymentIntentId, p.paymentIntentId) });
  const deposit = checkout
    ? undefined
    : await db.query.deposits.findFirst({ where: and(eq(schema.deposits.method, "card"), dsql`${schema.deposits.meta}->>'paymentIntentId' = ${p.paymentIntentId}`) });
  const reason = p.kind === "dispute" ? `dispute${p.reason ? `: ${p.reason}` : ""}` : `refund${p.fullyRefunded ? "" : " (partial)"}`;
  if (checkout) {
    await db
      .update(schema.cardCheckouts)
      .set({
        flaggedAt: new Date(),
        flagReason: reason,
        ...(p.amountRefundedCents != null ? { refundedCents: p.amountRefundedCents } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.cardCheckouts.id, checkout.id));
  }
  if (deposit) {
    await db
      .update(schema.deposits)
      .set({ meta: { ...(deposit.meta ?? {}), flaggedAt: new Date().toISOString(), flagReason: reason, refundedCents: p.amountRefundedCents ?? null } })
      .where(eq(schema.deposits.id, deposit.id));
  }
  await db.insert(schema.adminAudit).values({
    adminId: null,
    action: p.kind === "dispute" ? "payment.dispute" : "payment.refund",
    targetType: checkout ? "order" : deposit ? "deposit" : "payment",
    targetId: checkout?.id ?? deposit?.id ?? p.paymentIntentId,
    details: { paymentIntentId: p.paymentIntentId, eventId: p.eventId, amountRefundedCents: p.amountRefundedCents ?? null, reason: p.reason ?? null },
  });
  return checkout || deposit ? "flagged" : "unknown-payment";
}

// ─── Depósitos al saldo con tarjeta (Stripe) ─────────────────────────────────

export const CARD_DEPOSIT_MAX_MXN = 20_000;

export type CardFeeConfig = { pct: number; fixedMxn: number; pass: boolean };

/** Comisión de tarjeta que se le suma al cliente en recargas de saldo (Stripe MX: 3.6% + $3 + IVA por defecto). */
export function cardFeeConfig(): CardFeeConfig {
  return {
    pct: Number(process.env.CARD_FEE_PCT ?? 3.6),
    fixedMxn: Number(process.env.CARD_FEE_FIXED_MXN ?? 3),
    pass: process.env.CARD_PASS_FEES !== "false",
  };
}

export function cardFeeCents(amountCents: number, cfg = cardFeeConfig()) {
  if (!cfg.pass) return 0;
  const pct = cfg.pct / 100;
  const fixed = cfg.fixedMxn * 100;
  const iva = 1.16;
  // El cliente paga un total T tal que T − comisión(T) = monto.
  const total = (amountCents + fixed * iva) / (1 - pct * iva);
  return Math.ceil(total / 100) * 100 - amountCents;
}

type StripeDepositMeta = { provider?: string; sessionId?: string; feeCents?: number; chargedCents?: number; paymentIntentId?: string | null };

/** Crea el depósito con tarjeta y regresa la URL de Stripe Checkout. */
export async function startCardDeposit(user: { id: string; email: string }, amountMxn: number): Promise<{ url: string } | { error: string }> {
  const provider = await getPaymentProvider();
  if (!provider) return { error: "El pago con tarjeta estará disponible muy pronto." };
  if (!Number.isInteger(amountMxn) || amountMxn < MIN_DEPOSIT_MXN || amountMxn > CARD_DEPOSIT_MAX_MXN) return { error: "Monto inválido." };
  const amountCents = amountMxn * 100;
  const feeCents = cardFeeCents(amountCents);
  const meta: StripeDepositMeta = { provider: "stripe", feeCents, chargedCents: amountCents + feeCents };
  const [dep] = await db
    .insert(schema.deposits)
    .values({ userId: user.id, method: "card", amountCents, reference: `T${Date.now().toString().slice(-9)}${randomInt(10, 99)}`, meta })
    .returning();
  try {
    const session = await provider.createCheckout({
      kind: "deposit",
      referenceId: dep.id,
      email: user.email,
      lines: [
        { name: "Saldo NovaPhone", description: "Se acredita al instante en tu cuenta.", amountCents },
        ...(feeCents > 0 ? [{ name: "Comisión por pago con tarjeta", amountCents: feeCents }] : []),
      ],
      successUrl: `${appUrl()}/app/fondos/${dep.id}`,
      cancelUrl: `${appUrl()}/app/fondos?metodo=tarjeta&monto=${amountMxn}`,
      metadata: { depositId: dep.id, userId: user.id },
      allowPromotionCodes: false,
      expiresInMinutes: 60,
    });
    await db.update(schema.deposits).set({ meta: { ...meta, sessionId: session.id } }).where(eq(schema.deposits.id, dep.id));
    return { url: session.url };
  } catch (e) {
    console.error("startCardDeposit", e);
    await db.update(schema.deposits).set({ status: "cancelled" }).where(and(eq(schema.deposits.id, dep.id), eq(schema.deposits.status, "pending")));
    return { error: "No pudimos iniciar el pago con tarjeta. Intenta de nuevo." };
  }
}

async function reconcileCardDeposit(depositId: string, s: CheckoutSession): Promise<string> {
  const dep = await db.query.deposits.findFirst({ where: and(eq(schema.deposits.id, depositId), eq(schema.deposits.method, "card")) });
  if (!dep) return "unknown-deposit";
  const meta = (dep.meta ?? {}) as StripeDepositMeta;
  if (meta.sessionId && meta.sessionId !== s.id) return "session-mismatch";
  if (dep.status !== "pending") return "duplicate";
  if (!s.paid) {
    if (s.status !== "expired") return "unpaid";
    await db.update(schema.deposits).set({ status: "expired" }).where(and(eq(schema.deposits.id, dep.id), eq(schema.deposits.status, "pending")));
    return "expired";
  }
  if (s.currency !== "MXN" || (meta.chargedCents && s.amountTotal !== null && s.amountTotal < meta.chargedCents)) {
    console.error("card deposit amount mismatch", dep.id, s.amountTotal, s.currency);
    return "amount-mismatch";
  }
  const done = await completeDeposit(dep.id, {
    externalId: `stripe:${s.id}`,
    meta: { ...meta, sessionId: s.id, paymentIntentId: s.paymentIntentId, receiptUrl: s.receiptUrl },
  });
  return done ? "deposit-credited" : "duplicate";
}

/** Página de detalle del depósito: consulta Stripe si el webhook aún no llega. */
export async function syncStripeDeposit(depositId: string) {
  const dep = await db.query.deposits.findFirst({ where: and(eq(schema.deposits.id, depositId), eq(schema.deposits.method, "card")) });
  const meta = (dep?.meta ?? {}) as StripeDepositMeta;
  if (!dep || dep.status !== "pending" || meta.provider !== "stripe" || !meta.sessionId) return dep?.status ?? "unknown";
  await reconcileCheckout(meta.sessionId);
  return (await db.query.deposits.findFirst({ where: eq(schema.deposits.id, depositId), columns: { status: true } }))?.status ?? "unknown";
}

// ─── Página de éxito ─────────────────────────────────────────────────────────

export type OrderForSuccessStatus = "pending" | "provisioning" | "ready" | "failed" | "refunded" | "expired" | "cancelled";

export type OrderForSuccess = {
  /** Id de la orden (= id del checkout). */
  id: string;
  status: OrderForSuccessStatus;
  /** Correo del comprador (obligatorio al iniciar el checkout). */
  email: string;
  /** Cuenta sin reclamar todavía (creada por la compra, nunca ha entrado): se entra con "Crear mi contraseña". */
  newAccount: boolean;
  createdAt: string;
  paidAt: string | null;
  plan: { id: string; name: string; dataGb: number | null; days: number | null };
  /** Precio de lista y lo realmente cobrado (MXN, pesos). */
  priceMxn: number;
  paidMxn: number | null;
  currency: "MXN";
  promotionCode: string | null;
  /** Ya enviamos el correo con el QR. */
  emailSent: boolean;
  /** Número para recibir códigos comprado en este checkout (`addNumber`), ya asignado. */
  number: { e164: string } | null;
  /** Se pidió número pero no había: lo cobrado por él se devolvió a la tarjeta (`card`) o quedó como saldo (`wallet`). */
  numberRefund: null | { amountMxn: number; to: "card" | "wallet" };
  esim: null | {
    iccid: string | null;
    activationCode: string;
    smdpAddress: string;
    matchingId: string;
    apn: string | null;
    /** PNG del QR (URL firmada, relativa). */
    qrUrl: string;
    iosInstallUrl: string;
    androidInstallUrl: string;
  };
  /** Para <PurchaseTracker> (solo cuando está pagada). */
  purchase: null | { transactionId: string; value: number; currency: "MXN"; coupon: string | null; items: { id: string; name: string; price: number }[] };
  /** Rutas internas para entrar a la cuenta. */
  links: { account: string; login: string; setPassword: string; buyAgain: string };
};

/**
 * Datos de `/compra/{id}?t={token}` y de `GET /api/orders/{id}?t=`. Sin token válido regresa null.
 * Mientras esté pendiente reconsulta el pago con Stripe (por si el webhook tarda) y, si la eSIM se está generando,
 * consulta a eSIM Access.
 */
export async function getOrderForSuccess(orderId: string, token: string | null | undefined): Promise<OrderForSuccess | null> {
  if (!UUID_RE.test(orderId) || !token) return null;
  let checkout = await db.query.cardCheckouts.findFirst({ where: eq(schema.cardCheckouts.id, orderId) });
  if (!checkout || !tokenMatches(checkout, token)) return null;

  if ((checkout.status === "pending" || checkout.status === "expired") && checkout.paymentRef) {
    await reconcileCheckout(checkout.paymentRef).catch((e) => console.error("reconcile", checkout!.id, e));
    checkout = (await db.query.cardCheckouts.findFirst({ where: eq(schema.cardCheckouts.id, orderId) })) ?? checkout;
  }
  let order = checkout.orderId ? await db.query.orders.findFirst({ where: eq(schema.orders.id, checkout.orderId) }) : undefined;
  if (order?.status === "provisioning" && order.providerOrderNo) order = await refreshOrder(order).catch(() => order!);

  const [user, plan, number] = await Promise.all([
    checkout.userId ? db.query.users.findFirst({ where: eq(schema.users.id, checkout.userId), columns: { email: true, lastSeenAt: true } }) : Promise.resolve(undefined),
    db.query.plans.findFirst({ where: eq(schema.plans.id, checkout.planId), columns: { dataGb: true, days: true } }),
    checkout.numberId && checkout.numberStatus === "assigned"
      ? db.query.phoneNumbers.findFirst({ where: eq(schema.phoneNumbers.id, checkout.numberId), columns: { e164: true } })
      : Promise.resolve(undefined),
  ]);

  const status: OrderForSuccessStatus =
    checkout.status === "expired"
      ? "expired"
      : checkout.status === "refunded"
        ? "refunded"
        : checkout.status === "failed"
          ? "failed"
          : order
            ? order.status
            : checkout.status === "pending"
              ? "pending"
              : "provisioning";
  const paid = !!checkout.paidAt;
  const paidCents = checkout.amountPaidCents;
  const lpa = order?.status === "ready" ? order.activationCode : null;
  const [, smdp = "", matching = ""] = (lpa ?? "").split("$");
  const email = user?.email ?? checkout.email ?? "";
  const accountPath = `/app/esims/${checkout.id}`;
  return {
    id: checkout.id,
    status,
    email,
    newAccount: !!user && !user.lastSeenAt,
    createdAt: checkout.createdAt.toISOString(),
    paidAt: checkout.paidAt?.toISOString() ?? null,
    plan: { id: checkout.planId, name: checkout.planName, dataGb: plan?.dataGb ?? null, days: plan?.days ?? null },
    priceMxn: checkout.priceCents / 100,
    paidMxn: paidCents != null ? paidCents / 100 : null,
    currency: "MXN",
    promotionCode: checkout.promotionCode,
    emailSent: !!order?.emailedAt,
    number: number ? { e164: number.e164 } : null,
    numberRefund:
      checkout.numberStatus === "refunded" || checkout.numberStatus === "failed"
        ? { amountMxn: checkout.numberCents / 100, to: checkout.numberStatus === "refunded" ? "card" : "wallet" }
        : null,
    esim: lpa
      ? {
          iccid: order!.iccid,
          activationCode: lpa,
          smdpAddress: smdp,
          matchingId: matching,
          apn: order!.apn,
          qrUrl: `/api/qr/${checkout.id}?sig=${signValue(checkout.id)}`,
          iosInstallUrl: appleInstallUrl(lpa),
          androidInstallUrl: androidInstallUrl(lpa),
        }
      : null,
    purchase:
      paid && paidCents != null
        ? {
            transactionId: checkout.id,
            value: paidCents / 100,
            currency: "MXN",
            coupon: checkout.promotionCode,
            items: purchaseItems(checkout, paidCents),
          }
        : null,
    links: {
      account: accountPath,
      login: `/entrar?next=${encodeURIComponent(accountPath)}`,
      setPassword: `/recuperar${email ? `?email=${encodeURIComponent(email)}` : ""}`,
      buyAgain: `/planes?plan=${encodeURIComponent(checkout.planId)}`,
    },
  };
}

/** Órdenes con tarjeta pendientes de pago abandonadas (respaldo si no llega `checkout.session.expired`). */
export async function expireStaleCardCheckouts(hours = 24) {
  const rows = await db
    .update(schema.cardCheckouts)
    .set({ status: "expired", updatedAt: new Date() })
    .where(and(eq(schema.cardCheckouts.status, "pending"), isNull(schema.cardCheckouts.paidAt), lt(schema.cardCheckouts.createdAt, new Date(Date.now() - hours * 3600_000))))
    .returning({ id: schema.cardCheckouts.id });
  return rows.length;
}
