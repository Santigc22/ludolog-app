import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  CreatePrivateGameResponseSchema,
  ErrorResponseSchema,
  GameDetailResponseSchema,
  GameModerationCaseResponseSchema,
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

type TestUser = Readonly<{
  id: string;
  cookie: string;
  csrfToken: string;
}>;

let baseUrl: string;
let server: Server;
let owner: TestUser;
let moderator: TestUser;
let ordinaryUser: TestUser;
let collectionId: string;
const gameIds: string[] = [];

async function registerUser(label: string): Promise<TestUser> {
  const suffix = randomUUID().slice(0, 8);
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: `moderation-${label}-${suffix}@example.com`,
      username: `moderation_${label}_${suffix}`,
      password: "a sufficiently long moderation password",
    }),
  });
  const body = RegisterResponseSchema.parse(await response.json());
  return {
    id: body.user.id,
    cookie: (response.headers.get("set-cookie") ?? "").split(";", 1)[0] ?? "",
    csrfToken: body.csrfToken,
  };
}

async function createPrivateGame(name: string) {
  const response = await fetch(`${baseUrl}/api/v1/games`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      cookie: owner.cookie,
      "content-type": "application/json",
      "x-csrf-token": owner.csrfToken,
    },
    body: JSON.stringify({
      name,
      description: "Una propuesta creada para probar moderación",
      minPlayers: 2,
      maxPlayers: 2,
    }),
  });
  expect(response.status).toBe(201);
  const body = CreatePrivateGameResponseSchema.parse(await response.json());
  gameIds.push(body.game.id);
  return body.game;
}

async function submitGame(gameId: string, note: string) {
  return fetch(`${baseUrl}/api/v1/games/${gameId}/moderation-submissions`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      cookie: owner.cookie,
      "content-type": "application/json",
      "x-csrf-token": owner.csrfToken,
    },
    body: JSON.stringify({ note }),
  });
}

async function resolveCase(
  caseId: string,
  decision: "approve" | "reject",
  body: Record<string, unknown> = {},
) {
  return fetch(`${baseUrl}/api/v1/moderation/cases/${caseId}/${decision}`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      cookie: moderator.cookie,
      "content-type": "application/json",
      "x-csrf-token": moderator.csrfToken,
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

  owner = await registerUser("owner");
  moderator = await registerUser("reviewer");
  ordinaryUser = await registerUser("ordinary");
  await databasePool.query("DELETE FROM user_roles WHERE user_id = $1", [
    moderator.id,
  ]);
  await databasePool.query(
    `INSERT INTO user_roles (user_id, role_code, assigned_by_user_id)
     VALUES ($1, 'MODERATOR', $1)`,
    [moderator.id],
  );

  const collection = await databasePool.query<{ id: string }>(
    `INSERT INTO collections (
       type_code, status_code, name, visibility_code, created_by_user_id
     ) VALUES ('PERSONAL', 'ACTIVE', 'Moderation collection', 'PRIVATE', $1)
     RETURNING id`,
    [owner.id],
  );
  collectionId = collection.rows[0]!.id;
  await databasePool.query(
    `INSERT INTO collection_members (collection_id, user_id, role_code)
     VALUES ($1, $2, 'OWNER')`,
    [collectionId, owner.id],
  );
});

afterAll(async () => {
  await databasePool.query(
    "DELETE FROM audit_logs WHERE actor_user_id = ANY($1::uuid[])",
    [[owner.id, moderator.id, ordinaryUser.id]],
  );
  await databasePool.query("DELETE FROM copies WHERE created_by_user_id = $1", [
    owner.id,
  ]);
  await databasePool.query("DELETE FROM games WHERE id = ANY($1::uuid[])", [
    gameIds,
  ]);
  await databasePool.query("DELETE FROM collections WHERE id = $1", [
    collectionId,
  ]);
  await databasePool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
    [owner.id, moderator.id, ordinaryUser.id],
  ]);
  server.close();
  await closeDatabase();
});

test("submits, approves and publishes the same game without losing its copy", async () => {
  const game = await createPrivateGame(`Sky Team ${randomUUID().slice(0, 6)}`);
  const copy = await databasePool.query<{ id: string }>(
    `INSERT INTO copies (
       game_id, current_collection_id, lifecycle_code, condition_code,
       alias, created_by_user_id
     ) VALUES ($1, $2, 'ACTIVE', 'GOOD', 'My original copy', $3)
     RETURNING id`,
    [game.id, collectionId, owner.id],
  );

  const submission = await submitGame(game.id, "Datos revisados por el autor");
  expect(submission.status).toBe(201);
  const submitted = GameModerationCaseResponseSchema.parse(
    await submission.json(),
  );
  expect(submitted.moderationCase).toMatchObject({
    status: "PENDING_REVIEW",
    submissionNote: "Datos revisados por el autor",
    game: {
      id: game.id,
      visibility: "PRIVATE",
      moderationStatus: "PENDING_REVIEW",
    },
  });

  const repeatedSubmission = await submitGame(game.id, "Duplicate request");
  expect(repeatedSubmission.status).toBe(409);
  expect(
    ErrorResponseSchema.parse(await repeatedSubmission.json()).error.code,
  ).toBe("GAME_NOT_SUBMITTABLE");

  const deniedQueue = await fetch(`${baseUrl}/api/v1/moderation/games`, {
    headers: { origin: apiConfig.webOrigin, cookie: ordinaryUser.cookie },
  });
  expect(deniedQueue.status).toBe(403);

  const queue = await fetch(`${baseUrl}/api/v1/moderation/games`, {
    headers: { origin: apiConfig.webOrigin, cookie: moderator.cookie },
  });
  expect(queue.status).toBe(200);
  const pending = GameModerationListResponseSchema.parse(await queue.json());
  expect(
    pending.moderationCases.some(
      ({ id }) => id === submitted.moderationCase.id,
    ),
  ).toBe(true);

  const approval = await resolveCase(submitted.moderationCase.id, "approve");
  expect(approval.status).toBe(200);
  const approved = GameModerationCaseResponseSchema.parse(
    await approval.json(),
  );
  expect(approved.moderationCase).toMatchObject({
    status: "APPROVED",
    game: {
      id: game.id,
      classification: "COMMUNITY",
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
    },
  });

  const repeatedApproval = await resolveCase(
    submitted.moderationCase.id,
    "approve",
  );
  expect(repeatedApproval.status).toBe(409);

  const publicDetail = await fetch(`${baseUrl}/api/v1/games/${game.id}`, {
    headers: { origin: apiConfig.webOrigin },
  });
  expect(publicDetail.status).toBe(200);
  expect(
    GameDetailResponseSchema.parse(await publicDetail.json()).game,
  ).toMatchObject({
    id: game.id,
    visibility: "PUBLIC",
    moderationStatus: "APPROVED",
  });
  const persistedCopy = await databasePool.query<{
    game_id: string;
    current_collection_id: string;
  }>("SELECT game_id, current_collection_id FROM copies WHERE id = $1", [
    copy.rows[0]!.id,
  ]);
  expect(persistedCopy.rows[0]).toEqual({
    game_id: game.id,
    current_collection_id: collectionId,
  });
});

test("rejects with a reason while keeping the proposal private for its owner", async () => {
  const game = await createPrivateGame(
    `Rejected prototype ${randomUUID().slice(0, 6)}`,
  );
  const submission = await submitGame(game.id, "Please review this prototype");
  const submitted = GameModerationCaseResponseSchema.parse(
    await submission.json(),
  );

  const rejection = await resolveCase(submitted.moderationCase.id, "reject", {
    reason: "Faltan datos verificables de la edición.",
  });
  expect(rejection.status).toBe(200);
  const rejected = GameModerationCaseResponseSchema.parse(
    await rejection.json(),
  );
  expect(rejected.moderationCase).toMatchObject({
    status: "REJECTED",
    resolutionNote: "Faltan datos verificables de la edición.",
    game: { visibility: "PRIVATE", moderationStatus: "REJECTED" },
  });

  const ownerDetail = await fetch(`${baseUrl}/api/v1/games/${game.id}`, {
    headers: { origin: apiConfig.webOrigin, cookie: owner.cookie },
  });
  const anonymousDetail = await fetch(`${baseUrl}/api/v1/games/${game.id}`, {
    headers: { origin: apiConfig.webOrigin },
  });
  expect(ownerDetail.status).toBe(200);
  expect(
    GameDetailResponseSchema.parse(await ownerDetail.json()).game
      .moderationStatus,
  ).toBe("REJECTED");
  expect(anonymousDetail.status).toBe(404);
});
