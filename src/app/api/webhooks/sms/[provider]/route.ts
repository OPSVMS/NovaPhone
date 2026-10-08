import { NextResponse, type NextRequest } from "next/server";
import { storeInboundSms } from "@/lib/numbers";

/**
 * SMS entrantes de proveedores de números (cloudnumbering, etc.).
 * URL: /api/webhooks/sms/cloudnumbering?token=SMS_WEBHOOK_TOKEN
 * Acepta JSON o form-urlencoded con nombres comunes: to/To/destination/msisdn, from/From/originator/sender,
 * text/body/Body/message/content, id/messageId/MessageSid.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/webhooks/sms/[provider]">) {
  if (req.nextUrl.searchParams.get("token") !== process.env.SMS_WEBHOOK_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { provider } = await ctx.params;
  const type = req.headers.get("content-type") ?? "";
  let data: Record<string, unknown> = {};
  if (type.includes("application/json")) data = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  else data = Object.fromEntries((await req.formData().catch(() => new FormData())).entries());
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = data[k] ?? (data.data as Record<string, unknown> | undefined)?.[k];
      if (typeof v === "string" && v) return v;
      if (typeof v === "number") return String(v);
    }
    return "";
  };
  const to = pick("to", "To", "destination", "recipient", "msisdn", "number", "did");
  const from = pick("from", "From", "originator", "sender", "source", "cli");
  const body = pick("text", "body", "Body", "message", "content", "msg");
  const externalId = pick("id", "messageId", "message_id", "MessageSid", "sms_id", "uuid");
  if (!to || !body) return NextResponse.json({ ok: false, error: "to and text are required" }, { status: 400 });
  const result = await storeInboundSms({ to, from: from || "desconocido", body, externalId: externalId ? `${provider}:${externalId}` : undefined });
  return NextResponse.json({ ok: true, ...result });
}
