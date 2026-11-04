import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { apiConfig } from "../../config/environment.js";

export const databasePool = new Pool({
  connectionString: apiConfig.databaseUrl,
  connectionTimeoutMillis: 5_000,
  application_name: "ludoteca-api",
  options: "-c timezone=UTC",
});

export const database = drizzle({ client: databasePool });

export async function closeDatabase(): Promise<void> {
  await databasePool.end();
}
