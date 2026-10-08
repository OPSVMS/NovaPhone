import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { refreshOrder } from "@/lib/orders";

/** Webhook de eSIM Access. La URL incluye ?token= para autenticar. */
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== process.env.ESIMACCESS_WEBHOOK_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { notifyType?: string; content?: { orderNo?: string; esimTranNo?: string } } | null;
  const orderNo = body?.content?.orderNo;
  if (orderNo) {
    const order = await db.query.orders.findFirst({ where: eq(schema.orders.providerOrderNo, orderNo) });
    if (order) await refreshOrder(order);
  }
  return NextResponse.json({ ok: true });
}
