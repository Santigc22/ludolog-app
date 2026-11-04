import type { Response } from "express";

import { apiConfig } from "../../config/environment.js";
import { absoluteSessionDurationMilliseconds } from "./session.js";

export const sessionCookieName =
  apiConfig.nodeEnv === "production" ? "__Host-id" : "id";
export const csrfCookieName = "XSRF-TOKEN";

const cookieOptions = {
  httpOnly: true,
  secure: apiConfig.nodeEnv === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function readSessionCookie(
  cookieHeader: string | undefined,
): string | null {
  if (cookieHeader === undefined) {
    return null;
  }

  for (const segment of cookieHeader.split(";")) {
    const separator = segment.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const name = segment.slice(0, separator).trim();

    if (name === sessionCookieName) {
      return segment.slice(separator + 1).trim() || null;
    }
  }

  return null;
}

export function setSessionCookie(response: Response, token: string): void {
  response.cookie(sessionCookieName, token, {
    ...cookieOptions,
    maxAge: absoluteSessionDurationMilliseconds,
  });
}

export function setCsrfCookie(response: Response, token: string): void {
  response.cookie(csrfCookieName, token, {
    secure: apiConfig.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: absoluteSessionDurationMilliseconds,
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(sessionCookieName, cookieOptions);
}

export function clearCsrfCookie(response: Response): void {
  response.clearCookie(csrfCookieName, {
    secure: apiConfig.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
  });
}
