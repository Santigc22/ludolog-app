import {
  GameIdParamsSchema,
  MediaIdParamsSchema,
  MediaVariantQuerySchema,
  type ErrorResponse,
  type GameCoverUploadResponse,
  type GameIdParams,
  type MediaIdParams,
  type OwnProfileResponse,
} from "@ludoteca/contracts";
import type { RequestHandler } from "express";

import { ApplicationError } from "../../errors/application-error.js";
import {
  readMedia,
  uploadGameCover,
  uploadOwnAvatar,
} from "./media.service.js";

function userId(request: Express.Request): string {
  if (request.auth === undefined) {
    throw new ApplicationError({
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication is required.",
      statusCode: 401,
    });
  }
  return request.auth.userId;
}

function imageBody(request: { body?: unknown }): Buffer {
  if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
    throw new ApplicationError({
      code: "IMAGE_INVALID",
      message: "A non-empty image body is required.",
      statusCode: 400,
    });
  }
  return request.body;
}

export const uploadAvatar: RequestHandler<
  Record<string, never>,
  OwnProfileResponse | ErrorResponse
> = async (request, response) => {
  const result = await uploadOwnAvatar(userId(request), imageBody(request));
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};

export const uploadCover: RequestHandler<
  GameIdParams,
  GameCoverUploadResponse | ErrorResponse
> = async (request, response) => {
  const params = GameIdParamsSchema.safeParse(request.params);
  if (!params.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The route parameters are invalid.",
      statusCode: 400,
      details: { fields: params.error.flatten().fieldErrors },
    });
  }
  const result = await uploadGameCover(
    params.data.gameId,
    userId(request),
    imageBody(request),
  );
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};

export const getMedia: RequestHandler<MediaIdParams> = async (
  request,
  response,
) => {
  const params = MediaIdParamsSchema.safeParse(request.params);
  const query = MediaVariantQuerySchema.safeParse(request.query);
  if (!params.success || !query.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The media request is invalid.",
      statusCode: 400,
    });
  }
  const result = await readMedia(
    params.data.mediaId,
    request.auth?.userId ?? null,
    query.data,
  );
  const etag = `"${result.checksumSha256}"`;
  if (request.get("if-none-match") === etag) {
    response.status(304).end();
    return;
  }
  response.setHeader("Content-Type", result.mimeType);
  response.setHeader("Content-Length", String(result.contents.length));
  response.setHeader("ETag", etag);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader(
    "Cache-Control",
    result.isPublic
      ? "public, max-age=31536000, immutable"
      : "private, no-store",
  );
  response.status(200).send(result.contents);
};
