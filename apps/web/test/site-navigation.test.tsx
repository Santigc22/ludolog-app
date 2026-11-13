import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { SiteNavigation } from "../src/components/layout/site-navigation";
import { SESSION_CHANGED_EVENT } from "../src/lib/api/auth";

const getCurrentSession = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/catalogo",
}));

vi.mock("../src/lib/api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/api/auth")>();
  return {
    ...original,
    getCurrentSession: (...arguments_: unknown[]) =>
      getCurrentSession(...arguments_),
  };
});

describe("SiteNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("hides access while checking and for an authenticated user", async () => {
    let resolveSession: ((value: unknown) => void) | undefined;
    getCurrentSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );
    render(<SiteNavigation />);

    expect(screen.queryByRole("link", { name: "Acceder" })).toBeNull();
    await act(async () => resolveSession?.({ user: { roles: ["USER"] } }));
    expect(screen.queryByRole("link", { name: "Acceder" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Moderación" })).toBeNull();
  });

  test("shows access to an anonymous visitor", async () => {
    getCurrentSession.mockRejectedValue(new Error("no session"));
    render(<SiteNavigation />);

    expect(
      await screen.findByRole("link", { name: "Acceder" }),
    ).toHaveAttribute("href", "/acceso");
    expect(screen.queryByRole("link", { name: "Moderación" })).toBeNull();
  });

  test.each(["MODERATOR", "ADMIN"] as const)(
    "shows moderation to the %s role",
    async (role) => {
      getCurrentSession.mockResolvedValue({ user: { roles: [role] } });
      render(<SiteNavigation />);

      expect(
        await screen.findByRole("link", { name: "Moderación" }),
      ).toHaveAttribute("href", "/moderacion");
      expect(screen.queryByRole("link", { name: "Acceder" })).toBeNull();
    },
  );

  test("updates immediately when authentication changes", async () => {
    getCurrentSession
      .mockRejectedValueOnce(new Error("no session"))
      .mockResolvedValue({ user: { roles: ["USER"] } });
    render(<SiteNavigation />);
    await screen.findByRole("link", { name: "Acceder" });

    act(() => window.dispatchEvent(new Event(SESSION_CHANGED_EVENT)));

    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Acceder" })).toBeNull(),
    );
    expect(getCurrentSession).toHaveBeenCalledTimes(2);
  });
});
