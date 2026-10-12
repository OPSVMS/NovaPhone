import { after, NextResponse, type NextRequest } from "next/server";
import { handleProviderEvent } from "@/lib/lifecycle";

/**
 * Webhook de eSIM Access (ORDER_STATUS, ESIM_STATUS, DATA_USAGE, VALIDITY_USAGE, SMDP_EVENT). La URL incluye ?token=.
 * La cuenta de eSIM Access solo admite una URL: los eventos de pedidos que no son nuestros se reenvían
 * a la otra marca (Faro) si ESIMACCESS_FORWARD_URL está configurado.
 */
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== process.env.ESIMACCESS_WEBHOOK_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const raw = await req.text();
  let body: Parameters<typeof handleProviderEvent>[0] | null = null;
  try {
    body = JSON.parse(raw);
  } catch {}
  const result = body ? await handleProviderEvent(body) : "invalid";
  if (result === "unknown-order") forward(raw);
  return NextResponse.json({ ok: true, result });
}

function forward(raw: string) {
  const url = process.env.ESIMACCESS_FORWARD_URL;
  const token = process.env.ESIMACCESS_FORWARD_TOKEN;
  if (!url || !token) return;
  after(async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forward-token": token },
        body: raw,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) console.warn("[esimaccess] forward failed", res.status);
    } catch (e) {
      console.warn("[esimaccess] forward error", e instanceof Error ? e.message : e);
    }
  });
}
