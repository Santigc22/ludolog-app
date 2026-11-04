import { sql } from "drizzle-orm";

import { database } from "./client.js";

export async function checkDatabaseHealth(): Promise<void> {
  await database.execute(sql`select 1 as healthy`);
}
