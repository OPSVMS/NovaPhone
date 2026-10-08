import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { adjustBalance } from "./wallet";
import { completeDeposit } from "./deposits";
import { sendDepositCredited, sendPersonalClabeReady } from "./email";
import { formatMxn } from "./pricing";

/** Integración NOVACORE: CLABE por usuario y avisos de depósito SPEI. */
const BASE = () => process.env.NOVACORE_BASE_URL ?? "https://novacorp.mx";
export const novacoreEnabled = () => !!(process.env.NOVACORE_API_KEY && process.env.NOVACORE_SIGNING_SECRET);

async function signedFetch<T>(method: "GET" | "POST", path: string, payload?: unknown): Promise<{ status: number; json: T }> {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();
  const sig = "sha256=" + createHmac("sha256", process.env.NOVACORE_SIGNING_SECRET!).update(`${ts}.${nonce}.${body}`).digest("hex");
  const res = await fetch(`${BASE()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.NOVACORE_API_KEY!,
      "X-Signature-Timestamp": ts,
      "X-Signature-Nonce": nonce,
      "X-Signature": sig,
    },
    body: method === "POST" ? body : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as T };
}

/** Asigna (o recupera) la CLABE personal del usuario. Idempotente. */
export async function ensureClabe(user: { id: string; name: string; email: string; clabe?: string | null }, opts: { notify?: boolean } = {}) {
  if (user.clabe) return user.clabe;
  if (!novacoreEnabled()) return null;
  const { status, json } = await signedFetch<{ clabe?: string; beneficiaryName?: string; isNew?: boolean }>("POST", "/api/integrations/clabes", {
    externalUserId: user.id,
    label: user.name.slice(0, 60),
  });
  if ((status !== 200 && status !== 201) || !json.clabe) {
    console.error("NOVACORE clabe error", status, json);
    return null;
  }
  const [updated] = await db
    .update(schema.users)
    .set({ clabe: json.clabe })
    .where(and(eq(schema.users.id, user.id), isNull(schema.users.clabe)))
    .returning();
  if (updated && opts.notify !== false) {
    await sendPersonalClabeReady(user.email, {
      clabe: json.clabe,
      beneficiary: json.beneficiaryName ?? process.env.SPEI_BENEFICIARY ?? "NovaPhone",
      url: `${process.env.APP_URL ?? ""}/app/fondos`,
    });
  }
  return json.clabe;
}

export type NovacoreDeposit = {
  type?: string;
  trackingKey: string;
  amount: number;
  beneficiaryAccount: string;
  externalUserId?: string;
  userEmail?: string;
  payerAccount?: string;
  payerName?: string;
  concept?: string;
  receivedAt?: string;
  status?: "completed" | "returned";
};

/** Verifica la firma del aviso: HMAC-SHA256(CALLBACK_SECRET, "{ts}.{nonce}.{rawBody}") en hex. */
export function verifyNovacoreSignature(raw: string, ts: string | null, nonce: string | null, sig: string | null) {
  const secret = process.env.NOVACORE_CALLBACK_SECRET;
  if (!secret || !ts || !nonce || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${ts}.${nonce}.${raw}`).digest("hex");
  return expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

/** Registra el nonce; false si ya se había usado (repetición). */
export async function claimNonce(nonce: string) {
  const [row] = await db.insert(schema.webhookEvents).values({ id: `novacore:${nonce}`, type: "novacore.nonce" }).onConflictDoNothing().returning();
  return !!row;
}

async function findUser(d: NovacoreDeposit) {
  if (d.beneficiaryAccount) {
    const u = await db.query.users.findFirst({ where: eq(schema.users.clabe, d.beneficiaryAccount) });
    if (u) return u;
  }
  const ext = d.externalUserId ?? d.userEmail;
  if (!ext) return null;
  return (
    (/^[0-9a-f-]{36}$/i.test(ext) ? await db.query.users.findFirst({ where: eq(schema.users.id, ext) }) : undefined) ??
    (await db.query.users.findFirst({ where: eq(schema.users.email, ext.toLowerCase()) })) ??
    null
  );
}

/** Acredita un depósito SPEI de forma idempotente por trackingKey. */
export async function creditNovacoreDeposit(d: NovacoreDeposit, source: "webhook" | "reconcile") {
  const existing = await db.query.deposits.findFirst({ where: eq(schema.deposits.externalId, d.trackingKey) });
  if (existing) return { result: "duplicate" as const, depositId: existing.id };
  const user = await findUser(d);
  if (!user) return { result: "unknown-user" as const };
  const amountCents = Math.round(Number(d.amount) * 100);
  if (!(amountCents > 0)) return { result: "invalid-amount" as const };
  const [dep] = await db
    .insert(schema.deposits)
    .values({
      userId: user.id,
      method: "spei",
      amountCents,
      reference: `NC${d.trackingKey.slice(-10)}`,
      externalId: d.trackingKey,
      meta: { source, payerName: d.payerName, payerAccount: d.payerAccount, concept: d.concept, receivedAt: d.receivedAt, clabe: d.beneficiaryAccount },
    })
    .onConflictDoNothing()
    .returning();
  if (!dep) return { result: "duplicate" as const };
  await completeDeposit(dep.id, { externalId: d.trackingKey });
  return { result: "credited" as const, depositId: dep.id };
}

/** Un depósito acreditado fue devuelto por el banco emisor: se revierte el saldo. */
async function reverseReturned(trackingKey: string) {
  const dep = await db.query.deposits.findFirst({ where: eq(schema.deposits.externalId, trackingKey) });
  if (!dep || dep.status !== "completed") return false;
  const [marked] = await db
    .update(schema.deposits)
    .set({ status: "returned" })
    .where(and(eq(schema.deposits.id, dep.id), eq(schema.deposits.status, "completed")))
    .returning();
  if (!marked) return false;
  await adjustBalance({
    userId: dep.userId,
    amountCents: -dep.amountCents,
    kind: "adjustment",
    description: "SPEI devuelto por el banco emisor",
    refId: dep.id,
    allowNegative: true,
  });
  return true;
}

/** Conciliación: cubre avisos perdidos y detecta devoluciones. */
export async function reconcileNovacore(sinceMinutes = 60 * 24) {
  if (!novacoreEnabled()) return { enabled: false };
  const since = new Date(Date.now() - Math.min(sinceMinutes, 7 * 24 * 60) * 60_000).toISOString();
  let cursor: string | undefined;
  let credited = 0;
  let returned = 0;
  let seen = 0;
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ since, status: "all", ...(cursor ? { cursor } : {}) });
    const { status, json } = await signedFetch<{ data?: NovacoreDeposit[]; deposits?: NovacoreDeposit[]; nextCursor?: string | null }>(
      "GET",
      `/api/integrations/spei-deposits?${qs}`,
    );
    if (status !== 200) throw new Error(`NOVACORE reconcile ${status}`);
    const rows = json.data ?? json.deposits ?? [];
    for (const d of rows) {
      seen++;
      if (d.status === "returned") {
        if (await reverseReturned(d.trackingKey)) returned++;
      } else if ((await creditNovacoreDeposit(d, "reconcile")).result === "credited") credited++;
    }
    if (!json.nextCursor) break;
    cursor = json.nextCursor;
  }
  return { enabled: true, seen, credited, returned };
}

export { formatMxn, sendDepositCredited };
