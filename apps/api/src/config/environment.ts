import { config as loadEnvironment } from "dotenv";
import { fileURLToPath } from "node:url";

import {
  ApiEnvironmentSchema,
  type ApiEnvironment,
} from "./environment.schema.js";

const rootEnvironmentPath = fileURLToPath(
  new URL("../../../../.env", import.meta.url),
);

loadEnvironment({ path: rootEnvironmentPath, quiet: true });

function formatEnvironmentError(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): string {
  return issues
    .map(
      (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`,
    )
    .join("; ");
}

const result = ApiEnvironmentSchema.safeParse(process.env);

if (!result.success) {
  throw new Error(
    `Invalid API environment variables: ${formatEnvironmentError(result.error.issues)}`,
  );
}

function toApiConfig(environment: ApiEnvironment) {
  return Object.freeze({
    nodeEnv: environment.NODE_ENV,
    port: environment.API_PORT,
    webOrigin: environment.WEB_ORIGIN,
    databaseUrl: environment.DATABASE_URL,
  });
}

export const apiConfig = toApiConfig(result.data);
