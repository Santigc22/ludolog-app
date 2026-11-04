import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  CollectionListResponseSchema,
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

let baseUrl: string;
let server: Server;
let memberEmail: string;
let outsiderEmail: string;
let memberId: string;
let outsiderId: string;
let sessionCookie: string;
let countedGameId: string;
let countedCopyId: string;

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
  memberEmail = `list-member-${suffix}@example.com`;
  outsiderEmail = `list-outsider-${suffix}@example.com`;

  const registration = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: memberEmail,
      username: `list_member_${suffix}`,
      password: "a sufficiently long listing password",
    }),
  });
  const registered = RegisterResponseSchema.parse(await registration.json());
  memberId = registered.user.id;
  sessionCookie =
    (registration.headers.get("set-cookie") ?? "").split(";", 1)[0] ?? "";

  const outsider = await databasePool.query<{ id: string }>(
    `INSERT INTO users (email, username, password_hash, status_code)
     VALUES ($1, $2, $3, 'ACTIVE') RETURNING id`,
    [outsiderEmail, `list_outsider_${suffix}`, "test-password-hash"],
  );
  outsiderId = outsider.rows[0]?.id ?? "";

  if (outsiderId === "") {
    throw new Error("Outsider test user was not created");
  }

  const inserted = await databasePool.query<{ id: string; name: string }>(
    `INSERT INTO collections (
       type_code, status_code, name, visibility_code, created_by_user_id,
       created_at, updated_at, archived_at
     ) VALUES
       ('PERSONAL', 'ACTIVE', 'Older active', 'PRIVATE', $1,
        '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL),
       ('PERSONAL', 'ACTIVE', 'Newer shared', 'PUBLIC', $2,
        '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z', NULL),
       ('PERSONAL', 'ARCHIVED', 'Archived member', 'PRIVATE', $1,
        '2026-03-01T00:00:00Z', '2026-03-01T00:00:00Z', '2026-04-01T00:00:00Z'),
       ('PERSONAL', 'ACTIVE', 'Outsider private', 'PRIVATE', $2,
        '2026-05-01T00:00:00Z', '2026-05-01T00:00:00Z', NULL)
     RETURNING id, name`,
    [memberId, outsiderId],
  );
  const ids = new Map(inserted.rows.map((row) => [row.name, row.id]));

  await databasePool.query(
    `INSERT INTO collection_members (collection_id, user_id, role_code)
     VALUES
       ($1, $4, 'OWNER'),
       ($2, $4, 'VIEWER'),
       ($2, $5, 'OWNER'),
       ($3, $4, 'MEMBER'),
       ($6, $5, 'OWNER')`,
    [
      ids.get("Older active"),
      ids.get("Newer shared"),
      ids.get("Archived member"),
      memberId,
      outsiderId,
      ids.get("Outsider private"),
    ],
  );

  const countedGame = await databasePool.query<{ id: string }>(
    `INSERT INTO games (
       name, min_players, max_players, classification_code,
       visibility_code, moderation_status_code
     ) VALUES ('Counted collection game', 2, 8, 'OFFICIAL', 'PUBLIC', 'APPROVED')
     RETURNING id`,
  );
  countedGameId = countedGame.rows[0]!.id;
  const countedCopy = await databasePool.query<{ id: string }>(
    `INSERT INTO copies (
       game_id, current_collection_id, lifecycle_code, condition_code,
       created_by_user_id
     ) VALUES ($1, $2, 'ACTIVE', 'GOOD', $3)
     RETURNING id`,
    [countedGameId, ids.get("Older active"), memberId],
  );
  countedCopyId = countedCopy.rows[0]!.id;
});

afterAll(async () => {
  await databasePool.query("DELETE FROM copies WHERE id = $1", [countedCopyId]);
  await databasePool.query("DELETE FROM games WHERE id = $1", [countedGameId]);
  await databasePool.query(
    "DELETE FROM collections WHERE created_by_user_id = ANY($1::uuid[])",
    [[memberId, outsiderId]],
  );
  await databasePool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
    [memberId, outsiderId],
  ]);
  server.close();
  await closeDatabase();
});

async function listRequest(query = "", cookie = sessionCookie) {
  return fetch(`${baseUrl}/api/v1/collections${query}`, {
    headers: { origin: apiConfig.webOrigin, cookie },
  });
}

test("lists only active collections where the user is a member", async () => {
  const response = await listRequest();
  const body = CollectionListResponseSchema.parse(await response.json());

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(body.collections.map(({ name }) => name)).toEqual([
    "Newer shared",
    "Older active",
  ]);
  expect(body.collections.map(({ effectiveRole }) => effectiveRole)).toEqual([
    "VIEWER",
    "OWNER",
  ]);
  expect(body.collections.map(({ gameCount }) => gameCount)).toEqual([0, 1]);
  expect(body.pagination).toEqual({
    page: 1,
    pageSize: 20,
    totalItems: 2,
    totalPages: 1,
  });
});

test("uses deterministic pagination", async () => {
  const first = CollectionListResponseSchema.parse(
    await (await listRequest("?page=1&pageSize=1")).json(),
  );
  const second = CollectionListResponseSchema.parse(
    await (await listRequest("?page=2&pageSize=1")).json(),
  );

  expect(first.collections[0]?.name).toBe("Newer shared");
  expect(second.collections[0]?.name).toBe("Older active");
  expect(first.pagination.totalPages).toBe(2);
  expect(second.pagination.totalItems).toBe(2);
});

test("includes archived memberships only through the explicit filter", async () => {
  const response = await listRequest("?includeArchived=true");
  const body = CollectionListResponseSchema.parse(await response.json());

  expect(body.pagination.totalItems).toBe(3);
  expect(body.collections.map(({ name }) => name)).toContain("Archived member");
});

test("rejects invalid filters and anonymous access", async () => {
  const invalid = await listRequest("?includeArchived=yes");
  const anonymous = await listRequest("", "missing=1");

  expect(invalid.status).toBe(400);
  expect(ErrorResponseSchema.parse(await invalid.json()).error.code).toBe(
    "VALIDATION_ERROR",
  );
  expect(anonymous.status).toBe(401);
  expect(ErrorResponseSchema.parse(await anonymous.json()).error.code).toBe(
    "AUTHENTICATION_REQUIRED",
  );
});
