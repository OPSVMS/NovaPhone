import { config } from "dotenv";
config({ path: ".env.local" });

const { syncCatalog, getActivePlans } = await import("../src/lib/catalog.ts");
const r = await syncCatalog();
console.log(r);
console.table((await getActivePlans()).map((p) => ({ id: p.id, gb: p.dataGb, dias: p.days, diario: p.daily, costoUsd: p.costUsd, mxn: p.priceMxn, red: p.networks })));
