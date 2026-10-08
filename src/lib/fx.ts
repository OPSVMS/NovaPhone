import "server-only";

/** Tipo de cambio USD→MXN (BCE vía frankfurter), con respaldo en env. */
export async function getUsdMxn(): Promise<number> {
  try {
    const res = await fetch(process.env.FX_URL ?? "https://api.frankfurter.app/latest?from=USD&to=MXN", { cache: "no-store" });
    const json = (await res.json()) as { rates?: { MXN?: number } };
    if (json.rates?.MXN) return json.rates.MXN;
  } catch {}
  return Number(process.env.FX_USD_MXN_FALLBACK ?? 18);
}
