import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/session";
import { getUserOrder, refreshOrder } from "@/lib/orders";
import { getOrderForSuccess } from "@/lib/checkout";
import { UUID_RE } from "@/lib/queries";

/**
 * Estado de una orden; si sigue en aprovisionamiento consulta al proveedor.
 * - Con `?t={token}` (compra con tarjeta sin sesión): regresa el `OrderForSuccess` completo (lo usa /compra/[id]).
 * - Sin token: requiere sesión del dueño y regresa `{ status }` (lo usa la cuenta).
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/orders/[id]">) {
  const { id } = await ctx.params;
  const token = req.nextUrl.searchParams.get("t");
  if (token) {
    const view = await getOrderForSuccess(id, token).catch((e) => {
      console.error("getOrderForSuccess", id, e);
      return null;
    });
    if (!view) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  }
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  let order = await getUserOrder(user.id, id);
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (order.status === "provisioning") order = await refreshOrder(order).catch(() => order!);
  return NextResponse.json({ status: order.status });
}
