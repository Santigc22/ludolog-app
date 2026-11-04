import type { RequestHandler } from "express";

import { apiConfig } from "../config/environment.js";
import { ApplicationError } from "../errors/application-error.js";

export const requireWebOrigin: RequestHandler = (request, response, next) => {
  if (request.get("origin") !== apiConfig.webOrigin) {
    next(
      new ApplicationError({
        code: "ORIGIN_NOT_ALLOWED",
        message: "The request origin is not allowed.",
        statusCode: 403,
      }),
    );
    return;
  }

  response.setHeader("Access-Control-Allow-Origin", apiConfig.webOrigin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Vary", "Origin");
  next();
};
