import {
  CollectionIdParamsSchema,
  CollectionListQuerySchema,
  CreateCollectionRequestSchema,
  UpdateCollectionRequestSchema,
  type CollectionDetailResponse,
  type CollectionIdParams,
  type CollectionListResponse,
  type CreateCollectionResponse,
  type ErrorResponse,
} from "@ludoteca/contracts";
import type { RequestHandler } from "express";

import { ApplicationError } from "../../errors/application-error.js";
import {
  createCollectionForUser,
  archiveCollectionForUser,
  getCollectionForViewer,
  listCollectionsForUser,
  updateCollectionForUser,
} from "./collection.service.js";

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

export const createCollection: RequestHandler<
  Record<string, never>,
  CreateCollectionResponse | ErrorResponse
> = async (request, response) => {
  const parsed = CreateCollectionRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The request body is invalid.",
      statusCode: 400,
      details: { fields: parsed.error.flatten().fieldErrors },
    });
  }

  const result = await createCollectionForUser(
    authenticatedUserId(request),
    parsed.data,
  );

  response.setHeader("Cache-Control", "no-store");
  response.status(201).json(result);
};

export const getCollection: RequestHandler<
  CollectionIdParams,
  CollectionDetailResponse | ErrorResponse
> = async (request, response) => {
  const parsed = CollectionIdParamsSchema.safeParse(request.params);

  if (!parsed.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The route parameters are invalid.",
      statusCode: 400,
      details: { fields: parsed.error.flatten().fieldErrors },
    });
  }

  const result = await getCollectionForViewer(
    parsed.data.collectionId,
    request.auth?.userId ?? null,
  );

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};

export const updateCollection: RequestHandler<
  CollectionIdParams,
  CollectionDetailResponse | ErrorResponse
> = async (request, response) => {
  const params = CollectionIdParamsSchema.safeParse(request.params);
  const body = UpdateCollectionRequestSchema.safeParse(request.body);

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

  const result = await updateCollectionForUser(
    params.data.collectionId,
    authenticatedUserId(request),
    body.data,
  );

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};

export const archiveCollection: RequestHandler<
  CollectionIdParams,
  CollectionDetailResponse | ErrorResponse
> = async (request, response) => {
  const parsed = CollectionIdParamsSchema.safeParse(request.params);

  if (!parsed.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The route parameters are invalid.",
      statusCode: 400,
      details: { fields: parsed.error.flatten().fieldErrors },
    });
  }

  const result = await archiveCollectionForUser(
    parsed.data.collectionId,
    authenticatedUserId(request),
  );

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};

export const listCollections: RequestHandler<
  Record<string, never>,
  CollectionListResponse | ErrorResponse
> = async (request, response) => {
  const parsed = CollectionListQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The query parameters are invalid.",
      statusCode: 400,
      details: { fields: parsed.error.flatten().fieldErrors },
    });
  }

  const result = await listCollectionsForUser(
    authenticatedUserId(request),
    parsed.data,
  );

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(result);
};
