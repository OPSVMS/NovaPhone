import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { completeDeposit } from "@/lib/deposits";

/**
 * Webhook de pagos entrantes (core bancario SPEI y detector USDT).
 * Header `x-novaphone-signature`: HMAC-SHA256 hex del body crudo con DEPOSITS_WEBHOOK_SECRET.
 * Body:
 *   SPEI: { "method": "spei", "reference": "12345678", "amountMxn": 500, "externalId": "<clave de rastreo>" }
 *   USDT: { "method": "usdt", "amountUsdt": "27.4123", "externalId": "<tx hash>" }
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-novaphone-signature") ?? "";
  const expected = createHmac("sha256", process.env.DEPOSITS_WEBHOOK_SECRET!).update(raw).digest("hex");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }
  const body = JSON.parse(raw) as { method: "spei" | "usdt"; reference?: string; amountMxn?: number; amountUsdt?: string; externalId: string };
  if (!body.externalId) return NextResponse.json({ ok: false, error: "externalId required" }, { status: 400 });

  const dup = await db.query.deposits.findFirst({ where: eq(schema.deposits.externalId, body.externalId) });
  if (dup) return NextResponse.json({ ok: true, depositId: dup.id, duplicate: true });

  const dep =
    body.method === "spei" && body.reference
      ? await db.query.deposits.findFirst({ where: and(eq(schema.deposits.reference, body.reference), eq(schema.deposits.status, "pending")) })
      : body.method === "usdt" && body.amountUsdt
        ? await db.query.deposits.findFirst({ where: and(eq(schema.deposits.expectedUsdt, Number(body.amountUsdt).toFixed(4)), eq(schema.deposits.status, "pending")) })
        : undefined;
  if (!dep) return NextResponse.json({ ok: false, error: "deposit not found" }, { status: 404 });

  // SPEI: se acredita lo realmente recibido.
  const amountCents = body.method === "spei" && body.amountMxn ? Math.round(body.amountMxn * 100) : undefined;
  const done = await completeDeposit(dep.id, { externalId: body.externalId, amountCents, meta: { webhook: body } });
  return NextResponse.json({ ok: true, depositId: dep.id, credited: !!done });
}
