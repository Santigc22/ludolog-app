import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  CreateCollectionResponseSchema,
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
let email: string;
let userId: string;
let sessionCookie: string;
let csrfToken: string;
let suffix: string;

beforeAll(async () => {
  server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Expected an ephemeral TCP address");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
  suffix = randomUUID().slice(0, 8);
  email = `collection-${suffix}@example.com`;

  const registration = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      username: `collection_${suffix}`,
      password: "a sufficiently long collection password",
    }),
  });
  const body = RegisterResponseSchema.parse(await registration.json());
  const setCookie = registration.headers.get("set-cookie") ?? "";

  userId = body.user.id;
  csrfToken = body.csrfToken;
  sessionCookie = setCookie.split(";", 1)[0] ?? "";
});

afterAll(async () => {
  await databasePool.query(
    "DELETE FROM collections WHERE created_by_user_id = $1",
    [userId],
  );
  await databasePool.query("DELETE FROM users WHERE email = $1", [email]);
  server.close();
  await closeDatabase();
});

async function collectionRequest(
  body: unknown,
  options: { cookie?: string; csrf?: string } = {},
) {
  return fetch(`${baseUrl}/api/v1/collections`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
      cookie: options.cookie ?? sessionCookie,
      "x-csrf-token": options.csrf ?? csrfToken,
    },
    body: JSON.stringify(body),
  });
}

test("creates a personal collection and OWNER membership atomically", async () => {
  const response = await collectionRequest({
    name: "  My board games  ",
    description: "  Main shelf  ",
    visibility: "PUBLIC",
  });
  const body = CreateCollectionResponseSchema.parse(await response.json());

  expect(response.status).toBe(201);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(body.collection).toMatchObject({
    type: "PERSONAL",
    status: "ACTIVE",
    name: "My board games",
    description: "Main shelf",
    visibility: "PUBLIC",
    isForSale: false,
    createdByUserId: userId,
    effectiveRole: "OWNER",
    archivedAt: null,
  });

  const persisted = await databasePool.query<{
    role_code: string;
    member_count: string;
  }>(
    `SELECT MIN(collection_members.role_code) AS role_code,
            COUNT(collection_members.user_id)::text AS member_count
     FROM collections
     INNER JOIN collection_members
       ON collection_members.collection_id = collections.id
     WHERE collections.id = $1
     GROUP BY collections.id`,
    [body.collection.id],
  );

  expect(persisted.rows[0]).toEqual({
    role_code: "OWNER",
    member_count: "1",
  });
});

test("defaults visibility and nullable description on the server contract", async () => {
  const response = await collectionRequest({ name: "Second shelf" });
  const body = CreateCollectionResponseSchema.parse(await response.json());

  expect(response.status).toBe(201);
  expect(body.collection).toMatchObject({
    visibility: "PRIVATE",
    description: null,
    effectiveRole: "OWNER",
  });
});

test("rejects sale, group and server-owned fields", async () => {
  const sale = await collectionRequest({
    name: "Sale shelf",
    isForSale: true,
  });
  const group = await collectionRequest({
    name: "Group shelf",
    type: "GROUP",
  });
  const status = await collectionRequest({
    name: "Archived shelf",
    status: "ARCHIVED",
  });

  expect(sale.status).toBe(400);
  expect(group.status).toBe(400);
  expect(status.status).toBe(400);
  expect(ErrorResponseSchema.parse(await sale.json()).error.code).toBe(
    "VALIDATION_ERROR",
  );
});

test("requires authentication and a valid CSRF token", async () => {
  const anonymous = await collectionRequest(
    { name: "Anonymous shelf" },
    { cookie: "missing=1" },
  );
  const invalidCsrf = await collectionRequest(
    { name: "Invalid CSRF shelf" },
    { csrf: "invalid-token" },
  );

  expect(anonymous.status).toBe(401);
  expect(ErrorResponseSchema.parse(await anonymous.json()).error.code).toBe(
    "AUTHENTICATION_REQUIRED",
  );
  expect(invalidCsrf.status).toBe(403);
  expect(ErrorResponseSchema.parse(await invalidCsrf.json()).error.code).toBe(
    "CSRF_TOKEN_INVALID",
  );
});

test("rolls back the collection when OWNER membership creation fails", async () => {
  const rollbackName = `Rollback ${suffix}`;

  await databasePool.query(`
    CREATE OR REPLACE FUNCTION fail_test_collection_membership()
    RETURNS trigger AS $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM collections
        WHERE id = NEW.collection_id AND name = '${rollbackName}'
      ) THEN
        RAISE EXCEPTION 'forced membership failure';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_test_collection_membership_trigger
    BEFORE INSERT ON collection_members
    FOR EACH ROW EXECUTE FUNCTION fail_test_collection_membership();
  `);

  try {
    const response = await collectionRequest({ name: rollbackName });
    const body = ErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");

    const persisted = await databasePool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM collections
       WHERE created_by_user_id = $1 AND name = $2`,
      [userId, rollbackName],
    );
    expect(persisted.rows[0]?.count).toBe("0");
  } finally {
    await databasePool.query(
      "DROP TRIGGER IF EXISTS fail_test_collection_membership_trigger ON collection_members",
    );
    await databasePool.query(
      "DROP FUNCTION IF EXISTS fail_test_collection_membership()",
    );
  }
});
