import type { PoolClient } from "pg";

import { databasePool } from "../../infrastructure/database/index.js";
import type { ImagePurpose, ProcessedImage } from "./image-processor.js";

export type StoredAssetInput = ProcessedImage &
  Readonly<{
    id: string;
    purpose: ImagePurpose;
    primaryObjectKey: string;
    thumbnailObjectKey: string;
  }>;

export type ReplacedAsset = Readonly<{
  primaryObjectKey: string;
  thumbnailObjectKey: string;
}>;

export type ReadableMedia = Readonly<{
  id: string;
  purpose_code: ImagePurpose;
  primary_object_key: string;
  thumbnail_object_key: string;
  mime_type: string;
  checksum_sha256: string;
  is_public: boolean;
  is_allowed: boolean;
}>;

async function insertAsset(
  client: PoolClient,
  userId: string,
  asset: StoredAssetInput,
) {
  await client.query(
    `INSERT INTO media_assets (
       id, purpose_code, primary_object_key, thumbnail_object_key,
       mime_type, byte_size, width, height, checksum_sha256,
       created_by_user_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      asset.id,
      asset.purpose,
      asset.primaryObjectKey,
      asset.thumbnailObjectKey,
      asset.mimeType,
      asset.primary.length,
      asset.width,
      asset.height,
      asset.checksumSha256,
      userId,
    ],
  );
}

async function deleteReplacedAsset(
  client: PoolClient,
  oldMediaId: string | null,
): Promise<ReplacedAsset | null> {
  if (oldMediaId === null) return null;
  const deleted = await client.query<{
    primary_object_key: string;
    thumbnail_object_key: string;
  }>(
    `DELETE FROM media_assets
     WHERE id = $1
     RETURNING primary_object_key, thumbnail_object_key`,
    [oldMediaId],
  );
  const row = deleted.rows[0];
  return row === undefined
    ? null
    : {
        primaryObjectKey: row.primary_object_key,
        thumbnailObjectKey: row.thumbnail_object_key,
      };
}

export async function replaceAvatarAsset(
  userId: string,
  asset: StoredAssetInput,
): Promise<
  { kind: "not_found" } | { kind: "success"; replaced: ReplacedAsset | null }
> {
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const profile = await client.query<{ avatar_media_id: string | null }>(
      `SELECT avatar_media_id FROM profiles WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    const current = profile.rows[0];
    if (current === undefined) {
      await client.query("ROLLBACK");
      return { kind: "not_found" };
    }
    await insertAsset(client, userId, asset);
    await client.query(
      `UPDATE profiles
       SET avatar_media_id = $2, avatar_url = NULL, updated_at = now()
       WHERE user_id = $1`,
      [userId, asset.id],
    );
    const replaced = await deleteReplacedAsset(client, current.avatar_media_id);
    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, resource_type, resource_id, after_state, context
       ) VALUES ($1, 'profile.avatar_updated', 'USER', $1, $2::jsonb, $3::jsonb)`,
      [
        userId,
        JSON.stringify({ avatarMediaId: asset.id }),
        JSON.stringify({ replacedMediaId: current.avatar_media_id }),
      ],
    );
    await client.query("COMMIT");
    return { kind: "success", replaced };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function replaceGameCoverAsset(
  gameId: string,
  userId: string,
  asset: StoredAssetInput,
): Promise<
  | { kind: "not_found" }
  | { kind: "denied" }
  | { kind: "success"; replaced: ReplacedAsset | null }
> {
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const game = await client.query<{
      cover_media_id: string | null;
      created_by_user_id: string | null;
      visibility_code: "PRIVATE" | "PUBLIC";
      moderation_status_code: string;
      can_moderate: boolean;
      can_manage_catalog: boolean;
    }>(
      `SELECT games.cover_media_id, games.created_by_user_id,
              games.visibility_code, games.moderation_status_code,
              EXISTS (
                SELECT 1 FROM user_roles
                INNER JOIN role_permissions
                  ON role_permissions.role_code = user_roles.role_code
                WHERE user_roles.user_id = $2
                  AND role_permissions.permission_code = 'moderation.approve'
              ) AS can_moderate
              , EXISTS (
                SELECT 1 FROM user_roles
                INNER JOIN role_permissions
                  ON role_permissions.role_code = user_roles.role_code
                WHERE user_roles.user_id = $2
                  AND role_permissions.permission_code = 'catalog.game.manage'
              ) AS can_manage_catalog
       FROM games
       WHERE games.id = $1 AND games.archived_at IS NULL
       FOR UPDATE OF games`,
      [gameId, userId],
    );
    const current = game.rows[0];
    if (current === undefined) {
      await client.query("ROLLBACK");
      return { kind: "not_found" };
    }
    const isPrivateOwner =
      current.visibility_code === "PRIVATE" &&
      current.created_by_user_id === userId;
    const isPendingModerator =
      current.moderation_status_code === "PENDING_REVIEW" &&
      current.can_moderate;
    const isPublicCatalogManager =
      current.visibility_code === "PUBLIC" && current.can_manage_catalog;
    if (!isPrivateOwner && !isPendingModerator && !isPublicCatalogManager) {
      await client.query("ROLLBACK");
      return { kind: "denied" };
    }

    await insertAsset(client, userId, asset);
    await client.query(
      `UPDATE games SET cover_media_id = $2, updated_at = now() WHERE id = $1`,
      [gameId, asset.id],
    );
    const replaced = await deleteReplacedAsset(client, current.cover_media_id);
    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, resource_type, resource_id, after_state, context
       ) VALUES ($1, 'game.cover_updated', 'GAME', $2, $3::jsonb, $4::jsonb)`,
      [
        userId,
        gameId,
        JSON.stringify({ coverMediaId: asset.id }),
        JSON.stringify({ replacedMediaId: current.cover_media_id }),
      ],
    );
    await client.query("COMMIT");
    return { kind: "success", replaced };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findReadableMedia(
  mediaId: string,
  viewerUserId: string | null,
): Promise<ReadableMedia | null> {
  const result = await databasePool.query<ReadableMedia>(
    `SELECT media_assets.id, media_assets.purpose_code,
            media_assets.primary_object_key,
            media_assets.thumbnail_object_key, media_assets.mime_type,
            media_assets.checksum_sha256,
            (
              (games.visibility_code = 'PUBLIC'
               AND games.moderation_status_code = 'APPROVED')
              OR profiles.visibility_code = 'PUBLIC'
            ) IS TRUE AS is_public,
            (
              (games.visibility_code = 'PUBLIC'
               AND games.moderation_status_code = 'APPROVED')
              OR profiles.visibility_code = 'PUBLIC'
              OR ($2::uuid IS NOT NULL AND games.created_by_user_id = $2)
              OR ($2::uuid IS NOT NULL AND profiles.user_id = $2)
              OR ($2::uuid IS NOT NULL AND EXISTS (
                SELECT 1 FROM user_roles
                INNER JOIN role_permissions
                  ON role_permissions.role_code = user_roles.role_code
                WHERE user_roles.user_id = $2
                  AND role_permissions.permission_code = 'moderation.view'
              ))
            ) IS TRUE AS is_allowed
     FROM media_assets
     LEFT JOIN games ON games.cover_media_id = media_assets.id
     LEFT JOIN profiles ON profiles.avatar_media_id = media_assets.id
     WHERE media_assets.id = $1`,
    [mediaId, viewerUserId],
  );
  return result.rows[0] ?? null;
}
