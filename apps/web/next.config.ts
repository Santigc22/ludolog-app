import { config as loadEnvironment } from "dotenv";
import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

import { parsePublicEnvironment } from "./src/lib/config/public-env.schema";

const rootEnvironmentPath = fileURLToPath(
  new URL("../../.env", import.meta.url),
);

loadEnvironment({ path: rootEnvironmentPath, quiet: true });

const publicEnvironment = parsePublicEnvironment(process.env);
const apiUrl = new URL(publicEnvironment.NEXT_PUBLIC_API_URL);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: apiUrl.protocol.replace(":", "") as "http" | "https",
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        pathname: `${apiUrl.pathname.replace(/\/$/, "")}/media/**`,
      },
    ],
  },
};

export default nextConfig;
