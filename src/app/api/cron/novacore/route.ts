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
  const reconcile = await reconcileNovacore(Number(req.nextUrl.searchParams.get("minutes") ?? 60 * 24));
  return NextResponse.json({ ok: true, assigned, ...reconcile });
}
