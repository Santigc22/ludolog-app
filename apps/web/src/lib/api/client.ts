import { ErrorResponseSchema } from "@ludoteca/contracts";

import { getPublicApiBaseUrl } from "../config/public-env";

type Parser<T> = {
  parse: (value: unknown) => T;
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | null;

  constructor(
    status: number,
    code = "API_REQUEST_FAILED",
    message = `API request failed with status ${status}`,
    details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(
  path: string,
  responseSchema: Parser<T>,
  init?: RequestInit,
): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  const normalizedPath = path.replace(/^\/+/, "");
  const response = await fetch(`${baseUrl}/${normalizedPath}`, {
    credentials: "include",
    ...init,
    headers: {
      accept: "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const parsedError = ErrorResponseSchema.safeParse(errorBody);

    if (parsedError.success) {
      throw new ApiRequestError(
        response.status,
        parsedError.data.error.code,
        parsedError.data.error.message,
        parsedError.data.error.details,
      );
    }

    throw new ApiRequestError(response.status);
  }

  return responseSchema.parse(await response.json());
}

export function readBrowserCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  for (const segment of document.cookie.split(";")) {
    const separator = segment.indexOf("=");

    if (separator === -1) {
      continue;
    }

    if (segment.slice(0, separator).trim() === name) {
      return decodeURIComponent(segment.slice(separator + 1).trim());
    }
  }

  return null;
}
