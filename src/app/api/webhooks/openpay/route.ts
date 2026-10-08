import { NextResponse, type NextRequest } from "next/server";
import { syncCardDeposit } from "@/lib/openpay";

/**
 * Webhook de Openpay. Se configura en el panel con usuario/contraseña (Basic Auth = OPENPAY_WEBHOOK_USER/PASSWORD).
 * Nunca confiamos en el cuerpo: re-consultamos el cargo en la API de Openpay antes de acreditar.
 */
export async function POST(req: NextRequest) {
  const user = process.env.OPENPAY_WEBHOOK_USER;
  if (user) {
    const expected = `Basic ${Buffer.from(`${user}:${process.env.OPENPAY_WEBHOOK_PASSWORD ?? ""}`).toString("base64")}`;
    if (req.headers.get("authorization") !== expected) return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { type?: string; verification_code?: string; transaction?: { order_id?: string } } | null;
  // Openpay manda un código de verificación al registrar el webhook: se muestra en logs para capturarlo en el panel.
  if (body?.type === "verification") {
    console.log("Openpay webhook verification_code:", body.verification_code);
    return NextResponse.json({ ok: true });
  }
  const orderId = body?.transaction?.order_id;
  if (orderId && /^[0-9a-f-]{36}$/i.test(orderId)) await syncCardDeposit(orderId).catch((e) => console.error("openpay webhook", e));
  return NextResponse.json({ ok: true });
}
