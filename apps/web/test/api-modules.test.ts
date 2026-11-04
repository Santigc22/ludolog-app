import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/lib/api/client", () => ({
  apiFetch: vi.fn(),
  readBrowserCookie: vi.fn(),
}));

import { apiFetch, readBrowserCookie } from "../src/lib/api/client";
import {
  getCurrentSession,
  login,
  logout,
  registerAccount,
} from "../src/lib/api/auth";
import {
  archiveCollection,
  createCollection,
  getCollection,
  listCollections,
  updateCollection,
} from "../src/lib/api/collections";
import { getOwnProfile, updateOwnProfile } from "../src/lib/api/profile";
import { createPrivateGame, getGame, listGames } from "../src/lib/api/games";
import {
  createCopy,
  exitCopy,
  getCopy,
  listCopies,
  moveCopy,
  updateCopy,
} from "../src/lib/api/copies";
import {
  approveGameModerationCase,
  listGameModerationCases,
  rejectGameModerationCase,
  submitGameForModeration,
} from "../src/lib/api/moderation";

const apiFetchMock = vi.mocked(apiFetch);
const readBrowserCookieMock = vi.mocked(readBrowserCookie);

describe("typed API modules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchMock.mockResolvedValue({} as never);
    readBrowserCookieMock.mockReturnValue("csrf-token");
  });

  test("builds identity and profile requests", async () => {
    await registerAccount({
      email: "Player@Example.com",
      username: "Player_One",
      password: "a sufficiently long password",
      displayName: " Player One ",
    });
    await login({
      email: "Player@Example.com",
      password: "a sufficiently long password",
    });
    await getCurrentSession();
    await logout();
    await getOwnProfile();
    await updateOwnProfile({ displayName: " Updated player " });

    expect(apiFetchMock).toHaveBeenCalledTimes(6);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "auth/register",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("player@example.com"),
      }),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "auth/logout",
      expect.anything(),
      expect.objectContaining({
        headers: { "x-csrf-token": "csrf-token" },
      }),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "profiles/me",
      expect.anything(),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  test("builds collection reads, pagination and CSRF writes", async () => {
    await listCollections();
    await listCollections({ page: 2, pageSize: 10, includeArchived: true });
    await createCollection({ name: " Shelf " });
    await getCollection("id with spaces");
    await updateCollection("id with spaces", { visibility: "PUBLIC" });
    await archiveCollection("id with spaces");

    expect(apiFetchMock).toHaveBeenCalledWith(
      "collections?page=1&pageSize=20&includeArchived=false",
      expect.anything(),
      { cache: "no-store" },
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "collections?page=2&pageSize=10&includeArchived=true",
      expect.anything(),
      { cache: "no-store" },
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "collections/id%20with%20spaces/archive",
      expect.anything(),
      {
        method: "POST",
        headers: { "x-csrf-token": "csrf-token" },
      },
    );
    expect(readBrowserCookieMock).toHaveBeenCalledWith("XSRF-TOKEN");
  });

  test("sends an empty CSRF value when the browser cookie is absent", async () => {
    readBrowserCookieMock.mockReturnValue(null);

    await logout();
    await createCollection({ name: "Private shelf" });

    expect(apiFetchMock).toHaveBeenCalledWith(
      "auth/logout",
      expect.anything(),
      expect.objectContaining({ headers: { "x-csrf-token": "" } }),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "collections",
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-csrf-token": "" }),
      }),
    );
  });

  test("builds catalog reads and a protected private-game write", async () => {
    await listGames();
    await listGames({ q: " Azul ", page: 2, pageSize: 5, sort: "newest" });
    await getGame("id with spaces");
    await createPrivateGame({
      name: "Prototype",
      minPlayers: 1,
      maxPlayers: 4,
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      "games?page=1&pageSize=12&sort=name",
      expect.anything(),
      { cache: "no-store" },
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "games?page=2&pageSize=5&sort=newest&q=Azul",
      expect.anything(),
      { cache: "no-store" },
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "games/id%20with%20spaces",
      expect.anything(),
      { cache: "no-store" },
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "games",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-csrf-token": "csrf-token" }),
      }),
    );
  });

  test("builds copy reads and protected lifecycle operations", async () => {
    const gameId = "4e145b05-1f8c-4b3f-a535-3c474bb55e95";
    const collectionId = "3297a863-b2f0-4746-bfec-e76517342f86";
    const destinationCollectionId = "7b962b21-67dd-49bc-97dd-c14ae1805504";
    const copyId = "930a9d0e-b4f4-4299-bcd1-e51be4d85c13";

    await listCopies(collectionId);
    await createCopy(collectionId, { gameId });
    await getCopy(copyId);
    await updateCopy(copyId, { condition: "DAMAGED" });
    await moveCopy(copyId, { destinationCollectionId });
    await exitCopy(copyId, { reason: "DAMAGED" });

    expect(apiFetchMock).toHaveBeenCalledWith(
      `collections/${collectionId}/copies?page=1&pageSize=100&lifecycle=ALL`,
      expect.anything(),
      { cache: "no-store" },
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      `copies/${copyId}/move`,
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-csrf-token": "csrf-token" }),
      }),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      `copies/${copyId}/exit`,
      expect.anything(),
      expect.objectContaining({ body: JSON.stringify({ reason: "DAMAGED" }) }),
    );
  });

  test("builds protected moderation submissions, queues and decisions", async () => {
    await submitGameForModeration("game with spaces", {
      note: "  Ready to review  ",
    });
    await listGameModerationCases({
      status: "REJECTED",
      page: 2,
      pageSize: 12,
    });
    await approveGameModerationCase("case with spaces");
    await rejectGameModerationCase("case with spaces", {
      reason: "  Missing publisher data  ",
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      "games/game%20with%20spaces/moderation-submissions",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ note: "Ready to review" }),
        headers: expect.objectContaining({ "x-csrf-token": "csrf-token" }),
      }),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "moderation/games?page=2&pageSize=12&status=REJECTED",
      expect.anything(),
      { cache: "no-store" },
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "moderation/cases/case%20with%20spaces/approve",
      expect.anything(),
      expect.objectContaining({ method: "POST" }),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "moderation/cases/case%20with%20spaces/reject",
      expect.anything(),
      expect.objectContaining({
        body: JSON.stringify({ reason: "Missing publisher data" }),
      }),
    );
  });
});
