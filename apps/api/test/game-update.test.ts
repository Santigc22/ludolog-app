import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  ErrorResponseSchema,
  GameDetailResponseSchema,
  RegisterResponseSchema,
  UpdatePublicGameResponseSchema,
} from "@ludoteca/contracts";
import { afterAll, beforeAll, expect, test } from "vitest";

import { app } from "../src/app.js";
import { apiConfig } from "../src/config/environment.js";
import {
  closeDatabase,
  databasePool,
} from "../src/infrastructure/database/index.js";

type TestUser = Readonly<{
  id: string;
  cookie: string;
  csrfToken: string;
}>;

let baseUrl: string;
let server: Server;
let manager: TestUser;
let ordinaryUser: TestUser;
let publicGameId: string;
let privateGameId: string;

async function registerUser(label: string): Promise<TestUser> {
  const suffix = randomUUID().slice(0, 8);
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: `game-update-${label}-${suffix}@example.com`,
      username: `game_update_${label}_${suffix}`,
      password: "a sufficiently long game update password",
    }),
  });
  const body = RegisterResponseSchema.parse(await response.json());
  return {
    id: body.user.id,
    cookie: (response.headers.get("set-cookie") ?? "").split(";", 1)[0] ?? "",
    csrfToken: body.csrfToken,
  };
}

async function updateGame(user: TestUser, gameId: string, body: unknown) {
  return fetch(`${baseUrl}/api/v1/games/${gameId}`, {
    method: "PATCH",
    headers: {
      origin: apiConfig.webOrigin,
      cookie: user.cookie,
      "content-type": "application/json",
      "x-csrf-token": user.csrfToken,
    },
    body: JSON.stringify(body),
  });
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

  manager = await registerUser("manager");
  ordinaryUser = await registerUser("ordinary");
  await databasePool.query("DELETE FROM user_roles WHERE user_id = $1", [
    manager.id,
  ]);
  await databasePool.query(
    `INSERT INTO user_roles (user_id, role_code, assigned_by_user_id)
     VALUES ($1, 'CONTENT_MANAGER', $1)`,
    [manager.id],
  );

  const games = await databasePool.query<{
    id: string;
    visibility_code: string;
  }>(
    `INSERT INTO games (
       name, description, publication_year, min_players, max_players,
       min_duration_minutes, max_duration_minutes, min_age, complexity,
       classification_code, visibility_code, moderation_status_code,
       created_by_user_id
     ) VALUES
       ('Public game to edit', 'Original description', 2020, 2, 4,
        30, 45, 8, 2.10, 'OFFICIAL', 'PUBLIC', 'APPROVED', NULL),
       ('Private game not editable here', NULL, NULL, 1, 2,
        NULL, NULL, NULL, NULL, 'PRIVATE', 'PRIVATE', 'DRAFT', $1)
     RETURNING id, visibility_code`,
    [manager.id],
  );
  publicGameId = games.rows.find(
    ({ visibility_code }) => visibility_code === "PUBLIC",
  )!.id;
  privateGameId = games.rows.find(
    ({ visibility_code }) => visibility_code === "PRIVATE",
  )!.id;
});

afterAll(async () => {
  await databasePool.query(
    "DELETE FROM audit_logs WHERE actor_user_id = ANY($1::uuid[])",
    [[manager.id, ordinaryUser.id]],
  );
  await databasePool.query("DELETE FROM games WHERE id = ANY($1::uuid[])", [
    [publicGameId, privateGameId],
  ]);
  await databasePool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
    [manager.id, ordinaryUser.id],
  ]);
  server.close();
  await closeDatabase();
});

test("allows a content manager to update an approved public game", async () => {
  const detail = await fetch(`${baseUrl}/api/v1/games/${publicGameId}`, {
    headers: { origin: apiConfig.webOrigin, cookie: manager.cookie },
  });
  expect(
    GameDetailResponseSchema.parse(await detail.json()).game.canManageCatalog,
  ).toBe(true);

  const response = await updateGame(manager, publicGameId, {
    name: "Public game corrected",
    description: "Corrected description",
    publicationYear: 2021,
    minPlayers: 2,
    maxPlayers: 5,
    minDurationMinutes: 25,
    maxDurationMinutes: 50,
    minAge: 10,
    maxAge: null,
    complexity: 2.35,
    mechanics: ["Cooperativo", " Gestión de mano ", "cooperativo"],
    categories: [" Robots ", "robots", "Solitario"],
  });
  expect(response.status).toBe(200);
  const updated = UpdatePublicGameResponseSchema.parse(await response.json());
  expect(updated.game).toMatchObject({
    name: "Public game corrected",
    description: "Corrected description",
    publicationYear: 2021,
    minPlayers: 2,
    maxPlayers: 5,
    mechanics: ["Cooperativo", "Gestión de mano"],
    categories: ["Robots", "Solitario"],
    canManageCatalog: true,
  });

  const audit = await databasePool.query<{ action: string }>(
    `SELECT action FROM audit_logs
     WHERE actor_user_id = $1 AND resource_id = $2
     ORDER BY occurred_at DESC LIMIT 1`,
    [manager.id, publicGameId],
  );
  expect(audit.rows[0]?.action).toBe("game.public_updated");
});

test("rejects ordinary users and invalid or non-public updates", async () => {
  const denied = await updateGame(ordinaryUser, publicGameId, {
    name: "Unauthorized change",
  });
  expect(denied.status).toBe(403);

  const invalidRange = await updateGame(manager, publicGameId, {
    maxPlayers: 1,
  });
  expect(invalidRange.status).toBe(400);
  expect(ErrorResponseSchema.parse(await invalidRange.json()).error.code).toBe(
    "GAME_RANGE_INVALID",
  );

  const privateUpdate = await updateGame(manager, privateGameId, {
    name: "Not through public administration",
  });
  expect(privateUpdate.status).toBe(404);
  expect(ErrorResponseSchema.parse(await privateUpdate.json()).error.code).toBe(
    "PUBLIC_GAME_NOT_FOUND",
  );
});
