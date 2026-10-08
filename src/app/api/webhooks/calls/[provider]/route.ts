import { NextResponse, type NextRequest } from "next/server";
import { storeCall } from "@/lib/numbers";

/**
 * Registro de llamadas desde el servicio de voz (SIP → webhook). URL: /api/webhooks/calls/<proveedor>?token=SMS_WEBHOOK_TOKEN
 * Body JSON: { to, from, status?: answered|missed|voicemail|rejected, duration?, transcript?, id?, startedAt? }
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/webhooks/calls/[provider]">) {
  if (req.nextUrl.searchParams.get("token") !== process.env.SMS_WEBHOOK_TOKEN) return NextResponse.json({ ok: false }, { status: 401 });
  const { provider } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : typeof b[k] === "number" ? String(b[k]) : "");
  if (!str("to")) return NextResponse.json({ ok: true, result: "missing-to" });
  const status = ["answered", "missed", "voicemail", "rejected"].includes(str("status")) ? (str("status") as "answered") : "missed";
  const result = await storeCall({
    to: str("to"),
    from: str("from") || "desconocido",
    status,
    durationSec: Number(b.duration ?? b.durationSec ?? 0) || 0,
    transcript: str("transcript") || undefined,
    externalId: str("id") ? `${provider}:${str("id")}` : undefined,
    startedAt: str("startedAt") ? new Date(str("startedAt")) : undefined,
  });
  return NextResponse.json({ ok: true, ...result });
}
