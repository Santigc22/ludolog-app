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
let copyId: string;
let archivedCopyId: string;

async function register(label: string): Promise<Identity> {
  const suffix = randomUUID().slice(0, 8);
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: `copy-update-${label}-${suffix}@example.com`,
      username: `copy_update_${label}_${suffix}`,
      password: "a sufficiently long copy update password",
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

  const collections = await databasePool.query<{ id: string }>(
    `INSERT INTO collections (
       type_code, status_code, name, visibility_code, created_by_user_id,
       archived_at
     ) VALUES
       ('PERSONAL', 'ACTIVE', 'Editable copies', 'PRIVATE', $1, NULL),
       ('PERSONAL', 'ARCHIVED', 'Archived copies', 'PRIVATE', $1, CURRENT_TIMESTAMP)
     RETURNING id`,
    [owner.id],
  );
  collectionId = collections.rows[0]!.id;
  archivedCollectionId = collections.rows[1]!.id;
  await databasePool.query(
    `INSERT INTO collection_members (collection_id, user_id, role_code)
     VALUES
       ($1, $2, 'OWNER'), ($1, $3, 'MANAGER'), ($1, $4, 'VIEWER'),
       ($5, $2, 'OWNER')`,
    [collectionId, owner.id, manager.id, viewer.id, archivedCollectionId],
  );

  const game = await databasePool.query<{ id: string }>(
    `INSERT INTO games (
       name, min_players, max_players, classification_code,
       visibility_code, moderation_status_code
     ) VALUES ('Copy update game', 1, 4, 'OFFICIAL', 'PUBLIC', 'APPROVED')
     RETURNING id`,
  );
  gameId = game.rows[0]!.id;
  const copies = await databasePool.query<{ id: string; alias: string }>(
    `INSERT INTO copies (
       game_id, current_collection_id, lifecycle_code, condition_code,
       alias, notes, created_by_user_id, created_at, updated_at
     ) VALUES
       ($1, $2, 'ACTIVE', 'GOOD', 'Editable copy', 'Original notes', $3,
        CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'),
       ($1, $4, 'ACTIVE', 'GOOD', 'Archived copy', NULL, $3,
        CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days')
     RETURNING id, alias`,
    [gameId, collectionId, owner.id, archivedCollectionId],
  );
  copyId = copies.rows.find((row) => row.alias === "Editable copy")!.id;
  archivedCopyId = copies.rows.find((row) => row.alias === "Archived copy")!.id;
  await databasePool.query(
    `INSERT INTO copy_collection_history (
       copy_id, collection_id, changed_by_user_id
     ) VALUES ($1, $2, $3), ($4, $5, $3)`,
    [copyId, collectionId, owner.id, archivedCopyId, archivedCollectionId],
  );
});

afterAll(async () => {
  const userIds = [owner.id, manager.id, viewer.id, outsider.id];
  await databasePool.query(
    "DELETE FROM audit_logs WHERE resource_id = ANY($1::uuid[])",
    [[copyId, archivedCopyId]],
  );
  await databasePool.query(
    "DELETE FROM copy_collection_history WHERE copy_id = ANY($1::uuid[])",
    [[copyId, archivedCopyId]],
  );
  await databasePool.query("DELETE FROM copies WHERE id = ANY($1::uuid[])", [
    [copyId, archivedCopyId],
  ]);
  await databasePool.query("DELETE FROM games WHERE id = $1", [gameId]);
  await databasePool.query(
    "DELETE FROM collections WHERE id = ANY($1::uuid[])",
    [[collectionId, archivedCollectionId]],
  );
  await databasePool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
    userIds,
  ]);
  server.close();
  await closeDatabase();
});

async function updateRequest(
  targetCopyId: string,
  body: Record<string, unknown>,
  identity?: Identity,
  csrfOverride?: string,
) {
  return fetch(`${baseUrl}/api/v1/copies/${targetCopyId}`, {
    method: "PATCH",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
      ...(identity ? { cookie: identity.cookie } : {}),
      ...(identity ? { "x-csrf-token": csrfOverride ?? identity.csrf } : {}),
    },
    body: JSON.stringify(body),
  });
}

test("updates approved metadata, keeps a damaged copy active, and audits both states", async () => {
  const response = await updateRequest(
    copyId,
    {
      alias: "Damaged but playable",
      notes: "One corner is worn",
      condition: "DAMAGED",
    },
    owner,
  );
  const body = CopyDetailResponseSchema.parse(await response.json());

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(body.copy).toMatchObject({
    id: copyId,
    alias: "Damaged but playable",
    notes: "One corner is worn",
    condition: "DAMAGED",
    lifecycle: "ACTIVE",
    currentCollectionId: collectionId,
    exitReason: null,
    exitedAt: null,
  });
  expect(body.copy.updatedAt).not.toBe(body.copy.createdAt);

  const audit = await databasePool.query<{
    before_state: { condition: string; alias: string };
    after_state: { condition: string; alias: string };
  }>(
    `SELECT before_state, after_state
     FROM audit_logs
     WHERE resource_id = $1 AND action = 'copy.updated'
     ORDER BY occurred_at DESC LIMIT 1`,
    [copyId],
  );
  expect(audit.rows[0]?.before_state).toMatchObject({
    condition: "GOOD",
    alias: "Editable copy",
  });
  expect(audit.rows[0]?.after_state).toMatchObject({
    condition: "DAMAGED",
    alias: "Damaged but playable",
  });
});

test("allows a manager to clear optional metadata", async () => {
  const response = await updateRequest(
    copyId,
    { alias: null, notes: null },
    manager,
  );
  const body = CopyDetailResponseSchema.parse(await response.json());
  expect(response.status).toBe(200);
  expect(body.copy.alias).toBeNull();
  expect(body.copy.notes).toBeNull();
  expect(body.copy.condition).toBe("DAMAGED");
});

test("rejects lifecycle operations and empty updates", async () => {
  for (const payload of [
    {},
    { lifecycle: "EXITED" },
    { currentCollectionId: null },
    { exitReason: "SOLD", exitedAt: "2026-09-22T00:00:00.000Z" },
  ]) {
    const response = await updateRequest(copyId, payload, owner);
    expect(response.status).toBe(400);
    expect(ErrorResponseSchema.parse(await response.json()).error.code).toBe(
      "VALIDATION_ERROR",
    );
  }
});

test("enforces role, latest collection access, active collection, permission and CSRF", async () => {
  const viewerResponse = await updateRequest(
    copyId,
    { alias: "Denied" },
    viewer,
  );
  const outsiderResponse = await updateRequest(
    copyId,
    { alias: "Hidden" },
    outsider,
  );
  const archivedResponse = await updateRequest(
    archivedCopyId,
    { alias: "Denied archived" },
    owner,
  );
  const anonymousResponse = await updateRequest(copyId, {
    alias: "No session",
  });
  const csrfResponse = await updateRequest(
    copyId,
    { alias: "Wrong token" },
    owner,
    "invalid-token",
  );

  expect(viewerResponse.status).toBe(403);
  expect(outsiderResponse.status).toBe(404);
  expect(archivedResponse.status).toBe(409);
  expect(anonymousResponse.status).toBe(401);
  expect(csrfResponse.status).toBe(403);

  await databasePool.query("DELETE FROM user_roles WHERE user_id = $1", [
    outsider.id,
  ]);
  const permissionResponse = await updateRequest(
    copyId,
    { alias: "No permission" },
    outsider,
  );
  expect(permissionResponse.status).toBe(403);
  expect(
    ErrorResponseSchema.parse(await permissionResponse.json()).error.code,
  ).toBe("PERMISSION_DENIED");
});

test("rolls back metadata when audit insertion fails", async () => {
  const before = await databasePool.query<{
    condition_code: string;
    alias: string | null;
  }>("SELECT condition_code, alias FROM copies WHERE id = $1", [copyId]);
  await databasePool.query(`
    CREATE OR REPLACE FUNCTION fail_copy_update_audit_for_test() RETURNS trigger AS $$
    BEGIN
      IF NEW.action = 'copy.updated' THEN
        RAISE EXCEPTION 'forced update audit failure';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_copy_update_audit_for_test
    BEFORE INSERT ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fail_copy_update_audit_for_test();
  `);

  try {
    const response = await updateRequest(
      copyId,
      { condition: "POOR", alias: "Must roll back" },
      owner,
    );
    expect(response.status).toBe(500);
  } finally {
    await databasePool.query(
      "DROP TRIGGER IF EXISTS fail_copy_update_audit_for_test ON audit_logs",
    );
    await databasePool.query(
      "DROP FUNCTION IF EXISTS fail_copy_update_audit_for_test",
    );
  }

  const after = await databasePool.query<{
    condition_code: string;
    alias: string | null;
  }>("SELECT condition_code, alias FROM copies WHERE id = $1", [copyId]);
  expect(after.rows[0]).toEqual(before.rows[0]);
});
