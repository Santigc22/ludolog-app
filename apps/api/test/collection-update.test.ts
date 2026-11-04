import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  CollectionDetailResponseSchema,
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

type Identity = Readonly<{
  id: string;
  email: string;
  cookie: string;
  csrfToken: string;
}>;

let baseUrl: string;
let server: Server;
let owner: Identity;
let manager: Identity;
let viewer: Identity;
let outsider: Identity;
let collectionId: string;

async function register(suffix: string, label: string): Promise<Identity> {
  const email = `mutation-${label}-${suffix}@example.com`;
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      username: `mutation_${label}_${suffix}`,
      password: "a sufficiently long mutation password",
    }),
  });
  const body = RegisterResponseSchema.parse(await response.json());

  return {
    id: body.user.id,
    email,
    cookie: (response.headers.get("set-cookie") ?? "").split(";", 1)[0] ?? "",
    csrfToken: body.csrfToken,
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
  const suffix = randomUUID().slice(0, 8);
  [owner, manager, viewer, outsider] = await Promise.all([
    register(suffix, "owner"),
    register(suffix, "manager"),
    register(suffix, "viewer"),
    register(suffix, "outsider"),
  ]);

  const inserted = await databasePool.query<{ id: string }>(
    `INSERT INTO collections (
       type_code, status_code, name, visibility_code, created_by_user_id
     ) VALUES ('PERSONAL', 'ACTIVE', 'Mutable shelf', 'PRIVATE', $1)
     RETURNING id`,
    [owner.id],
  );
  collectionId = inserted.rows[0]?.id ?? "";

  await databasePool.query(
    `INSERT INTO collection_members (collection_id, user_id, role_code)
     VALUES ($1, $2, 'OWNER'), ($1, $3, 'MANAGER'), ($1, $4, 'VIEWER')`,
    [collectionId, owner.id, manager.id, viewer.id],
  );
});

afterAll(async () => {
  await databasePool.query("DELETE FROM collections WHERE id = $1", [
    collectionId,
  ]);
  await databasePool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
    [owner.id, manager.id, viewer.id, outsider.id],
  ]);
  server.close();
  await closeDatabase();
});

async function mutate(
  identity: Identity,
  method: "PATCH" | "POST",
  path = "",
  body?: unknown,
  csrfToken = identity.csrfToken,
) {
  return fetch(`${baseUrl}/api/v1/collections/${collectionId}${path}`, {
    method,
    headers: {
      origin: apiConfig.webOrigin,
      cookie: identity.cookie,
      "x-csrf-token": csrfToken,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("allows OWNER and MANAGER to edit permitted metadata", async () => {
  const ownerResponse = await mutate(owner, "PATCH", "", {
    name: "  Curated shelf  ",
    description: "Main room",
  });
  const managerResponse = await mutate(manager, "PATCH", "", {
    visibility: "PUBLIC",
  });
  const result = CollectionDetailResponseSchema.parse(
    await managerResponse.json(),
  );

  expect(ownerResponse.status).toBe(200);
  expect(managerResponse.status).toBe(200);
  expect(result.collection).toMatchObject({
    name: "Curated shelf",
    description: "Main room",
    visibility: "PUBLIC",
    effectiveRole: "MANAGER",
    canEdit: true,
  });
});

test("rejects server-owned fields and invalid CSRF", async () => {
  const controlled = await mutate(owner, "PATCH", "", {
    status: "ARCHIVED",
  });
  const csrf = await mutate(
    owner,
    "PATCH",
    "",
    { name: "Must not change" },
    "invalid-token",
  );

  expect(controlled.status).toBe(400);
  expect(ErrorResponseSchema.parse(await controlled.json()).error.code).toBe(
    "VALIDATION_ERROR",
  );
  expect(csrf.status).toBe(403);
  expect(ErrorResponseSchema.parse(await csrf.json()).error.code).toBe(
    "CSRF_TOKEN_INVALID",
  );
});

test("denies a VIEWER and hides the collection from a non-member", async () => {
  const viewerResponse = await mutate(viewer, "PATCH", "", {
    name: "Viewer edit",
  });
  const outsiderResponse = await mutate(outsider, "PATCH", "", {
    name: "Outsider edit",
  });

  expect(viewerResponse.status).toBe(403);
  expect(
    ErrorResponseSchema.parse(await viewerResponse.json()).error.code,
  ).toBe("COLLECTION_ROLE_DENIED");
  expect(outsiderResponse.status).toBe(404);
  expect(
    ErrorResponseSchema.parse(await outsiderResponse.json()).error.code,
  ).toBe("COLLECTION_NOT_FOUND");

  const invariant = await databasePool.query<{
    outsider_has_permission: boolean;
    owner_count: string;
    collection_name: string;
  }>(
    `SELECT
       EXISTS (
         SELECT 1
         FROM user_roles
         INNER JOIN role_permissions
           ON role_permissions.role_code = user_roles.role_code
         WHERE user_roles.user_id = $2
           AND role_permissions.permission_code = 'collection.update'
       ) AS outsider_has_permission,
       COUNT(*) FILTER (
         WHERE collection_members.role_code = 'OWNER'
       )::text AS owner_count,
       MIN(collections.name) AS collection_name
     FROM collections
     INNER JOIN collection_members
       ON collection_members.collection_id = collections.id
     WHERE collections.id = $1
     GROUP BY collections.id`,
    [collectionId, outsider.id],
  );

  expect(invariant.rows[0]).toEqual({
    outsider_has_permission: true,
    owner_count: "1",
    collection_name: "Curated shelf",
  });
});

test("allows only OWNER to archive and preserves every membership", async () => {
  const managerResponse = await mutate(manager, "POST", "/archive");
  expect(managerResponse.status).toBe(403);

  const ownerResponse = await mutate(owner, "POST", "/archive");
  const archived = CollectionDetailResponseSchema.parse(
    await ownerResponse.json(),
  );

  expect(ownerResponse.status).toBe(200);
  expect(archived.collection.status).toBe("ARCHIVED");
  expect(archived.collection.archivedAt).not.toBeNull();
  expect(archived.collection.canEdit).toBe(false);

  const memberships = await databasePool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM collection_members
     WHERE collection_id = $1`,
    [collectionId],
  );
  expect(memberships.rows[0]?.count).toBe("3");

  const repeated = await mutate(owner, "POST", "/archive");
  expect(repeated.status).toBe(200);
});

test("rejects edits after archival", async () => {
  const response = await mutate(owner, "PATCH", "", {
    name: "Archived edit",
  });

  expect(response.status).toBe(409);
  expect(ErrorResponseSchema.parse(await response.json()).error.code).toBe(
    "COLLECTION_ARCHIVED",
  );
});

test("allows the browser CSRF preflight for archival", async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/collections/${collectionId}/archive`,
    {
      method: "OPTIONS",
      headers: {
        origin: apiConfig.webOrigin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "x-csrf-token",
      },
    },
  );

  expect(response.status).toBe(204);
  expect(response.headers.get("access-control-allow-origin")).toBe(
    apiConfig.webOrigin,
  );
  expect(response.headers.get("access-control-allow-methods")).toBe("POST");
  expect(response.headers.get("access-control-allow-headers")).toBe(
    "X-CSRF-Token",
  );
});
