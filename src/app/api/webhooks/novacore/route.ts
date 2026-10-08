import { NextResponse, type NextRequest } from "next/server";
import { checkNovacoreSignature, claimNonce, creditNovacoreDeposit, type NovacoreDeposit } from "@/lib/novacore";

/** Aviso de depósito SPEI de NOVACORE (se envía una sola vez; responder 200 en < 10 s). */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const ts = req.headers.get("x-novacore-timestamp");
  const nonce = req.headers.get("x-novacore-nonce");
  const check = checkNovacoreSignature(raw, ts, nonce, req.headers.get("x-novacore-signature"));
  if (!check.ok) {
    console.error("NOVACORE aviso rechazado:", check.reason, "keyPrefix:", req.headers.get("x-novacore-apikey-prefix"), "body:", raw.slice(0, 160));
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }
  if (!(await claimNonce(nonce!))) return NextResponse.json({ ok: false, error: "replayed nonce" }, { status: 409 });
  let body: NovacoreDeposit;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (body.type && body.type !== "deposit.received") return NextResponse.json({ ok: true, ignored: body.type });
  if (!body.trackingKey) return NextResponse.json({ ok: false, error: "trackingKey required" }, { status: 400 });
  const result = await creditNovacoreDeposit(body, "webhook");
  // 200 incluso si no reconocemos al usuario: la conciliación lo reintentará y operaciones lo revisa.
  return NextResponse.json({ ok: true, ...result });
}
