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
let collectionId: string;
let archivedCollectionId: string;
let gameId: string;
let acquisitionId: string;
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
      email: `copy-exit-${label}-${suffix}@example.com`,
      username: `copy_exit_${label}_${suffix}`,
      password: "a sufficiently long copy exit password",
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
       ('PERSONAL', 'ACTIVE', 'Exit collection', 'PRIVATE', $1, NULL),
       ('PERSONAL', 'ARCHIVED', 'Archived exit collection', 'PRIVATE', $1, CURRENT_TIMESTAMP)
     RETURNING id, name`,
    [owner.id],
  );
  collectionId = collections.rows.find(
    ({ name }) => name === "Exit collection",
  )!.id;
  archivedCollectionId = collections.rows.find(
    ({ name }) => name === "Archived exit collection",
  )!.id;
  await databasePool.query(
    `INSERT INTO collection_members (collection_id, user_id, role_code)
     VALUES
       ($1, $3, 'OWNER'), ($1, $4, 'MANAGER'), ($1, $5, 'VIEWER'),
       ($2, $3, 'OWNER')`,
    [collectionId, archivedCollectionId, owner.id, manager.id, viewer.id],
  );

  const game = await databasePool.query<{ id: string }>(
    `INSERT INTO games (
       name, min_players, max_players, classification_code,
       visibility_code, moderation_status_code
     ) VALUES ('Copy exit game', 1, 4, 'OFFICIAL', 'PUBLIC', 'APPROVED')
     RETURNING id`,
  );
  gameId = game.rows[0]!.id;
  const labels = [
    "success",
    "concurrent",
    "already-exited",
    "archived",
    "role",
    "inconsistent",
    "rollback",
  ];
  const copies = await databasePool.query<{ id: string; alias: string }>(
    `INSERT INTO copies (
       game_id, current_collection_id, lifecycle_code, condition_code,
       alias, exit_reason_code, exited_at, created_by_user_id
     ) VALUES
       ($1, $2, 'ACTIVE', 'DAMAGED', 'success', NULL, NULL, $4),
       ($1, $2, 'ACTIVE', 'GOOD', 'concurrent', NULL, NULL, $4),
       ($1, NULL, 'EXITED', 'GOOD', 'already-exited', 'GIFTED', CURRENT_TIMESTAMP, $4),
       ($1, $3, 'ACTIVE', 'GOOD', 'archived', NULL, NULL, $4),
       ($1, $2, 'ACTIVE', 'GOOD', 'role', NULL, NULL, $4),
       ($1, $2, 'ACTIVE', 'GOOD', 'inconsistent', NULL, NULL, $4),
       ($1, $2, 'ACTIVE', 'GOOD', 'rollback', NULL, NULL, $4)
     RETURNING id, alias`,
    [gameId, collectionId, archivedCollectionId, owner.id],
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
       ($6, $8, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 day', $10),
       ($7, $8, CURRENT_TIMESTAMP - INTERVAL '1 day', NULL, $10)`,
    [
      copyIds.success,
      copyIds.concurrent,
      copyIds["already-exited"],
      copyIds.archived,
      copyIds.role,
      copyIds.inconsistent,
      copyIds.rollback,
      collectionId,
      archivedCollectionId,
      owner.id,
    ],
  );
  const acquisition = await databasePool.query<{ id: string }>(
    `INSERT INTO acquisitions (
       copy_id, collection_id, acquired_by_user_id, type_code,
       acquired_on, price_amount, currency_code, source_name
     ) VALUES ($1, $2, $3, 'PURCHASE', CURRENT_DATE, 42.50, 'USD', 'Local shop')
     RETURNING id`,
    [copyIds.success, collectionId, owner.id],
  );
  acquisitionId = acquisition.rows[0]!.id;
});

afterAll(async () => {
  const ids = Object.values(copyIds);
  await databasePool.query(
    "DELETE FROM audit_logs WHERE resource_id = ANY($1::uuid[])",
    [ids],
  );
  await databasePool.query("DELETE FROM acquisitions WHERE id = $1", [
    acquisitionId,
  ]);
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
    [[collectionId, archivedCollectionId]],
  );
  await databasePool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
    [owner.id, manager.id, viewer.id, outsider.id],
  ]);
  server.close();
  await closeDatabase();
});

async function exitRequest(
  copyId: string,
  reason: string,
  identity?: Identity,
  csrfOverride?: string,
) {
  return fetch(`${baseUrl}/api/v1/copies/${copyId}/exit`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
      ...(identity ? { cookie: identity.cookie } : {}),
      ...(identity ? { "x-csrf-token": csrfOverride ?? identity.csrf } : {}),
    },
    body: JSON.stringify({ reason }),
  });
}

test("exits a damaged active copy and preserves its history and acquisition", async () => {
  const response = await exitRequest(copyIds.success!, "DAMAGED", manager);
  const body = CopyDetailResponseSchema.parse(await response.json());

  expect(response.status).toBe(200);
  expect(body.copy).toMatchObject({
    id: copyIds.success,
    currentCollectionId: null,
    lifecycle: "EXITED",
    condition: "DAMAGED",
    exitReason: "DAMAGED",
  });
  expect(body.copy.exitedAt).not.toBeNull();
  expect(body.copy.collectionHistory).toHaveLength(1);
  expect(body.copy.collectionHistory[0]?.endedAt).toBe(body.copy.exitedAt);
  expect(body.copy.acquisitions.map(({ id }) => id)).toContain(acquisitionId);

  const audit = await databasePool.query<{
    before_state: { lifecycle: string; currentCollectionId: string };
    after_state: { lifecycle: string; currentCollectionId: null };
  }>(
    `SELECT before_state, after_state FROM audit_logs
     WHERE resource_id = $1 AND action = 'copy.exited'`,
    [copyIds.success],
  );
  expect(audit.rows[0]?.before_state).toMatchObject({
    lifecycle: "ACTIVE",
    currentCollectionId: collectionId,
  });
  expect(audit.rows[0]?.after_state).toMatchObject({
    lifecycle: "EXITED",
    currentCollectionId: null,
  });
});

test("serializes concurrent exits and applies the transition only once", async () => {
  const responses = await Promise.all([
    exitRequest(copyIds.concurrent!, "SOLD", owner),
    exitRequest(copyIds.concurrent!, "SOLD", owner),
  ]);
  expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);

  const persisted = await databasePool.query<{
    lifecycle_code: string;
    current_collection_id: string | null;
    open_count: string;
    audit_count: string;
  }>(
    `SELECT copies.lifecycle_code, copies.current_collection_id,
            COUNT(history.id) FILTER (WHERE history.ended_at IS NULL)::text AS open_count,
            COUNT(DISTINCT audit_logs.id)::text AS audit_count
     FROM copies
     INNER JOIN copy_collection_history AS history ON history.copy_id = copies.id
     LEFT JOIN audit_logs
       ON audit_logs.resource_id = copies.id AND audit_logs.action = 'copy.exited'
     WHERE copies.id = $1
     GROUP BY copies.id`,
    [copyIds.concurrent],
  );
  expect(persisted.rows[0]).toEqual({
    lifecycle_code: "EXITED",
    current_collection_id: null,
    open_count: "0",
    audit_count: "1",
  });
});

test("rejects repeated exit, archived collection, viewer role and inconsistent history", async () => {
  const alreadyExited = await exitRequest(
    copyIds["already-exited"]!,
    "SOLD",
    owner,
  );
  const archived = await exitRequest(copyIds.archived!, "LOST", owner);
  const roleDenied = await exitRequest(copyIds.role!, "GIFTED", viewer);
  const inconsistent = await exitRequest(
    copyIds.inconsistent!,
    "DISCARDED",
    owner,
  );

  expect(ErrorResponseSchema.parse(await alreadyExited.json()).error.code).toBe(
    "COPY_NOT_ACTIVE",
  );
  expect(ErrorResponseSchema.parse(await archived.json()).error.code).toBe(
    "COLLECTION_ARCHIVED",
  );
  expect(ErrorResponseSchema.parse(await roleDenied.json()).error.code).toBe(
    "COLLECTION_ROLE_DENIED",
  );
  expect(ErrorResponseSchema.parse(await inconsistent.json()).error.code).toBe(
    "COPY_HISTORY_INCONSISTENT",
  );
});

test("validates the reason and requires visibility, authentication, permission and CSRF", async () => {
  const invalidReason = await exitRequest(copyIds.role!, "BROKEN", owner);
  const hidden = await exitRequest(copyIds.role!, "OTHER", outsider);
  const anonymous = await exitRequest(copyIds.role!, "OTHER");
  const csrf = await exitRequest(copyIds.role!, "OTHER", owner, "invalid");

  expect(invalidReason.status).toBe(400);
  expect(hidden.status).toBe(404);
  expect(anonymous.status).toBe(401);
  expect(csrf.status).toBe(403);

  await databasePool.query("DELETE FROM user_roles WHERE user_id = $1", [
    outsider.id,
  ]);
  const permission = await exitRequest(copyIds.role!, "OTHER", outsider);
  expect(permission.status).toBe(403);
  expect(ErrorResponseSchema.parse(await permission.json()).error.code).toBe(
    "PERMISSION_DENIED",
  );
});

test("rolls back lifecycle and history if exit auditing fails", async () => {
  await databasePool.query(`
    CREATE OR REPLACE FUNCTION fail_copy_exit_audit_for_test() RETURNS trigger AS $$
    BEGIN
      IF NEW.action = 'copy.exited' THEN
        RAISE EXCEPTION 'forced exit audit failure';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_copy_exit_audit_for_test
    BEFORE INSERT ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fail_copy_exit_audit_for_test();
  `);

  try {
    const response = await exitRequest(copyIds.rollback!, "DONATED", owner);
    expect(response.status).toBe(500);
  } finally {
    await databasePool.query(
      "DROP TRIGGER IF EXISTS fail_copy_exit_audit_for_test ON audit_logs",
    );
    await databasePool.query(
      "DROP FUNCTION IF EXISTS fail_copy_exit_audit_for_test",
    );
  }

  const persisted = await databasePool.query<{
    lifecycle_code: string;
    current_collection_id: string;
    open_count: string;
  }>(
    `SELECT copies.lifecycle_code, copies.current_collection_id,
            COUNT(*) FILTER (WHERE history.ended_at IS NULL)::text AS open_count
     FROM copies
     INNER JOIN copy_collection_history AS history ON history.copy_id = copies.id
     WHERE copies.id = $1
     GROUP BY copies.id`,
    [copyIds.rollback],
  );
  expect(persisted.rows[0]).toEqual({
    lifecycle_code: "ACTIVE",
    current_collection_id: collectionId,
    open_count: "1",
  });
});
