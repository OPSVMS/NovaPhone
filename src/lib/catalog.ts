import "server-only";
import { db, schema } from "@/db";
import { eq, notInArray, and, asc } from "drizzle-orm";
import { listPackages, toUsd } from "./esimaccess";
import { getUsdMxn } from "./fx";
import { formatGb, retailPriceMxn } from "./pricing";

const COUNTRIES = ["MX"];
const FEATURED = new Set(["MX_20_30"]);

/** Sincroniza los planes del proveedor y recalcula precios con el tipo de cambio actual. */
export async function syncCatalog() {
  const fx = await getUsdMxn();
  const seen: string[] = [];
  for (const country of COUNTRIES) {
    const pkgs = (await listPackages(country)).filter((p) => p.location === country && p.dataType === 1 && p.volume >= 1024 ** 3 * 0.9);
    for (const p of pkgs) {
      const costUsd = toUsd(p.price);
      const networks = (p.locationNetworkList ?? [])
        .flatMap((l) => (l.operatorList ?? []).map((o) => `${o.operatorName}${o.networkType ? ` ${o.networkType}` : ""}`))
        .join(", ");
      const row = {
        id: p.slug,
        provider: "esimaccess",
        providerCode: p.packageCode,
        name: `México ${formatGb(Math.round((p.volume / 1024 ** 3) * 10) / 10)} · ${p.duration} días`,
        countryCode: country,
        dataGb: Math.round((p.volume / 1024 ** 3) * 10) / 10,
        days: p.duration,
        daily: p.dataType !== 1,
        costUsd,
        priceMxn: retailPriceMxn(costUsd, fx),
        networks,
        speed: p.speed ?? "",
        active: true,
        featured: FEATURED.has(p.slug),
        updatedAt: new Date(),
      };
      await db.insert(schema.plans).values(row).onConflictDoUpdate({ target: schema.plans.id, set: row });
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

export async function getActivePlans() {
  return db.query.plans.findMany({
    where: eq(schema.plans.active, true),
    orderBy: [asc(schema.plans.daily), asc(schema.plans.dataGb), asc(schema.plans.days)],
  });
}

export async function getPlan(id: string) {
  return db.query.plans.findFirst({ where: and(eq(schema.plans.id, id), eq(schema.plans.active, true)) });
}
