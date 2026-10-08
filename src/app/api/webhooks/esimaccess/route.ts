import { NextResponse, type NextRequest } from "next/server";
import { handleProviderEvent } from "@/lib/lifecycle";

/** Webhook de eSIM Access (ORDER_STATUS, ESIM_STATUS, DATA_USAGE, VALIDITY_USAGE, SMDP_EVENT). La URL incluye ?token=. */
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== process.env.ESIMACCESS_WEBHOOK_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const result = body ? await handleProviderEvent(body) : "invalid";
  return NextResponse.json({ ok: true, result });
}
