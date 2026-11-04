import type {
  NormalizedLoginRequest,
  NormalizedRegisterRequest,
  RegisterResponse,
  SessionResponse,
} from "@ludoteca/contracts";
import { timingSafeEqual } from "node:crypto";

import { ApplicationError } from "../../errors/application-error.js";
import {
  createUserWithSession,
  findLoginIdentity,
  findSession,
  persistSession,
  renewSession,
  revokeSession,
  type LoginIdentity,
  type PersistedSession,
} from "./auth.repository.js";
import {
  getDummyPasswordHash,
  hashPassword,
  verifyPassword,
} from "./password.js";
import {
  createSessionMaterial,
  hashToken,
  idleSessionDurationMilliseconds,
} from "./session.js";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function registerUser(input: NormalizedRegisterRequest): Promise<{
  response: RegisterResponse;
  sessionToken: string;
}> {
  const passwordHash = await hashPassword(input.password);
  const session = createSessionMaterial();

  try {
    const user = await createUserWithSession(input, passwordHash, session);

    return {
      sessionToken: session.token,
      response: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          status: "ACTIVE",
          profile: {
            displayName: user.displayName,
            visibility: "PRIVATE",
          },
        },
        csrfToken: session.csrfToken,
      },
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApplicationError({
        code: "IDENTITY_ALREADY_EXISTS",
        message: "An account with those identifiers already exists.",
        statusCode: 409,
        cause: error,
      });
    }

    throw error;
  }
}

function authenticationFailed(): ApplicationError {
  return new ApplicationError({
    code: "AUTHENTICATION_FAILED",
    message: "The email or password is invalid.",
    statusCode: 401,
  });
}

function toAuthenticatedUser(
  identity: LoginIdentity | PersistedSession,
): SessionResponse["user"] {
  return {
    id: identity.id,
    email: identity.email,
    username: identity.username,
    status: "ACTIVE",
    profile: {
      displayName: identity.displayName,
      visibility: identity.visibility,
    },
  };
}

function toSessionResponse(
  identity: LoginIdentity | PersistedSession,
  csrfToken: string,
): SessionResponse {
  return {
    user: toAuthenticatedUser(identity),
    csrfToken,
  };
}

export async function loginUser(input: NormalizedLoginRequest): Promise<{
  response: SessionResponse;
  sessionToken: string;
}> {
  const identity = await findLoginIdentity(input.email);
  const passwordHash = identity?.passwordHash ?? (await getDummyPasswordHash());
  const validPassword = await verifyPassword(input.password, passwordHash);

  if (identity === null || !validPassword || identity.status !== "ACTIVE") {
    throw authenticationFailed();
  }

  const session = createSessionMaterial();
  await persistSession(identity.id, session);

  return {
    sessionToken: session.token,
    response: toSessionResponse(identity, session.csrfToken),
  };
}

function sessionError(code: string, message: string): ApplicationError {
  return new ApplicationError({ code, message, statusCode: 401 });
}

export async function resolveSession(
  sessionToken: string,
): Promise<PersistedSession> {
  const session = await findSession(hashToken(sessionToken));

  if (session === null || session.revokedAt !== null) {
    throw sessionError("SESSION_INVALID", "The session is invalid.");
  }

  const now = new Date();

  if (
    session.idleExpiresAt.getTime() <= now.getTime() ||
    session.absoluteExpiresAt.getTime() <= now.getTime()
  ) {
    await revokeSession(session.sessionId);
    throw sessionError("SESSION_EXPIRED", "The session has expired.");
  }

  if (session.status !== "ACTIVE") {
    await revokeSession(session.sessionId);
    throw sessionError("SESSION_INVALID", "The session is invalid.");
  }

  return session;
}

export async function authenticateSession(
  sessionToken: string | null,
): Promise<PersistedSession> {
  if (sessionToken === null) {
    throw sessionError(
      "AUTHENTICATION_REQUIRED",
      "Authentication is required.",
    );
  }

  const session = await resolveSession(sessionToken);
  const nextIdleExpiration = new Date(
    Math.min(
      Date.now() + idleSessionDurationMilliseconds,
      session.absoluteExpiresAt.getTime(),
    ),
  );

  await renewSession(session.sessionId, nextIdleExpiration);

  return session;
}

function csrfMatches(providedToken: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(providedToken), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isCsrfTokenValid(
  providedToken: string | undefined,
  expectedHash: string,
): boolean {
  return (
    providedToken !== undefined && csrfMatches(providedToken, expectedHash)
  );
}

export async function logoutAuthenticatedSession(
  sessionId: string,
): Promise<void> {
  await revokeSession(sessionId);
}
