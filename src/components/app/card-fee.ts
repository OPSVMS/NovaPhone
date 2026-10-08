/**
 * Fórmula pura de la comisión con tarjeta (espejo de `cardFeeCents` en src/lib/openpay.ts, que es server-only).
 * Los parámetros vienen del servidor para respetar la misma configuración (OPENPAY_FEE_PCT, OPENPAY_FEE_FIXED, OPENPAY_PASS_FEES).
 */
export type CardFeeConfig = { pct: number; fixedMxn: number; pass: boolean };

export function cardFeeCents(amountCents: number, cfg: CardFeeConfig) {
  if (!cfg.pass) return 0;
  const pct = cfg.pct / 100;
  const fixed = cfg.fixedMxn * 100;
  const iva = 1.16;
  const total = (amountCents + fixed * iva) / (1 - pct * iva);
  return Math.ceil(total / 100) * 100 - amountCents;
}
