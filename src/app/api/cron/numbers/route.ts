import { NextResponse, type NextRequest } from "next/server";
import { renewDueNumbers } from "@/lib/numbers";
import { expireStaleCardDeposits } from "@/lib/deposits";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false }, { status: 401 });
  const expiredCards = await expireStaleCardDeposits();
  return NextResponse.json({ ok: true, expiredCards, ...(await renewDueNumbers()) });
}
