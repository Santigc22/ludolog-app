import type { RequestHandler } from "express";

import { ApplicationError } from "../errors/application-error.js";
import { userHasPermission } from "../modules/auth/authorization.repository.js";

export function requirePermission(permissionCode: string): RequestHandler {
  return async (request, _response, next) => {
    if (request.auth === undefined) {
      next(
        new ApplicationError({
          code: "AUTHENTICATION_REQUIRED",
          message: "Authentication is required.",
          statusCode: 401,
        }),
      );
      return;
    }

    try {
      if (!(await userHasPermission(request.auth.userId, permissionCode))) {
        throw new ApplicationError({
          code: "PERMISSION_DENIED",
          message: "You do not have permission to perform this action.",
          statusCode: 403,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
