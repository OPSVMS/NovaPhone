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
];

/**
 * Plans offered on the public site (director decision 2026-10-15). Anything else in the
 * catalog (e.g. 50 GB) stays purchasable from the app but is not marketed.
 */
export const MARKETED_PLAN_IDS = ["MX_1_7", "MX_3_15", "MX_3_30", "MX_5_30", "MX_10_30", "MX_20_30"] as const;

/** Recommended plan: preselected in the picker and used in the hero copy. */
export const RECOMMENDED_PLAN_ID = "MX_20_30";

/** Plans shown before "Ver más planes", in this order (recommended in the middle). */
export const VISIBLE_PLAN_IDS = ["MX_5_30", "MX_20_30", "MX_10_30"] as const;

/** Active plans for the public site, sorted by data then validity. */
export async function getMarketingPlans(): Promise<MarketingPlan[]> {
  try {
    const rows = await getActivePlans();
    const plans = rows
      .filter((r) => !r.daily && (MARKETED_PLAN_IDS as readonly string[]).includes(r.id))
      .map(({ id, name, dataGb, days, priceMxn, networks, speed }) => ({
        id,
        name,
        dataGb,
        days,
        priceMxn,
        networks,
        speed,
        featured: id === RECOMMENDED_PLAN_ID,
      }));
    return plans.length ? plans : FALLBACK_PLANS;
  } catch (error) {
    console.error("[marketing] getActivePlans failed, using fallback catalog", error);
    return FALLBACK_PLANS;
  }
}
