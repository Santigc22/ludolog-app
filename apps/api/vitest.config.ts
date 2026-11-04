import { config as loadEnvironment } from "dotenv";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const rootEnvironmentPath = fileURLToPath(
  new URL("../../.env", import.meta.url),
);

loadEnvironment({ path: rootEnvironmentPath, quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (testDatabaseUrl === undefined) {
  throw new Error("TEST_DATABASE_URL is required to run API tests");
}

const parsedTestDatabaseUrl = new URL(testDatabaseUrl);
const testDatabaseName = decodeURIComponent(
  parsedTestDatabaseUrl.pathname.slice(1),
);

if (!testDatabaseName.endsWith("_test")) {
  throw new Error("TEST_DATABASE_URL must target a database ending in _test");
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    // Integration files share one PostgreSQL database and some deliberately
    // install temporary audit-failure triggers. Running files concurrently can
    // deadlock DDL against another file's in-flight audit insert.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/server.ts",
        "src/types/**",
        "src/infrastructure/database/schema/**",
        "src/infrastructure/database/seeds/**",
        "src/infrastructure/database/testing/**",
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        statements: 60,
        branches: 50,
      },
    },
  },
});
