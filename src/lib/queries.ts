import "server-only";
import { and, count, desc, eq, inArray, ne, sum } from "drizzle-orm";
import { db, schema } from "@/db";

/* ---------------------------------- Usuario --------------------------------- */

export async function getLedger(userId: string, limit = 100) {
  return db.query.ledger.findMany({
    where: eq(schema.ledger.userId, userId),
    orderBy: desc(schema.ledger.createdAt),
    limit,
  });
}

export async function getUserDeposit(userId: string, depositId: string) {
  // Evita errores de Postgres con ids que no son UUID (→ 404 limpio).
  if (!UUID_RE.test(depositId)) return undefined;
  return db.query.deposits.findFirst({
    where: and(eq(schema.deposits.id, depositId), eq(schema.deposits.userId, userId)),
  });
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ----------------------------------- Admin ---------------------------------- */

const SOLD: ("provisioning" | "ready")[] = ["provisioning", "ready"];

export async function getFxUsdMxn() {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, "fx_usd_mxn") });
  const v = Number(row?.value);
  return Number.isFinite(v) && v > 0 ? v : Number(process.env.FX_USD_MXN_FALLBACK ?? 18);
}

export async function getAdminStats() {
  const [[users], [sold], fx, [pending]] = await Promise.all([
    db.select({ n: count() }).from(schema.users),
    db
      .select({ n: count(), revenueCents: sum(schema.orders.priceCents), costUsd: sum(schema.orders.costUsd) })
      .from(schema.orders)
      .where(inArray(schema.orders.status, SOLD)),
    getFxUsdMxn(),
    db
      .select({ n: count(), cents: sum(schema.deposits.amountCents) })
      .from(schema.deposits)
      .where(and(eq(schema.deposits.status, "pending"), ne(schema.deposits.method, "card"))),
  ]);
  const revenueCents = Number(sold.revenueCents ?? 0);
  const costCents = Math.round(Number(sold.costUsd ?? 0) * fx * 100);
  return {
    users: users.n,
    esimsSold: sold.n,
    revenueCents,
    costCents,
    marginCents: revenueCents - costCents,
    marginPct: revenueCents > 0 ? (revenueCents - costCents) / revenueCents : 0,
    fx,
    pendingDeposits: pending.n,
    pendingDepositsCents: Number(pending.cents ?? 0),
  };
}

export async function getPendingDeposits(limit = 50) {
  return db
    .select({
      id: schema.deposits.id,
      method: schema.deposits.method,
      amountCents: schema.deposits.amountCents,
      expectedUsdt: schema.deposits.expectedUsdt,
      reference: schema.deposits.reference,
      createdAt: schema.deposits.createdAt,
      userName: schema.users.name,
      userEmail: schema.users.email,
    })
    .from(schema.deposits)
    .innerJoin(schema.users, eq(schema.users.id, schema.deposits.userId))
    .where(and(eq(schema.deposits.status, "pending"), ne(schema.deposits.method, "card")))
    .orderBy(desc(schema.deposits.createdAt))
    .limit(limit);
}

export async function getRecentOrders(limit = 10) {
  return db
    .select({
      id: schema.orders.id,
      planName: schema.orders.planName,
      priceCents: schema.orders.priceCents,
      costUsd: schema.orders.costUsd,
      status: schema.orders.status,
      createdAt: schema.orders.createdAt,
      userEmail: schema.users.email,
    })
    .from(schema.orders)
    .innerJoin(schema.users, eq(schema.users.id, schema.orders.userId))
    .orderBy(desc(schema.orders.createdAt))
    .limit(limit);
}

export async function getRecentUsers(limit = 10) {
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      balanceCents: schema.users.balanceCents,
      verified: schema.users.emailVerifiedAt,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt))
    .limit(limit);
}
