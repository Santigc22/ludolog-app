import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  CurrentSessionResponseSchema,
  ErrorResponseSchema,
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
const createdEmails: string[] = [];
let registeredUserId: string;
let registeredEmail: string;
const registeredPassword = "a sufficiently long password";
let activeCookie: string;
let activeCsrfToken: string;

beforeAll(async () => {
  server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Expected an ephemeral TCP address");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (createdEmails.length > 0) {
    await databasePool.query(
      "DELETE FROM users WHERE email = ANY($1::text[])",
      [createdEmails],
    );
  }
  server.close();
  await closeDatabase();
});

async function postRegistration(body: unknown, origin = apiConfig.webOrigin) {
  return fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
    },
    body: JSON.stringify(body),
  });
}

function cookiePair(setCookie: string): string {
  return setCookie.split(";", 1)[0] ?? "";
}

async function postLogin(body: unknown) {
  return fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: apiConfig.webOrigin,
    },
    body: JSON.stringify(body),
  });
}

async function getMe(cookie?: string) {
  return fetch(`${baseUrl}/api/v1/auth/me`, {
    headers: {
      origin: apiConfig.webOrigin,
      ...(cookie === undefined ? {} : { cookie }),
    },
  });
}

test("registers account, profile, base role and opaque session atomically", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `Player-${suffix}@Example.com`;
  createdEmails.push(email.toLowerCase());

  const response = await postRegistration({
    email,
    username: `Player_${suffix}`,
    password: registeredPassword,
    displayName: "Player One",
  });
  const body = RegisterResponseSchema.parse(await response.json());
  const cookie = response.headers.get("set-cookie") ?? "";

  expect(response.status).toBe(201);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("access-control-allow-origin")).toBe(
    apiConfig.webOrigin,
  );
  expect(cookie).toContain("id=");
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=Lax");
  expect(body.user).toMatchObject({
    email: email.toLowerCase(),
    username: `player_${suffix}`,
    status: "ACTIVE",
    profile: { displayName: "Player One", visibility: "PRIVATE" },
  });
  registeredUserId = body.user.id;
  registeredEmail = body.user.email;
  expect(JSON.stringify(body)).not.toContain("password");

  const persisted = await databasePool.query<{
    password_hash: string;
    role_code: string;
    token_hash: string;
  }>(
    `SELECT users.password_hash, user_roles.role_code, sessions.token_hash
     FROM users
     INNER JOIN profiles ON profiles.user_id = users.id
     INNER JOIN user_roles ON user_roles.user_id = users.id
     INNER JOIN sessions ON sessions.user_id = users.id
     WHERE users.id = $1`,
    [body.user.id],
  );

  expect(persisted.rows[0]?.password_hash).toMatch(/^\$argon2id\$v=19\$/);
  expect(persisted.rows[0]?.role_code).toBe("USER");
  const rawSessionToken = /(?:^|;\s*)id=([^;]+)/.exec(cookie)?.[1];
  expect(rawSessionToken).toBeDefined();
  expect(persisted.rows[0]?.token_hash).toBe(
    createHash("sha256")
      .update(rawSessionToken ?? "")
      .digest("hex"),
  );
});

test("uses the same public error for unknown email and wrong password", async () => {
  const wrongPassword = await postLogin({
    email: registeredEmail,
    password: "this password is incorrect",
  });
  const unknownEmail = await postLogin({
    email: `missing-${randomUUID()}@example.com`,
    password: "this password is incorrect",
  });
  const wrongBody = ErrorResponseSchema.parse(await wrongPassword.json());
  const unknownBody = ErrorResponseSchema.parse(await unknownEmail.json());

  expect(wrongPassword.status).toBe(401);
  expect(unknownEmail.status).toBe(401);
  expect(wrongBody.error.code).toBe("AUTHENTICATION_FAILED");
  expect(unknownBody.error.code).toBe("AUTHENTICATION_FAILED");
  expect(wrongBody.error.message).toBe(unknownBody.error.message);
});

test("rate limits repeated login failures by IP and identifier", async () => {
  const email = `limited-${randomUUID()}@example.com`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await postLogin({
      email,
      password: "this password is incorrect",
    });
    expect(response.status).toBe(401);
  }

  const limited = await postLogin({
    email,
    password: "this password is incorrect",
  });
  const body = ErrorResponseSchema.parse(await limited.json());

  expect(limited.status).toBe(429);
  expect(body.error.code).toBe("TOO_MANY_LOGIN_ATTEMPTS");
});

test("logs in and creates a fresh opaque session", async () => {
  const response = await postLogin({
    email: registeredEmail.toUpperCase(),
    password: registeredPassword,
  });
  const body = RegisterResponseSchema.parse(await response.json());
  const setCookie = response.headers.get("set-cookie") ?? "";

  expect(response.status).toBe(200);
  expect(body.user.id).toBe(registeredUserId);
  expect(setCookie).toContain("HttpOnly");
  activeCookie = cookiePair(setCookie);
  activeCsrfToken = body.csrfToken;
});

test("GET /auth/me distinguishes an absent session", async () => {
  const response = await getMe();
  const body = ErrorResponseSchema.parse(await response.json());

  expect(response.status).toBe(401);
  expect(body.error.code).toBe("AUTHENTICATION_REQUIRED");
});

test("GET /auth/me returns the user and renews session activity", async () => {
  const response = await getMe(activeCookie);
  const body = CurrentSessionResponseSchema.parse(await response.json());

  expect(response.status).toBe(200);
  expect(body.user.id).toBe(registeredUserId);
});

test("GET /auth/me identifies an expired session", async () => {
  const rawToken = randomUUID();
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const csrfHash = createHash("sha256").update(randomUUID()).digest("hex");

  await databasePool.query(
    `INSERT INTO sessions (
       user_id, token_hash, csrf_token_hash, idle_expires_at,
       absolute_expires_at
     ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP - INTERVAL '2 days',
               CURRENT_TIMESTAMP - INTERVAL '1 day')`,
    [registeredUserId, tokenHash, csrfHash],
  );

  const response = await getMe(`id=${rawToken}`);
  const body = ErrorResponseSchema.parse(await response.json());

  expect(response.status).toBe(401);
  expect(body.error.code).toBe("SESSION_EXPIRED");
});

test("logout requires CSRF and revokes the current session", async () => {
  const rejected = await fetch(`${baseUrl}/api/v1/auth/logout`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      cookie: activeCookie,
      "x-csrf-token": "invalid-token",
    },
  });
  const rejectedBody = ErrorResponseSchema.parse(await rejected.json());

  expect(rejected.status).toBe(403);
  expect(rejectedBody.error.code).toBe("CSRF_TOKEN_INVALID");

  const response = await fetch(`${baseUrl}/api/v1/auth/logout`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      cookie: activeCookie,
      "x-csrf-token": activeCsrfToken,
    },
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ loggedOut: true });
  expect(response.headers.get("set-cookie")).toContain("id=;");

  const afterLogout = await getMe(activeCookie);
  const afterLogoutBody = ErrorResponseSchema.parse(await afterLogout.json());
  expect(afterLogout.status).toBe(401);
  expect(afterLogoutBody.error.code).toBe("SESSION_INVALID");
});

test("returns a stable conflict without exposing SQL details", async () => {
  const email = createdEmails[0];

  if (email === undefined) {
    throw new Error("Registration fixture was not created");
  }

  const response = await postRegistration({
    email: email.toUpperCase(),
    username: `another_${randomUUID().slice(0, 8)}`,
    password: "another sufficiently long password",
  });
  const body = ErrorResponseSchema.parse(await response.json());

  expect(response.status).toBe(409);
  expect(body.error.code).toBe("IDENTITY_ALREADY_EXISTS");
  expect(JSON.stringify(body)).not.toContain("users_email_normalized_unique");
});

test("rejects invalid input before persistence", async () => {
  const response = await postRegistration({
    email: "invalid",
    username: "x",
    password: "short",
  });
  const body = ErrorResponseSchema.parse(await response.json());

  expect(response.status).toBe(400);
  expect(body.error.code).toBe("VALIDATION_ERROR");
});

test("rejects registration from an untrusted origin", async () => {
  const response = await postRegistration(
    {
      email: `blocked-${randomUUID()}@example.com`,
      username: `blocked_${randomUUID().slice(0, 8)}`,
      password: "another sufficiently long password",
    },
    "https://attacker.example",
  );
  const body = ErrorResponseSchema.parse(await response.json());

  expect(response.status).toBe(403);
  expect(body.error.code).toBe("ORIGIN_NOT_ALLOWED");
});
