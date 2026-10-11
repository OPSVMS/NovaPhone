import { NextResponse, type NextRequest } from "next/server";
import { handleTelnyxEvent } from "@/lib/voice";

/** Webhooks de Telnyx Voice API (llamadas a números NovaPhone). URL: /api/webhooks/telnyx?token=TELNYX_WEBHOOK_TOKEN */
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== process.env.TELNYX_WEBHOOK_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const evt = await req.json().catch(() => null);
  const result = evt ? await handleTelnyxEvent(evt).catch((e) => (console.error("telnyx webhook", e), "error")) : "invalid";
  return NextResponse.json({ ok: true, result });
}
