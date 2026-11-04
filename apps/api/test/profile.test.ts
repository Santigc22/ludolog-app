import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  ErrorResponseSchema,
  OwnProfileResponseSchema,
  RegisterResponseSchema,
} from "@ludoteca/contracts";
import { afterAll, beforeAll, expect, test } from "vitest";

import { app } from "../src/app.js";
import { apiConfig } from "../src/config/environment.js";
import {
  closeDatabase,
  databasePool,
} from "../src/infrastructure/database/index.js";

let baseUrl: string;
let server: Server;
let email: string;
let userId: string;
let sessionCookie: string;
let csrfToken: string;

beforeAll(async () => {
  server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Expected an ephemeral TCP address");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
  const suffix = randomUUID().slice(0, 8);
  email = `profile-${suffix}@example.com`;
  const registration = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      username: `profile_${suffix}`,
      password: "a sufficiently long profile password",
      displayName: "Initial name",
    }),
  });
  const body = RegisterResponseSchema.parse(await registration.json());
  const setCookie = registration.headers.get("set-cookie") ?? "";

  userId = body.user.id;
  csrfToken = body.csrfToken;
  sessionCookie = setCookie.split(";", 1)[0] ?? "";
});

afterAll(async () => {
  await databasePool.query("DELETE FROM users WHERE email = $1", [email]);
  server.close();
  await closeDatabase();
});

async function profileRequest(
  method: "GET" | "PATCH",
  body?: unknown,
  csrf = csrfToken,
) {
  return fetch(`${baseUrl}/api/v1/profiles/me`, {
    method,
    headers: {
      origin: apiConfig.webOrigin,
      cookie: sessionCookie,
      ...(method === "PATCH"
        ? { "content-type": "application/json", "x-csrf-token": csrf }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("reads the profile belonging to the authenticated user", async () => {
  const response = await profileRequest("GET");
  const body = OwnProfileResponseSchema.parse(await response.json());

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(body.profile).toMatchObject({
    userId,
    displayName: "Initial name",
    bio: null,
    avatarUrl: null,
    locationText: null,
    visibility: "PRIVATE",
  });
});

test("updates only editable profile fields", async () => {
  const response = await profileRequest("PATCH", {
    displayName: " Updated name ",
    bio: "Board-game enthusiast",
    avatarUrl: "https://example.com/avatar.png",
    locationText: "Bogotá",
    visibility: "PUBLIC",
  });
  const body = OwnProfileResponseSchema.parse(await response.json());

  expect(response.status).toBe(200);
  expect(body.profile).toMatchObject({
    userId,
    displayName: "Updated name",
    bio: "Board-game enthusiast",
    avatarUrl: "https://example.com/avatar.png",
    locationText: "Bogotá",
    visibility: "PUBLIC",
  });

  const identity = await databasePool.query<{
    email: string;
    role_code: string;
  }>(
    `SELECT users.email, user_roles.role_code
     FROM users
     INNER JOIN user_roles ON user_roles.user_id = users.id
     WHERE users.id = $1`,
    [userId],
  );
  expect(identity.rows[0]).toEqual({ email, role_code: "USER" });
});

test("rejects identity and authorization fields", async () => {
  const response = await profileRequest("PATCH", {
    displayName: "Allowed value",
    email: "attacker@example.com",
    role: "ADMIN",
  });
  const body = ErrorResponseSchema.parse(await response.json());

  expect(response.status).toBe(400);
  expect(body.error.code).toBe("VALIDATION_ERROR");
});

test("rejects unsupported visibility and unsafe avatar protocols", async () => {
  const invalidVisibility = await profileRequest("PATCH", {
    visibility: "GROUP",
  });
  const unsafeAvatar = await profileRequest("PATCH", {
    avatarUrl: "javascript:alert(1)",
  });

  expect(invalidVisibility.status).toBe(400);
  expect(unsafeAvatar.status).toBe(400);
});

test("requires authentication and CSRF protection", async () => {
  const anonymous = await fetch(`${baseUrl}/api/v1/profiles/me`, {
    headers: { origin: apiConfig.webOrigin },
  });
  const invalidCsrf = await profileRequest(
    "PATCH",
    { displayName: "Must not change" },
    "invalid-token",
  );
  const anonymousBody = ErrorResponseSchema.parse(await anonymous.json());
  const csrfBody = ErrorResponseSchema.parse(await invalidCsrf.json());

  expect(anonymous.status).toBe(401);
  expect(anonymousBody.error.code).toBe("AUTHENTICATION_REQUIRED");
  expect(invalidCsrf.status).toBe(403);
  expect(csrfBody.error.code).toBe("CSRF_TOKEN_INVALID");
});
