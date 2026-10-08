import { NextResponse, type NextRequest } from "next/server";
import { syncCatalog } from "@/lib/catalog";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await syncCatalog()) });
}
