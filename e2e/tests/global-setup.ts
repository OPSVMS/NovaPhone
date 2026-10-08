// Sincroniza el catálogo (simulador) antes de las pruebas.
export default async function globalSetup() {
  const base = process.env.BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/cron/sync-catalog`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  const json = await res.json();
  if (!json.ok || json.plans < 3) throw new Error(`Catalog sync failed: ${JSON.stringify(json)}`);
}
