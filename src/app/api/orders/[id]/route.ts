import { NextResponse } from "next/server";
import { getUser } from "@/lib/session";
import { getUserOrder, refreshOrder } from "@/lib/orders";

/** Estado de una orden; si sigue en aprovisionamiento consulta al proveedor. */
export async function GET(_: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  let order = await getUserOrder(user.id, id);
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (order.status === "provisioning") order = await refreshOrder(order).catch(() => order!);
  return NextResponse.json({ status: order.status });
}
