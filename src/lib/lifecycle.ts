import "server-only";
import { and, eq, or, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Order } from "@/db/schema";
import { cancelEsim, queryEsim, suspendEsim, unsuspendEsim } from "./esimaccess";
import { adjustBalance } from "./wallet";
import { refreshOrder } from "./orders";
import { afterUsageChange, syncUsage } from "./topups";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Una eSIM se puede cancelar (con reembolso) solo si nunca se instaló. */
export const canCancel = (o: Order) => o.status === "ready" && (o.esimStatus ?? "GOT_RESOURCE") === "GOT_RESOURCE" && (o.smdpStatus ?? "RELEASED") === "RELEASED";

export async function cancelUnused(order: Order): Promise<ActionResult> {
  if (!order.esimTranNo || order.status !== "ready") return { ok: false, error: "Esta eSIM no se puede cancelar." };
  const live = await queryEsim(order.esimTranNo);
  if (!live || live.esimStatus !== "GOT_RESOURCE" || live.smdpStatus !== "RELEASED") {
    return { ok: false, error: "Esta eSIM ya se instaló en un teléfono, por lo que no se puede cancelar." };
  }
  await cancelEsim(order.esimTranNo);
  const [cancelled] = await db
    .update(schema.orders)
    .set({ status: "cancelled", esimStatus: "CANCEL", autoTopupPlanId: null, updatedAt: new Date() })
    .where(and(eq(schema.orders.id, order.id), eq(schema.orders.status, "ready")))
    .returning();
  if (!cancelled) return { ok: false, error: "Esta eSIM ya fue cancelada." };
  const topups = await db.query.topups.findMany({ where: and(eq(schema.topups.orderId, order.id), eq(schema.topups.status, "applied")) });
  const refund = order.priceCents + topups.reduce((acc, t) => acc + t.priceCents, 0);
  await adjustBalance({ userId: order.userId, amountCents: refund, kind: "refund", description: `Cancelación ${order.planName}`, refId: order.id });
  return { ok: true };
}

export async function setSuspended(order: Order, suspend: boolean): Promise<ActionResult> {
  if (!order.esimTranNo || order.status !== "ready") return { ok: false, error: "Esta eSIM no está activa." };
  if (suspend) await suspendEsim(order.esimTranNo);
  else await unsuspendEsim(order.esimTranNo);
  await db.update(schema.orders).set({ suspended: suspend, updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
  return { ok: true };
}

type Notify = {
  notifyType?: string;
  notifyId?: string;
  content?: {
    orderNo?: string;
    esimTranNo?: string;
    iccid?: string;
    esimStatus?: string;
    smdpStatus?: string;
    totalVolume?: number;
    orderUsage?: number;
    expiredTime?: string;
  };
};

/** Procesa un webhook de eSIM Access. Idempotente por notifyId. */
export async function handleProviderEvent(event: Notify) {
  const type = event.notifyType ?? "UNKNOWN";
  if (type === "CHECK_HEALTH") return "health";
  if (event.notifyId) {
    const [fresh] = await db.insert(schema.webhookEvents).values({ id: event.notifyId, type, payload: event }).onConflictDoNothing().returning();
    if (!fresh) return "duplicate";
  }
  const c = event.content ?? {};
  const match = [
    c.esimTranNo ? eq(schema.orders.esimTranNo, c.esimTranNo) : undefined,
    c.iccid ? eq(schema.orders.iccid, c.iccid) : undefined,
    c.orderNo ? eq(schema.orders.providerOrderNo, c.orderNo) : undefined,
  ].filter((x) => x !== undefined);
  if (!match.length) return "ignored";
  const order = await db.query.orders.findFirst({ where: or(...match) });
  if (!order) return "unknown-order";

  if (order.status === "provisioning") {
    await refreshOrder(order);
    return "provisioned";
  }
  if (order.status !== "ready") return "ignored";

  switch (type) {
    case "SMDP_EVENT":
    case "ESIM_STATUS": {
      const [updated] = await db
        .update(schema.orders)
        .set({
          ...(c.smdpStatus ? { smdpStatus: c.smdpStatus } : {}),
          ...(c.esimStatus ? { esimStatus: c.esimStatus } : {}),
          ...(typeof c.orderUsage === "number" ? { usedBytes: c.orderUsage } : {}),
          ...(typeof c.totalVolume === "number" ? { totalBytes: c.totalVolume } : {}),
          ...(c.smdpStatus === "ENABLED" && !order.activatedAt ? { activatedAt: dsql`coalesce(${schema.orders.activatedAt}, now())` } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, order.id))
        .returning();
      if (type === "ESIM_STATUS" && (c.esimStatus === "USED_UP" || c.esimStatus === "IN_USE")) await syncUsage(updated);
      return "status";
    }
    case "DATA_USAGE":
    case "VALIDITY_USAGE":
    default:
      await syncUsage(order).catch(() => afterUsageChange(order));
      return "usage";
  }
}
