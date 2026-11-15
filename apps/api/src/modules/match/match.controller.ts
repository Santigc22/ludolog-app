import {
  CreateMatchRequestSchema,
  MatchIdParamsSchema,
  MatchListQuerySchema,
  UpdateMatchRequestSchema,
  type ErrorResponse,
  type MatchIdParams,
  type MatchListResponse,
  type MatchResponse,
} from "@ludoteca/contracts";
import type { RequestHandler } from "express";

import { ApplicationError } from "../../errors/application-error.js";
import {
  createMatchForUser,
  getMatchForUser,
  listMatchesForUser,
  updateMatchForUser,
} from "./match.service.js";

function userId(request: Express.Request) {
  if (request.auth === undefined) {
    throw new ApplicationError({
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication is required.",
      statusCode: 401,
    });
  }
  return request.auth.userId;
}

export const createMatch: RequestHandler<
  Record<string, never>,
  MatchResponse | ErrorResponse
> = async (request, response) => {
  const body = CreateMatchRequestSchema.safeParse(request.body);
  if (!body.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The request body is invalid.",
      statusCode: 400,
      details: { fields: body.error.flatten().fieldErrors },
    });
  }
  const result = await createMatchForUser(userId(request), body.data);
  response.setHeader("Cache-Control", "no-store");
  response.status(201).json(result);
};

export const listMatches: RequestHandler<
  Record<string, never>,
  MatchListResponse | ErrorResponse
> = async (request, response) => {
  const query = MatchListQuerySchema.safeParse(request.query);
  if (!query.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The query is invalid.",
      statusCode: 400,
      details: { fields: query.error.flatten().fieldErrors },
    });
  }
  const result = await listMatchesForUser(userId(request), query.data);
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};

export const getMatch: RequestHandler<
  MatchIdParams,
  MatchResponse | ErrorResponse
> = async (request, response) => {
  const params = MatchIdParamsSchema.safeParse(request.params);
  if (!params.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The route parameters are invalid.",
      statusCode: 400,
      details: { fields: params.error.flatten().fieldErrors },
    });
  }
  const result = await getMatchForUser(params.data.matchId, userId(request));
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};

export const updateMatch: RequestHandler<
  MatchIdParams,
  MatchResponse | ErrorResponse
> = async (request, response) => {
  const params = MatchIdParamsSchema.safeParse(request.params);
  const body = UpdateMatchRequestSchema.safeParse(request.body);
  if (!params.success || !body.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      statusCode: 400,
      details: {
        params: params.success ? undefined : params.error.flatten().fieldErrors,
        fields: body.success ? undefined : body.error.flatten().fieldErrors,
      },
    });
  }
  const result = await updateMatchForUser(
    params.data.matchId,
    userId(request),
    body.data,
  );
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};
