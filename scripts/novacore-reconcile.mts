import { config } from "dotenv";
config({ path: ".env.local" });
const { reconcileNovacore } = await import("../src/lib/novacore.ts");
console.log(await reconcileNovacore(Number(process.argv[2] ?? 120)));
