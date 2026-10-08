import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** Cliente de cloudnumbering API v1.1 (OAuth2 client credentials). */
const BASE = () => process.env.CLOUDNUMBERING_BASE_URL ?? "https://api.cloudnumbering.com/v1.1";
export const cloudnumberingEnabled = () => !!(process.env.CLOUDNUMBERING_CLIENT_ID && process.env.CLOUDNUMBERING_CLIENT_SECRET);

/** IPs desde las que cloudnumbering envía SMS entrantes. */
export const CLOUDNUMBERING_SMS_IPS = ["13.41.154.11", "18.135.51.94", "18.171.64.227"];

let cached: { token: string; expiresAt: number } | null = null;

async function token() {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const qs = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.CLOUDNUMBERING_CLIENT_ID!,
    client_secret: process.env.CLOUDNUMBERING_CLIENT_SECRET!,
  });
  const res = await fetch(`${BASE()}/oauth/token?${qs}`, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(15_000) });
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!res.ok || !json.access_token) throw new Error(`cloudnumbering auth ${res.status}`);
  cached = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

type Envelope<T> = { success: boolean; result: T; error?: string; code?: string };

/** Algunos errores regresan HTTP 200 con success:false, así que siempre se revisa `success`. */
async function cn<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as Envelope<T>;
  if (!res.ok || json.success === false) throw new Error(`cloudnumbering ${method} ${path}: ${res.status} ${json.error ?? json.code ?? ""}`);
  return json.result;
}

export async function getCloudnumberingBalance() {
  const r = await cn<{ balance: number; currency: string }>("GET", "/organisation");
  return { balance: Number(r.balance), currency: r.currency };
}

type CatalogueEntry = { sid: string; countryIso: string; numberType: string; terms: string; cost: number; connectionCharge: number; currency: string };
type NumberGroup = { sid: string; countryIso: string; numberType: string };
type AssignedNumber = { sid: string; number: string; countryIso: string; smsEndpointSid: string; nextBillingDate?: string; numberRental?: number };

const webhookUri = () => `${process.env.APP_URL}/api/webhooks/sms/cloudnumbering?token=${process.env.SMS_WEBHOOK_TOKEN}`;

/** Endpoint SMS (HTTPS) hacia NovaPhone. Lo crea si no existe y guarda su SID. */
export async function ensureSmsEndpoint() {
  const saved = await db.query.settings.findFirst({ where: eq(schema.settings.key, "cloudnumbering_sms_endpoint") });
  const uri = webhookUri();
  const list = await cn<{ entries: { sid: string; uri: string; endpointType: string }[] }>("GET", "/endpoints");
  const existing = list.entries.find((e) => e.uri === uri) ?? list.entries.find((e) => e.sid === (saved?.value as string));
  let sid = existing?.sid;
  if (!sid) {
    sid = (await cn<{ sid: string }>("POST", "/endpoints", { description: "NovaPhone inbound SMS", endpointType: "sms", uri, isDefault: true })).sid;
  }
  await db
    .insert(schema.settings)
    .values({ key: "cloudnumbering_sms_endpoint", value: sid })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: sid, updatedAt: new Date() } });
  return sid;
}

/** Elige el plan mensual del país (el más barato por mes) y su grupo de números. */
async function pickProduct(country: string) {
  const [catalogue, groups] = await Promise.all([
    cn<{ entries: CatalogueEntry[] }>("GET", "/catalogue"),
    cn<{ entries: NumberGroup[] }>("GET", "/number-groups"),
  ]);
  const group = groups.entries.find((g) => g.countryIso === country);
  const entries = catalogue.entries.filter((e) => e.countryIso === country && (!group || e.numberType === group.numberType));
  const entry = entries.find((e) => e.terms === "MONTHLY") ?? entries[0];
  if (!group || !entry) throw new Error(`cloudnumbering: sin producto para ${country}`);
  return { group, entry };
}

/** Compra números al azar y los agrega al inventario con el endpoint SMS asignado. */
export async function purchaseNumbers(amount = 1, country = process.env.CLOUDNUMBERING_COUNTRY ?? "GB") {
  const [{ group, entry }, endpointSid] = await Promise.all([pickProduct(country), ensureSmsEndpoint()]);
  const body = { type: "numbers", amount, rateCardEntrySid: entry.sid, numberGroupSid: group.sid };
  const preview = await cn<{ quoteToken: string; totalCost: number; currency: string }>("POST", "/orders/preview", body);
  const maxCost = Number(process.env.CLOUDNUMBERING_MAX_ORDER_GBP ?? 10) * amount;
  if (preview.totalCost > maxCost) throw new Error(`cloudnumbering: costo ${preview.totalCost} ${preview.currency} excede el límite`);
  const order = await cn<{ sid: string; numbers: { sid: string; number: string }[] }>(
    "POST",
    "/orders",
    { ...body, quoteToken: preview.quoteToken },
    { "Idempotency-Key": randomUUID() },
  );
  const added: string[] = [];
  for (const n of order.numbers) {
    await cn("POST", `/numbers/${n.sid}/endpoints`, { smsEndpointSid: endpointSid, reference: "NovaPhone" }).catch((e) => console.error(e));
    const [row] = await db
      .insert(schema.phoneNumbers)
      .values({ e164: n.number, country, provider: "cloudnumbering", providerRef: n.sid })
      .onConflictDoNothing()
      .returning();
    if (row) added.push(row.e164);
  }
  return { orderSid: order.sid, added, cost: preview.totalCost, currency: preview.currency };
}

/** Importa los números en servicio de la cuenta y asegura que su SMS llegue a NovaPhone. */
export async function syncCloudnumberingInventory() {
  const endpointSid = await ensureSmsEndpoint();
  let page = 1;
  let imported = 0;
  let routed = 0;
  for (;;) {
    const res = await fetch(`${BASE()}/numbers?page=${page}&perPage=100`, { headers: { Authorization: `Bearer ${await token()}` }, cache: "no-store" });
    const json = (await res.json()) as Envelope<{ entries: AssignedNumber[] }> & { meta?: { pagination?: { pageCount: number } } };
    for (const n of json.result?.entries ?? []) {
      if (n.smsEndpointSid !== endpointSid) {
        await cn("POST", `/numbers/${n.sid}/endpoints`, { smsEndpointSid: endpointSid, reference: "NovaPhone" }).catch((e) => console.error(e));
        routed++;
      }
      const [row] = await db
        .insert(schema.phoneNumbers)
        .values({ e164: n.number, country: n.countryIso, provider: "cloudnumbering", providerRef: n.sid })
        .onConflictDoNothing()
        .returning();
      if (row) imported++;
    }
    if (page >= (json.meta?.pagination?.pageCount ?? 1)) break;
    page++;
  }
  return { imported, routed };
}

/** Desconecta definitivamente un número (deja de cobrarse). Irreversible después de 7 días. */
export async function disconnectNumber(assignedSid: string) {
  await cn("DELETE", `/numbers/${assignedSid}`);
}
