/** Redondea hacia arriba a un número "cerrado" que termina en 9 (37 → 39, 590.5 → 599). */
export function closedPrice(mxn: number) {
  const p = Math.ceil(mxn / 10) * 10 - 1;
  return p >= mxn ? p : p + 10;
}

export function retailPriceMxn(costUsd: number, fx: number, markup = Number(process.env.PRICE_MARKUP ?? 1.33)) {
  return closedPrice(costUsd * fx * markup);
}

export const formatMxn = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

export const formatGb = (gb: number) => (gb < 1 ? `${Math.round(gb * 1024)} MB` : `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`);
