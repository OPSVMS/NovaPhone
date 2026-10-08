// Asigna (o recupera) la CLABE NOVACORE de un usuario. Uso: tsx --conditions=react-server scripts/novacore-clabe.mts <email>
import { config } from "dotenv";
config({ path: ".env.local" });
const [email] = process.argv.slice(2);
const { db, schema } = await import("../src/db/index.ts");
const { eq } = await import("drizzle-orm");
const { ensureClabe } = await import("../src/lib/novacore.ts");
const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
if (!user) throw new Error("usuario no encontrado");
console.log("clabe:", await ensureClabe(user, { notify: true }));
// Segunda llamada directa al API para confirmar idempotencia (mismo externalUserId → misma CLABE, isNew:false).
const { createHmac, randomUUID } = await import("node:crypto");
const body = JSON.stringify({ externalUserId: user.id, label: user.name.slice(0, 60) });
const ts = Math.floor(Date.now() / 1000).toString(), nonce = randomUUID();
const sig = "sha256=" + createHmac("sha256", process.env.NOVACORE_SIGNING_SECRET!).update(`${ts}.${nonce}.${body}`).digest("hex");
const r = await fetch("https://novacorp.mx/api/integrations/clabes", { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": process.env.NOVACORE_API_KEY!, "X-Signature-Timestamp": ts, "X-Signature-Nonce": nonce, "X-Signature": sig }, body });
console.log("idempotencia:", r.status, await r.text());
