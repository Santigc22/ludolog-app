import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  DatabaseHealthResponseSchema,
  HealthResponseSchema,
} from "@ludoteca/contracts";
import { afterAll, expect, test } from "vitest";

import { app } from "../src/app.js";
import { ApiEnvironmentSchema } from "../src/config/environment.schema.js";
import { closeDatabase } from "../src/infrastructure/database/index.js";
import { redactLogValue } from "../src/infrastructure/logging/logger.js";

afterAll(async () => {
  await closeDatabase();
});

async function startTestServer(): Promise<{
  baseUrl: string;
  server: Server;
}> {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();

  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Expected an ephemeral TCP address");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
  };
}

test("accepts valid API environment variables", () => {
  const result = ApiEnvironmentSchema.safeParse({
    NODE_ENV: "test",
    API_PORT: "3001",
    WEB_ORIGIN: "http://localhost:3000",
    DATABASE_URL: "postgresql://user:password@localhost:5433/database",
  });

  expect(result.success).toBe(true);
  expect(result.data?.API_PORT).toBe(3001);
});

test("rejects invalid API environment variables without requiring secrets", () => {
  const result = ApiEnvironmentSchema.safeParse({
    NODE_ENV: "invalid",
    API_PORT: "70000",
    WEB_ORIGIN: "not-a-url",
    DATABASE_URL: "mysql://localhost/database",
  });

  expect(result.success).toBe(false);
});

test("importing app does not start a listening server", () => {
  expect(typeof app.listen).toBe("function");
});

test("GET /api/v1/health returns the documented contract", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id") ?? "").toMatch(
      /^[0-9a-f-]{36}$/,
    );
    expect(HealthResponseSchema.parse(body)).toEqual({
      status: "ok",
      service: "ludoteca-api",
    });
  } finally {
    server.close();
  }
});

test("preserves a valid caller request ID", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { "x-request-id": "caller-request-123" },
    });

    expect(response.headers.get("x-request-id")).toBe("caller-request-123");
  } finally {
    server.close();
  }
});

test("returns the standard error envelope for an unknown route", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const response = await fetch(`${baseUrl}/api/v1/unknown`);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "The requested route does not exist.",
        details: null,
        requestId: response.headers.get("x-request-id"),
      },
    });
  } finally {
    server.close();
  }
});

test("redacts secrets and connection strings from log context", () => {
  const redacted = redactLogValue({
    password: "visible-password",
    nested: {
      authorization: "Bearer visible-token",
      message: "Failed at postgresql://user:password@localhost:5433/database",
    },
  });

  expect(redacted).toEqual({
    password: "[REDACTED]",
    nested: {
      authorization: "[REDACTED]",
      message: "Failed at [REDACTED_DATABASE_URL]",
    },
  });
});

test("GET /api/v1/health/database verifies PostgreSQL", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const response = await fetch(`${baseUrl}/api/v1/health/database`);
    const body = DatabaseHealthResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "ok",
      service: "database",
    });
  } finally {
    server.close();
  }
});
