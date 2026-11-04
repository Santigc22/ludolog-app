import { config as loadEnvironment } from "dotenv";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

loadEnvironment({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
  quiet: true,
});

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/app/**"],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },
  },
});
