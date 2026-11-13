import {
  type CurrentSessionResponse,
  LoginRequestSchema,
  type LogoutResponse,
  RegisterRequestSchema,
  type SessionResponse,
  type ErrorResponse,
  type RegisterResponse,
} from "@ludoteca/contracts";
import type { RequestHandler } from "express";

import { ApplicationError } from "../../errors/application-error.js";
import {
  clearCsrfCookie,
  clearSessionCookie,
  setCsrfCookie,
  setSessionCookie,
} from "./auth-cookie.js";
import {
  clearLoginFailures,
  assertLoginAllowed,
  recordLoginFailure,
} from "./login-attempts.js";
import {
  loginUser,
  logoutAuthenticatedSession,
  registerUser,
} from "./auth.service.js";

function authenticatedContext(request: Express.Request) {
  if (request.auth === undefined) {
    throw new ApplicationError({
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication is required.",
      statusCode: 401,
    });
  }

  return request.auth;
}

export const register: RequestHandler<
  Record<string, never>,
  RegisterResponse | ErrorResponse
> = async (request, response) => {
  const parsed = RegisterRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The request body is invalid.",
      statusCode: 400,
      details: {
        fields: parsed.error.flatten().fieldErrors,
      },
    });
  }

  const result = await registerUser(parsed.data);

  setSessionCookie(response, result.sessionToken);
  setCsrfCookie(response, result.response.csrfToken);
  response.setHeader("Cache-Control", "no-store");
  response.status(201).json(result.response);
};

export const login: RequestHandler<
  Record<string, never>,
  SessionResponse | ErrorResponse
> = async (request, response) => {
  const parsed = LoginRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "The request body is invalid.",
      statusCode: 400,
      details: { fields: parsed.error.flatten().fieldErrors },
    });
  }

  const ip = request.ip ?? request.socket.remoteAddress ?? "unknown";
  assertLoginAllowed(ip, parsed.data.email);

  try {
    const result = await loginUser(parsed.data);
    clearLoginFailures(ip, parsed.data.email);
    setSessionCookie(response, result.sessionToken);
    setCsrfCookie(response, result.response.csrfToken);
    response.setHeader("Cache-Control", "no-store");
    response.status(200).json(result.response);
  } catch (error) {
    if (
      error instanceof ApplicationError &&
      error.code === "AUTHENTICATION_FAILED"
    ) {
      recordLoginFailure(ip, parsed.data.email);
    }

    throw error;
  }
};

export const me: RequestHandler<
  Record<string, never>,
  CurrentSessionResponse | ErrorResponse
> = async (request, response) => {
  const auth = authenticatedContext(request);

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    user: {
      id: auth.userId,
      email: auth.email,
      username: auth.username,
      status: "ACTIVE",
      roles: auth.roles,
      profile: {
        displayName: auth.displayName,
        visibility: auth.visibility,
      },
    },
  });
};

export const logout: RequestHandler<
  Record<string, never>,
  LogoutResponse | ErrorResponse
> = async (request, response) => {
  await logoutAuthenticatedSession(authenticatedContext(request).sessionId);
  clearSessionCookie(response);
  clearCsrfCookie(response);
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({ loggedOut: true });
};
