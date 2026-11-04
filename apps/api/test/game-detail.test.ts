import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  ErrorResponseSchema,
  GameDetailResponseSchema,
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
let publicGameId: string;
let ownPrivateGameId: string;
let otherPrivateGameId: string;
let archivedGameId: string;

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
  const registration = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: `game-detail-owner-${suffix}@example.com`,
      username: `game_detail_owner_${suffix}`,
      password: "a sufficiently long game detail password",
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
      `game-detail-outsider-${suffix}@example.com`,
      `game_detail_outsider_${suffix}`,
      "test-password-hash",
    ],
  );
  outsiderId = outsider.rows[0]?.id ?? "";

  const inserted = await databasePool.query<{ id: string; name: string }>(
    `INSERT INTO games (
       name, description, publication_year, min_players, max_players,
       classification_code, visibility_code, moderation_status_code,
       created_by_user_id, created_at, updated_at, archived_at
     ) VALUES
       ('Detail Public', 'Public description', 2020, 2, 4,
        'OFFICIAL', 'PUBLIC', 'APPROVED', NULL,
        '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL),
       ('Detail Own Private', NULL, NULL, 1, 2,
        'PRIVATE', 'PRIVATE', 'DRAFT', $1,
        '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z', NULL),
       ('Detail Other Private', NULL, NULL, 1, 2,
        'PRIVATE', 'PRIVATE', 'DRAFT', $2,
        '2026-03-01T00:00:00Z', '2026-03-01T00:00:00Z', NULL),
       ('Detail Archived', NULL, 2019, 2, 5,
        'OFFICIAL', 'PUBLIC', 'ARCHIVED', NULL,
        '2026-04-01T00:00:00Z', '2026-04-01T00:00:00Z', '2026-05-01T00:00:00Z')
     RETURNING id, name`,
    [ownerId, outsiderId],
  );
  const ids = new Map(inserted.rows.map((row) => [row.name, row.id]));
  publicGameId = ids.get("Detail Public") ?? "";
  ownPrivateGameId = ids.get("Detail Own Private") ?? "";
  otherPrivateGameId = ids.get("Detail Other Private") ?? "";
  archivedGameId = ids.get("Detail Archived") ?? "";

  await databasePool.query(
    `INSERT INTO game_editions (
       game_id, edition_name, edition_number, language_code,
       publication_year, isbn, notes, created_at
     ) VALUES
       ($1, 'First edition', '1', 'es', 2020, 'ISBN-ONE', 'First',
        '2026-01-02T00:00:00Z'),
       ($1, 'Second edition', '2', 'en', 2021, 'ISBN-TWO', 'Second',
        '2026-01-03T00:00:00Z')`,
    [publicGameId],
  );
});

afterAll(async () => {
  await databasePool.query(
    "DELETE FROM game_editions WHERE game_id = ANY($1::uuid[])",
    [[publicGameId, ownPrivateGameId, otherPrivateGameId, archivedGameId]],
  );
  await databasePool.query("DELETE FROM games WHERE id = ANY($1::uuid[])", [
    [publicGameId, ownPrivateGameId, otherPrivateGameId, archivedGameId],
  ]);
  await databasePool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
    [ownerId, outsiderId],
  ]);
  server.close();
  await closeDatabase();
});

async function detailRequest(gameId: string, cookie?: string) {
  return fetch(`${baseUrl}/api/v1/games/${gameId}`, {
    headers: {
      origin: apiConfig.webOrigin,
      ...(cookie === undefined ? {} : { cookie }),
    },
  });
}

test("returns an approved public game and only its ordered editions", async () => {
  const response = await detailRequest(publicGameId);
  const body = GameDetailResponseSchema.parse(await response.json());

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(body.game.name).toBe("Detail Public");
  expect(body.game.isOwnedByViewer).toBe(false);
  expect(body.game.editions.map(({ editionName }) => editionName)).toEqual([
    "First edition",
    "Second edition",
  ]);
  expect(body.game.editions.every((edition) => edition.id.length > 0)).toBe(
    true,
  );
});

test("returns an owned private game with an empty edition list", async () => {
  const response = await detailRequest(ownPrivateGameId, sessionCookie);
  const body = GameDetailResponseSchema.parse(await response.json());

  expect(response.status).toBe(200);
  expect(body.game).toMatchObject({
    name: "Detail Own Private",
    visibility: "PRIVATE",
    isOwnedByViewer: true,
    editions: [],
  });
});

test("does not reveal private games owned by another user", async () => {
  const anonymous = await detailRequest(otherPrivateGameId);
  const authenticated = await detailRequest(otherPrivateGameId, sessionCookie);

  for (const response of [anonymous, authenticated]) {
    const body = ErrorResponseSchema.parse(await response.json());
    expect(response.status).toBe(404);
    expect(body.error.code).toBe("GAME_NOT_FOUND");
  }
});

test("hides archived and unknown games with the same public error", async () => {
  for (const gameId of [archivedGameId, randomUUID()]) {
    const response = await detailRequest(gameId, sessionCookie);
    const body = ErrorResponseSchema.parse(await response.json());
    expect(response.status).toBe(404);
    expect(body.error.code).toBe("GAME_NOT_FOUND");
  }
});

test("rejects malformed game IDs", async () => {
  const response = await detailRequest("not-a-uuid");
  const body = ErrorResponseSchema.parse(await response.json());

  expect(response.status).toBe(400);
  expect(body.error.code).toBe("VALIDATION_ERROR");
});
