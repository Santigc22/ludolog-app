import { randomUUID } from "node:crypto";

import type {
  GameCoverUploadResponse,
  MediaVariantQuery,
  OwnProfileResponse,
} from "@ludoteca/contracts";

import { ApplicationError } from "../../errors/application-error.js";
import { objectStorage } from "../../infrastructure/files/index.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { getProfileForUser } from "../profile/profile.service.js";
import { processImage, type ImagePurpose } from "./image-processor.js";
import {
  findReadableMedia,
  replaceAvatarAsset,
  replaceGameCoverAsset,
  type ReplacedAsset,
  type StoredAssetInput,
} from "./media.repository.js";

function objectKeys(purpose: ImagePurpose, id: string) {
  const directory = purpose === "USER_AVATAR" ? "avatars" : "game-covers";
  return {
    primaryObjectKey: `${directory}/${id}/primary.webp`,
    thumbnailObjectKey: `${directory}/${id}/thumbnail.webp`,
  };
}

async function removeFiles(asset: ReplacedAsset | null) {
  if (asset === null) return;
  await Promise.all([
    objectStorage.delete(asset.primaryObjectKey),
    objectStorage.delete(asset.thumbnailObjectKey),
  ]).catch((error) => {
    logger.error("media_cleanup_failed", { asset, error });
  });
}

async function prepareAsset(
  input: Buffer,
  purpose: ImagePurpose,
): Promise<StoredAssetInput> {
  const id = randomUUID();
  const processed = await processImage(input, purpose);
  return { id, purpose, ...objectKeys(purpose, id), ...processed };
}

async function writeAsset(asset: StoredAssetInput) {
  try {
    await objectStorage.put(asset.primaryObjectKey, asset.primary);
    await objectStorage.put(asset.thumbnailObjectKey, asset.thumbnail);
  } catch (error) {
    await Promise.all([
      objectStorage.delete(asset.primaryObjectKey),
      objectStorage.delete(asset.thumbnailObjectKey),
    ]);
    throw error;
  }
}

async function discardAsset(asset: StoredAssetInput) {
  await Promise.all([
    objectStorage.delete(asset.primaryObjectKey),
    objectStorage.delete(asset.thumbnailObjectKey),
  ]);
}

export async function uploadOwnAvatar(
  userId: string,
  input: Buffer,
): Promise<OwnProfileResponse> {
  const asset = await prepareAsset(input, "USER_AVATAR");
  await writeAsset(asset);
  let storedInDatabase = false;
  try {
    const result = await replaceAvatarAsset(userId, asset);
    if (result.kind === "not_found") {
      throw new ApplicationError({
        code: "PROFILE_NOT_FOUND",
        message: "The profile does not exist.",
        statusCode: 404,
      });
    }
    storedInDatabase = true;
    await removeFiles(result.replaced);
    return getProfileForUser(userId);
  } catch (error) {
    if (!storedInDatabase) await discardAsset(asset);
    throw error;
  }
}

export async function uploadGameCover(
  gameId: string,
  userId: string,
  input: Buffer,
): Promise<GameCoverUploadResponse> {
  const asset = await prepareAsset(input, "GAME_COVER");
  await writeAsset(asset);
  let storedInDatabase = false;
  try {
    const result = await replaceGameCoverAsset(gameId, userId, asset);
    if (result.kind === "not_found") {
      throw new ApplicationError({
        code: "GAME_NOT_FOUND",
        message: "The game does not exist.",
        statusCode: 404,
      });
    }
    if (result.kind === "denied") {
      throw new ApplicationError({
        code: "GAME_COVER_ACCESS_DENIED",
        message: "You cannot update this game cover.",
        statusCode: 403,
      });
    }
    storedInDatabase = true;
    await removeFiles(result.replaced);
    return { coverMediaId: asset.id };
  } catch (error) {
    if (!storedInDatabase) await discardAsset(asset);
    throw error;
  }
}

export async function readMedia(
  mediaId: string,
  viewerUserId: string | null,
  query: MediaVariantQuery,
) {
  const media = await findReadableMedia(mediaId, viewerUserId);
  if (media === null || !media.is_allowed) {
    throw new ApplicationError({
      code: "MEDIA_NOT_FOUND",
      message: "The media asset does not exist.",
      statusCode: 404,
    });
  }
  const objectKey =
    query.variant === "thumbnail"
      ? media.thumbnail_object_key
      : media.primary_object_key;
  try {
    return {
      contents: await objectStorage.read(objectKey),
      mimeType: media.mime_type,
      checksumSha256: media.checksum_sha256,
      isPublic: media.is_public,
    };
  } catch (error) {
    throw new ApplicationError({
      code: "MEDIA_FILE_MISSING",
      message: "The media file is unavailable.",
      statusCode: 404,
      cause: error,
    });
  }
}
