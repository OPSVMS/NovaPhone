/**
 * Configuración pública de analítica. `process.env.NEXT_PUBLIC_*` se referencia literal para que Next.js
 * lo incruste en el bundle del cliente. Cada pieza es un no-op si falta su variable.
 */

const clean = (v: string | undefined): string | undefined => {
  const s = v?.trim();
  return s ? s : undefined;
};

export const GA4_ID = clean(process.env.NEXT_PUBLIC_GA4_ID); // "G-XXXXXXX"
export const GOOGLE_ADS_ID = clean(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID); // "AW-123456789"
export const ADS_PURCHASE_LABEL = clean(process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL);
export const CLARITY_ID = clean(process.env.NEXT_PUBLIC_CLARITY_ID); // Microsoft Clarity

/** Primer id con el que se carga gtag.js (GA4 preferido). */
export const GTAG_LOADER_ID = GA4_ID ?? GOOGLE_ADS_ID;

export function adsSendTo(label: string | undefined): string | undefined {
  return GOOGLE_ADS_ID && label ? `${GOOGLE_ADS_ID}/${label}` : undefined;
}
