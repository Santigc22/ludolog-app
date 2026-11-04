import { config as loadEnvironment } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

loadEnvironment({ path: ".env", quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const managesExternalServers = process.env.PLAYWRIGHT_EXTERNAL_SERVERS === "1";

if (testDatabaseUrl === undefined) {
  throw new Error("TEST_DATABASE_URL is required to run E2E tests");
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: managesExternalServers
    ? undefined
    : [
        {
          command: "node apps/api/dist/server.js",
          url: "http://localhost:3001/api/v1/health",
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            NODE_ENV: "test",
            API_PORT: "3001",
            WEB_ORIGIN: "http://localhost:3000",
            DATABASE_URL: testDatabaseUrl,
          },
        },
        {
          command: "node ../../node_modules/next/dist/bin/next start -p 3000",
          cwd: "apps/web",
          url: "http://localhost:3000",
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            NODE_ENV: "production",
            NEXT_PUBLIC_API_URL: "http://localhost:3001/api/v1",
          },
        },
      ],
});
