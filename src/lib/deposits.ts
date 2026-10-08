import "server-only";
import { and, eq, desc } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { db, schema } from "@/db";
import { adjustBalance } from "./wallet";
import { sendDepositCredited } from "./email";
import { formatMxn } from "./pricing";

export const MIN_DEPOSIT_MXN = 100;
export const MAX_DEPOSIT_MXN = 50_000;

export function paymentInstructions() {
  return {
    spei: { clabe: process.env.SPEI_CLABE ?? "", bank: process.env.SPEI_BANK ?? "", beneficiary: process.env.SPEI_BENEFICIARY ?? "NovaPhone" },
    usdt: { network: process.env.USDT_NETWORK ?? "TRON (TRC20)", address: process.env.USDT_ADDRESS ?? "" },
  };
}

export async function createDeposit(userId: string, method: "spei" | "usdt", amountMxn: number, fx: number) {
  const reference = String(randomInt(10_000_000, 99_999_999));
  // Para USDT generamos un monto con centavos únicos para identificar la transferencia.
  const expectedUsdt = method === "usdt" ? (Math.ceil((amountMxn / fx) * 100) / 100 + randomInt(1, 99) / 10_000).toFixed(4) : null;
  const [dep] = await db
    .insert(schema.deposits)
    .values({ userId, method, amountCents: Math.round(amountMxn * 100), reference, expectedUsdt, meta: { fx } })
    .returning();
  return dep;
}

/** Acredita un depósito pendiente (idempotente). */
export async function completeDeposit(depositId: string, opts: { externalId?: string; amountCents?: number; meta?: Record<string, unknown> } = {}) {
  const [dep] = await db
    .update(schema.deposits)
    .set({
      status: "completed",
      completedAt: new Date(),
      externalId: opts.externalId,
      ...(opts.amountCents ? { amountCents: opts.amountCents } : {}),
      ...(opts.meta ? { meta: opts.meta } : {}),
    })
    .where(and(eq(schema.deposits.id, depositId), eq(schema.deposits.status, "pending")))
    .returning();
  if (!dep) return null;
  await adjustBalance({
    userId: dep.userId,
    amountCents: dep.amountCents,
    kind: "deposit",
    description: dep.method === "spei" ? "Depósito SPEI" : dep.method === "usdt" ? "Depósito USDT" : "Depósito",
    refId: dep.id,
  });
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, dep.userId) });
  if (user) await sendDepositCredited(user.email, formatMxn(dep.amountCents));
  return dep;
}

export async function getUserDeposits(userId: string) {
  return db.query.deposits.findMany({ where: eq(schema.deposits.userId, userId), orderBy: desc(schema.deposits.createdAt), limit: 50 });
}

/** Depósito SPEI recibido en la CLABE personal de un usuario. Idempotente por externalId (índice único). */
export async function creditClabeDeposit(clabe: string, amountCents: number, externalId: string, meta: Record<string, unknown>) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.clabe, clabe) });
  if (!user) return null;
  const [dep] = await db
    .insert(schema.deposits)
    .values({ userId: user.id, method: "spei", amountCents, reference: `C${Date.now()}${randomInt(100, 999)}`, externalId, meta })
    .onConflictDoNothing()
    .returning();
  if (!dep) return db.query.deposits.findFirst({ where: eq(schema.deposits.externalId, externalId) });
  return completeDeposit(dep.id, { externalId });
}
