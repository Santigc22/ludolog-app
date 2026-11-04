import {
  CreatePrivateGameRequestSchema,
  GameIdParamsSchema,
  GameListQuerySchema,
  type ErrorResponse,
  type CreatePrivateGameResponse,
  type GameDetailResponse,
  type GameIdParams,
  type GameListResponse,
} from "@ludoteca/contracts";
import type { RequestHandler } from "express";

import { ApplicationError } from "../../errors/application-error.js";
import {
  createPrivateGameForUser,
  getGameForViewer,
  listGamesForViewer,
} from "./game.service.js";

function authenticatedUserId(request: Express.Request): string {
  if (request.auth === undefined) {
    throw new ApplicationError({
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication is required.",
      statusCode: 401,
    });
  }

  return request.auth.userId;
}

export const createGame: RequestHandler<
  Record<string, never>,
  CreatePrivateGameResponse | ErrorResponse
> = async (request, response) => {
  const parsed = CreatePrivateGameRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The request body is invalid.",
      statusCode: 400,
      details: { fields: parsed.error.flatten().fieldErrors },
    });
  }

  const result = await createPrivateGameForUser(
    authenticatedUserId(request),
    parsed.data,
  );

  response.setHeader("Cache-Control", "no-store");
  response.status(201).json(result);
};

export const listGames: RequestHandler<
  Record<string, never>,
  GameListResponse | ErrorResponse
> = async (request, response) => {
  const parsed = GameListQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The query parameters are invalid.",
      statusCode: 400,
      details: { fields: parsed.error.flatten().fieldErrors },
    });
  }

  const result = await listGamesForViewer(
    request.auth?.userId ?? null,
    parsed.data,
  );

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};

export const getGame: RequestHandler<
  GameIdParams,
  GameDetailResponse | ErrorResponse
> = async (request, response) => {
  const parsed = GameIdParamsSchema.safeParse(request.params);

  if (!parsed.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The route parameters are invalid.",
      statusCode: 400,
      details: { fields: parsed.error.flatten().fieldErrors },
    });
  }

  const result = await getGameForViewer(
    parsed.data.gameId,
    request.auth?.userId ?? null,
  );

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};
