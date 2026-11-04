import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  CopyDetailResponseSchema,
  CopyListResponseSchema,
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
let viewerId: string;
let viewerCookie: string;
let outsiderId: string;
let outsiderCookie: string;
let collectionId: string;
let destinationCollectionId: string;
let gameId: string;
let editionId: string;
let currentCopyId: string;
let exitedCopyId: string;
let movedCopyId: string;
let mechanicId: string;

async function register(label: string) {
  const suffix = randomUUID().slice(0, 8);
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: `copy-read-${label}-${suffix}@example.com`,
      username: `copy_read_${label}_${suffix}`,
      password: "a sufficiently long copy read password",
    }),
  });
  const body = RegisterResponseSchema.parse(await response.json());
  return {
    id: body.user.id,
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
  const viewer = await register("viewer");
  viewerId = viewer.id;
  viewerCookie = viewer.cookie;
  const outsider = await register("outsider");
  outsiderId = outsider.id;
  outsiderCookie = outsider.cookie;

  const collections = await databasePool.query<{ id: string }>(
    `INSERT INTO collections (
       type_code, status_code, name, visibility_code, created_by_user_id
     ) VALUES
       ('PERSONAL', 'ACTIVE', 'Private inventory', 'PRIVATE', $1),
       ('PERSONAL', 'ACTIVE', 'Destination inventory', 'PRIVATE', $1)
     RETURNING id`,
    [ownerId],
  );
  collectionId = collections.rows[0]!.id;
  destinationCollectionId = collections.rows[1]!.id;
  await databasePool.query(
    `INSERT INTO collection_members (collection_id, user_id, role_code)
     VALUES
       ($1, $2, 'OWNER'), ($1, $3, 'VIEWER'), ($4, $2, 'OWNER')`,
    [collectionId, ownerId, viewerId, destinationCollectionId],
  );

  const game = await databasePool.query<{ id: string }>(
    `INSERT INTO games (
       name, min_players, max_players, classification_code,
       visibility_code, moderation_status_code
     ) VALUES ('Readable game', 2, 4, 'OFFICIAL', 'PUBLIC', 'APPROVED')
     RETURNING id`,
  );
  gameId = game.rows[0]!.id;
  const mechanic = await databasePool.query<{ id: string }>(
    `INSERT INTO mechanics (name) VALUES ('Tile placement read test') RETURNING id`,
  );
  mechanicId = mechanic.rows[0]!.id;
  await databasePool.query(
    `INSERT INTO game_mechanics (game_id, mechanic_id) VALUES ($1, $2)`,
    [gameId, mechanicId],
  );
  const edition = await databasePool.query<{ id: string }>(
    `INSERT INTO game_editions (
       game_id, edition_name, edition_number, language_code, publication_year
     ) VALUES ($1, 'Spanish edition', 'Second', 'es', 2024)
     RETURNING id`,
    [gameId],
  );
  editionId = edition.rows[0]!.id;

  const copies = await databasePool.query<{
    id: string;
    alias: string;
  }>(
    `INSERT INTO copies (
       game_id, game_edition_id, current_collection_id, lifecycle_code,
       condition_code, alias, notes, exit_reason_code, exited_at,
       created_by_user_id, created_at
     ) VALUES
       ($1, $2, $3, 'ACTIVE', 'GOOD', 'Current copy', 'Current notes', NULL, NULL, $4, CURRENT_TIMESTAMP - INTERVAL '3 days'),
       ($1, NULL, NULL, 'EXITED', 'FAIR', 'Exited copy', NULL, 'GIFTED', CURRENT_TIMESTAMP - INTERVAL '1 day', $4, CURRENT_TIMESTAMP - INTERVAL '2 days'),
       ($1, $2, $5, 'ACTIVE', 'LIKE_NEW', 'Moved copy', 'Moved notes', NULL, NULL, $4, CURRENT_TIMESTAMP - INTERVAL '1 day')
     RETURNING id, alias`,
    [gameId, editionId, collectionId, ownerId, destinationCollectionId],
  );
  currentCopyId = copies.rows.find((row) => row.alias === "Current copy")!.id;
  exitedCopyId = copies.rows.find((row) => row.alias === "Exited copy")!.id;
  movedCopyId = copies.rows.find((row) => row.alias === "Moved copy")!.id;

  await databasePool.query(
    `INSERT INTO copy_collection_history (
       copy_id, collection_id, started_at, ended_at, changed_by_user_id
     ) VALUES
       ($1, $4, CURRENT_TIMESTAMP - INTERVAL '3 days', NULL, $6),
       ($2, $4, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 day', $6),
       ($3, $4, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '12 hours', $6),
       ($3, $5, CURRENT_TIMESTAMP - INTERVAL '12 hours', NULL, $6)`,
    [
      currentCopyId,
      exitedCopyId,
      movedCopyId,
      collectionId,
      destinationCollectionId,
      ownerId,
    ],
  );
  await databasePool.query(
    `INSERT INTO acquisitions (
       copy_id, collection_id, acquired_by_user_id, type_code,
       acquired_on, price_amount, currency_code
     ) VALUES
       ($1, $2, $3, 'PURCHASE', '2024-01-02', 100, 'COP'),
       ($1, $4, $3, 'GIFT', '2026-01-02', NULL, NULL)`,
    [movedCopyId, collectionId, ownerId, destinationCollectionId],
  );
});

afterAll(async () => {
  await databasePool.query(
    "DELETE FROM acquisitions WHERE copy_id = ANY($1::uuid[])",
    [[currentCopyId, exitedCopyId, movedCopyId]],
  );
  await databasePool.query(
    "DELETE FROM copy_collection_history WHERE copy_id = ANY($1::uuid[])",
    [[currentCopyId, exitedCopyId, movedCopyId]],
  );
  await databasePool.query("DELETE FROM copies WHERE id = ANY($1::uuid[])", [
    [currentCopyId, exitedCopyId, movedCopyId],
  ]);
  await databasePool.query("DELETE FROM game_editions WHERE id = $1", [
    editionId,
  ]);
  await databasePool.query("DELETE FROM games WHERE id = $1", [gameId]);
  await databasePool.query("DELETE FROM mechanics WHERE id = $1", [mechanicId]);
  await databasePool.query(
    "DELETE FROM collections WHERE id = ANY($1::uuid[])",
    [[collectionId, destinationCollectionId]],
  );
  await databasePool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
    [ownerId, viewerId, outsiderId],
  ]);
  server.close();
  await closeDatabase();
});

function listUrl(query = "") {
  return `${baseUrl}/api/v1/collections/${collectionId}/copies${query}`;
}

test("lists only active current copies by default for every collection member", async () => {
  for (const cookie of [ownerCookie, viewerCookie]) {
    const response = await fetch(listUrl(), {
      headers: { origin: apiConfig.webOrigin, cookie },
    });
    const body = CopyListResponseSchema.parse(await response.json());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.copies.map(({ id }) => id)).toEqual([currentCopyId]);
    expect(body.copies[0]).toMatchObject({
      lifecycle: "ACTIVE",
      condition: "GOOD",
      game: { id: gameId, name: "Readable game" },
      edition: { id: editionId, editionName: "Spanish edition" },
    });
  }
});

test("supports explicit exited and full-history filters with stable pagination", async () => {
  const exitedResponse = await fetch(listUrl("?lifecycle=EXITED"), {
    headers: { origin: apiConfig.webOrigin, cookie: ownerCookie },
  });
  const exited = CopyListResponseSchema.parse(await exitedResponse.json());
  expect(exited.copies.map(({ id }) => id)).toEqual([exitedCopyId]);
  expect(exited.copies[0]?.edition).toBeNull();
  expect(exited.copies[0]?.exitReason).toBe("GIFTED");

  const allResponse = await fetch(listUrl("?lifecycle=ALL&page=2&pageSize=1"), {
    headers: { origin: apiConfig.webOrigin, cookie: ownerCookie },
  });
  const all = CopyListResponseSchema.parse(await allResponse.json());
  expect(all.copies).toHaveLength(1);
  expect(all.pagination).toEqual({
    page: 2,
    pageSize: 1,
    totalItems: 3,
    totalPages: 3,
  });
});

test("filters the collection inventory by game data and player capacity", async () => {
  const matching = await fetch(
    listUrl("?q=readable&mechanic=tile&minPlayers=2&maxPlayers=4"),
    { headers: { origin: apiConfig.webOrigin, cookie: ownerCookie } },
  );
  const outsideRange = await fetch(listUrl("?minPlayers=5"), {
    headers: { origin: apiConfig.webOrigin, cookie: ownerCookie },
  });
  const exactTwo = await fetch(listUrl("?minPlayers=2&maxPlayers=2"), {
    headers: { origin: apiConfig.webOrigin, cookie: ownerCookie },
  });
  const missingOneToFour = await fetch(listUrl("?minPlayers=1&maxPlayers=4"), {
    headers: { origin: apiConfig.webOrigin, cookie: ownerCookie },
  });
  const matchingBody = CopyListResponseSchema.parse(await matching.json());
  const outsideBody = CopyListResponseSchema.parse(await outsideRange.json());
  const exactTwoBody = CopyListResponseSchema.parse(await exactTwo.json());
  const missingOneToFourBody = CopyListResponseSchema.parse(
    await missingOneToFour.json(),
  );

  expect(matchingBody.copies.map(({ id }) => id)).toEqual([currentCopyId]);
  expect(matchingBody.copies[0]?.game).toMatchObject({
    minPlayers: 2,
    maxPlayers: 4,
    mechanics: ["Tile placement read test"],
  });
  expect(outsideBody.copies).toEqual([]);
  expect(exactTwoBody.copies).toEqual([]);
  expect(missingOneToFourBody.copies).toEqual([]);
});

test("returns an authorized detail with edition, acquisitions and ordered history", async () => {
  const response = await fetch(`${baseUrl}/api/v1/copies/${movedCopyId}`, {
    headers: { origin: apiConfig.webOrigin, cookie: ownerCookie },
  });
  const body = CopyDetailResponseSchema.parse(await response.json());

  expect(response.status).toBe(200);
  expect(body.copy).toMatchObject({
    id: movedCopyId,
    lifecycle: "ACTIVE",
    condition: "LIKE_NEW",
    game: { id: gameId },
    edition: { id: editionId, languageCode: "es" },
  });
  expect(body.copy.collectionHistory).toHaveLength(2);
  expect(body.copy.collectionHistory.map(({ collectionId: id }) => id)).toEqual(
    [collectionId, destinationCollectionId],
  );
  expect(body.copy.acquisitions).toHaveLength(2);
  expect(body.copy.acquisitions[0]?.acquiredOn).toBe("2024-01-02");
});

test("does not reveal private inventories or copy details to outsiders", async () => {
  const list = await fetch(listUrl(), {
    headers: { origin: apiConfig.webOrigin, cookie: outsiderCookie },
  });
  const detail = await fetch(`${baseUrl}/api/v1/copies/${currentCopyId}`, {
    headers: { origin: apiConfig.webOrigin, cookie: outsiderCookie },
  });

  expect(list.status).toBe(404);
  expect(ErrorResponseSchema.parse(await list.json()).error.code).toBe(
    "COLLECTION_NOT_FOUND",
  );
  expect(detail.status).toBe(404);
  expect(ErrorResponseSchema.parse(await detail.json()).error.code).toBe(
    "COPY_NOT_FOUND",
  );
});

test("rejects anonymous access and invalid filters or identifiers", async () => {
  const anonymous = await fetch(listUrl(), {
    headers: { origin: apiConfig.webOrigin },
  });
  const badFilter = await fetch(listUrl("?lifecycle=REMOVED&pageSize=101"), {
    headers: { origin: apiConfig.webOrigin, cookie: ownerCookie },
  });
  const badId = await fetch(`${baseUrl}/api/v1/copies/not-a-uuid`, {
    headers: { origin: apiConfig.webOrigin, cookie: ownerCookie },
  });

  expect(anonymous.status).toBe(401);
  expect(badFilter.status).toBe(400);
  expect(badId.status).toBe(400);
});
