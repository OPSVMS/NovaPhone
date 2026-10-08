import { NextResponse, type NextRequest } from "next/server";
import { getActiveEsims, syncUsage } from "@/lib/topups";

export const maxDuration = 300;

/** Actualiza consumo/vigencia de las eSIM activas y ejecuta auto-recargas. */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const esims = await getActiveEsims();
  let synced = 0;
  const errors: string[] = [];
  for (const order of esims) {
    try {
      await syncUsage(order);
      synced++;
    } catch (e) {
      errors.push(`${order.id}: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 150)); // límite del proveedor: 8 req/s
  }
  return NextResponse.json({ ok: true, synced, errors });
}
