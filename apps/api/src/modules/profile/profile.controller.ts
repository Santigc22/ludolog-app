import {
  UpdateOwnProfileRequestSchema,
  type ErrorResponse,
  type OwnProfileResponse,
} from "@ludoteca/contracts";
import type { RequestHandler } from "express";

import { ApplicationError } from "../../errors/application-error.js";
import { getProfileForUser, updateProfileForUser } from "./profile.service.js";

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

export const getOwnProfile: RequestHandler<
  Record<string, never>,
  OwnProfileResponse | ErrorResponse
> = async (request, response) => {
  const result = await getProfileForUser(authenticatedUserId(request));

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};

export const patchOwnProfile: RequestHandler<
  Record<string, never>,
  OwnProfileResponse | ErrorResponse
> = async (request, response) => {
  const parsed = UpdateOwnProfileRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The request body is invalid.",
      statusCode: 400,
      details: { fields: parsed.error.flatten().fieldErrors },
    });
  }

  const result = await updateProfileForUser(
    authenticatedUserId(request),
    parsed.data,
  );

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};
