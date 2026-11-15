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
import { uploadGameCover, uploadOwnAvatar } from "../src/lib/api/media";
import {
  createPrivateGame,
  createPublicGame,
  createPublicGamesBatch,
  getGame,
  listGameTaxonomyOptions,
  listGames,
  updatePublicGame,
} from "../src/lib/api/games";
import {
  createCopy,
  exitCopy,
  getCopy,
  listCopies,
  moveCopy,
  updateCopy,
} from "../src/lib/api/copies";
import {
  approveEditionModerationCase,
  approveGameModerationCase,
  listEditionModerationCases,
  listGameModerationCases,
  rejectEditionModerationCase,
  rejectGameModerationCase,
  submitGameForModeration,
} from "../src/lib/api/moderation";
import {
  createMatch,
  getMatch,
  listMatches,
  updateMatch,
} from "../src/lib/api/matches";

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

  test("uploads images as protected raw request bodies", async () => {
    const file = new File(["image"], "cover.webp", { type: "image/webp" });
    await uploadOwnAvatar(file);
    await uploadGameCover("game with spaces", file);

    expect(apiFetchMock).toHaveBeenCalledWith(
      "profiles/me/avatar",
      expect.anything(),
      {
        method: "POST",
        headers: {
          "content-type": "image/webp",
          "x-csrf-token": "csrf-token",
        },
        body: file,
      },
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "games/game%20with%20spaces/cover",
      expect.anything(),
      expect.objectContaining({ body: file }),
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
    await listGameTaxonomyOptions();
    await listGames({
      q: " Azul ",
      category: " Abstracto ",
      page: 2,
      pageSize: 5,
      sort: "newest",
    });
    await getGame("id with spaces");
    await createPrivateGame({
      name: "Prototype",
      minPlayers: 1,
      maxPlayers: 4,
    });
    await createPublicGame({
      name: "Harmonies",
      minPlayers: 1,
      maxPlayers: 4,
      classification: "OFFICIAL",
    });
    await createPublicGamesBatch({
      games: [
        {
          name: "Sky Team",
          minPlayers: 2,
          maxPlayers: 2,
          classification: "OFFICIAL",
        },
      ],
    });
    await updatePublicGame("id with spaces", {
      name: " Azul corregido ",
      mechanics: [" Losetas "],
      categories: [" Abstracto "],
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      "games?page=1&pageSize=12&sort=name",
      expect.anything(),
      { cache: "no-store" },
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "games/taxonomies",
      expect.anything(),
      { cache: "no-store" },
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "games?page=2&pageSize=5&sort=newest&q=Azul&category=Abstracto",
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
    expect(apiFetchMock).toHaveBeenCalledWith(
      "games/public",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Harmonies",
          minPlayers: 1,
          maxPlayers: 4,
          classification: "OFFICIAL",
        }),
        headers: expect.objectContaining({ "x-csrf-token": "csrf-token" }),
      }),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "games/public/batch",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          games: [
            {
              name: "Sky Team",
              minPlayers: 2,
              maxPlayers: 2,
              classification: "OFFICIAL",
            },
          ],
        }),
        headers: expect.objectContaining({ "x-csrf-token": "csrf-token" }),
      }),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "games/id%20with%20spaces",
      expect.anything(),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Azul corregido",
          mechanics: ["Losetas"],
          categories: ["Abstracto"],
        }),
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
    await listCopies(collectionId, { category: " Abstracto " });
    await createCopy(collectionId, { gameId });
    await createCopy(collectionId, {
      gameId,
      proposedEdition: { editionName: " Deluxe ", languageCode: " es " },
    });
    await getCopy(copyId);
    await updateCopy(copyId, {
      condition: "DAMAGED",
      proposedEdition: { editionName: " Deluxe ", languageCode: " es " },
    });
    await moveCopy(copyId, { destinationCollectionId });
    await exitCopy(copyId, { reason: "DAMAGED" });

    expect(apiFetchMock).toHaveBeenCalledWith(
      `collections/${collectionId}/copies?page=1&pageSize=100&lifecycle=ALL`,
      expect.anything(),
      { cache: "no-store" },
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      `collections/${collectionId}/copies?page=1&pageSize=100&lifecycle=ALL&category=Abstracto`,
      expect.anything(),
      { cache: "no-store" },
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      `collections/${collectionId}/copies`,
      expect.anything(),
      expect.objectContaining({
        body: JSON.stringify({
          gameId,
          proposedEdition: { editionName: "Deluxe", languageCode: "es" },
          condition: "GOOD",
        }),
      }),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      `copies/${copyId}`,
      expect.anything(),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          proposedEdition: { editionName: "Deluxe", languageCode: "es" },
          condition: "DAMAGED",
        }),
      }),
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

  test("builds match history reads and protected writes", async () => {
    const matchId = "930a9d0e-b4f4-4299-bcd1-e51be4d85c13";
    const gameId = "4e145b05-1f8c-4b3f-a535-3c474bb55e95";
    const userId = "f393aa06-8b03-44c8-b75a-8e15f59aa7b6";
    await listMatches({
      page: 2,
      pageSize: 10,
      status: "INCOMPLETE",
      startedFrom: "2026-11-13T05:00:00.000Z",
      startedBefore: "2026-11-14T05:00:00.000Z",
    });
    await getMatch("match with spaces");
    await createMatch({
      gameId,
      startedAt: "2026-11-13T18:30:00.000Z",
      participants: [{ userId }],
    });
    await updateMatch(matchId, {
      status: "CANCELLED",
      participants: [{ userId, outcome: "NO_RESULT" }],
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      "matches?page=2&pageSize=10&status=INCOMPLETE&startedFrom=2026-11-13T05%3A00%3A00.000Z&startedBefore=2026-11-14T05%3A00%3A00.000Z",
      expect.anything(),
      { cache: "no-store" },
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "matches/match%20with%20spaces",
      expect.anything(),
      { cache: "no-store" },
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "matches",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-csrf-token": "csrf-token" }),
      }),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      `matches/${matchId}`,
      expect.anything(),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          status: "CANCELLED",
          participants: [{ userId, outcome: "NO_RESULT" }],
        }),
      }),
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
      approvedByUserId: "f393aa06-8b03-44c8-b75a-8e15f59aa7b6",
    });
    await approveGameModerationCase("case with spaces");
    await rejectGameModerationCase("case with spaces", {
      reason: "  Missing publisher data  ",
    });
    await listEditionModerationCases({ status: "APPROVED" });
    await approveEditionModerationCase("edition case");
    await rejectEditionModerationCase("edition case", {
      reason: "  Duplicate edition  ",
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
      "moderation/games?page=2&pageSize=12&status=REJECTED&approvedByUserId=f393aa06-8b03-44c8-b75a-8e15f59aa7b6",
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
    expect(apiFetchMock).toHaveBeenCalledWith(
      "moderation/editions?page=1&pageSize=20&status=APPROVED",
      expect.anything(),
      { cache: "no-store" },
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "moderation/edition-cases/edition%20case/approve",
      expect.anything(),
      expect.objectContaining({ method: "POST" }),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "moderation/edition-cases/edition%20case/reject",
      expect.anything(),
      expect.objectContaining({
        body: JSON.stringify({ reason: "Duplicate edition" }),
      }),
    );
  });
});
