import { ApplicationError } from "../../errors/application-error.js";

const windowMilliseconds = 15 * 60 * 1000;
const maximumFailures = 5;
const failures = new Map<string, { count: number; windowStartedAt: number }>();

function key(ip: string, email: string): string {
  return `${ip}:${email}`;
}

export function assertLoginAllowed(ip: string, email: string): void {
  const attempt = failures.get(key(ip, email));
  const now = Date.now();

  if (
    attempt === undefined ||
    now - attempt.windowStartedAt >= windowMilliseconds
  ) {
    return;
  }

  if (attempt.count >= maximumFailures) {
    throw new ApplicationError({
      code: "TOO_MANY_LOGIN_ATTEMPTS",
      message: "Too many login attempts. Try again later.",
      statusCode: 429,
    });
  }
}

export function recordLoginFailure(ip: string, email: string): void {
  const attemptKey = key(ip, email);
  const current = failures.get(attemptKey);
  const now = Date.now();

  if (
    current === undefined ||
    now - current.windowStartedAt >= windowMilliseconds
  ) {
    failures.set(attemptKey, { count: 1, windowStartedAt: now });
    return;
  }

  current.count += 1;
}

export function clearLoginFailures(ip: string, email: string): void {
  failures.delete(key(ip, email));
}
