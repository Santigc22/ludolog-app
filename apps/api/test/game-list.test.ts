import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  ErrorResponseSchema,
  GameListResponseSchema,
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
let outsiderId: string;
let sessionCookie: string;
let insertedGameIds: string[] = [];
let insertedMechanicId: string;
let listToken: string;

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
  listToken = suffix;
  const registration = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: `game-list-owner-${suffix}@example.com`,
      username: `game_list_owner_${suffix}`,
      password: "a sufficiently long game listing password",
    }),
  });
  const registered = RegisterResponseSchema.parse(await registration.json());
  ownerId = registered.user.id;
  sessionCookie =
    (registration.headers.get("set-cookie") ?? "").split(";", 1)[0] ?? "";

  const outsider = await databasePool.query<{ id: string }>(
    `INSERT INTO users (email, username, password_hash, status_code)
     VALUES ($1, $2, $3, 'ACTIVE') RETURNING id`,
    [
      `game-list-outsider-${suffix}@example.com`,
      `game_list_outsider_${suffix}`,
      "test-password-hash",
    ],
  );
  outsiderId = outsider.rows[0]?.id ?? "";

  const inserted = await databasePool.query<{ id: string }>(
    `INSERT INTO games (
       name, publication_year, min_players, max_players,
       classification_code, visibility_code, moderation_status_code,
       created_by_user_id, created_at, updated_at, archived_at
     ) VALUES
       ('Alpha Public ' || $3, 2010, 2, 4, 'OFFICIAL', 'PUBLIC', 'APPROVED', NULL,
        '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL),
       ('Newest Public ' || $3, 2020, 1, 5, 'COMMUNITY', 'PUBLIC', 'APPROVED', $1,
        '2026-03-01T00:00:00Z', '2026-03-01T00:00:00Z', NULL),
       ('My Private Prototype ' || $3, NULL, 1, 2, 'PRIVATE', 'PRIVATE', 'DRAFT', $1,
        '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z', NULL),
       ('Other Private Prototype ' || $3, NULL, 1, 2, 'PRIVATE', 'PRIVATE', 'DRAFT', $2,
        '2026-04-01T00:00:00Z', '2026-04-01T00:00:00Z', NULL),
       ('Archived Public ' || $3, 2025, 2, 4, 'OFFICIAL', 'PUBLIC', 'ARCHIVED', NULL,
        '2026-05-01T00:00:00Z', '2026-05-01T00:00:00Z', '2026-06-01T00:00:00Z'),
       ('100% Fun ' || $3, 2015, 2, 6, 'OFFICIAL', 'PUBLIC', 'APPROVED', NULL,
        '2026-02-15T00:00:00Z', '2026-02-15T00:00:00Z', NULL)
     RETURNING id`,
    [ownerId, outsiderId, listToken],
  );
  insertedGameIds = inserted.rows.map(({ id }) => id);

  const mechanic = await databasePool.query<{ id: string }>(
    `INSERT INTO mechanics (name) VALUES ($1) RETURNING id`,
    [`Strategy ${listToken}`],
  );
  insertedMechanicId = mechanic.rows[0]!.id;
  await databasePool.query(
    `INSERT INTO game_mechanics (game_id, mechanic_id)
     VALUES ($1, $3), ($2, $3)`,
    [insertedGameIds[0], insertedGameIds[5], insertedMechanicId],
  );
});

afterAll(async () => {
  await databasePool.query("DELETE FROM games WHERE id = ANY($1::uuid[])", [
    insertedGameIds,
  ]);
  await databasePool.query("DELETE FROM mechanics WHERE id = $1", [
    insertedMechanicId,
  ]);
  await databasePool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
    [ownerId, outsiderId],
  ]);
  server.close();
  await closeDatabase();
});

async function listGames(query = "", cookie?: string) {
  return fetch(`${baseUrl}/api/v1/games${query}`, {
    headers: {
      origin: apiConfig.webOrigin,
      ...(cookie === undefined ? {} : { cookie }),
    },
  });
}

test("anonymous viewers see only active approved public games", async () => {
  const response = await listGames(`?q=${listToken}`);
  const body = GameListResponseSchema.parse(await response.json());

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(body.games.map(({ name }) => name)).toEqual([
    `100% Fun ${listToken}`,
    `Alpha Public ${listToken}`,
    `Newest Public ${listToken}`,
  ]);
  expect(body.games.every(({ isOwnedByViewer }) => !isOwnedByViewer)).toBe(
    true,
  );
});

test("authenticated viewers additionally see only their private games", async () => {
  const response = await listGames(`?q=${listToken}`, sessionCookie);
  const body = GameListResponseSchema.parse(await response.json());

  expect(body.games.map(({ name }) => name)).toEqual([
    `100% Fun ${listToken}`,
    `Alpha Public ${listToken}`,
    `My Private Prototype ${listToken}`,
    `Newest Public ${listToken}`,
  ]);
  expect(
    body.games.find(({ name }) => name === `My Private Prototype ${listToken}`),
  ).toMatchObject({
    visibility: "PRIVATE",
    moderationStatus: "DRAFT",
    isOwnedByViewer: true,
  });
  expect(body.games.map(({ name }) => name)).not.toContain(
    `Other Private Prototype ${listToken}`,
  );
});

test("search is case-insensitive and treats wildcard characters literally", async () => {
  const regular = GameListResponseSchema.parse(
    await (await listGames("?q=ALPHA")).json(),
  );
  const literal = GameListResponseSchema.parse(
    await (await listGames("?q=%25")).json(),
  );

  expect(regular.games.map(({ name }) => name)).toEqual([
    `Alpha Public ${listToken}`,
  ]);
  expect(literal.games.map(({ name }) => name)).toEqual([
    `100% Fun ${listToken}`,
  ]);
});

test("filters open capacity limits and exact recorded player ranges", async () => {
  const supportsAtLeastFour = GameListResponseSchema.parse(
    await (
      await listGames(`?q=${listToken}&mechanic=STRATEGY&minPlayers=4`)
    ).json(),
  );
  const exactRecordedRange = GameListResponseSchema.parse(
    await (
      await listGames(
        `?q=${listToken}&mechanic=STRATEGY&minPlayers=2&maxPlayers=4`,
      )
    ).json(),
  );
  const missingExactRange = GameListResponseSchema.parse(
    await (
      await listGames(
        `?q=${listToken}&mechanic=STRATEGY&minPlayers=1&maxPlayers=4`,
      )
    ).json(),
  );
  const supportsAtLeastFive = GameListResponseSchema.parse(
    await (
      await listGames(`?q=${listToken}&mechanic=strategy&minPlayers=5`)
    ).json(),
  );

  expect(supportsAtLeastFour.games.map(({ name }) => name)).toEqual([
    `100% Fun ${listToken}`,
    `Alpha Public ${listToken}`,
  ]);
  expect(exactRecordedRange.games.map(({ name }) => name)).toEqual([
    `Alpha Public ${listToken}`,
  ]);
  expect(exactRecordedRange.games[0]?.mechanics).toEqual([
    `Strategy ${listToken}`,
  ]);
  expect(missingExactRange.games).toEqual([]);
  expect(supportsAtLeastFive.games.map(({ name }) => name)).toEqual([
    `100% Fun ${listToken}`,
  ]);
});

test("supports deterministic sorting and pagination", async () => {
  const newest = GameListResponseSchema.parse(
    await (
      await listGames(
        `?q=${listToken}&sort=newest&page=1&pageSize=2`,
        sessionCookie,
      )
    ).json(),
  );
  const byYear = GameListResponseSchema.parse(
    await (
      await listGames(
        `?q=${listToken}&sort=publicationYear&page=2&pageSize=2`,
        sessionCookie,
      )
    ).json(),
  );

  expect(newest.games.map(({ name }) => name)).toEqual([
    `Newest Public ${listToken}`,
    `100% Fun ${listToken}`,
  ]);
  expect(newest.pagination).toEqual({
    page: 1,
    pageSize: 2,
    totalItems: 4,
    totalPages: 2,
  });
  expect(byYear.games.map(({ name }) => name)).toEqual([
    `Alpha Public ${listToken}`,
    `My Private Prototype ${listToken}`,
  ]);
});

test("rejects unknown and out-of-range query parameters", async () => {
  for (const query of [
    "?sort=popular",
    "?page=0",
    "?pageSize=101",
    "?q=%20%20",
    "?minPlayers=6&maxPlayers=4",
    "?unknown=value",
  ]) {
    const response = await listGames(query);
    const body = ErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  }
});
