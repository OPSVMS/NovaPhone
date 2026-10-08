import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { verifyValue } from "@/lib/sign";
import { getUser } from "@/lib/session";

/** PNG del QR de instalación. Acceso con firma (correo) o con sesión del dueño. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/qr/[id]">) {
  const { id } = await ctx.params;
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, id) });
  const signed = verifyValue(id, req.nextUrl.searchParams.get("sig"));
  const user = signed ? null : await getUser();
  if (!order?.activationCode || (!signed && user?.id !== order.userId)) return new NextResponse(null, { status: 404 });
  const png = await QRCode.toBuffer(order.activationCode, { width: 480, margin: 1, color: { dark: "#1a1033", light: "#ffffff" } });
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" } });
}
