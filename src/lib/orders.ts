import "server-only";
import { and, eq, desc, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Order } from "@/db/schema";
import { orderEsim, queryOrder } from "./esimaccess";
import { adjustBalance } from "./wallet";
import { getPlan } from "./catalog";
import { sendEsimReady } from "./email";
import { signValue } from "./sign";

export type PurchaseResult = { ok: true; orderId: string } | { ok: false; error: string };

export async function purchasePlan(user: { id: string; email: string }, planId: string): Promise<PurchaseResult> {
  const plan = await getPlan(planId);
  if (!plan) return { ok: false, error: "Ese plan ya no está disponible." };
  const priceCents = plan.priceMxn * 100;

  const [order] = await db
    .insert(schema.orders)
    .values({ userId: user.id, planId: plan.id, planName: plan.name, priceCents, costUsd: plan.costUsd })
    .returning();

  const balance = await adjustBalance({
    userId: user.id,
    amountCents: -priceCents,
    kind: "purchase",
    description: `eSIM ${plan.name}`,
    refId: order.id,
  });
  if (balance === null) {
    await db.delete(schema.orders).where(eq(schema.orders.id, order.id));
    return { ok: false, error: "Saldo insuficiente. Agrega fondos para continuar." };
  }

  try {
    const { orderNo } = await orderEsim(order.id, plan.providerCode);
    await db.update(schema.orders).set({ providerOrderNo: orderNo, updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
  } catch (e) {
    await failAndRefund(order, e instanceof Error ? e.message : "Error del proveedor");
    return { ok: false, error: "No pudimos generar tu eSIM. Te devolvimos el saldo." };
  }
  return { ok: true, orderId: order.id };
}

/** Marca la orden como reembolsada y devuelve el precio al saldo (solo si seguía aprovisionándose). Regresa si reembolsó. */
export async function failAndRefund(order: Order, error: string) {
  const [updated] = await db
    .update(schema.orders)
    .set({ status: "refunded", error, updatedAt: new Date() })
    .where(and(eq(schema.orders.id, order.id), eq(schema.orders.status, "provisioning")))
    .returning();
  if (updated) {
    await adjustBalance({ userId: order.userId, amountCents: order.priceCents, kind: "refund", description: `Reembolso ${order.planName}`, refId: order.id });
  }
  return !!updated;
}

/** Consulta al proveedor y actualiza la orden. Envía el correo la primera vez que queda lista. */
export async function refreshOrder(order: Order): Promise<Order> {
  if (!order.providerOrderNo || order.status === "refunded" || order.status === "failed") return order;
  const esim = await queryOrder(order.providerOrderNo);
  if (!esim) return order;
  const [updated] = await db
    .update(schema.orders)
    .set({
      status: "ready",
      esimTranNo: esim.esimTranNo,
      iccid: esim.iccid,
      activationCode: esim.ac,
      apn: esim.apn,
      esimStatus: esim.esimStatus,
      totalBytes: esim.totalVolume,
      usedBytes: esim.orderUsage,
      expiresAt: esim.expiredTime ? new Date(esim.expiredTime) : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.orders.id, order.id))
    .returning();

  if (!updated.emailedAt && updated.activationCode) {
    const [claimed] = await db
      .update(schema.orders)
      .set({ emailedAt: new Date() })
      .where(and(eq(schema.orders.id, order.id), isNull(schema.orders.emailedAt)))
      .returning();
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, order.userId) });
    if (claimed && user) {
      const appUrl = process.env.APP_URL ?? "";
      // Compra directa con tarjeta: el correo lleva a la página de éxito (no requiere sesión) y explica cómo entrar.
      const checkout = await db.query.cardCheckouts.findFirst({ where: eq(schema.cardCheckouts.orderId, order.id), columns: { id: true, accessToken: true } });
      await sendEsimReady(user.email, {
        planName: updated.planName,
        activationCode: updated.activationCode,
        orderId: order.id,
        orderUrl: checkout ? `${appUrl}/compra/${checkout.id}?t=${checkout.accessToken}` : `${appUrl}/app/esims/${order.id}`,
        qrDataUrl: `${appUrl}/api/qr/${order.id}?sig=${signValue(order.id)}`,
        // Cuenta creada por la compra (aún sin reclamar): explica cómo crear la contraseña.
        accountUrl: checkout && !user.emailVerifiedAt ? `${appUrl}/recuperar?email=${encodeURIComponent(user.email)}` : undefined,
      });
    }
  }
  return updated;
}

export async function getUserOrder(userId: string, orderId: string) {
  return db.query.orders.findFirst({ where: and(eq(schema.orders.id, orderId), eq(schema.orders.userId, userId)) });
}

export async function getUserOrders(userId: string) {
  return db.query.orders.findMany({ where: eq(schema.orders.userId, userId), orderBy: desc(schema.orders.createdAt) });
}

export const appleInstallUrl = (ac: string) => `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${ac}`;
/** Instalación con un toque en Android (Android 10+ con soporte de Google). */
export const androidInstallUrl = (ac: string) => `https://esimsetup.android.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(ac)}`;

const DELAY = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Justo después de ordenar: unos cuantos intentos para tener el perfil sin esperar al webhook del proveedor. */
export async function pollOrder(order: Order, tries = 4, delayMs = 2500): Promise<Order> {
  let current = order;
  for (let i = 0; i < tries && current.status === "provisioning" && current.providerOrderNo; i++) {
    await DELAY(delayMs);
    current = await refreshOrder(current).catch(() => current);
  }
  return current;
}
