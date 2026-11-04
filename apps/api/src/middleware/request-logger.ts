import { performance } from "node:perf_hooks";

import type { RequestHandler } from "express";

import { logger } from "../infrastructure/logging/logger.js";

export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = performance.now();

  response.on("finish", () => {
    logger.info("http_request_completed", {
      requestId: request.requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Number((performance.now() - startedAt).toFixed(3)),
    });
  });

  next();
};
