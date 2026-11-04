import { defineConfig } from "drizzle-kit";

import { apiConfig } from "./src/config/environment.js";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infrastructure/database/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: apiConfig.databaseUrl,
  },
  strict: true,
  verbose: true,
});
