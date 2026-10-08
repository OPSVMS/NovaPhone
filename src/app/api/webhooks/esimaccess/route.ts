import { NextResponse, type NextRequest } from "next/server";
import { eq, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { refreshOrder } from "@/lib/orders";
import { syncUsage } from "@/lib/topups";

type Notify = { notifyType?: string; content?: { orderNo?: string; esimTranNo?: string; iccid?: string } };

/** Webhook de eSIM Access (ORDER_STATUS, uso de datos, vigencia, eventos SM-DP+). La URL incluye ?token=. */
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== process.env.ESIMACCESS_WEBHOOK_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Notify | null;
  const c = body?.content ?? {};
  const conditions = [
    c.orderNo ? eq(schema.orders.providerOrderNo, c.orderNo) : undefined,
    c.esimTranNo ? eq(schema.orders.esimTranNo, c.esimTranNo) : undefined,
    c.iccid ? eq(schema.orders.iccid, c.iccid) : undefined,
  ].filter((x) => x !== undefined);
  if (conditions.length) {
    const order = await db.query.orders.findFirst({ where: or(...conditions) });
    if (order) {
      const ready = order.status === "provisioning" ? await refreshOrder(order) : order;
      if (ready.status === "ready" && body?.notifyType !== "ORDER_STATUS") await syncUsage(ready).catch(() => null);
    }
  }
  return NextResponse.json({ ok: true });
}
