/** Formatting helpers for the app. Dates use Mexico City time so SSR output is stable. */

const TZ = "America/Mexico_City";

export function formatDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-MX", { timeZone: TZ, ...opts }).format(new Date(d));
}

export function formatDateTime(d: Date | string | null | undefined) {
  return formatDate(d, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatBytes(bytes: number | null | undefined) {
  const b = Math.max(0, Number(bytes ?? 0));
  const gb = b / 1024 ** 3;
  if (gb >= 1) return `${gb >= 10 ? Math.round(gb) : Math.round(gb * 10) / 10} GB`;
  return `${Math.round(b / 1024 ** 2)} MB`;
}

/** Días completos restantes (0 si ya venció). */
export function daysLeft(expiresAt: Date | string | null | undefined, now = Date.now()) {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 86_400_000));
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

/** Monto faltante redondeado hacia arriba a múltiplos de $100 (mínimo $100). */
export function topUpAmountMxn(missingCents: number) {
  return Math.max(100, Math.ceil(missingCents / 100 / 100) * 100);
}

/** "LPA:1$smdp.example.com$ABC123" → { smdp, code } */
export function splitActivationCode(ac: string | null | undefined) {
  const parts = (ac ?? "").split("$");
  return { smdp: parts[1] ?? "", code: parts[2] ?? "" };
}

export function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("es-MX", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now));
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** Only internal paths ("/app/..."); never "//host" or absolute URLs. */
export function safeNext(v: unknown) {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : undefined;
}
