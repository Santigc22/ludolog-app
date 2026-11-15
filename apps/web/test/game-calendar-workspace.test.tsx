import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { GameCalendarWorkspace } from "../src/components/matches/game-calendar-workspace";
import { ApiRequestError } from "../src/lib/api/client";

const getCurrentSession = vi.fn();
const listMatches = vi.fn();

vi.mock("../src/lib/api/auth", () => ({
  getCurrentSession: (...arguments_: unknown[]) =>
    getCurrentSession(...arguments_),
}));
vi.mock("../src/lib/api/matches", () => ({
  listMatches: (...arguments_: unknown[]) => listMatches(...arguments_),
}));

const userId = "f393aa06-8b03-44c8-b75a-8e15f59aa7b6";
const gameId = "4e145b05-1f8c-4b3f-a535-3c474bb55e95";

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function matchForToday() {
  const now = new Date();
  const startedAt = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    30,
  ).toISOString();
  return {
    id: "930a9d0e-b4f4-4299-bcd1-e51be4d85c13",
    game: {
      id: gameId,
      name: "Sky Team",
      coverMediaId: null,
      minPlayers: 2,
      maxPlayers: 2,
    },
    edition: null,
    copy: null,
    collection: null,
    createdByUserId: userId,
    status: "PLANNED" as const,
    visibility: "PRIVATE" as const,
    startedAt,
    durationMinutes: null,
    location: "Casa",
    notes: "Preparar la pista antes de jugar.",
    participants: [
      {
        id: "9ea0858b-2e77-4ad6-a1b9-b17e769cc386",
        userId,
        guestName: null,
        displayName: "Santi",
        seatOrder: 1,
        outcome: "NO_RESULT" as const,
        score: null,
      },
      {
        id: "57476c6d-ffda-4a66-8bda-6cc8cb8dbbc2",
        userId: null,
        guestName: "Invitada",
        displayName: "Invitada",
        seatOrder: 2,
        outcome: "NO_RESULT" as const,
        score: null,
      },
    ],
    createdAt: startedAt,
    updatedAt: startedAt,
    canEdit: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentSession.mockResolvedValue({
    user: {
      id: userId,
      username: "santi",
      profile: { displayName: "Santi", visibility: "PRIVATE" },
      roles: ["USER"],
    },
  });
  listMatches.mockResolvedValue({
    matches: [matchForToday()],
    pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
  });
});

test("shows matches in the month and opens their complete detail", async () => {
  render(<GameCalendarWorkspace />);

  const event = await screen.findByRole(
    "button",
    { name: /Sky Team/ },
    { timeout: 3_000 },
  );
  expect(event).toHaveClass("calendar-status-planned");
  expect(listMatches).toHaveBeenCalledWith(
    expect.objectContaining({
      page: 1,
      pageSize: 100,
      startedFrom: expect.any(String),
      startedBefore: expect.any(String),
    }),
  );

  fireEvent.click(event);
  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getByRole("heading", { name: "Sky Team" }),
  ).toBeVisible();
  expect(within(dialog).getByText("Santi")).toBeVisible();
  expect(within(dialog).getByText("Invitada")).toBeVisible();
  expect(
    within(dialog).getByText("Preparar la pista antes de jugar."),
  ).toBeVisible();
  expect(
    within(dialog).getByRole("link", { name: "Ver detalle del juego →" }),
  ).toHaveAttribute("href", `/catalogo/${gameId}`);
});

test("switches between week and detailed day views and plans on a date", async () => {
  render(<GameCalendarWorkspace />);
  await screen.findByRole("button", { name: /Sky Team/ }, { timeout: 3_000 });

  fireEvent.click(screen.getByRole("button", { name: "Semana" }));
  expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await waitFor(() => expect(listMatches).toHaveBeenCalledTimes(2));

  fireEvent.click(screen.getByRole("button", { name: "Día" }));
  expect(screen.getByRole("button", { name: "Día" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const playerFact = (await screen.findByText("Jugadores")).closest("div")!;
  expect(within(playerFact).getByText("2")).toBeVisible();
  expect(screen.getByText("Preparar la pista antes de jugar.")).toBeVisible();
  const today = localDateKey(new Date());
  expect(
    screen.getByRole("link", { name: "+ Planear en este día" }),
  ).toHaveAttribute("href", `/partidas?plannedDate=${today}`);
});

test("filters the calendar by one or several statuses", async () => {
  const plannedMatch = matchForToday();
  listMatches.mockResolvedValueOnce({
    matches: [
      plannedMatch,
      {
        ...plannedMatch,
        id: "930a9d0e-b4f4-4299-bcd1-e51be4d85c14",
        game: { ...plannedMatch.game, name: "Azul" },
        status: "COMPLETED" as const,
      },
      {
        ...plannedMatch,
        id: "930a9d0e-b4f4-4299-bcd1-e51be4d85c15",
        game: { ...plannedMatch.game, name: "Catan" },
        status: "INCOMPLETE" as const,
      },
      {
        ...plannedMatch,
        id: "930a9d0e-b4f4-4299-bcd1-e51be4d85c16",
        game: { ...plannedMatch.game, name: "Flip 7" },
        status: "CANCELLED" as const,
      },
    ],
    pagination: { page: 1, pageSize: 100, totalItems: 4, totalPages: 1 },
  });
  render(<GameCalendarWorkspace />);

  await screen.findByRole("button", { name: /Sky Team/ }, { timeout: 3_000 });
  expect(screen.getByRole("button", { name: /Azul/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /Catan/ })).toBeVisible();

  const planned = screen.getByRole("button", { name: "Planeada" });
  const completed = screen.getByRole("button", { name: "Completada" });
  const incomplete = screen.getByRole("button", { name: "Inconclusa" });
  const cancelled = screen.getByRole("button", { name: "Cancelada" });
  fireEvent.click(planned);

  expect(planned).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: /Sky Team/ })).toBeVisible();
  expect(screen.queryByRole("button", { name: /Azul/ })).toBeNull();

  fireEvent.click(completed);
  expect(planned).toHaveAttribute("aria-pressed", "true");
  expect(completed).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: /Sky Team/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /Azul/ })).toBeVisible();
  expect(screen.queryByRole("button", { name: /Catan/ })).toBeNull();

  fireEvent.click(incomplete);
  fireEvent.click(cancelled);
  for (const filter of [planned, completed, incomplete, cancelled]) {
    expect(filter).toHaveAttribute("aria-pressed", "false");
  }
  expect(screen.queryByRole("button", { name: "Mostrar todas" })).toBeNull();
  expect(screen.getByRole("button", { name: /Catan/ })).toBeVisible();
});

test("keeps anonymous visitors out of the personal calendar", async () => {
  getCurrentSession.mockRejectedValueOnce(
    new ApiRequestError(401, "AUTHENTICATION_REQUIRED"),
  );
  render(<GameCalendarWorkspace />);

  expect(
    await screen.findByRole("heading", {
      name: "Inicia sesión para abrir tu calendario",
    }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute(
    "href",
    "/acceso",
  );
  expect(listMatches).not.toHaveBeenCalled();
});
