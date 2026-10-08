import "server-only";
import { and, asc, desc, eq, lte, or, lt, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { PhoneNumber } from "@/db/schema";
import { adjustBalance } from "./wallet";
import { formatMxn } from "./pricing";
import { sendPhoneNumberReady, sendPhoneNumberRenewalFailed, sendSmsReceived } from "./email";

/** Precio mensual del número NovaPhone (MXN). */
export const NUMBER_PRICE_MXN = () => Number(process.env.PHONE_NUMBER_PRICE_MXN ?? 79);
const PERIOD_DAYS = 30;
const GRACE_DAYS = 7;
/** Días antes de reasignar un número liberado (WhatsApp trata como reciclado tras 45 días). */
const COOLDOWN_DAYS = 90;
const DAY = 86_400_000;

export const normalizeE164 = (n: string) => {
  const digits = n.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
};

export async function getUserNumber(userId: string) {
  return db.query.phoneNumbers.findFirst({ where: and(eq(schema.phoneNumbers.userId, userId), eq(schema.phoneNumbers.status, "assigned")) });
}

export async function getMessages(numberId: string, userId: string, limit = 50) {
  return db.query.smsMessages.findMany({
    where: and(eq(schema.smsMessages.numberId, numberId), eq(schema.smsMessages.userId, userId)),
    orderBy: desc(schema.smsMessages.receivedAt),
    limit,
  });
}

export async function availableCount() {
  const [row] = await db
    .select({ n: dsql<number>`count(*)::int` })
    .from(schema.phoneNumbers)
    .where(
      or(
        eq(schema.phoneNumbers.status, "available"),
        and(eq(schema.phoneNumbers.status, "cooldown"), lt(schema.phoneNumbers.cooldownUntil, new Date())),
      ),
    );
  return row?.n ?? 0;
}

type AssignResult = { ok: true; number: PhoneNumber } | { ok: false; error: string; code: "funds" | "none" | "has" };

/** Asigna un número del inventario al usuario. `charge=false` para asignaciones manuales del admin. */
export async function assignNumber(user: { id: string; email: string }, opts: { charge?: boolean; orderId?: string | null; e164?: string } = {}): Promise<AssignResult> {
  if (await getUserNumber(user.id)) return { ok: false, error: "Ya tienes un número NovaPhone.", code: "has" };
  const priceCents = NUMBER_PRICE_MXN() * 100;

  // Toma un número libre con una actualización condicional: si otro cliente lo tomó primero, prueba el siguiente.
  const now = new Date();
  const candidates = await db
    .select({ id: schema.phoneNumbers.id })
    .from(schema.phoneNumbers)
    .where(
      and(
        opts.e164 ? eq(schema.phoneNumbers.e164, normalizeE164(opts.e164)) : undefined,
        or(eq(schema.phoneNumbers.status, "available"), and(eq(schema.phoneNumbers.status, "cooldown"), lt(schema.phoneNumbers.cooldownUntil, now))),
      ),
    )
    .orderBy(asc(schema.phoneNumbers.createdAt))
    .limit(5);
  let claimed: PhoneNumber | undefined;
  for (const c of candidates) {
    [claimed] = await db
      .update(schema.phoneNumbers)
      .set({
        status: "assigned",
        userId: user.id,
        orderId: opts.orderId ?? null,
        assignedAt: now,
        renewsAt: new Date(now.getTime() + PERIOD_DAYS * DAY),
        graceUntil: null,
        autoRenew: true,
        monthlyPriceCents: priceCents,
      })
      .where(
        and(
          eq(schema.phoneNumbers.id, c.id),
          or(eq(schema.phoneNumbers.status, "available"), and(eq(schema.phoneNumbers.status, "cooldown"), lt(schema.phoneNumbers.cooldownUntil, now))),
        ),
      )
      .returning();
    if (claimed) break;
  }
  if (!claimed) return { ok: false, error: "Por ahora no hay números disponibles. Te avisaremos en cuanto haya.", code: "none" };

  if (opts.charge !== false) {
    const balance = await adjustBalance({ userId: user.id, amountCents: -priceCents, kind: "purchase", description: `Número NovaPhone ${claimed.e164}`, refId: claimed.id });
    if (balance === null) {
      await db.update(schema.phoneNumbers).set({ status: "available", userId: null, assignedAt: null, renewsAt: null, orderId: null, monthlyPriceCents: null, autoRenew: true }).where(eq(schema.phoneNumbers.id, claimed.id));
      return { ok: false, error: `Saldo insuficiente. El número cuesta ${formatMxn(priceCents)} al mes.`, code: "funds" };
    }
  }
  await sendPhoneNumberReady(user.email, {
    number: claimed.e164,
    monthly: formatMxn(priceCents),
    renewsAt: claimed.renewsAt!,
    url: `${process.env.APP_URL ?? ""}/app/numero`,
  });
  return { ok: true, number: claimed };
}

export async function linkNumberToEsim(userId: string, orderId: string | null) {
  await db.update(schema.phoneNumbers).set({ orderId }).where(and(eq(schema.phoneNumbers.userId, userId), eq(schema.phoneNumbers.status, "assigned")));
}

export async function setAutoRenew(userId: string, autoRenew: boolean) {
  await db.update(schema.phoneNumbers).set({ autoRenew }).where(and(eq(schema.phoneNumbers.userId, userId), eq(schema.phoneNumbers.status, "assigned")));
}

/** Libera el número: entra en periodo de espera antes de poder reasignarse. */
export async function releaseNumber(numberId: string) {
  await db
    .update(schema.phoneNumbers)
    .set({ status: "cooldown", userId: null, orderId: null, renewsAt: null, graceUntil: null, cooldownUntil: new Date(Date.now() + COOLDOWN_DAYS * DAY) })
    .where(eq(schema.phoneNumbers.id, numberId));
}

/** Renueva números vencidos con el saldo; si no alcanza, periodo de gracia y luego se libera. */
export async function renewDueNumbers(onlyUserId?: string) {
  const now = new Date();
  const due = await db.query.phoneNumbers.findMany({
    where: and(eq(schema.phoneNumbers.status, "assigned"), lte(schema.phoneNumbers.renewsAt, now), onlyUserId ? eq(schema.phoneNumbers.userId, onlyUserId) : undefined),
  });
  let renewed = 0, failed = 0, released = 0;
  for (const n of due) {
    const user = n.userId ? await db.query.users.findFirst({ where: eq(schema.users.id, n.userId) }) : undefined;
    if (!user) continue;
    // El cliente apagó la renovación: se libera sin avisos de cobro.
    if (!n.autoRenew || (n.graceUntil && n.graceUntil < now)) {
      await releaseNumber(n.id);
      released++;
      continue;
    }
    const price = n.monthlyPriceCents ?? NUMBER_PRICE_MXN() * 100;
    const ok = await adjustBalance({ userId: user.id, amountCents: -price, kind: "purchase", description: `Renovación número ${n.e164}`, refId: n.id });
    if (ok !== null) {
      await db
        .update(schema.phoneNumbers)
        .set({ renewsAt: new Date(n.renewsAt!.getTime() + PERIOD_DAYS * DAY), graceUntil: null })
        .where(eq(schema.phoneNumbers.id, n.id));
      renewed++;
    } else if (!n.graceUntil) {
      const graceUntil = new Date(now.getTime() + GRACE_DAYS * DAY);
      await db.update(schema.phoneNumbers).set({ graceUntil }).where(eq(schema.phoneNumbers.id, n.id));
      await sendPhoneNumberRenewalFailed(user.email, { number: n.e164, amount: formatMxn(price), graceUntil, url: `${process.env.APP_URL ?? ""}/app/fondos` });
      failed++;
    }
  }
  return { due: due.length, renewed, failed, released };
}

/** Reintenta la renovación pendiente de un usuario (p. ej. justo después de que deposita). */
export async function retryRenewalFor(userId: string) {
  const n = await getUserNumber(userId);
  if (!n?.graceUntil) return;
  await renewDueNumbers(userId);
}

/** SMS entrante desde el proveedor. Idempotente por externalId. */
export async function storeInboundSms(input: { to: string; from: string; body: string; externalId?: string }) {
  const to = normalizeE164(input.to);
  const number = await db.query.phoneNumbers.findFirst({ where: eq(schema.phoneNumbers.e164, to) });
  if (!number) return { result: "unknown-number" as const };
  const [msg] = await db
    .insert(schema.smsMessages)
    .values({ numberId: number.id, userId: number.userId, fromNumber: input.from, toNumber: to, body: input.body.slice(0, 2000), externalId: input.externalId ?? null })
    .onConflictDoNothing()
    .returning();
  if (!msg) return { result: "duplicate" as const };
  if (number.userId && number.status === "assigned") {
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, number.userId) });
    if (user) await sendSmsReceived(user.email, { number: to, from: input.from, body: input.body, url: `${process.env.APP_URL ?? ""}/app/numero` });
  }
  return { result: "stored" as const, messageId: msg.id };
}

/** Admin: agrega números al inventario (uno por línea). */
export async function addInventory(lines: string, country = "GB", provider = "cloudnumbering") {
  const nums = [...new Set(lines.split(/[\s,;]+/).map((l) => l.trim()).filter((l) => /\d{8,}/.test(l)).map(normalizeE164))];
  if (!nums.length) return 0;
  const rows = await db.insert(schema.phoneNumbers).values(nums.map((e164) => ({ e164, country, provider }))).onConflictDoNothing().returning();
  return rows.length;
}

export async function listInventory() {
  return db.query.phoneNumbers.findMany({ orderBy: [asc(schema.phoneNumbers.status), desc(schema.phoneNumbers.createdAt)], limit: 200 });
}

export async function recentSms(limit = 30) {
  return db.query.smsMessages.findMany({ orderBy: desc(schema.smsMessages.receivedAt), limit });
}
