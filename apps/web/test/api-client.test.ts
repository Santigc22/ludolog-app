import { z } from "zod";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const responseSchema = z.object({ value: z.string() });

describe("API client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3001/api/v1/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("uses the configured base URL and validates JSON", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ value: "ok" })));
    const { apiFetch } = await import("../src/lib/api/client");

    await expect(apiFetch("/resource", responseSchema)).resolves.toEqual({
      value: "ok",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/resource",
      {
        credentials: "include",
        headers: { accept: "application/json" },
      },
    );
  });

  test("throws a typed error for a non-success response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 503 }),
    );
    const { ApiRequestError, apiFetch } = await import("../src/lib/api/client");

    await expect(apiFetch("health", responseSchema)).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 503,
    });
    expect(new ApiRequestError(500).status).toBe(500);
  });

  test("preserves the public API error without leaking an unknown body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "SESSION_EXPIRED",
            message: "The session has expired.",
            details: null,
            requestId: "request-123",
          },
        }),
        { status: 401 },
      ),
    );
    const { apiFetch } = await import("../src/lib/api/client");

    await expect(apiFetch("auth/me", responseSchema)).rejects.toMatchObject({
      status: 401,
      code: "SESSION_EXPIRED",
    });
  });

  test("merges request headers and tolerates an invalid error body", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("not-json", { status: 502 }));
    const { apiFetch } = await import("../src/lib/api/client");

    await expect(
      apiFetch("resource", responseSchema, {
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    ).rejects.toMatchObject({ status: 502, code: "API_REQUEST_FAILED" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/resource",
      expect.objectContaining({
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
      }),
    );
  });

  test("reads named browser cookies and skips malformed segments", async () => {
    const { readBrowserCookie } = await import("../src/lib/api/client");
    Object.defineProperty(document, "cookie", {
      configurable: true,
      value: "malformed; theme=dark; csrf-token=a%20value",
    });

    expect(readBrowserCookie("csrf-token")).toBe("a value");
    expect(readBrowserCookie("missing")).toBeNull();
  });
});
