import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { storeInboundSms } from "@/lib/numbers";
import { CLOUDNUMBERING_SMS_IPS } from "@/lib/cloudnumbering";

/**
 * SMS entrantes de proveedores de números.
 * URL configurada en el endpoint del proveedor: /api/webhooks/sms/cloudnumbering?token=SMS_WEBHOOK_TOKEN
 *
 * cloudnumbering manda JSON { to, from, content, country, country_name, parts } sin firma ni id, no reintenta ante
 * respuestas no-2xx y puede duplicar por fallas de red. Por eso: aceptamos primero (siempre 200), deduplicamos por
 * contenido y tratamos todos los campos como opcionales y no confiables.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/webhooks/sms/[provider]">) {
  if (req.nextUrl.searchParams.get("token") !== process.env.SMS_WEBHOOK_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { provider } = await ctx.params;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (provider === "cloudnumbering" && ip && !CLOUDNUMBERING_SMS_IPS.includes(ip) && process.env.NODE_ENV === "production") {
    console.warn("SMS webhook desde IP no listada", ip);
    if (process.env.CLOUDNUMBERING_ENFORCE_IPS === "true") return NextResponse.json({ ok: false }, { status: 403 });
  }

  let data: Record<string, unknown> = {};
  try {
    const type = req.headers.get("content-type") ?? "";
    if (type.includes("application/json")) data = (await req.json()) as Record<string, unknown>;
    else data = Object.fromEntries((await req.formData()).entries());
  } catch {
    console.error("SMS webhook: cuerpo inválido");
    return NextResponse.json({ ok: true, result: "invalid-body" });
  }
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = data[k] ?? (data.data as Record<string, unknown> | undefined)?.[k];
      if (typeof v === "string" && v) return v;
      if (typeof v === "number") return String(v);
    }
    return "";
  };
  const to = pick("to", "To", "destination", "recipient", "msisdn", "number", "did");
  const from = pick("from", "From", "originator", "sender", "source", "cli") || "desconocido";
  const body = pick("content", "text", "body", "Body", "message", "msg");
  const providerId = pick("id", "messageId", "message_id", "MessageSid", "sms_id", "uuid");
  if (!to) {
    console.error("SMS webhook sin destino", JSON.stringify(data).slice(0, 300));
    return NextResponse.json({ ok: true, result: "missing-to" });
  }
  // Sin id del proveedor: deduplicamos por destino + remitente + contenido dentro de la misma ventana de 10 minutos.
  const window = Math.floor(Date.now() / 600_000);
  const externalId = providerId
    ? `${provider}:${providerId}`
    : `${provider}:h:${createHash("sha256").update(`${to}|${from}|${body}|${window}`).digest("hex").slice(0, 40)}`;
  const result = await storeInboundSms({ to, from, body: body || "(mensaje vacío)", externalId }).catch((e) => {
    console.error("SMS webhook store", e);
    return { result: "error" as const };
  });
  return NextResponse.json({ ok: true, ...result });
}
