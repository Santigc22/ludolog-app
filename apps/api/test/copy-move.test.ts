import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  CopyDetailResponseSchema,
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

type Identity = { id: string; cookie: string; csrf: string };

let server: Server;
let baseUrl: string;
let owner: Identity;
let manager: Identity;
let viewer: Identity;
let outsider: Identity;
let sourceId: string;
let destinationId: string;
let restrictedDestinationId: string;
let archivedSourceId: string;
let gameId: string;
const copyIds: Record<string, string> = {};

async function register(label: string): Promise<Identity> {
  const suffix = randomUUID().slice(0, 8);
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: `copy-move-${label}-${suffix}@example.com`,
      username: `copy_move_${label}_${suffix}`,
      password: "a sufficiently long copy move password",
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
  owner = await register("owner");
  manager = await register("manager");
  viewer = await register("viewer");
  outsider = await register("outsider");

  const collections = await databasePool.query<{ id: string; name: string }>(
    `INSERT INTO collections (
       type_code, status_code, name, visibility_code, created_by_user_id,
       archived_at
     ) VALUES
       ('PERSONAL', 'ACTIVE', 'Move source', 'PRIVATE', $1, NULL),
       ('PERSONAL', 'ACTIVE', 'Move destination', 'PRIVATE', $1, NULL),
       ('PERSONAL', 'ACTIVE', 'Restricted destination', 'PRIVATE', $1, NULL),
       ('PERSONAL', 'ARCHIVED', 'Archived source', 'PRIVATE', $1, CURRENT_TIMESTAMP)
     RETURNING id, name`,
    [owner.id],
  );
  sourceId = collections.rows.find(({ name }) => name === "Move source")!.id;
  destinationId = collections.rows.find(
    ({ name }) => name === "Move destination",
  )!.id;
  restrictedDestinationId = collections.rows.find(
    ({ name }) => name === "Restricted destination",
  )!.id;
  archivedSourceId = collections.rows.find(
    ({ name }) => name === "Archived source",
  )!.id;
  await databasePool.query(
    `INSERT INTO collection_members (collection_id, user_id, role_code)
     VALUES
       ($1, $5, 'OWNER'), ($1, $6, 'MANAGER'), ($1, $7, 'VIEWER'),
       ($2, $5, 'OWNER'), ($2, $6, 'MANAGER'),
       ($3, $5, 'VIEWER'), ($4, $5, 'OWNER')`,
    [
      sourceId,
      destinationId,
      restrictedDestinationId,
      archivedSourceId,
      owner.id,
      manager.id,
      viewer.id,
    ],
  );

  const game = await databasePool.query<{ id: string }>(
    `INSERT INTO games (
       name, min_players, max_players, classification_code,
       visibility_code, moderation_status_code
     ) VALUES ('Copy move game', 1, 4, 'OFFICIAL', 'PUBLIC', 'APPROVED')
     RETURNING id`,
  );
  gameId = game.rows[0]!.id;
  const labels = [
    "success",
    "concurrent",
    "exited",
    "archived",
    "role",
    "rollback",
    "inconsistent",
  ];
  const copies = await databasePool.query<{
    id: string;
    alias: string;
  }>(
    `INSERT INTO copies (
       game_id, current_collection_id, lifecycle_code, condition_code,
       alias, exit_reason_code, exited_at, created_by_user_id
     ) VALUES
       ($1, $2, 'ACTIVE', 'GOOD', 'success', NULL, NULL, $4),
       ($1, $2, 'ACTIVE', 'GOOD', 'concurrent', NULL, NULL, $4),
       ($1, NULL, 'EXITED', 'GOOD', 'exited', 'GIFTED', CURRENT_TIMESTAMP, $4),
       ($1, $3, 'ACTIVE', 'GOOD', 'archived', NULL, NULL, $4),
       ($1, $2, 'ACTIVE', 'GOOD', 'role', NULL, NULL, $4),
       ($1, $2, 'ACTIVE', 'GOOD', 'rollback', NULL, NULL, $4),
       ($1, $2, 'ACTIVE', 'GOOD', 'inconsistent', NULL, NULL, $4)
     RETURNING id, alias`,
    [gameId, sourceId, archivedSourceId, owner.id],
  );
  for (const label of labels) {
    copyIds[label] = copies.rows.find(({ alias }) => alias === label)!.id;
  }
  await databasePool.query(
    `INSERT INTO copy_collection_history (
       copy_id, collection_id, started_at, ended_at, changed_by_user_id
     ) VALUES
       ($1, $8, CURRENT_TIMESTAMP - INTERVAL '7 days', NULL, $10),
       ($2, $8, CURRENT_TIMESTAMP - INTERVAL '6 days', NULL, $10),
       ($3, $8, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '4 days', $10),
       ($4, $9, CURRENT_TIMESTAMP - INTERVAL '4 days', NULL, $10),
       ($5, $8, CURRENT_TIMESTAMP - INTERVAL '3 days', NULL, $10),
       ($6, $8, CURRENT_TIMESTAMP - INTERVAL '2 days', NULL, $10),
       ($7, $8, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 hour', $10)`,
    [
      copyIds.success,
      copyIds.concurrent,
      copyIds.exited,
      copyIds.archived,
      copyIds.role,
      copyIds.rollback,
      copyIds.inconsistent,
      sourceId,
      archivedSourceId,
      owner.id,
    ],
  );
});

afterAll(async () => {
  const ids = Object.values(copyIds);
  await databasePool.query(
    "DELETE FROM audit_logs WHERE resource_id = ANY($1::uuid[])",
    [ids],
  );
  await databasePool.query(
    "DELETE FROM copy_collection_history WHERE copy_id = ANY($1::uuid[])",
    [ids],
  );
  await databasePool.query("DELETE FROM copies WHERE id = ANY($1::uuid[])", [
    ids,
  ]);
  await databasePool.query("DELETE FROM games WHERE id = $1", [gameId]);
  await databasePool.query(
    "DELETE FROM collections WHERE id = ANY($1::uuid[])",
    [[sourceId, destinationId, restrictedDestinationId, archivedSourceId]],
  );
  await databasePool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
    [owner.id, manager.id, viewer.id, outsider.id],
  ]);
  server.close();
  await closeDatabase();
});

async function moveRequest(
  copyId: string,
  destinationCollectionId: string,
  identity?: Identity,
  csrfOverride?: string,
) {
  return fetch(`${baseUrl}/api/v1/copies/${copyId}/move`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
      ...(identity ? { cookie: identity.cookie } : {}),
      ...(identity ? { "x-csrf-token": csrfOverride ?? identity.csrf } : {}),
    },
    body: JSON.stringify({ destinationCollectionId }),
  });
}

test("moves the same copy as manager and preserves a continuous audited history", async () => {
  const response = await moveRequest(copyIds.success!, destinationId, manager);
  const body = CopyDetailResponseSchema.parse(await response.json());

  expect(response.status).toBe(200);
  expect(body.copy.id).toBe(copyIds.success);
  expect(body.copy.currentCollectionId).toBe(destinationId);
  expect(body.copy.lifecycle).toBe("ACTIVE");
  expect(body.copy.collectionHistory).toHaveLength(2);
  const [sourcePeriod, destinationPeriod] = body.copy.collectionHistory;
  expect(sourcePeriod?.endedAt).toBe(destinationPeriod?.startedAt);
  expect(destinationPeriod?.endedAt).toBeNull();

  const audit = await databasePool.query<{
    before_state: { currentCollectionId: string };
    after_state: { currentCollectionId: string };
  }>(
    `SELECT before_state, after_state FROM audit_logs
     WHERE resource_id = $1 AND action = 'copy.moved'`,
    [copyIds.success],
  );
  expect(audit.rows[0]?.before_state.currentCollectionId).toBe(sourceId);
  expect(audit.rows[0]?.after_state.currentCollectionId).toBe(destinationId);

  const noOp = await moveRequest(copyIds.success!, destinationId, manager);
  expect(noOp.status).toBe(409);
  expect(ErrorResponseSchema.parse(await noOp.json()).error.code).toBe(
    "COPY_ALREADY_IN_DESTINATION",
  );
});

test("serializes concurrent moves and leaves exactly one open destination period", async () => {
  const responses = await Promise.all([
    moveRequest(copyIds.concurrent!, destinationId, owner),
    moveRequest(copyIds.concurrent!, destinationId, owner),
  ]);
  expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);

  const persisted = await databasePool.query<{
    current_collection_id: string;
    open_count: string;
    history_count: string;
  }>(
    `SELECT copies.current_collection_id,
            COUNT(*) FILTER (WHERE history.ended_at IS NULL)::text AS open_count,
            COUNT(*)::text AS history_count
     FROM copies
     INNER JOIN copy_collection_history AS history ON history.copy_id = copies.id
     WHERE copies.id = $1
     GROUP BY copies.id`,
    [copyIds.concurrent],
  );
  expect(persisted.rows[0]).toEqual({
    current_collection_id: destinationId,
    open_count: "1",
    history_count: "2",
  });
});

test("rejects exited copies, inconsistent history, archived sources and insufficient roles", async () => {
  const exited = await moveRequest(copyIds.exited!, destinationId, owner);
  const inconsistent = await moveRequest(
    copyIds.inconsistent!,
    destinationId,
    owner,
  );
  const archived = await moveRequest(copyIds.archived!, destinationId, owner);
  const sourceDenied = await moveRequest(copyIds.role!, destinationId, viewer);
  const destinationDenied = await moveRequest(
    copyIds.role!,
    restrictedDestinationId,
    owner,
  );

  expect(ErrorResponseSchema.parse(await exited.json()).error.code).toBe(
    "COPY_NOT_ACTIVE",
  );
  expect(ErrorResponseSchema.parse(await inconsistent.json()).error.code).toBe(
    "COPY_HISTORY_INCONSISTENT",
  );
  expect(ErrorResponseSchema.parse(await archived.json()).error.code).toBe(
    "SOURCE_COLLECTION_ARCHIVED",
  );
  expect(ErrorResponseSchema.parse(await sourceDenied.json()).error.code).toBe(
    "SOURCE_COLLECTION_ROLE_DENIED",
  );
  expect(
    ErrorResponseSchema.parse(await destinationDenied.json()).error.code,
  ).toBe("DESTINATION_COLLECTION_ROLE_DENIED");
});

test("requires an accessible destination, authentication, permission and CSRF", async () => {
  const unknownDestination = await moveRequest(
    copyIds.role!,
    randomUUID(),
    owner,
  );
  const hiddenCopy = await moveRequest(copyIds.role!, destinationId, outsider);
  const anonymous = await moveRequest(copyIds.role!, destinationId);
  const csrf = await moveRequest(
    copyIds.role!,
    destinationId,
    owner,
    "invalid-token",
  );

  expect(unknownDestination.status).toBe(404);
  expect(hiddenCopy.status).toBe(404);
  expect(anonymous.status).toBe(401);
  expect(csrf.status).toBe(403);

  await databasePool.query("DELETE FROM user_roles WHERE user_id = $1", [
    outsider.id,
  ]);
  const permission = await moveRequest(copyIds.role!, destinationId, outsider);
  expect(permission.status).toBe(403);
  expect(ErrorResponseSchema.parse(await permission.json()).error.code).toBe(
    "PERMISSION_DENIED",
  );
});

test("rolls back location and both history changes if auditing fails", async () => {
  await databasePool.query(`
    CREATE OR REPLACE FUNCTION fail_copy_move_audit_for_test() RETURNS trigger AS $$
    BEGIN
      IF NEW.action = 'copy.moved' THEN
        RAISE EXCEPTION 'forced move audit failure';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_copy_move_audit_for_test
    BEFORE INSERT ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fail_copy_move_audit_for_test();
  `);

  try {
    const response = await moveRequest(copyIds.rollback!, destinationId, owner);
    expect(response.status).toBe(500);
  } finally {
    await databasePool.query(
      "DROP TRIGGER IF EXISTS fail_copy_move_audit_for_test ON audit_logs",
    );
    await databasePool.query(
      "DROP FUNCTION IF EXISTS fail_copy_move_audit_for_test",
    );
  }

  const persisted = await databasePool.query<{
    current_collection_id: string;
    open_collection_id: string;
    history_count: string;
  }>(
    `SELECT copies.current_collection_id,
            max(history.collection_id::text) FILTER (WHERE history.ended_at IS NULL) AS open_collection_id,
            COUNT(*)::text AS history_count
     FROM copies
     INNER JOIN copy_collection_history AS history ON history.copy_id = copies.id
     WHERE copies.id = $1
     GROUP BY copies.id`,
    [copyIds.rollback],
  );
  expect(persisted.rows[0]).toEqual({
    current_collection_id: sourceId,
    open_collection_id: sourceId,
    history_count: "1",
  });
});
