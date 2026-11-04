import {
  GameIdParamsSchema,
  GameModerationListQuerySchema,
  ModerationCaseIdParamsSchema,
  RejectModerationCaseRequestSchema,
  SubmitGameForModerationRequestSchema,
  type ErrorResponse,
  type GameIdParams,
  type GameModerationCaseResponse,
  type GameModerationListResponse,
  type ModerationCaseIdParams,
} from "@ludoteca/contracts";
import type { RequestHandler } from "express";

import { ApplicationError } from "../../errors/application-error.js";
import {
  approveModerationCase,
  listModerationQueue,
  rejectModerationCase,
  submitGameForModerationByOwner,
} from "./moderation.service.js";

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

export const submitGame: RequestHandler<
  GameIdParams,
  GameModerationCaseResponse | ErrorResponse
> = async (request, response) => {
  const params = GameIdParamsSchema.safeParse(request.params);
  const body = SubmitGameForModerationRequestSchema.safeParse(request.body);
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
  const result = await submitGameForModerationByOwner(
    params.data.gameId,
    userId(request),
    body.data,
  );
  response.setHeader("Cache-Control", "no-store");
  response.status(201).json(result);
};

export const listCases: RequestHandler<
  Record<string, never>,
  GameModerationListResponse | ErrorResponse
> = async (request, response) => {
  const parsed = GameModerationListQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The query parameters are invalid.",
      statusCode: 400,
      details: { fields: parsed.error.flatten().fieldErrors },
    });
  }
  const result = await listModerationQueue(userId(request), parsed.data);
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};

export const approveCase: RequestHandler<
  ModerationCaseIdParams,
  GameModerationCaseResponse | ErrorResponse
> = async (request, response) => {
  const params = ModerationCaseIdParamsSchema.safeParse(request.params);
  if (!params.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The route parameters are invalid.",
      statusCode: 400,
      details: { fields: params.error.flatten().fieldErrors },
    });
  }
  const result = await approveModerationCase(
    params.data.caseId,
    userId(request),
  );
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};

export const rejectCase: RequestHandler<
  ModerationCaseIdParams,
  GameModerationCaseResponse | ErrorResponse
> = async (request, response) => {
  const params = ModerationCaseIdParamsSchema.safeParse(request.params);
  const body = RejectModerationCaseRequestSchema.safeParse(request.body);
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
  const result = await rejectModerationCase(
    params.data.caseId,
    userId(request),
    body.data,
  );
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};
