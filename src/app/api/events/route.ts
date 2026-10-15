import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { CLIENT_FUNNEL_EVENTS, MAX_BATCH, VISITOR_COOKIE, VISITOR_MAX_AGE_S } from "@/lib/analytics/funnel";
import { contextFrom, insertFunnelEvents } from "@/lib/analytics/funnel-server";

/**
 * Registro propio y anónimo del embudo (ver docs/CHECKOUT.md).
 * POST [{ event, path, props? }] (≤ 20) → 204. País, dispositivo, visitante y atribución de anuncios se derivan aquí
 * de headers/cookies; el cliente no puede fijarlos. No se guarda correo ni IP.
 */

const Scalar = z.union([z.string().max(200), z.number(), z.boolean(), z.null()]);
const Batch = z
  .array(
    z.object({
      event: z.enum(CLIENT_FUNNEL_EVENTS),
      path: z.string().max(500).optional().nullable(),
      props: z.record(z.string().max(40), Scalar).optional().nullable(),
    }),
  )
  .min(1)
  .max(MAX_BATCH);

/** Límite ligero por visitante (por instancia): más de 60 eventos/hora se descartan en silencio. */
const LIMIT = 60;
const WINDOW_MS = 60 * 60 * 1000;
const seen = new Map<string, { start: number; count: number }>();

function allowed(key: string, n: number): number {
  const now = Date.now();
  if (seen.size > 10_000) for (const [k, v] of seen) if (now - v.start > WINDOW_MS) seen.delete(k);
  let e = seen.get(key);
  if (!e || now - e.start > WINDOW_MS) {
    e = { start: now, count: 0 };
    seen.set(key, e);
  }
  const ok = Math.max(0, Math.min(n, LIMIT - e.count));
  e.count += n;
  return ok;
}

export async function POST(req: NextRequest) {
  const raw = await req.text().catch(() => "");
  if (raw.length > 20_000) return new NextResponse(null, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = Batch.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid events" }, { status: 400 });

  const ctx = contextFrom(req.headers, (n) => req.cookies.get(n)?.value);
  let newVisitor: string | null = null;
  if (!ctx.visitor) {
    newVisitor = randomBytes(16).toString("hex");
    ctx.visitor = newVisitor;
  }

  const n = allowed(ctx.visitor, parsed.data.length);
  if (n > 0) await insertFunnelEvents(parsed.data.slice(0, n), ctx);

  const res = new NextResponse(null, { status: 204 });
  if (newVisitor) {
    res.cookies.set(VISITOR_COOKIE, newVisitor, { path: "/", maxAge: VISITOR_MAX_AGE_S, sameSite: "lax", secure: req.nextUrl.protocol === "https:", httpOnly: false });
  }
  return res;
}
