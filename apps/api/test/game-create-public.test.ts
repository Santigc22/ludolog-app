import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  BulkCreatePublicGamesResponseSchema,
  CreatePublicGameResponseSchema,
  ErrorResponseSchema,
  GameModerationListResponseSchema,
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
let adminId: string;
let adminCookie: string;
let adminCsrfToken: string;
let userId: string;
let userCookie: string;
let userCsrfToken: string;
const createdGameIds: string[] = [];
const suffix = randomUUID().slice(0, 8);

async function register(label: string) {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: `direct-public-${label}-${suffix}@example.com`,
      username: `direct_public_${label}_${suffix}`,
      password: "a sufficiently long direct publication password",
    }),
  });
  const body = RegisterResponseSchema.parse(await response.json());
  return {
    id: body.user.id,
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

  const admin = await register("admin");
  adminId = admin.id;
  adminCookie = admin.cookie;
  adminCsrfToken = admin.csrfToken;
  await databasePool.query("DELETE FROM user_roles WHERE user_id = $1", [
    adminId,
  ]);
  await databasePool.query(
    "INSERT INTO user_roles (user_id, role_code) VALUES ($1, 'ADMIN')",
    [adminId],
  );

  const user = await register("user");
  userId = user.id;
  userCookie = user.cookie;
  userCsrfToken = user.csrfToken;
});

afterAll(async () => {
  await databasePool.query(
    "DELETE FROM audit_logs WHERE actor_user_id = ANY($1::uuid[])",
    [[adminId, userId]],
  );
  if (createdGameIds.length > 0) {
    await databasePool.query("DELETE FROM games WHERE id = ANY($1::uuid[])", [
      createdGameIds,
    ]);
  }
  await databasePool.query("DELETE FROM mechanics WHERE name = $1", [
    `Direct mechanic ${suffix}`,
  ]);
  await databasePool.query("DELETE FROM categories WHERE name = $1", [
    `Direct category ${suffix}`,
  ]);
  await databasePool.query(
    "DELETE FROM mechanics WHERE name = ANY($1::text[])",
    [[`Batch mechanic one ${suffix}`, `Batch mechanic two ${suffix}`]],
  );
  await databasePool.query(
    "DELETE FROM categories WHERE name = ANY($1::text[])",
    [[`Batch category one ${suffix}`, `Batch category two ${suffix}`]],
  );
  await databasePool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
    [adminId, userId],
  ]);
  server.close();
  await closeDatabase();
});

const publicGame = {
  name: `Direct public game ${suffix}`,
  description: "Published by an administrator without a pending queue.",
  publicationYear: 2026,
  minPlayers: 1,
  maxPlayers: 4,
  classification: "OFFICIAL" as const,
  mechanics: [`Direct mechanic ${suffix}`],
  categories: [`Direct category ${suffix}`],
};

function createRequest(options: { cookie?: string; csrfToken?: string } = {}) {
  return fetch(`${baseUrl}/api/v1/games/public`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
      ...(options.cookie === undefined ? {} : { cookie: options.cookie }),
      ...(options.csrfToken === undefined
        ? {}
        : { "x-csrf-token": options.csrfToken }),
    },
    body: JSON.stringify(publicGame),
  });
}

function createBatchRequest(
  games: unknown[],
  options: { cookie?: string; csrfToken?: string } = {},
) {
  return fetch(`${baseUrl}/api/v1/games/public/batch`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
      ...(options.cookie === undefined ? {} : { cookie: options.cookie }),
      ...(options.csrfToken === undefined
        ? {}
        : { "x-csrf-token": options.csrfToken }),
    },
    body: JSON.stringify({ games }),
  });
}

test("only an admin permission holder can publish directly", async () => {
  const anonymous = await createRequest();
  const regularUser = await createRequest({
    cookie: userCookie,
    csrfToken: userCsrfToken,
  });
  const invalidCsrf = await createRequest({
    cookie: adminCookie,
    csrfToken: "invalid-token",
  });

  expect(anonymous.status).toBe(401);
  expect(regularUser.status).toBe(403);
  expect(invalidCsrf.status).toBe(403);
  expect(ErrorResponseSchema.parse(await regularUser.json()).error.code).toBe(
    "PERMISSION_DENIED",
  );

  const regularUserBatch = await createBatchRequest([publicGame], {
    cookie: userCookie,
    csrfToken: userCsrfToken,
  });
  expect(regularUserBatch.status).toBe(403);
});

test("publishes immediately and records the same admin as submitter and reviewer", async () => {
  const response = await createRequest({
    cookie: adminCookie,
    csrfToken: adminCsrfToken,
  });
  const responseSnapshot = await response.clone().json();
  expect(response.status, JSON.stringify(responseSnapshot)).toBe(201);
  const body = CreatePublicGameResponseSchema.parse(await response.json());
  const createdGameId = body.game.id;
  createdGameIds.push(createdGameId);

  expect(body.game).toMatchObject({
    name: publicGame.name,
    classification: "OFFICIAL",
    visibility: "PUBLIC",
    moderationStatus: "APPROVED",
    isOwnedByViewer: true,
    canManageCatalog: true,
    mechanics: publicGame.mechanics,
    categories: publicGame.categories,
  });

  const history = await databasePool.query<{
    submitted_by_user_id: string;
    assigned_to_user_id: string;
    current_status_code: string;
    submission_note: string;
    resolution_note: string;
    closed_at: Date | null;
    from_status_code: string | null;
    to_status_code: string;
    action: string;
    publication_mode: string;
  }>(
    `SELECT moderation_cases.submitted_by_user_id,
            moderation_cases.assigned_to_user_id,
            moderation_cases.current_status_code,
            moderation_cases.submission_note,
            moderation_cases.resolution_note,
            moderation_cases.closed_at,
            moderation_actions.from_status_code,
            moderation_actions.to_status_code,
            audit_logs.action,
            audit_logs.context->>'publicationMode' AS publication_mode
     FROM moderation_cases
     INNER JOIN moderation_actions
       ON moderation_actions.moderation_case_id = moderation_cases.id
     INNER JOIN audit_logs
       ON audit_logs.resource_id = moderation_cases.game_id
      AND audit_logs.action = 'game.public_created_directly'
     WHERE moderation_cases.game_id = $1`,
    [createdGameId],
  );
  expect(history.rows[0]).toMatchObject({
    submitted_by_user_id: adminId,
    assigned_to_user_id: adminId,
    current_status_code: "APPROVED",
    submission_note: "Publicación directa administrativa.",
    resolution_note: "Publicación directa administrativa.",
    from_status_code: null,
    to_status_code: "APPROVED",
    action: "game.public_created_directly",
    publication_mode: "DIRECT_ADMIN",
  });
  expect(history.rows[0]?.closed_at).toBeInstanceOf(Date);

  const moderationResponse = await fetch(
    `${baseUrl}/api/v1/moderation/games?status=APPROVED&approvedByUserId=${adminId}`,
    { headers: { origin: apiConfig.webOrigin, cookie: adminCookie } },
  );
  const moderation = GameModerationListResponseSchema.parse(
    await moderationResponse.json(),
  );
  const recordedCase = moderation.moderationCases.find(
    ({ game }) => game.id === createdGameId,
  );
  expect(recordedCase).toMatchObject({
    status: "APPROVED",
    submittedBy: { id: adminId },
    assignedToUserId: adminId,
    resolvedBy: { id: adminId },
    resolutionNote: "Publicación directa administrativa.",
  });
});

test("publishes a validated batch atomically with one audit batch id", async () => {
  const games = [
    {
      name: `Batch public game one ${suffix}`,
      minPlayers: 2,
      maxPlayers: 2,
      mechanics: [`Batch mechanic one ${suffix}`],
      categories: [`Batch category one ${suffix}`],
    },
    {
      name: `Batch public game two ${suffix}`,
      minPlayers: 1,
      maxPlayers: 5,
      classification: "COMMUNITY",
      mechanics: [`Batch mechanic two ${suffix}`],
      categories: [`Batch category two ${suffix}`],
    },
  ];
  const response = await createBatchRequest(games, {
    cookie: adminCookie,
    csrfToken: adminCsrfToken,
  });
  const responseSnapshot = await response.clone().json();
  expect(response.status, JSON.stringify(responseSnapshot)).toBe(201);
  const body = BulkCreatePublicGamesResponseSchema.parse(await response.json());
  createdGameIds.push(...body.games.map(({ id }) => id));

  expect(body.createdCount).toBe(2);
  expect(body.games).toMatchObject([
    {
      name: games[0]!.name,
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      classification: "OFFICIAL",
    },
    {
      name: games[1]!.name,
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      classification: "COMMUNITY",
    },
  ]);

  const history = await databasePool.query<{
    game_id: string;
    submitted_by_user_id: string;
    assigned_to_user_id: string;
    current_status_code: string;
    publication_mode: string;
    batch_id: string;
  }>(
    `SELECT moderation_cases.game_id,
            moderation_cases.submitted_by_user_id,
            moderation_cases.assigned_to_user_id,
            moderation_cases.current_status_code,
            audit_logs.context->>'publicationMode' AS publication_mode,
            audit_logs.context->>'batchId' AS batch_id
     FROM moderation_cases
     INNER JOIN audit_logs
       ON audit_logs.resource_id = moderation_cases.game_id
      AND audit_logs.action = 'game.public_created_directly'
     WHERE moderation_cases.game_id = ANY($1::uuid[])
     ORDER BY moderation_cases.game_id`,
    [body.games.map(({ id }) => id)],
  );
  expect(history.rows).toHaveLength(2);
  expect(history.rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        submitted_by_user_id: adminId,
        assigned_to_user_id: adminId,
        current_status_code: "APPROVED",
        publication_mode: "DIRECT_ADMIN_BATCH",
      }),
    ]),
  );
  expect(history.rows[0]!.batch_id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(history.rows[1]!.batch_id).toBe(history.rows[0]!.batch_id);
});

test("rejects the complete batch before writing when one row is invalid", async () => {
  const validName = `Rejected batch valid row ${suffix}`;
  const response = await createBatchRequest(
    [
      { name: validName, minPlayers: 1, maxPlayers: 4 },
      {
        name: `Rejected batch invalid row ${suffix}`,
        minPlayers: 5,
        maxPlayers: 2,
      },
    ],
    { cookie: adminCookie, csrfToken: adminCsrfToken },
  );

  expect(response.status).toBe(400);
  const count = await databasePool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM games WHERE name = $1",
    [validName],
  );
  expect(count.rows[0]?.count).toBe("0");
});

test("bounds the batch request body", async () => {
  const response = await fetch(`${baseUrl}/api/v1/games/public/batch`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({ games: [], padding: "x".repeat(2_100_000) }),
  });

  expect(response.status).toBe(413);
  expect(ErrorResponseSchema.parse(await response.json()).error.code).toBe(
    "PAYLOAD_TOO_LARGE",
  );
});
