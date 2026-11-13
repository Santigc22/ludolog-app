import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";

import {
  CreatePrivateGameResponseSchema,
  ErrorResponseSchema,
  GameCoverUploadResponseSchema,
  OwnProfileResponseSchema,
  RegisterResponseSchema,
} from "@ludoteca/contracts";
import sharp from "sharp";
import { afterAll, beforeAll, expect, test } from "vitest";

import { app } from "../src/app.js";
import { apiConfig } from "../src/config/environment.js";
import {
  closeDatabase,
  databasePool,
} from "../src/infrastructure/database/index.js";
import { objectStorage } from "../src/infrastructure/files/index.js";

let baseUrl: string;
let server: Server;
let userId: string;
let sessionCookie: string;
let csrfToken: string;
let gameId: string;

async function upload(path: string, image: Buffer, contentType = "image/jpeg") {
  return fetch(`${baseUrl}/api/v1/${path}`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      cookie: sessionCookie,
      "content-type": contentType,
      "x-csrf-token": csrfToken,
    },
    body: new Uint8Array(image),
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

  const suffix = randomUUID().slice(0, 8);
  const registration = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: `media-${suffix}@example.com`,
      username: `media_${suffix}`,
      password: "a sufficiently long media test password",
    }),
  });
  const account = RegisterResponseSchema.parse(await registration.json());
  userId = account.user.id;
  csrfToken = account.csrfToken;
  sessionCookie =
    (registration.headers.get("set-cookie") ?? "").split(";", 1)[0] ?? "";

  const gameResponse = await fetch(`${baseUrl}/api/v1/games`, {
    method: "POST",
    headers: {
      origin: apiConfig.webOrigin,
      cookie: sessionCookie,
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({
      name: "Media test game",
      minPlayers: 1,
      maxPlayers: 4,
    }),
  });
  const game = CreatePrivateGameResponseSchema.parse(await gameResponse.json());
  gameId = game.game.id;
});

afterAll(async () => {
  const assets = await databasePool.query<{
    primary_object_key: string;
    thumbnail_object_key: string;
  }>(
    `SELECT primary_object_key, thumbnail_object_key
     FROM media_assets WHERE created_by_user_id = $1`,
    [userId],
  );
  await databasePool.query("DELETE FROM audit_logs WHERE actor_user_id = $1", [
    userId,
  ]);
  await databasePool.query(
    "UPDATE profiles SET avatar_media_id = NULL WHERE user_id = $1",
    [userId],
  );
  await databasePool.query("DELETE FROM games WHERE id = $1", [gameId]);
  await databasePool.query(
    "DELETE FROM media_assets WHERE created_by_user_id = $1",
    [userId],
  );
  await databasePool.query("DELETE FROM users WHERE id = $1", [userId]);
  await Promise.all(
    assets.rows.flatMap((asset) => [
      objectStorage.delete(asset.primary_object_key),
      objectStorage.delete(asset.thumbnail_object_key),
    ]),
  );
  server.close();
  await closeDatabase();
});

test("stores optimized avatars and applies profile visibility", async () => {
  const source = await sharp({
    create: {
      width: 900,
      height: 600,
      channels: 3,
      background: "#1f5a43",
    },
  })
    .jpeg()
    .toBuffer();
  const response = await upload("profiles/me/avatar", source);
  const body = OwnProfileResponseSchema.parse(await response.json());

  expect(response.status).toBe(200);
  expect(body.profile.avatarMediaId).not.toBeNull();
  expect(body.profile.avatarUrl).toBeNull();
  const mediaId = body.profile.avatarMediaId!;

  const ownerRead = await fetch(
    `${baseUrl}/api/v1/media/${mediaId}?variant=thumbnail`,
    { headers: { cookie: sessionCookie } },
  );
  expect(ownerRead.status).toBe(200);
  expect(ownerRead.headers.get("content-type")).toContain("image/webp");
  expect(ownerRead.headers.get("cache-control")).toBe("private, no-store");
  expect((await sharp(await ownerRead.arrayBuffer()).metadata()).width).toBe(
    128,
  );

  const anonymousPrivate = await fetch(
    `${baseUrl}/api/v1/media/${mediaId}?variant=thumbnail`,
  );
  expect(anonymousPrivate.status).toBe(404);

  await databasePool.query(
    "UPDATE profiles SET visibility_code = 'PUBLIC' WHERE user_id = $1",
    [userId],
  );
  const anonymousPublic = await fetch(`${baseUrl}/api/v1/media/${mediaId}`);
  expect(anonymousPublic.status).toBe(200);
  expect(anonymousPublic.headers.get("cache-control")).toContain("public");
});

test("replaces private game covers and exposes an approved cover publicly", async () => {
  const firstSource = await sharp({
    create: {
      width: 1200,
      height: 1600,
      channels: 3,
      background: "#c98b3c",
    },
  })
    .png()
    .toBuffer();
  const firstResponse = await upload(
    `games/${gameId}/cover`,
    firstSource,
    "image/png",
  );
  const first = GameCoverUploadResponseSchema.parse(await firstResponse.json());
  expect(firstResponse.status).toBe(200);

  const anonymousPrivate = await fetch(
    `${baseUrl}/api/v1/media/${first.coverMediaId}`,
  );
  expect(anonymousPrivate.status).toBe(404);

  const secondSource = await sharp({
    create: {
      width: 640,
      height: 900,
      channels: 3,
      background: "#345e78",
    },
  })
    .jpeg()
    .toBuffer();
  const secondResponse = await upload(`games/${gameId}/cover`, secondSource);
  const second = GameCoverUploadResponseSchema.parse(
    await secondResponse.json(),
  );
  expect(second.coverMediaId).not.toBe(first.coverMediaId);

  const replaced = await fetch(
    `${baseUrl}/api/v1/media/${first.coverMediaId}`,
    {
      headers: { cookie: sessionCookie },
    },
  );
  expect(replaced.status).toBe(404);

  await databasePool.query(
    `UPDATE games
     SET classification_code = 'COMMUNITY', visibility_code = 'PUBLIC',
         moderation_status_code = 'APPROVED'
     WHERE id = $1`,
    [gameId],
  );
  const publicRead = await fetch(
    `${baseUrl}/api/v1/media/${second.coverMediaId}`,
  );
  expect(publicRead.status).toBe(200);
  expect(publicRead.headers.get("content-type")).toContain("image/webp");
  const etag = publicRead.headers.get("etag")!;
  const unchanged = await fetch(
    `${baseUrl}/api/v1/media/${second.coverMediaId}`,
    { headers: { "if-none-match": etag } },
  );
  expect(unchanged.status).toBe(304);

  const forbiddenReplacement = await upload(
    `games/${gameId}/cover`,
    firstSource,
  );
  expect(forbiddenReplacement.status).toBe(403);
  expect(
    ErrorResponseSchema.parse(await forbiddenReplacement.json()).error.code,
  ).toBe("GAME_COVER_ACCESS_DENIED");

  await databasePool.query("DELETE FROM user_roles WHERE user_id = $1", [
    userId,
  ]);
  await databasePool.query(
    `INSERT INTO user_roles (user_id, role_code, assigned_by_user_id)
     VALUES ($1, 'CONTENT_MANAGER', $1)`,
    [userId],
  );
  const managedReplacement = await upload(
    `games/${gameId}/cover`,
    firstSource,
    "image/png",
  );
  expect(managedReplacement.status).toBe(200);
  expect(
    GameCoverUploadResponseSchema.parse(await managedReplacement.json())
      .coverMediaId,
  ).not.toBe(second.coverMediaId);
});

test("rejects unsupported and invalid image uploads", async () => {
  const unsupported = await upload(
    "profiles/me/avatar",
    Buffer.from("not an image"),
    "text/plain",
  );
  const invalid = await upload(
    "profiles/me/avatar",
    Buffer.from("not an image"),
  );

  expect(unsupported.status).toBe(415);
  expect(ErrorResponseSchema.parse(await unsupported.json()).error.code).toBe(
    "IMAGE_TYPE_UNSUPPORTED",
  );
  expect(invalid.status).toBe(400);
  expect(ErrorResponseSchema.parse(await invalid.json()).error.code).toBe(
    "IMAGE_INVALID",
  );
});
