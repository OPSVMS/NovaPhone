// Importa números de cloudnumbering y asigna uno (sin cobro) a un usuario. Uso: APP_URL=https://novaphone.lat tsx --conditions=react-server scripts/assign-number.mts <email> [e164] [orderId]
import { config } from "dotenv";
config({ path: ".env.local", override: false });
const [email, e164, orderId] = process.argv.slice(2);
const { db, schema } = await import("../src/db/index.ts");
const { eq } = await import("drizzle-orm");
const { syncCloudnumberingInventory } = await import("../src/lib/cloudnumbering.ts");
const { assignNumber } = await import("../src/lib/numbers.ts");
console.log("sync", await syncCloudnumberingInventory());
const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
if (!user) throw new Error("usuario no encontrado");
const r = await assignNumber(user, { charge: false, e164, orderId: orderId ?? null });
console.log(r.ok ? { ok: true, number: r.number.e164, renewsAt: r.number.renewsAt, orderId: r.number.orderId } : r);
