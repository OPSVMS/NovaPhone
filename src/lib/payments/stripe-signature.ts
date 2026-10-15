/**
 * Verificación de firmas de webhooks de Stripe (esquema `Stripe-Signature: t=…,v1=…`).
 * Sin dependencias de servidor de Next.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const DEFAULT_TOLERANCE_SEC = 300;

export function signStripePayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return { timestamp, v1, header: `t=${timestamp},v1=${v1}` };
}

export function parseSignatureHeader(header: string) {
  let t: number | null = null;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t" && /^\d+$/.test(v)) t = Number(v);
    else if (k === "v1" && v) v1.push(v);
  }
  return { t, v1 };
}

export type VerifyResult = { ok: true } | { ok: false; reason: "missing" | "malformed" | "expired" | "mismatch" };

/** Verifica la firma sobre el cuerpo crudo (sin parsear). Acepta cualquiera de las firmas v1 (rotación de secretos). */
export function verifyStripeSignature(
  payload: string,
  header: string | null | undefined,
  secret: string,
  { toleranceSec = DEFAULT_TOLERANCE_SEC, now = Math.floor(Date.now() / 1000) } = {},
): VerifyResult {
  if (!header || !secret) return { ok: false, reason: "missing" };
  const { t, v1 } = parseSignatureHeader(header);
  if (t === null || !v1.length) return { ok: false, reason: "malformed" };
  if (toleranceSec > 0 && Math.abs(now - t) > toleranceSec) return { ok: false, reason: "expired" };
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${payload}`, "utf8").digest("hex"));
  const match = v1.some((sig) => {
    const b = Buffer.from(sig);
    return b.length === expected.length && timingSafeEqual(b, expected);
  });
  return match ? { ok: true } : { ok: false, reason: "mismatch" };
}
