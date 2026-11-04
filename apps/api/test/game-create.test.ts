import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  CreatePrivateGameResponseSchema,
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
let ownerId: string;
let ownerCookie: string;
let ownerCsrfToken: string;
let deniedUserId: string;
let deniedCookie: string;
let deniedCsrfToken: string;

async function registerUser(label: string) {
  const suffix = randomUUID().slice(0, 8);
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: `game-create-${label}-${suffix}@example.com`,
      username: `game_create_${label}_${suffix}`,
      password: "a sufficiently long private game password",
    }),
  });
  const body = RegisterResponseSchema.parse(await response.json());

  return {
    userId: body.user.id,
    csrfToken: body.csrfToken,
    cookie: (response.headers.get("set-cookie") ?? "").split(";", 1)[0] ?? "",
  };
}

beforeAll(async () => {
  server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Expected an ephemeral TCP address");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
  const owner = await registerUser("owner");
  ownerId = owner.userId;
  ownerCookie = owner.cookie;
  ownerCsrfToken = owner.csrfToken;

  const denied = await registerUser("denied");
  deniedUserId = denied.userId;
  deniedCookie = denied.cookie;
  deniedCsrfToken = denied.csrfToken;
  await databasePool.query("DELETE FROM user_roles WHERE user_id = $1", [
    deniedUserId,
  ]);
});

afterAll(async () => {
  await databasePool.query(
    "DELETE FROM games WHERE created_by_user_id = ANY($1::uuid[])",
    [[ownerId, deniedUserId]],
  );
  await databasePool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
    [ownerId, deniedUserId],
  ]);
  server.close();
  await closeDatabase();
});

const validBody = {
  name: "My private prototype",
  description: "A game still under design",
  publicationYear: 2026,
  minPlayers: 1,
  maxPlayers: 4,
  minDurationMinutes: 20,
  maxDurationMinutes: 60,
  minAge: 10,
  maxAge: 99,
  complexity: 2.75,
};

async function createRequest(
  body: Record<string, unknown>,
  options: { cookie?: string; csrfToken?: string } = {},
) {
  return fetch(`${baseUrl}/api/v1/games`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
      ...(options.cookie === undefined ? {} : { cookie: options.cookie }),
      ...(options.csrfToken === undefined
        ? {}
        : { "x-csrf-token": options.csrfToken }),
    },
    body: JSON.stringify(body),
  });
}

test("creates an immediately usable private game owned by the actor", async () => {
  const response = await createRequest(validBody, {
    cookie: ownerCookie,
    csrfToken: ownerCsrfToken,
  });
  const body = CreatePrivateGameResponseSchema.parse(await response.json());

  expect(response.status).toBe(201);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(body.game).toMatchObject({
    name: validBody.name,
    classification: "PRIVATE",
    visibility: "PRIVATE",
    moderationStatus: "DRAFT",
    isOwnedByViewer: true,
    editions: [],
  });

  const persisted = await databasePool.query<{
    created_by_user_id: string;
    visibility_code: string;
  }>("SELECT created_by_user_id, visibility_code FROM games WHERE id = $1", [
    body.game.id,
  ]);
  expect(persisted.rows[0]).toEqual({
    created_by_user_id: ownerId,
    visibility_code: "PRIVATE",
  });

  const detail = await fetch(`${baseUrl}/api/v1/games/${body.game.id}`, {
    headers: { origin: apiConfig.webOrigin, cookie: ownerCookie },
  });
  expect(detail.status).toBe(200);
});

test("allows duplicate names without impersonating moderation", async () => {
  const responses = await Promise.all([
    createRequest(
      { name: "Shared candidate name", minPlayers: 2, maxPlayers: 4 },
      { cookie: ownerCookie, csrfToken: ownerCsrfToken },
    ),
    createRequest(
      { name: "Shared candidate name", minPlayers: 3, maxPlayers: 6 },
      { cookie: ownerCookie, csrfToken: ownerCsrfToken },
    ),
  ]);

  expect(responses.map(({ status }) => status)).toEqual([201, 201]);
  const games = await Promise.all(
    responses.map(async (response) =>
      CreatePrivateGameResponseSchema.parse(await response.json()),
    ),
  );
  expect(new Set(games.map(({ game }) => game.id)).size).toBe(2);
});

test("rejects invalid ranges and any attempt to self-publish", async () => {
  for (const body of [
    { name: "Invalid", minPlayers: 4, maxPlayers: 2 },
    {
      name: "Self published",
      minPlayers: 1,
      maxPlayers: 2,
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
    },
  ]) {
    const response = await createRequest(body, {
      cookie: ownerCookie,
      csrfToken: ownerCsrfToken,
    });
    const error = ErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(400);
    expect(error.error.code).toBe("VALIDATION_ERROR");
  }
});

test("requires authentication, permission, and a valid CSRF token", async () => {
  const anonymous = await createRequest(validBody);
  const invalidCsrf = await createRequest(validBody, {
    cookie: ownerCookie,
    csrfToken: "invalid-token",
  });
  const denied = await createRequest(validBody, {
    cookie: deniedCookie,
    csrfToken: deniedCsrfToken,
  });

  expect(anonymous.status).toBe(401);
  expect(invalidCsrf.status).toBe(403);
  expect(denied.status).toBe(403);
  expect(ErrorResponseSchema.parse(await denied.json()).error.code).toBe(
    "PERMISSION_DENIED",
  );
});
