import { describe, expect, test } from "vitest";

import { parsePublicEnvironment } from "../src/lib/config/public-env.schema";

describe("public web environment", () => {
  test("accepts an HTTP API URL", () => {
    expect(
      parsePublicEnvironment({
        NEXT_PUBLIC_API_URL: "http://localhost:3001/api/v1",
      }),
    ).toEqual({
      NEXT_PUBLIC_API_URL: "http://localhost:3001/api/v1",
    });
  });

  test("rejects missing and non-HTTP API URLs", () => {
    expect(() => parsePublicEnvironment({})).toThrow(
      "Invalid public web environment variables",
    );
    expect(() =>
      parsePublicEnvironment({ NEXT_PUBLIC_API_URL: "file:///api/v1" }),
    ).toThrow("NEXT_PUBLIC_API_URL must use HTTP or HTTPS");
  });
});
