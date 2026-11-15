import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { MatchWorkspace } from "../src/components/matches/match-workspace";
import { ApiRequestError } from "../src/lib/api/client";

const getCurrentSession = vi.fn();
const listMatches = vi.fn();
const createMatch = vi.fn();
const updateMatch = vi.fn();
const listGames = vi.fn();
const getGame = vi.fn();
const getCopy = vi.fn();

vi.mock("../src/lib/api/auth", () => ({
  getCurrentSession: (...arguments_: unknown[]) =>
    getCurrentSession(...arguments_),
}));
vi.mock("../src/lib/api/matches", () => ({
  listMatches: (...arguments_: unknown[]) => listMatches(...arguments_),
  createMatch: (...arguments_: unknown[]) => createMatch(...arguments_),
  updateMatch: (...arguments_: unknown[]) => updateMatch(...arguments_),
}));
vi.mock("../src/lib/api/games", () => ({
  listGames: (...arguments_: unknown[]) => listGames(...arguments_),
  getGame: (...arguments_: unknown[]) => getGame(...arguments_),
}));
vi.mock("../src/lib/api/copies", () => ({
  getCopy: (...arguments_: unknown[]) => getCopy(...arguments_),
}));

const userId = "f393aa06-8b03-44c8-b75a-8e15f59aa7b6";
const gameId = "4e145b05-1f8c-4b3f-a535-3c474bb55e95";
const copyId = "4099076c-4899-465e-88b9-0471353dc663";
const game = {
  id: gameId,
  name: "Sky Team",
  description: null,
  publicationYear: 2023,
  minPlayers: 2,
  maxPlayers: 2,
  mechanics: ["Cooperativo"],
  categories: ["Aviación"],
  coverMediaId: null,
  minDurationMinutes: 20,
  maxDurationMinutes: 20,
  minAge: 12,
  maxAge: null,
  complexity: 2.3,
  classification: "OFFICIAL" as const,
  visibility: "PUBLIC" as const,
  moderationStatus: "APPROVED" as const,
  isOwnedByViewer: false,
  canManageCatalog: false,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  editions: [],
};

const recordedMatch = {
  id: "930a9d0e-b4f4-4299-bcd1-e51be4d85c13",
  game: {
    id: game.id,
    name: game.name,
    coverMediaId: null,
    minPlayers: 2,
    maxPlayers: 2,
  },
  edition: null,
  copy: null,
  collection: null,
  createdByUserId: userId,
  status: "COMPLETED" as const,
  visibility: "PRIVATE" as const,
  startedAt: "2026-11-13T18:30:00.000Z",
  durationMinutes: 25,
  location: "Casa",
  notes: null,
  participants: [
    {
      id: "9ea0858b-2e77-4ad6-a1b9-b17e769cc386",
      userId,
      guestName: null,
      displayName: "Santi",
      seatOrder: 1,
      outcome: "WIN" as const,
      score: 10,
    },
    {
      id: "57476c6d-ffda-4a66-8bda-6cc8cb8dbbc2",
      userId: null,
      guestName: "Invitada",
      displayName: "Invitada",
      seatOrder: 2,
      outcome: "LOSS" as const,
      score: 5,
    },
  ],
  createdAt: "2026-11-13T19:00:00.000Z",
  updatedAt: "2026-11-13T19:00:00.000Z",
  canEdit: true,
};

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
  listGames.mockResolvedValue({
    games: [game],
    pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
  });
  getGame.mockResolvedValue({ game });
  listMatches.mockResolvedValue({
    matches: [recordedMatch],
    pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
  });
  createMatch.mockResolvedValue({ match: recordedMatch });
  updateMatch.mockResolvedValue({ match: recordedMatch });
});

test("registers a match from a visible game with the user and a guest", async () => {
  render(<MatchWorkspace initialGameId={gameId} />);

  expect(
    await screen.findByText("Sky Team admite 2 participantes."),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Añadir invitado" }));
  fireEvent.change(screen.getByLabelText("Nombre del invitado"), {
    target: { value: "Invitada" },
  });
  const outcomes = screen.getAllByLabelText("Resultado");
  fireEvent.change(outcomes[0]!, { target: { value: "WIN" } });
  fireEvent.change(outcomes[1]!, { target: { value: "LOSS" } });
  fireEvent.submit(
    screen.getByRole("button", { name: "Registrar partida" }).closest("form")!,
  );

  await waitFor(() =>
    expect(createMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId,
        status: "COMPLETED",
        visibility: "PRIVATE",
        participants: [
          expect.objectContaining({ userId, outcome: "WIN" }),
          expect.objectContaining({ guestName: "Invitada", outcome: "LOSS" }),
        ],
      }),
    ),
  );
  expect(await screen.findByText("La partida quedó registrada.")).toBeVisible();
});

test("fills every participant field up to the game's maximum", async () => {
  getGame.mockResolvedValueOnce({
    game: {
      ...game,
      maxPlayers: 18,
    },
  });
  render(<MatchWorkspace initialGameId={gameId} />);

  const complete = await screen.findByRole("button", {
    name: "Completar hasta 18 participantes",
  });
  fireEvent.click(screen.getByRole("button", { name: "Añadir invitado" }));
  fireEvent.click(complete);

  expect(screen.getAllByLabelText("Nombre del invitado")).toHaveLength(17);
  expect(screen.getAllByLabelText("Resultado")).toHaveLength(18);
  expect(
    screen.queryByRole("button", {
      name: "Completar hasta 18 participantes",
    }),
  ).not.toBeInTheDocument();
});

test("releases the game selector after registering from a collection copy", async () => {
  getCopy.mockResolvedValueOnce({
    copy: {
      id: copyId,
      gameEditionId: null,
      currentCollectionId: "d3aa6f94-c096-486b-9104-e26eb265a7c0",
      alias: "Sky Team de casa",
      game: {
        id: game.id,
        name: game.name,
      },
    },
  });

  render(<MatchWorkspace initialGameId={gameId} initialCopyId={copyId} />);

  expect(await screen.findByText(/Vinculada a la copia/)).toBeInTheDocument();
  expect(screen.getByLabelText(/^Juego/)).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Añadir invitado" }));
  fireEvent.change(screen.getByLabelText("Nombre del invitado"), {
    target: { value: "Invitada" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Registrar partida" }).closest("form")!,
  );

  await waitFor(() =>
    expect(createMatch).toHaveBeenCalledWith(
      expect.objectContaining({ copyId, gameId }),
    ),
  );
  expect(await screen.findByText("La partida quedó registrada.")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Registrar partida" }));

  const gameSelector = screen.getByLabelText(/^Juego/);
  expect(gameSelector).toBeEnabled();
  expect(gameSelector).toHaveValue("");
  expect(
    screen.getByText("No necesitas tener una copia para registrar la partida."),
  ).toBeVisible();
});

test("shows the history and keeps anonymous visitors out of it", async () => {
  const authenticated = render(<MatchWorkspace />);
  expect(await screen.findByText("Historial de partidas")).toBeVisible();
  expect(await screen.findByText("Santi")).toBeVisible();
  expect(screen.getByText("Invitada")).toBeVisible();
  expect(screen.getByRole("link", { name: "Sky Team" })).toHaveAttribute(
    "href",
    `/catalogo/${gameId}`,
  );
  authenticated.unmount();

  getCurrentSession.mockRejectedValueOnce(
    new ApiRequestError(401, "AUTHENTICATION_REQUIRED"),
  );
  render(<MatchWorkspace />);
  expect(
    await screen.findByText("Inicia sesión para registrar partidas"),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute(
    "href",
    "/acceso",
  );
});

test("distinguishes match outcomes by color", async () => {
  listMatches.mockResolvedValueOnce({
    matches: [
      {
        ...recordedMatch,
        participants: [
          ...recordedMatch.participants,
          {
            id: "4c124486-54d8-4889-a51b-36dc7a94833e",
            userId: null,
            guestName: "Empatada",
            displayName: "Empatada",
            seatOrder: 3,
            outcome: "DRAW" as const,
            score: 7,
          },
        ],
      },
    ],
    pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
  });

  render(<MatchWorkspace />);

  expect(await screen.findByText("Victoria · 10")).toHaveClass(
    "match-outcome-win",
  );
  expect(screen.getByText("Derrota · 5")).toHaveClass("match-outcome-loss");
  expect(screen.getByText("Empate · 7")).toHaveClass("match-outcome-draw");
});

test("keeps crowded match cards compact and shows every detail in a modal", async () => {
  const extraParticipants = [
    {
      id: "4c124486-54d8-4889-a51b-36dc7a94833e",
      userId: null,
      guestName: "Tercera",
      displayName: "Tercera",
      seatOrder: 3,
      outcome: "DRAW" as const,
      score: 7,
    },
    {
      id: "41cf217e-125f-4c0f-919f-7cb054299ce7",
      userId: null,
      guestName: "Cuarta",
      displayName: "Cuarta",
      seatOrder: 4,
      outcome: "LOSS" as const,
      score: 4,
    },
    {
      id: "ec393ac3-9295-4894-be9a-d4f565a6c67f",
      userId: null,
      guestName: "Quinta",
      displayName: "Quinta",
      seatOrder: 5,
      outcome: "WIN" as const,
      score: 12,
    },
  ];
  listMatches.mockResolvedValueOnce({
    matches: [
      {
        ...recordedMatch,
        notes: "Una partida con muchos participantes.",
        participants: [...recordedMatch.participants, ...extraParticipants],
      },
    ],
    pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
  });

  render(<MatchWorkspace />);

  expect(await screen.findByText("+2 jugadores más")).toBeVisible();
  expect(screen.getByText("Tercera")).toBeVisible();
  expect(screen.queryByText("Cuarta")).not.toBeInTheDocument();
  expect(screen.queryByText("Quinta")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Ver detalle" }));

  const dialog = await screen.findByRole("dialog", {
    name: "Sky Team",
  });
  expect(within(dialog).getByText("Participantes (5)")).toBeVisible();
  expect(
    within(dialog).getByRole("link", { name: "Ver detalle del juego →" }),
  ).toHaveAttribute("href", `/catalogo/${gameId}`);
  expect(within(dialog).getByText("Cuarta")).toBeVisible();
  expect(within(dialog).getByText("Quinta")).toBeVisible();
  expect(
    within(dialog).getByText("Una partida con muchos participantes."),
  ).toBeVisible();

  fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
});
