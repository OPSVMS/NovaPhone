import "server-only";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Entorno local/Docker: Postgres detrás de local-neon-http-proxy.
if (process.env.NEON_HTTP_PROXY) {
  neonConfig.fetchEndpoint = () => process.env.NEON_HTTP_PROXY!;
}

export const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
export { schema };
