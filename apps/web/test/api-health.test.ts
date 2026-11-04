import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/lib/api/client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "../src/lib/api/client";
import { getApiHealth } from "../src/lib/api/health";

const apiFetchMock = vi.mocked(apiFetch);

describe("getApiHealth", () => {
  afterEach(() => {
    apiFetchMock.mockReset();
  });

  test("returns the available service", async () => {
    apiFetchMock.mockResolvedValue({
      status: "ok",
      service: "ludoteca-api",
    });

    await expect(getApiHealth()).resolves.toEqual({
      available: true,
      service: "ludoteca-api",
    });
  });

  test("returns unavailable when the request fails", async () => {
    apiFetchMock.mockRejectedValue(new Error("unavailable"));

    await expect(getApiHealth()).resolves.toEqual({
      available: false,
      service: null,
    });
  });
});
