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

/** "+447700900123" → "+44 7700 900123" (UK); otros países en bloques legibles. */
export function formatPhone(e164: string | null | undefined) {
  const raw = (e164 ?? "").replace(/[^\d+]/g, "");
  if (!raw) return "—";
  const uk = raw.match(/^\+44(\d{4})(\d{6})$/);
  if (uk) return `+44 ${uk[1]} ${uk[2]}`;
  const us = raw.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (us) return `+1 ${us[1]} ${us[2]} ${us[3]}`;
  const mx = raw.match(/^\+52(\d{2})(\d{4})(\d{4})$/);
  if (mx) return `+52 ${mx[1]} ${mx[2]} ${mx[3]}`;
  return raw;
}

/** Número sin el prefijo de país (lo que se escribe en WhatsApp tras elegir el país). */
export function nationalNumber(e164: string) {
  const uk = e164.match(/^\+44(\d+)$/);
  return uk ? uk[1] : e164.replace(/^\+/, "");
}

const rtf = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });

/** "hace 2 min", "ayer"… respecto a `now`. */
export function relativeTime(d: Date | string, now: number) {
  const diff = (new Date(d).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "ahora";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 7 * 86_400) return rtf.format(Math.round(diff / 86_400), "day");
  return formatDate(d, { day: "numeric", month: "short" });
}

/** Detecta un código de verificación (4–8 dígitos o "123-456") en un SMS. Regresa solo dígitos. */
export function extractCode(body: string) {
  const split = body.match(/(?<![\d-])(\d{3})[-\s](\d{3})(?![\d-])/);
  if (split) return `${split[1]}${split[2]}`;
  const plain = body.match(/(?<![\d+])(\d{4,8})(?!\d)/);
  return plain ? plain[1] : null;
}
