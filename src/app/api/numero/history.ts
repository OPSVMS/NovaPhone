import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCalls, getMessages } from "@/lib/numbers";
import type { CommsCall, CommsHistory, CommsMessage } from "@/components/app/sms-inbox";

/** Máximo de mensajes/llamadas que se envían al panel. */
export const HISTORY_MAX = 200;

export function parseLimit(v: string | null, fallback = HISTORY_MAX) {
  const n = Number.parseInt(v ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, HISTORY_MAX);
}

async function count(table: typeof schema.smsMessages | typeof schema.callLogs, numberId: string, userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(table)
    .where(and(eq(table.numberId, numberId), eq(table.userId, userId)));
  return row?.n ?? 0;
}

/** SMS + llamadas del número del usuario, serializados para el cliente. */
export async function getCommsHistory(numberId: string, userId: string, limit = HISTORY_MAX): Promise<CommsHistory> {
  const [messages, calls, messageCount, callCount] = await Promise.all([
    getMessages(numberId, userId, limit),
    getCalls(numberId, userId, limit),
    count(schema.smsMessages, numberId, userId),
    count(schema.callLogs, numberId, userId),
  ]);
  return {
    messages: messages.map(
      (m): CommsMessage => ({ id: m.id, from: m.fromNumber, body: m.body, receivedAt: m.receivedAt.toISOString() }),
    ),
    calls: calls.map(
      (c): CommsCall => ({
        id: c.id,
        from: c.fromNumber,
        status: c.status,
        durationSec: c.durationSec,
        transcript: c.transcript,
        startedAt: c.startedAt.toISOString(),
      }),
    ),
    counts: { messages: messageCount, calls: callCount },
  };
}
