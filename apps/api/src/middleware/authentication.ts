import type { RequestHandler } from "express";

import { ApplicationError } from "../errors/application-error.js";
import { readSessionCookie } from "../modules/auth/auth-cookie.js";
import {
  authenticateSession,
  isCsrfTokenValid,
} from "../modules/auth/auth.service.js";

export const requireAuth: RequestHandler = async (request, _response, next) => {
  try {
    const session = await authenticateSession(
      readSessionCookie(request.get("cookie")),
    );

    request.auth = {
      sessionId: session.sessionId,
      userId: session.id,
      email: session.email,
      username: session.username,
      displayName: session.displayName,
      visibility: session.visibility,
      csrfTokenHash: session.csrfTokenHash,
    };
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth: RequestHandler = async (
  request,
  _response,
  next,
) => {
  const sessionToken = readSessionCookie(request.get("cookie"));

  if (sessionToken === null) {
    next();
    return;
  }

  try {
    const session = await authenticateSession(sessionToken);

    request.auth = {
      sessionId: session.sessionId,
      userId: session.id,
      email: session.email,
      username: session.username,
      displayName: session.displayName,
      visibility: session.visibility,
      csrfTokenHash: session.csrfTokenHash,
    };
    next();
  } catch (error) {
    next(error);
  }
};

export const requireCsrf: RequestHandler = (request, _response, next) => {
  const auth = request.auth;

  if (auth === undefined) {
    next(
      new ApplicationError({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication is required.",
        statusCode: 401,
      }),
    );
    return;
  }

  if (!isCsrfTokenValid(request.get("x-csrf-token"), auth.csrfTokenHash)) {
    next(
      new ApplicationError({
        code: "CSRF_TOKEN_INVALID",
        message: "The CSRF token is invalid.",
        statusCode: 403,
      }),
    );
    return;
  }

  next();
};
