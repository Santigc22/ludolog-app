import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  ErrorResponseSchema,
  MatchListResponseSchema,
  MatchResponseSchema,
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
let strangerId: string;
let strangerCookie: string;
let gameId: string;
let collectionId: string;
let copyId: string;
let matchId: string | null = null;
let plannedMatchId: string | null = null;
const suffix = randomUUID().slice(0, 8);

async function register(label: string) {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: `match-${label}-${suffix}@example.com`,
      username: `match_${label}_${suffix}`,
      password: "a sufficiently long match testing password",
      displayName: label === "owner" ? "Jugadora principal" : undefined,
    }),
  });
  const body = RegisterResponseSchema.parse(await response.json());
  return {
    id: body.user.id,
    cookie: (response.headers.get("set-cookie") ?? "").split(";", 1)[0] ?? "",
    csrf: body.csrfToken,
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
  const stranger = await register("stranger");
  strangerId = stranger.id;
  strangerCookie = stranger.cookie;

  const game = await databasePool.query<{ id: string }>(
    `INSERT INTO games (
       name, min_players, max_players, classification_code,
       visibility_code, moderation_status_code, created_by_user_id
     ) VALUES ($1, 2, 4, 'PRIVATE', 'PRIVATE', 'DRAFT', $2)
     RETURNING id`,
    [`Match game ${suffix}`, ownerId],
  );
  gameId = game.rows[0]!.id;
  const collection = await databasePool.query<{ id: string }>(
    `INSERT INTO collections (
       type_code, status_code, name, visibility_code, created_by_user_id
     ) VALUES ('PERSONAL', 'ACTIVE', $1, 'PRIVATE', $2)
     RETURNING id`,
    [`Match collection ${suffix}`, ownerId],
  );
  collectionId = collection.rows[0]!.id;
  await databasePool.query(
    `INSERT INTO collection_members (collection_id, user_id, role_code)
     VALUES ($1, $2, 'OWNER')`,
    [collectionId, ownerId],
  );
  const copy = await databasePool.query<{ id: string }>(
    `INSERT INTO copies (
       game_id, current_collection_id, lifecycle_code, condition_code,
       alias, created_by_user_id
     ) VALUES ($1, $2, 'ACTIVE', 'GOOD', 'Copia de prueba', $3)
     RETURNING id`,
    [gameId, collectionId, ownerId],
  );
  copyId = copy.rows[0]!.id;
  await databasePool.query(
    `INSERT INTO copy_collection_history (
       copy_id, collection_id, changed_by_user_id
     ) VALUES ($1, $2, $3)`,
    [copyId, collectionId, ownerId],
  );
});

afterAll(async () => {
  if (matchId !== null) {
    await databasePool.query("DELETE FROM audit_logs WHERE resource_id = $1", [
      matchId,
    ]);
    await databasePool.query("DELETE FROM matches WHERE id = $1", [matchId]);
  }
  if (plannedMatchId !== null) {
    await databasePool.query("DELETE FROM audit_logs WHERE resource_id = $1", [
      plannedMatchId,
    ]);
    await databasePool.query("DELETE FROM matches WHERE id = $1", [
      plannedMatchId,
    ]);
  }
  await databasePool.query(
    "DELETE FROM copy_collection_history WHERE copy_id = $1",
    [copyId],
  );
  await databasePool.query("DELETE FROM copies WHERE id = $1", [copyId]);
  await databasePool.query("DELETE FROM collections WHERE id = $1", [
    collectionId,
  ]);
  await databasePool.query("DELETE FROM games WHERE id = $1", [gameId]);
  await databasePool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
    [ownerId, strangerId],
  ]);
  server.close();
  await closeDatabase();
});

function createRequest(participants: unknown[]) {
  return fetch(`${baseUrl}/api/v1/matches`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
      cookie: ownerCookie,
      "x-csrf-token": ownerCsrf,
    },
    body: JSON.stringify({
      gameId,
      copyId,
      startedAt: "2026-11-13T18:30:00.000Z",
      durationMinutes: 75,
      location: "Mesa familiar",
      notes: "Primera partida registrada",
      participants,
    }),
  });
}

test("requires the game's participant range", async () => {
  const response = await createRequest([{ userId: ownerId }]);
  expect(response.status).toBe(400);
  expect(ErrorResponseSchema.parse(await response.json()).error).toMatchObject({
    code: "MATCH_PARTICIPANT_RANGE_INVALID",
    details: { minimum: 2, maximum: 4 },
  });
});

test("creates a match linked to an accessible copy and collection snapshot", async () => {
  const response = await createRequest([
    { userId: ownerId, outcome: "WIN", score: 42 },
    { guestName: "Invitado", outcome: "LOSS", score: 12 },
  ]);
  const snapshot = await response.clone().json();
  expect(response.status, JSON.stringify(snapshot)).toBe(201);
  const body = MatchResponseSchema.parse(await response.json());
  matchId = body.match.id;

  expect(body.match).toMatchObject({
    game: { id: gameId, minPlayers: 2, maxPlayers: 4 },
    copy: { id: copyId, alias: "Copia de prueba" },
    collection: { id: collectionId, name: `Match collection ${suffix}` },
    status: "COMPLETED",
    visibility: "PRIVATE",
    durationMinutes: 75,
    location: "Mesa familiar",
    canEdit: true,
    participants: [
      {
        userId: ownerId,
        displayName: "Jugadora principal",
        outcome: "WIN",
        score: 42,
      },
      {
        guestName: "Invitado",
        displayName: "Invitado",
        outcome: "LOSS",
        score: 12,
      },
    ],
  });

  const audit = await databasePool.query<{ action: string }>(
    "SELECT action FROM audit_logs WHERE resource_id = $1",
    [matchId],
  );
  expect(audit.rows.map(({ action }) => action)).toContain("match.created");
});

test("creates a future planned match and later records its result", async () => {
  const plannedResponse = await fetch(`${baseUrl}/api/v1/matches`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
      cookie: ownerCookie,
      "x-csrf-token": ownerCsrf,
    },
    body: JSON.stringify({
      gameId,
      status: "PLANNED",
      startedAt: "2027-01-10T15:00:00.000Z",
      location: "Casa de la anfitriona",
      participants: [{ userId: ownerId }, { guestName: "Invitada futura" }],
    }),
  });
  const plannedSnapshot = await plannedResponse.clone().json();
  expect(plannedResponse.status, JSON.stringify(plannedSnapshot)).toBe(201);
  const planned = MatchResponseSchema.parse(await plannedResponse.json()).match;
  plannedMatchId = planned.id;
  expect(planned).toMatchObject({
    status: "PLANNED",
    participants: [
      { outcome: "NO_RESULT", score: null },
      { outcome: "NO_RESULT", score: null },
    ],
  });

  const completedResponse = await fetch(
    `${baseUrl}/api/v1/matches/${planned.id}`,
    {
      method: "PATCH",
      headers: {
        origin: apiConfig.webOrigin,
        "content-type": "application/json",
        cookie: ownerCookie,
        "x-csrf-token": ownerCsrf,
      },
      body: JSON.stringify({
        status: "COMPLETED",
        durationMinutes: 90,
        participants: [
          { userId: ownerId, outcome: "WIN", score: 20 },
          { guestName: "Invitada futura", outcome: "LOSS", score: 12 },
        ],
      }),
    },
  );
  const completedSnapshot = await completedResponse.clone().json();
  expect(completedResponse.status, JSON.stringify(completedSnapshot)).toBe(200);
  expect(
    MatchResponseSchema.parse(await completedResponse.json()).match,
  ).toMatchObject({
    status: "COMPLETED",
    durationMinutes: 90,
    participants: [
      { outcome: "WIN", score: 20 },
      { outcome: "LOSS", score: 12 },
    ],
  });
});

test("lists and updates the owner's match without exposing it to another user", async () => {
  const listResponse = await fetch(
    `${baseUrl}/api/v1/matches?page=1&pageSize=20`,
    {
      headers: { origin: apiConfig.webOrigin, cookie: ownerCookie },
    },
  );
  const list = MatchListResponseSchema.parse(await listResponse.json());
  expect(list.matches.map(({ id }) => id)).toContain(matchId);

  const matchingDateResponse = await fetch(
    `${baseUrl}/api/v1/matches?${new URLSearchParams({
      page: "1",
      pageSize: "20",
      startedFrom: "2026-11-13T00:00:00.000Z",
      startedBefore: "2026-11-14T00:00:00.000Z",
    })}`,
    { headers: { origin: apiConfig.webOrigin, cookie: ownerCookie } },
  );
  const matchingDate = MatchListResponseSchema.parse(
    await matchingDateResponse.json(),
  );
  expect(matchingDate.matches.map(({ id }) => id)).toContain(matchId);

  const emptyDateResponse = await fetch(
    `${baseUrl}/api/v1/matches?${new URLSearchParams({
      page: "1",
      pageSize: "20",
      startedFrom: "2026-11-14T00:00:00.000Z",
      startedBefore: "2026-11-15T00:00:00.000Z",
    })}`,
    { headers: { origin: apiConfig.webOrigin, cookie: ownerCookie } },
  );
  const emptyDate = MatchListResponseSchema.parse(
    await emptyDateResponse.json(),
  );
  expect(emptyDate.matches.map(({ id }) => id)).not.toContain(matchId);

  const hidden = await fetch(`${baseUrl}/api/v1/matches/${matchId}`, {
    headers: { origin: apiConfig.webOrigin, cookie: strangerCookie },
  });
  expect(hidden.status).toBe(404);

  const updatedResponse = await fetch(`${baseUrl}/api/v1/matches/${matchId}`, {
    method: "PATCH",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
      cookie: ownerCookie,
      "x-csrf-token": ownerCsrf,
    },
    body: JSON.stringify({
      status: "INCOMPLETE",
      notes: "Terminó antes de tiempo",
      participants: [
        { userId: ownerId, outcome: "NO_RESULT", score: 25 },
        { guestName: "Invitado", outcome: "NO_RESULT", score: 20 },
      ],
    }),
  });
  const updated = MatchResponseSchema.parse(await updatedResponse.json());
  expect(updated.match).toMatchObject({
    status: "INCOMPLETE",
    notes: "Terminó antes de tiempo",
    participants: [
      { outcome: "NO_RESULT", score: 25 },
      { outcome: "NO_RESULT", score: 20 },
    ],
  });
});
