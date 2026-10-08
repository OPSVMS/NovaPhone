// Liga una eSIM comprada fuera de la plataforma a un usuario. Uso: tsx --conditions=react-server scripts/link-esim.mts <email> <orderNo> <planId>
import { config } from "dotenv";
config({ path: ".env.local" });
const [email, orderNo, planId] = process.argv.slice(2);
const { db, schema } = await import("../src/db/index.ts");
const { eq } = await import("drizzle-orm");
const { refreshOrder } = await import("../src/lib/orders.ts");
const { syncUsage } = await import("../src/lib/topups.ts");
const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, planId) });
if (!user || !plan) throw new Error("usuario o plan no encontrado");
const existing = await db.query.orders.findFirst({ where: eq(schema.orders.providerOrderNo, orderNo) });
let order = existing ?? (await db.insert(schema.orders).values({
  userId: user.id, planId: plan.id, planName: plan.name, priceCents: plan.priceMxn * 100, costUsd: plan.costUsd,
  providerOrderNo: orderNo, emailedAt: new Date(),
}).returning())[0];
order = await refreshOrder(order);
order = await syncUsage(order);
console.log({ id: order.id, status: order.status, iccid: order.iccid, usadoMB: Math.round(Number(order.usedBytes) / 1048576), totalGB: Number(order.totalBytes) / 1024 ** 3, activada: order.activatedAt, vence: order.expiresAt, smdp: order.smdpStatus });
