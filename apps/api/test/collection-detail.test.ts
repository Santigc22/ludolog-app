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

let baseUrl: string;
let server: Server;
let ownerId: string;
let viewerId: string;
let ownerEmail: string;
let viewerEmail: string;
let ownerCookie: string;
let viewerCookie: string;
let publicId: string;
let privateId: string;
let archivedId: string;

async function register(
  suffix: string,
  label: "owner" | "viewer",
): Promise<{ id: string; email: string; cookie: string }> {
  const email = `detail-${label}-${suffix}@example.com`;
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      username: `detail_${label}_${suffix}`,
      password: "a sufficiently long detail password",
    }),
  });
  const body = RegisterResponseSchema.parse(await response.json());

  return {
    id: body.user.id,
    email,
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
  const suffix = randomUUID().slice(0, 8);
  const owner = await register(suffix, "owner");
  const viewer = await register(suffix, "viewer");
  ownerId = owner.id;
  ownerEmail = owner.email;
  ownerCookie = owner.cookie;
  viewerId = viewer.id;
  viewerEmail = viewer.email;
  viewerCookie = viewer.cookie;

  const collections = await databasePool.query<{ id: string; name: string }>(
    `INSERT INTO collections (
       type_code, status_code, name, visibility_code, created_by_user_id,
       archived_at
     ) VALUES
       ('PERSONAL', 'ACTIVE', 'Public detail', 'PUBLIC', $1, NULL),
       ('PERSONAL', 'ACTIVE', 'Private detail', 'PRIVATE', $1, NULL),
       ('PERSONAL', 'ARCHIVED', 'Archived detail', 'PUBLIC', $1, CURRENT_TIMESTAMP)
     RETURNING id, name`,
    [ownerId],
  );
  const ids = new Map(collections.rows.map((row) => [row.name, row.id]));
  publicId = ids.get("Public detail") ?? "";
  privateId = ids.get("Private detail") ?? "";
  archivedId = ids.get("Archived detail") ?? "";

  await databasePool.query(
    `INSERT INTO collection_members (collection_id, user_id, role_code)
     VALUES
       ($1, $4, 'OWNER'),
       ($2, $4, 'OWNER'),
       ($2, $5, 'VIEWER'),
       ($3, $4, 'OWNER')`,
    [publicId, privateId, archivedId, ownerId, viewerId],
  );
});

afterAll(async () => {
  await databasePool.query(
    "DELETE FROM collections WHERE created_by_user_id = $1",
    [ownerId],
  );
  await databasePool.query("DELETE FROM users WHERE email = ANY($1::text[])", [
    [ownerEmail, viewerEmail],
  ]);
  server.close();
  await closeDatabase();
});

async function detailRequest(collectionId: string, cookie?: string) {
  return fetch(`${baseUrl}/api/v1/collections/${collectionId}`, {
    headers: {
      origin: apiConfig.webOrigin,
      ...(cookie === undefined ? {} : { cookie }),
    },
  });
}

test("allows anonymous read access only to active public metadata", async () => {
  const response = await detailRequest(publicId);
  const body = CollectionDetailResponseSchema.parse(await response.json());

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(body.collection).toMatchObject({
    name: "Public detail",
    effectiveRole: null,
    canEdit: false,
  });
});

test("returns the effective role and edit capability for members", async () => {
  const ownerResponse = await detailRequest(privateId, ownerCookie);
  const viewerResponse = await detailRequest(privateId, viewerCookie);
  const owner = CollectionDetailResponseSchema.parse(
    await ownerResponse.json(),
  );
  const viewer = CollectionDetailResponseSchema.parse(
    await viewerResponse.json(),
  );

  expect(owner.collection).toMatchObject({
    effectiveRole: "OWNER",
    canEdit: true,
  });
  expect(viewer.collection).toMatchObject({
    effectiveRole: "VIEWER",
    canEdit: false,
  });
});

test("allows members to read archived collections", async () => {
  const response = await detailRequest(archivedId, ownerCookie);
  const body = CollectionDetailResponseSchema.parse(await response.json());

  expect(response.status).toBe(200);
  expect(body.collection.status).toBe("ARCHIVED");
  expect(body.collection.effectiveRole).toBe("OWNER");
});

test("does not reveal private or archived collections to outsiders", async () => {
  const privateResponse = await detailRequest(privateId);
  const archivedResponse = await detailRequest(archivedId, viewerCookie);
  const privateBody = ErrorResponseSchema.parse(await privateResponse.json());
  const archivedBody = ErrorResponseSchema.parse(await archivedResponse.json());

  expect(privateResponse.status).toBe(404);
  expect(archivedResponse.status).toBe(404);
  expect(privateBody.error.code).toBe("COLLECTION_NOT_FOUND");
  expect(archivedBody.error.code).toBe("COLLECTION_NOT_FOUND");
});

test("validates identifiers and rejects invalid session cookies", async () => {
  const invalidId = await detailRequest("not-a-uuid");
  const invalidSession = await detailRequest(publicId, "id=invalid-session");

  expect(invalidId.status).toBe(400);
  expect(ErrorResponseSchema.parse(await invalidId.json()).error.code).toBe(
    "VALIDATION_ERROR",
  );
  expect(invalidSession.status).toBe(401);
  expect(
    ErrorResponseSchema.parse(await invalidSession.json()).error.code,
  ).toBe("SESSION_INVALID");
});
