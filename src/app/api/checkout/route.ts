import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/session";
import { startCardCheckout } from "@/lib/checkout";

/**
 * `POST /api/checkout` { planId, email, addNumber? } → 200 { url } | 4xx/5xx { error, code }.
 * Igual que la server action `startCardCheckout` (src/app/actions/checkout.ts).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { planId?: unknown; email?: unknown; addNumber?: unknown } | null;
  if (!body || typeof body.planId !== "string") return NextResponse.json({ error: "planId requerido", code: "unavailable" }, { status: 400 });
  const user = await getUser().catch(() => null);
  const result = await startCardCheckout({ planId: body.planId, email: typeof body.email === "string" ? body.email : "", addNumber: body.addNumber === true }, user);
  if ("url" in result) return NextResponse.json(result);
  const status =
    result.code === "unavailable" ? 404 : result.code === "invalid_email" ? 400 : result.code === "account_disabled" ? 403 : result.code === "payments_disabled" ? 503 : 502;
  return NextResponse.json(result, { status });
}
