import { createHash, randomBytes } from "node:crypto";

export const idleSessionDurationMilliseconds = 7 * 24 * 60 * 60 * 1000;
export const absoluteSessionDurationMilliseconds = 30 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createSessionMaterial(now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");

  return {
    token,
    tokenHash: hashToken(token),
    csrfToken,
    csrfTokenHash: hashToken(csrfToken),
    idleExpiresAt: new Date(now.getTime() + idleSessionDurationMilliseconds),
    absoluteExpiresAt: new Date(
      now.getTime() + absoluteSessionDurationMilliseconds,
    ),
  };
}
