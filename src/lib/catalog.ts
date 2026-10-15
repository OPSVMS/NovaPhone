import "server-only";
import { db, schema } from "@/db";
import { eq, notInArray, and, asc, lt } from "drizzle-orm";
import { listPackages, toUsd } from "./esimaccess";
import { getUsdMxn } from "./fx";
import { formatGb, retailPriceMxn } from "./pricing";

const COUNTRIES = ["MX"];
const FEATURED = new Set(["MX_20_30"]);
/**
 * Planes retirados de la venta por decisión comercial (2026-10-15: el de 50 GB / $1,829). Nunca se venden ni se
 * reactivan con la sincronización, aunque el proveedor los siga ofreciendo. Las eSIM ya vendidas siguen funcionando.
 */
export const RETIRED_MIN_GB = 50;

/**
 * Precios de lista fijos en MXN (IVA incluido), los mismos que anuncios y landing. La sincronización diaria los
 * respeta: solo los planes que no están aquí se calculan con costo × tipo de cambio × margen.
 * Llave: "{GB}/{días}".
 */
export const FIXED_PRICES_MXN: Record<string, number> = {
  "1/7": 39,
  "3/15": 109,
  "3/30": 119,
  "5/30": 189,
  "10/30": 329,
  "20/30": 599,
};
export const fixedPriceMxn = (dataGb: number, days: number): number | undefined => FIXED_PRICES_MXN[`${dataGb}/${days}`];
export const isRetired = (p: { dataGb: number }) => p.dataGb >= RETIRED_MIN_GB;

/** Sincroniza los planes del proveedor y recalcula precios con el tipo de cambio actual. */
export async function syncCatalog() {
  const fx = await getUsdMxn();
  const seen: string[] = [];
  for (const country of COUNTRIES) {
    const pkgs = (await listPackages(country)).filter((p) => p.location === country && p.dataType === 1 && p.volume >= 1024 ** 3 * 0.9);
    for (const p of pkgs) {
      const costUsd = toUsd(p.price);
      const dataGb = Math.round((p.volume / 1024 ** 3) * 10) / 10;
      const fixed = fixedPriceMxn(dataGb, p.duration);
      const computed = retailPriceMxn(costUsd, fx);
      if (fixed !== undefined && fixed < costUsd * fx * 1.1) console.warn(`[catalog] ${p.slug}: precio fijo $${fixed} deja menos de 10% sobre el costo ($${(costUsd * fx).toFixed(2)})`);
      const networks = (p.locationNetworkList ?? [])
        .flatMap((l) => (l.operatorList ?? []).map((o) => `${o.operatorName}${o.networkType ? ` ${o.networkType}` : ""}`))
        .join(", ");
      const row = {
        id: p.slug,
        provider: "esimaccess",
        providerCode: p.packageCode,
        name: `México ${formatGb(dataGb)} · ${p.duration} días`,
        countryCode: country,
        dataGb,
        days: p.duration,
        daily: p.dataType !== 1,
        costUsd,
        priceMxn: fixed ?? computed,
        networks,
        speed: p.speed ?? "",
        active: true,
        featured: FEATURED.has(p.slug),
        updatedAt: new Date(),
      };
      // En actualizaciones no se toca `active`: respeta los planes que un admin ocultó.
      const { active: _active, ...update } = row;
      void _active;
      const retired = isRetired(row);
      await db
        .insert(schema.plans)
        .values({ ...row, active: !retired })
        .onConflictDoUpdate({ target: schema.plans.id, set: retired ? { ...update, active: false } : update });
      seen.push(p.slug);
    }
  }
  if (seen.length) await db.update(schema.plans).set({ active: false }).where(notInArray(schema.plans.id, seen));
  await db
    .insert(schema.settings)
    .values({ key: "fx_usd_mxn", value: fx })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: fx, updatedAt: new Date() } });
  return { fx, plans: seen.length };
}

/** Planes a la venta (activos y no retirados). */
export async function getActivePlans() {
  return db.query.plans.findMany({
    where: and(eq(schema.plans.active, true), lt(schema.plans.dataGb, RETIRED_MIN_GB)),
    orderBy: [asc(schema.plans.daily), asc(schema.plans.dataGb), asc(schema.plans.days)],
  });
}

/** Plan a la venta por id (undefined si está inactivo o retirado). */
export async function getPlan(id: string) {
  return db.query.plans.findFirst({ where: and(eq(schema.plans.id, id), eq(schema.plans.active, true), lt(schema.plans.dataGb, RETIRED_MIN_GB)) });
}
