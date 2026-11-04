const sensitiveKeyPattern =
  /password|passphrase|secret|token|authorization|cookie|database_?url/i;
const connectionStringPattern = /postgres(?:ql)?:\/\/[^\s"']+/gi;
const bearerTokenPattern = /bearer\s+[^\s"']+/gi;

type LogLevel = "info" | "error";
type LogContext = Record<string, unknown>;

function sanitizeString(value: string): string {
  return value
    .replace(connectionStringPattern, "[REDACTED_DATABASE_URL]")
    .replace(bearerTokenPattern, "Bearer [REDACTED]");
}

export function redactLogValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item, seen));
  }

  if (value !== null && typeof value === "object") {
    if (seen.has(value)) {
      return "[CIRCULAR]";
    }

    seen.add(value);

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKeyPattern.test(key)
          ? "[REDACTED]"
          : redactLogValue(item, seen),
      ]),
    );
  }

  return value;
}

function writeLog(level: LogLevel, event: string, context: LogContext): void {
  const sanitizedContext = redactLogValue(context) as LogContext;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitizedContext,
  };
  const serialized = JSON.stringify(entry);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  console.info(serialized);
}

export const logger = {
  info(event: string, context: LogContext = {}): void {
    writeLog("info", event, context);
  },
  error(event: string, context: LogContext = {}): void {
    writeLog("error", event, context);
  },
};
