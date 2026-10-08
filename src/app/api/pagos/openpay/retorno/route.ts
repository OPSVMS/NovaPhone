import { NextResponse, type NextRequest } from "next/server";
import { syncCardDeposit } from "@/lib/openpay";

/** Openpay regresa aquí tras el pago (3D Secure). Verificamos con su API y mandamos al detalle del depósito. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("deposito") ?? "";
  if (/^[0-9a-f-]{36}$/i.test(id)) await syncCardDeposit(id).catch((e) => console.error("openpay retorno", e));
  return NextResponse.redirect(new URL(`/app/fondos/${id}`, process.env.APP_URL ?? req.url));
}
