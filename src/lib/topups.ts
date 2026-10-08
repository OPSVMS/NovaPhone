import "server-only";
import { and, eq, desc, isNotNull, inArray, lt, or, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Order } from "@/db/schema";
import { listTopupPackages, queryEsim, topupEsim, toUsd } from "./esimaccess";
import { adjustBalance } from "./wallet";
import { getActivePlans } from "./catalog";
import { sendAutoTopupDone, sendAutoTopupNoFunds, sendLowData, sendExpiringSoon, sendTopupApplied } from "./email";
import { formatMxn } from "./pricing";

const GB = 1024 ** 3;
/** Umbrales de auto-recarga. */
const AUTO_MIN_BYTES = 0.5 * GB;
const AUTO_MIN_RATIO = 0.1;
const AUTO_DAYS_LEFT = 2;
const AUTO_COOLDOWN_MS = 6 * 3600_000;
const NOTIFY_COOLDOWN_MS = 24 * 3600_000;

export type TopupOption = { planId: string; name: string; dataGb: number; days: number; priceMxn: number; packageCode: string; costUsd: number };

/** Recargas disponibles para una eSIM, con nuestro precio público. */
export async function getTopupOptions(order: Order): Promise<TopupOption[]> {
  if (!order.esimTranNo || order.status !== "ready") return [];
  if (order.expiresAt && order.expiresAt < new Date()) return [];
  const [pkgs, plans] = await Promise.all([listTopupPackages(order.esimTranNo), getActivePlans()]);
  const bySlug = new Map(plans.map((p) => [p.id, p]));
  return pkgs
    .filter((p) => p.dataType === 1 && bySlug.has(p.slug))
    .map((p) => {
      const plan = bySlug.get(p.slug)!;
      return { planId: plan.id, name: plan.name, dataGb: plan.dataGb, days: plan.days, priceMxn: plan.priceMxn, packageCode: p.packageCode, costUsd: toUsd(p.price) };
    })
    .sort((a, b) => a.priceMxn - b.priceMxn);
}

export type TopupResult = { ok: true } | { ok: false; error: string; code?: "funds" | "unavailable" | "provider" };

/** Cobra del saldo y aplica la recarga en el proveedor. Reembolsa si el proveedor falla. */
export async function applyTopup(order: Order, planId: string, opts: { auto?: boolean } = {}): Promise<TopupResult> {
  const option = (await getTopupOptions(order)).find((o) => o.planId === planId);
  if (!option) return { ok: false, error: "Esa recarga no está disponible para esta eSIM.", code: "unavailable" };
  const priceCents = option.priceMxn * 100;

  const [topup] = await db
    .insert(schema.topups)
    .values({ orderId: order.id, userId: order.userId, planId, planName: option.name, priceCents, costUsd: option.costUsd, auto: !!opts.auto })
    .returning();

  const balance = await adjustBalance({
    userId: order.userId,
    amountCents: -priceCents,
    kind: "purchase",
    description: `${opts.auto ? "Auto-recarga" : "Recarga"} ${option.name}`,
    refId: topup.id,
  });
  if (balance === null) {
    await db.delete(schema.topups).where(eq(schema.topups.id, topup.id));
    return { ok: false, error: "Saldo insuficiente para la recarga.", code: "funds" };
  }

  try {
    const res = await topupEsim(order.esimTranNo!, option.packageCode, topup.id);
    await db.update(schema.topups).set({ status: "applied" }).where(eq(schema.topups.id, topup.id));
    await db
      .update(schema.orders)
      .set({
        totalBytes: res.totalVolume,
        usedBytes: res.orderUsage,
        expiresAt: res.expiredTime ? new Date(res.expiredTime) : order.expiresAt,
        lowBalanceNotifiedAt: null,
        lowDataNotifiedAt: null,
        expiryNotifiedAt: null,
        ...(opts.auto ? { autoTopupLastAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, order.id));
    if (!opts.auto) {
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, order.userId) });
      if (user) {
        await sendTopupApplied(user.email, {
          planName: order.planName,
          topupName: option.name,
          amount: formatMxn(priceCents),
          orderId: order.id,
        });
      }
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error del proveedor";
    const [refunded] = await db
      .update(schema.topups)
      .set({ status: "refunded", error: msg })
      .where(and(eq(schema.topups.id, topup.id), eq(schema.topups.status, "pending")))
      .returning();
    if (refunded) {
      await adjustBalance({ userId: order.userId, amountCents: priceCents, kind: "refund", description: `Reembolso recarga ${option.name}`, refId: topup.id });
    }
    return { ok: false, error: "No pudimos aplicar la recarga. Te devolvimos el saldo.", code: "provider" };
  }
}

/** Trae consumo y vigencia del proveedor y evalúa la auto-recarga. */
export async function syncUsage(order: Order): Promise<Order> {
  if (!order.esimTranNo || order.status !== "ready") return order;
  const esim = await queryEsim(order.esimTranNo);
  if (!esim) return order;
  const [updated] = await db
    .update(schema.orders)
    .set({
      usedBytes: esim.orderUsage,
      totalBytes: esim.totalVolume,
      esimStatus: esim.esimStatus,
      smdpStatus: esim.smdpStatus,
      expiresAt: esim.expiredTime ? new Date(esim.expiredTime) : order.expiresAt,
      activatedAt: esim.activateTime ? new Date(esim.activateTime) : order.activatedAt,
      usageSyncedAt: new Date(),
    })
    .where(eq(schema.orders.id, order.id))
    .returning();
  await afterUsageChange(updated);
  return updated;
}

/** Tras cualquier cambio de consumo/vigencia: auto-recarga o aviso al cliente. */
export async function afterUsageChange(order: Order) {
  const topped = await maybeAutoTopup(order);
  if (!topped) await maybeNotify(order);
}

async function maybeNotify(order: Order) {
  if (order.status !== "ready" || order.autoTopupPlanId) return;
  const total = order.totalBytes ?? 0;
  const left = total - (order.usedBytes ?? 0);
  const lowData = total > 0 && (left < AUTO_MIN_BYTES || left / total < AUTO_MIN_RATIO);
  const expiring = !!order.activatedAt && !!order.expiresAt && order.expiresAt.getTime() - Date.now() < AUTO_DAYS_LEFT * 86_400_000 && order.expiresAt > new Date();
  if (!lowData && !expiring) return;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, order.userId) });
  if (!user) return;
  if (lowData && !order.lowDataNotifiedAt) {
    const [claimed] = await db.update(schema.orders).set({ lowDataNotifiedAt: new Date() }).where(and(eq(schema.orders.id, order.id), isNull(schema.orders.lowDataNotifiedAt))).returning();
    if (claimed) await sendLowData(user.email, order.planName, Math.max(0, left), order.id);
  } else if (expiring && !order.expiryNotifiedAt) {
    const [claimed] = await db.update(schema.orders).set({ expiryNotifiedAt: new Date() }).where(and(eq(schema.orders.id, order.id), isNull(schema.orders.expiryNotifiedAt))).returning();
    if (claimed) await sendExpiringSoon(user.email, order.planName, order.expiresAt!, order.id);
  }
}

export function needsTopup(o: Pick<Order, "usedBytes" | "totalBytes" | "expiresAt" | "activatedAt">) {
  const total = o.totalBytes ?? 0;
  const left = total - (o.usedBytes ?? 0);
  const lowData = total > 0 && (left < AUTO_MIN_BYTES || left / total < AUTO_MIN_RATIO);
  const lowDays = !!o.activatedAt && !!o.expiresAt && o.expiresAt.getTime() - Date.now() < AUTO_DAYS_LEFT * 86_400_000;
  return lowData || lowDays;
}

/** Regresa true si aplicó (o ya está aplicando) una auto-recarga. */
async function maybeAutoTopup(order: Order): Promise<boolean> {
  if (!order.autoTopupPlanId || !needsTopup(order)) return false;
  if (order.suspended || (order.expiresAt && order.expiresAt < new Date())) return false;
  if (order.autoTopupLastAt && Date.now() - order.autoTopupLastAt.getTime() < AUTO_COOLDOWN_MS) return true;

  // Reclama el turno para evitar dobles recargas en ejecuciones simultáneas.
  const [claimed] = await db
    .update(schema.orders)
    .set({ autoTopupLastAt: new Date() })
    .where(
      and(
        eq(schema.orders.id, order.id),
        or(isNull(schema.orders.autoTopupLastAt), lt(schema.orders.autoTopupLastAt, new Date(Date.now() - AUTO_COOLDOWN_MS))),
      ),
    )
    .returning();
  if (!claimed) return true;

  const user = await db.query.users.findFirst({ where: eq(schema.users.id, order.userId) });
  const result = await applyTopup(claimed, order.autoTopupPlanId, { auto: true });
  if (result.ok) {
    if (user) await sendAutoTopupDone(user.email, order.planName, order.id);
    return true;
  }
  // Libera el turno para reintentar en la siguiente revisión.
  await db.update(schema.orders).set({ autoTopupLastAt: order.autoTopupLastAt }).where(eq(schema.orders.id, order.id));
  if (result.code === "funds" && user && (!order.lowBalanceNotifiedAt || Date.now() - order.lowBalanceNotifiedAt.getTime() > NOTIFY_COOLDOWN_MS)) {
    const plan = (await getActivePlans()).find((p) => p.id === order.autoTopupPlanId);
    await sendAutoTopupNoFunds(user.email, order.planName, plan ? formatMxn(plan.priceMxn * 100) : "", order.id);
    await db.update(schema.orders).set({ lowBalanceNotifiedAt: new Date() }).where(eq(schema.orders.id, order.id));
  }
  return true;
}

export async function setAutoTopup(userId: string, orderId: string, planId: string | null) {
  await db
    .update(schema.orders)
    .set({ autoTopupPlanId: planId, lowBalanceNotifiedAt: null })
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.userId, userId)));
}

export async function getOrderTopups(orderId: string) {
  return db.query.topups.findMany({ where: eq(schema.topups.orderId, orderId), orderBy: desc(schema.topups.createdAt) });
}

/** eSIMs vigentes a revisar por el cron. */
export async function getActiveEsims() {
  return db.query.orders.findMany({
    where: and(eq(schema.orders.status, "ready"), isNotNull(schema.orders.esimTranNo), inArray(schema.orders.esimStatus, ["GOT_RESOURCE", "IN_USE"])),
  });
}
