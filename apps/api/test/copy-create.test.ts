import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  CreateCopyResponseSchema,
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

let server: Server;
let baseUrl: string;
let ownerId: string;
let ownerCookie: string;
let ownerCsrf: string;
let viewerId: string;
let viewerCookie: string;
let viewerCsrf: string;
let deniedId: string;
let deniedCookie: string;
let deniedCsrf: string;
let collectionId: string;
let archivedCollectionId: string;
let gameId: string;
let otherGameId: string;
let editionId: string;
let otherEditionId: string;

async function register(label: string) {
  const suffix = randomUUID().slice(0, 8);
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: `copy-${label}-${suffix}@example.com`,
      username: `copy_${label}_${suffix}`,
      password: "a sufficiently long copy password",
    }),
  });
  const body = RegisterResponseSchema.parse(await response.json());
  return {
    id: body.user.id,
    csrf: body.csrfToken,
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

  const owner = await register("owner");
  ownerId = owner.id;
  ownerCookie = owner.cookie;
  ownerCsrf = owner.csrf;
  const viewer = await register("viewer");
  viewerId = viewer.id;
  viewerCookie = viewer.cookie;
  viewerCsrf = viewer.csrf;
  const denied = await register("denied");
  deniedId = denied.id;
  deniedCookie = denied.cookie;
  deniedCsrf = denied.csrf;
  await databasePool.query("DELETE FROM user_roles WHERE user_id = $1", [
    deniedId,
  ]);

  const collections = await databasePool.query<{ id: string }>(
    `INSERT INTO collections (
       type_code, status_code, name, visibility_code, created_by_user_id,
       archived_at
     ) VALUES
       ('PERSONAL', 'ACTIVE', 'Copy target', 'PRIVATE', $1, NULL),
       ('PERSONAL', 'ARCHIVED', 'Archived target', 'PRIVATE', $1, CURRENT_TIMESTAMP)
     RETURNING id`,
    [ownerId],
  );
  collectionId = collections.rows[0]!.id;
  archivedCollectionId = collections.rows[1]!.id;
  await databasePool.query(
    `INSERT INTO collection_members (collection_id, user_id, role_code)
     VALUES ($1, $2, 'OWNER'), ($1, $3, 'VIEWER'), ($4, $2, 'OWNER')`,
    [collectionId, ownerId, viewerId, archivedCollectionId],
  );

  const games = await databasePool.query<{ id: string }>(
    `INSERT INTO games (
       name, min_players, max_players, classification_code,
       visibility_code, moderation_status_code
     ) VALUES
       ('Copy API game', 1, 4, 'OFFICIAL', 'PUBLIC', 'APPROVED'),
       ('Other copy API game', 2, 5, 'OFFICIAL', 'PUBLIC', 'APPROVED')
     RETURNING id`,
  );
  gameId = games.rows[0]!.id;
  otherGameId = games.rows[1]!.id;
  const editions = await databasePool.query<{ id: string; game_id: string }>(
    `INSERT INTO game_editions (game_id, edition_name)
     VALUES ($1, 'Selected edition'), ($2, 'Wrong edition')
     RETURNING id, game_id`,
    [gameId, otherGameId],
  );
  editionId = editions.rows.find((row) => row.game_id === gameId)!.id;
  otherEditionId = editions.rows.find((row) => row.game_id === otherGameId)!.id;
});

afterAll(async () => {
  await databasePool.query(
    "DELETE FROM audit_logs WHERE actor_user_id = ANY($1::uuid[])",
    [[ownerId, viewerId, deniedId]],
  );
  await databasePool.query(
    "DELETE FROM acquisitions WHERE acquired_by_user_id = ANY($1::uuid[])",
    [[ownerId, viewerId, deniedId]],
  );
  await databasePool.query(
    "DELETE FROM copy_collection_history WHERE changed_by_user_id = ANY($1::uuid[])",
    [[ownerId, viewerId, deniedId]],
  );
  await databasePool.query(
    "DELETE FROM copies WHERE created_by_user_id = ANY($1::uuid[])",
    [[ownerId, viewerId, deniedId]],
  );
  await databasePool.query(
    "DELETE FROM game_editions WHERE game_id = ANY($1::uuid[])",
    [[gameId, otherGameId]],
  );
  await databasePool.query("DELETE FROM games WHERE id = ANY($1::uuid[])", [
    [gameId, otherGameId],
  ]);
  await databasePool.query(
    "DELETE FROM collections WHERE id = ANY($1::uuid[])",
    [[collectionId, archivedCollectionId]],
  );
  await databasePool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
    [ownerId, viewerId, deniedId],
  ]);
  server.close();
  await closeDatabase();
});

async function requestCopy(
  targetCollectionId: string,
  body: Record<string, unknown>,
  auth: { cookie?: string; csrf?: string } = {},
) {
  return fetch(`${baseUrl}/api/v1/collections/${targetCollectionId}/copies`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
      ...(auth.cookie ? { cookie: auth.cookie } : {}),
      ...(auth.csrf ? { "x-csrf-token": auth.csrf } : {}),
    },
    body: JSON.stringify(body),
  });
}

test("creates a copy, open history, optional acquisition and audit atomically", async () => {
  const response = await requestCopy(
    collectionId,
    {
      gameId,
      gameEditionId: editionId,
      condition: "LIKE_NEW",
      alias: "Mesa principal",
      acquisition: {
        type: "PURCHASE",
        acquiredOn: "2026-09-22",
        priceAmount: 120000,
        currencyCode: "cop",
        sourceName: "Tienda local",
      },
    },
    { cookie: ownerCookie, csrf: ownerCsrf },
  );
  const body = CreateCopyResponseSchema.parse(await response.json());

  expect(response.status).toBe(201);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(body.copy).toMatchObject({
    gameId,
    gameEditionId: editionId,
    currentCollectionId: collectionId,
    lifecycle: "ACTIVE",
    condition: "LIKE_NEW",
    createdByUserId: ownerId,
  });
  expect(body.acquisition).toMatchObject({
    copyId: body.copy.id,
    collectionId,
    type: "PURCHASE",
    currencyCode: "COP",
  });

  const related = await databasePool.query<{
    history_count: string;
    acquisition_count: string;
    audit_count: string;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM copy_collection_history WHERE copy_id = $1 AND ended_at IS NULL)::text AS history_count,
       (SELECT COUNT(*) FROM acquisitions WHERE copy_id = $1)::text AS acquisition_count,
       (SELECT COUNT(*) FROM audit_logs WHERE resource_type = 'COPY' AND resource_id = $1)::text AS audit_count`,
    [body.copy.id],
  );
  expect(related.rows[0]).toEqual({
    history_count: "1",
    acquisition_count: "1",
    audit_count: "1",
  });
});

test("creates without acquisition and applies the default condition", async () => {
  const response = await requestCopy(
    collectionId,
    { gameId },
    { cookie: ownerCookie, csrf: ownerCsrf },
  );
  const body = CreateCopyResponseSchema.parse(await response.json());

  expect(response.status).toBe(201);
  expect(body.copy.condition).toBe("GOOD");
  expect(body.copy.gameEditionId).toBeNull();
  expect(body.acquisition).toBeNull();
});

test("rejects an edition from another game and invisible games", async () => {
  const wrongEdition = await requestCopy(
    collectionId,
    { gameId, gameEditionId: otherEditionId },
    { cookie: ownerCookie, csrf: ownerCsrf },
  );
  expect(wrongEdition.status).toBe(400);
  expect(ErrorResponseSchema.parse(await wrongEdition.json()).error.code).toBe(
    "GAME_EDITION_NOT_FOUND",
  );

  const privateGame = await databasePool.query<{ id: string }>(
    `INSERT INTO games (
       name, min_players, max_players, classification_code,
       visibility_code, moderation_status_code, created_by_user_id
     ) VALUES ('Viewer private game', 1, 2, 'PRIVATE', 'PRIVATE', 'DRAFT', $1)
     RETURNING id`,
    [viewerId],
  );
  const privateGameId = privateGame.rows[0]!.id;
  const invisible = await requestCopy(
    collectionId,
    { gameId: privateGameId },
    { cookie: ownerCookie, csrf: ownerCsrf },
  );
  expect(invisible.status).toBe(404);
  await databasePool.query("DELETE FROM games WHERE id = $1", [privateGameId]);
});

test("enforces collection access, active state, permission, authentication and CSRF", async () => {
  const body = { gameId };
  const viewer = await requestCopy(collectionId, body, {
    cookie: viewerCookie,
    csrf: viewerCsrf,
  });
  const archived = await requestCopy(archivedCollectionId, body, {
    cookie: ownerCookie,
    csrf: ownerCsrf,
  });
  const denied = await requestCopy(collectionId, body, {
    cookie: deniedCookie,
    csrf: deniedCsrf,
  });
  const anonymous = await requestCopy(collectionId, body);
  const invalidCsrf = await requestCopy(collectionId, body, {
    cookie: ownerCookie,
    csrf: "invalid-token",
  });

  expect(viewer.status).toBe(403);
  expect(archived.status).toBe(409);
  expect(denied.status).toBe(403);
  expect(anonymous.status).toBe(401);
  expect(invalidCsrf.status).toBe(403);
});

test("rejects server-owned lifecycle fields", async () => {
  const response = await requestCopy(
    collectionId,
    { gameId, lifecycle: "EXITED", currentCollectionId: null },
    { cookie: ownerCookie, csrf: ownerCsrf },
  );
  expect(response.status).toBe(400);
  expect(ErrorResponseSchema.parse(await response.json()).error.code).toBe(
    "VALIDATION_ERROR",
  );
});

test("rolls back copy and history if auditing fails", async () => {
  const before = await databasePool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM copies WHERE current_collection_id = $1",
    [collectionId],
  );
  await databasePool.query(`
    CREATE OR REPLACE FUNCTION fail_copy_audit_for_test() RETURNS trigger AS $$
    BEGIN
      IF NEW.action = 'copy.created' THEN
        RAISE EXCEPTION 'forced audit failure';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_copy_audit_for_test
    BEFORE INSERT ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fail_copy_audit_for_test();
  `);

  try {
    const response = await requestCopy(
      collectionId,
      { gameId, alias: "Must roll back" },
      { cookie: ownerCookie, csrf: ownerCsrf },
    );
    expect(response.status).toBe(500);
  } finally {
    await databasePool.query(
      "DROP TRIGGER IF EXISTS fail_copy_audit_for_test ON audit_logs",
    );
    await databasePool.query(
      "DROP FUNCTION IF EXISTS fail_copy_audit_for_test",
    );
  }

  const after = await databasePool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM copies WHERE current_collection_id = $1",
    [collectionId],
  );
  expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
});
