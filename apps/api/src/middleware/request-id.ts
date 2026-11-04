import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

const validRequestIdPattern = /^[A-Za-z0-9._-]{1,128}$/;

export const requestId: RequestHandler = (request, response, next) => {
  const suppliedRequestId = request.header("x-request-id");

  request.requestId =
    suppliedRequestId !== undefined &&
    validRequestIdPattern.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID();

  response.setHeader("x-request-id", request.requestId);
  next();
};
