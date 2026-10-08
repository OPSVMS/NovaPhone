import { NextResponse, type NextRequest } from "next/server";
import { and, isNull, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureClabe, novacoreEnabled, reconcileNovacore } from "@/lib/novacore";

export const maxDuration = 120;

/** Conciliación SPEI con NOVACORE + alta de CLABEs pendientes. */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!novacoreEnabled()) return NextResponse.json({ ok: true, enabled: false });
  const pending = await db.query.users.findMany({
    where: and(isNull(schema.users.clabe), eq(schema.users.role, "user")),
    limit: 50,
  });
  const admins = await db.query.users.findMany({ where: and(isNull(schema.users.clabe), eq(schema.users.role, "admin")), limit: 10 });
  let assigned = 0;
  for (const u of [...pending, ...admins]) if (await ensureClabe(u).catch(() => null)) assigned++;
  // Cada minuto revisa las últimas 2 h; una vez por hora, 7 días (para detectar devoluciones tardías).
  const fullSweep = new Date().getUTCMinutes() === 0;
  const minutes = Number(req.nextUrl.searchParams.get("minutes") ?? (fullSweep ? 7 * 24 * 60 : 120));
  const reconcile = await reconcileNovacore(minutes);
  return NextResponse.json({ ok: true, assigned, ...reconcile });
}
