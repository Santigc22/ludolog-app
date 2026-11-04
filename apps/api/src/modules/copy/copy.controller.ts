import {
  CollectionIdParamsSchema,
  CopyIdParamsSchema,
  CopyListQuerySchema,
  CreateCopyRequestSchema,
  ExitCopyRequestSchema,
  MoveCopyRequestSchema,
  UpdateCopyRequestSchema,
  type CollectionIdParams,
  type CreateCopyResponse,
  type CopyDetailResponse,
  type CopyIdParams,
  type CopyListResponse,
  type ErrorResponse,
} from "@ludoteca/contracts";
import type { RequestHandler } from "express";

import { ApplicationError } from "../../errors/application-error.js";
import {
  createCopyForUser,
  exitCopyForUser,
  getCopyForUser,
  listCopiesForUser,
  moveCopyForUser,
  updateCopyForUser,
} from "./copy.service.js";

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

export const createCopy: RequestHandler<
  CollectionIdParams,
  CreateCopyResponse | ErrorResponse
> = async (request, response) => {
  const params = CollectionIdParamsSchema.safeParse(request.params);
  const body = CreateCopyRequestSchema.safeParse(request.body);

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

  const result = await createCopyForUser(
    params.data.collectionId,
    authenticatedUserId(request),
    body.data,
  );

  response.setHeader("Cache-Control", "no-store");
  response.status(201).json(result);
};

export const listCopies: RequestHandler<
  CollectionIdParams,
  CopyListResponse | ErrorResponse
> = async (request, response) => {
  const params = CollectionIdParamsSchema.safeParse(request.params);
  const query = CopyListQuerySchema.safeParse(request.query);

  if (!params.success || !query.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      statusCode: 400,
      details: {
        params: params.success ? undefined : params.error.flatten().fieldErrors,
        fields: query.success ? undefined : query.error.flatten().fieldErrors,
      },
    });
  }

  const result = await listCopiesForUser(
    params.data.collectionId,
    authenticatedUserId(request),
    query.data,
  );
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};

export const getCopy: RequestHandler<
  CopyIdParams,
  CopyDetailResponse | ErrorResponse
> = async (request, response) => {
  const params = CopyIdParamsSchema.safeParse(request.params);

  if (!params.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The route parameters are invalid.",
      statusCode: 400,
      details: { fields: params.error.flatten().fieldErrors },
    });
  }

  const result = await getCopyForUser(
    params.data.copyId,
    authenticatedUserId(request),
  );
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};

export const updateCopy: RequestHandler<
  CopyIdParams,
  CopyDetailResponse | ErrorResponse
> = async (request, response) => {
  const params = CopyIdParamsSchema.safeParse(request.params);
  const body = UpdateCopyRequestSchema.safeParse(request.body);

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

  const result = await updateCopyForUser(
    params.data.copyId,
    authenticatedUserId(request),
    body.data,
  );
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};

export const moveCopy: RequestHandler<
  CopyIdParams,
  CopyDetailResponse | ErrorResponse
> = async (request, response) => {
  const params = CopyIdParamsSchema.safeParse(request.params);
  const body = MoveCopyRequestSchema.safeParse(request.body);

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

  const result = await moveCopyForUser(
    params.data.copyId,
    authenticatedUserId(request),
    body.data,
  );
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};

export const exitCopy: RequestHandler<
  CopyIdParams,
  CopyDetailResponse | ErrorResponse
> = async (request, response) => {
  const params = CopyIdParamsSchema.safeParse(request.params);
  const body = ExitCopyRequestSchema.safeParse(request.body);

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

  const result = await exitCopyForUser(
    params.data.copyId,
    authenticatedUserId(request),
    body.data,
  );
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};
