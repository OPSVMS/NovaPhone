import "server-only";
import { getActivePlans } from "@/lib/catalog";

export type MarketingPlan = {
  id: string;
  name: string;
  dataGb: number;
  days: number;
  /** Precio público en pesos cerrados (IVA incluido). */
  priceMxn: number;
  networks: string;
  speed: string;
  featured: boolean;
};

/**
 * Last-known catalog. Only used if the database is unreachable (e.g. a
 * prerender without DATABASE_URL) so the marketing site never 500s.
 */
const FALLBACK_PLANS: MarketingPlan[] = [
  { id: "MX_1_7", name: "México 1GB 7 días", dataGb: 1, days: 7, priceMxn: 39, networks: "Telcel 5G, AT&T 5G", speed: "5G", featured: false },
  { id: "MX_3_15", name: "México 3GB 15 días", dataGb: 3, days: 15, priceMxn: 109, networks: "Telcel 5G, AT&T 5G", speed: "5G", featured: false },
  { id: "MX_3_30", name: "México 3GB 30 días", dataGb: 3, days: 30, priceMxn: 119, networks: "Telcel 5G, AT&T 5G", speed: "5G", featured: false },
  { id: "MX_5_30", name: "México 5GB 30 días", dataGb: 5, days: 30, priceMxn: 189, networks: "Telcel 5G, AT&T 5G", speed: "5G", featured: false },
  { id: "MX_10_30", name: "México 10GB 30 días", dataGb: 10, days: 30, priceMxn: 329, networks: "Telcel 5G, AT&T 5G", speed: "5G", featured: false },
  { id: "MX_20_30", name: "México 20GB 30 días", dataGb: 20, days: 30, priceMxn: 599, networks: "Telcel 5G, AT&T 5G", speed: "5G", featured: true },
  { id: "MX_50_30", name: "México 50GB 30 días", dataGb: 50, days: 30, priceMxn: 1829, networks: "Telcel 5G, AT&T 5G", speed: "5G", featured: false },
];

/** Active plans for the public site, sorted by data then validity. */
export async function getMarketingPlans(): Promise<MarketingPlan[]> {
  try {
    const rows = await getActivePlans();
    const plans = rows
      .filter((r) => !r.daily)
      .map(({ id, name, dataGb, days, priceMxn, networks, speed, featured }) => ({
        id,
        name,
        dataGb,
        days,
        priceMxn,
        networks,
        speed,
        featured,
      }));
    return plans.length ? plans : FALLBACK_PLANS;
  } catch (error) {
    console.error("[marketing] getActivePlans failed, using fallback catalog", error);
    return FALLBACK_PLANS;
  }
}

/**
 * A short, representative selection for the landing: up to `count` monthly
 * plans around the featured one (featured always included).
 */
export function pickHighlights(plans: MarketingPlan[], count = 4): MarketingPlan[] {
  const monthly = plans.filter((p) => p.days >= 30);
  const pool = monthly.length >= count ? monthly : plans;
  if (pool.length <= count) return pool;
  const idx = Math.max(0, pool.findIndex((p) => p.featured));
  const start = Math.min(Math.max(idx - 2, 0), pool.length - count);
  return pool.slice(start, start + count);
}
