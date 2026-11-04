import type { ErrorResponse } from "@ludoteca/contracts";
import type { ErrorRequestHandler } from "express";

import { ApplicationError } from "../errors/application-error.js";
import { logger } from "../infrastructure/logging/logger.js";

export const errorHandler: ErrorRequestHandler<
  Record<string, string>,
  ErrorResponse
> = (error: unknown, request, response, _next) => {
  if (error instanceof ApplicationError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId: request.requestId,
      },
    });
    return;
  }

  logger.error("unhandled_request_error", {
    requestId: request.requestId,
    method: request.method,
    path: request.originalUrl,
    error,
  });

  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
      details: null,
      requestId: request.requestId,
    },
  });
};
