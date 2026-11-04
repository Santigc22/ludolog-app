import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  ErrorResponseSchema,
  RegisterResponseSchema,
} from "@ludoteca/contracts";
import express from "express";
import { afterAll, beforeAll, expect, test } from "vitest";

import { app } from "../src/app.js";
import { apiConfig } from "../src/config/environment.js";
import {
  closeDatabase,
  databasePool,
} from "../src/infrastructure/database/index.js";
import { requireAuth } from "../src/middleware/authentication.js";
import { requirePermission } from "../src/middleware/authorization.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { requestId } from "../src/middleware/request-id.js";

let registrationServer: Server;
let probeServer: Server;
let probeBaseUrl: string;
let email: string;
let sessionCookie: string;
let authenticatedUserId: string;

async function listen(server: Server): Promise<string> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Expected an ephemeral TCP address");
  }

  return `http://127.0.0.1:${address.port}`;
}

beforeAll(async () => {
  registrationServer = createServer(app);
  const registrationBaseUrl = await listen(registrationServer);
  const suffix = randomUUID().slice(0, 8);
  email = `middleware-${suffix}@example.com`;
  const registration = await fetch(
    `${registrationBaseUrl}/api/v1/auth/register`,
    {
      method: "POST",
      headers: {
        origin: apiConfig.webOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email,
        username: `middleware_${suffix}`,
        password: "a sufficiently long middleware password",
      }),
    },
  );
  const registered = RegisterResponseSchema.parse(await registration.json());
  const setCookie = registration.headers.get("set-cookie") ?? "";
  authenticatedUserId = registered.user.id;
  sessionCookie = setCookie.split(";", 1)[0] ?? "";

  const probe = express();
  probe.use(requestId);
  probe.get(
    "/allowed",
    requireAuth,
    requirePermission("profile.update"),
    (request, response) => {
      response.status(200).json({ userId: request.auth?.userId });
    },
  );
  probe.get(
    "/forbidden",
    requireAuth,
    requirePermission("user.manage"),
    (_request, response) => {
      response.sendStatus(204);
    },
  );
  probe.get(
    "/resources/:ownerId",
    requireAuth,
    requirePermission("profile.update"),
    (request, response) => {
      response.status(200).json({
        authenticatedUserId: request.auth?.userId,
        ownerId: request.params.ownerId,
      });
    },
  );
  probe.use(errorHandler);
  probeServer = createServer(probe);
  probeBaseUrl = await listen(probeServer);
});

afterAll(async () => {
  await databasePool.query("DELETE FROM users WHERE email = $1", [email]);
  registrationServer.close();
  probeServer.close();
  await closeDatabase();
});

test("requireAuth rejects a missing session with 401", async () => {
  const response = await fetch(`${probeBaseUrl}/allowed`);
  const body = ErrorResponseSchema.parse(await response.json());

  expect(response.status).toBe(401);
  expect(body.error.code).toBe("AUTHENTICATION_REQUIRED");
});

test("requirePermission allows an effective permission", async () => {
  const response = await fetch(`${probeBaseUrl}/allowed`, {
    headers: { cookie: sessionCookie },
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ userId: authenticatedUserId });
});

test("requirePermission rejects a missing permission with 403", async () => {
  const response = await fetch(`${probeBaseUrl}/forbidden`, {
    headers: { cookie: sessionCookie },
  });
  const body = ErrorResponseSchema.parse(await response.json());

  expect(response.status).toBe(403);
  expect(body.error.code).toBe("PERMISSION_DENIED");
});

test("RBAC middleware does not infer resource ownership", async () => {
  const differentOwnerId = randomUUID();
  const response = await fetch(
    `${probeBaseUrl}/resources/${differentOwnerId}`,
    { headers: { cookie: sessionCookie } },
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    authenticatedUserId,
    ownerId: differentOwnerId,
  });
});
