import { config as loadEnvironment } from "dotenv";
import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

import { parsePublicEnvironment } from "./src/lib/config/public-env.schema";

const rootEnvironmentPath = fileURLToPath(
  new URL("../../.env", import.meta.url),
);

loadEnvironment({ path: rootEnvironmentPath, quiet: true });

parsePublicEnvironment(process.env);

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
