import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const signValue = (v: string) => createHmac("sha256", process.env.SIGNING_SECRET!).update(v).digest("base64url").slice(0, 32);

export function verifyValue(v: string, sig: string | null) {
  if (!sig) return false;
  const a = Buffer.from(signValue(v));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
