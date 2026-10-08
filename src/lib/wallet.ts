import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/** Ajusta saldo de forma atómica. Para débitos falla si no hay fondos. Regresa el nuevo saldo o null. */
export async function adjustBalance(params: {
  userId: string;
  amountCents: number;
  kind: "deposit" | "purchase" | "refund" | "adjustment";
  description: string;
  refId?: string;
}) {
  const { userId, amountCents } = params;
  const where =
    amountCents < 0
      ? and(eq(schema.users.id, userId), gte(schema.users.balanceCents, -amountCents))
      : eq(schema.users.id, userId);
  const [row] = await db
    .update(schema.users)
    .set({ balanceCents: sql`${schema.users.balanceCents} + ${amountCents}` })
    .where(where)
    .returning({ balance: schema.users.balanceCents });
  if (!row) return null;
  await db.insert(schema.ledger).values({
    userId,
    amountCents,
    kind: params.kind,
    description: params.description,
    refId: params.refId,
    balanceAfterCents: row.balance,
  });
  return row.balance;
}
