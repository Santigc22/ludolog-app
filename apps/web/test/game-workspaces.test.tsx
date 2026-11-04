import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { GameCatalogWorkspace } from "../src/components/games/game-catalog-workspace";
import { GameDetailWorkspace } from "../src/components/games/game-detail-workspace";
import { ApiRequestError } from "../src/lib/api/client";

const listGames = vi.fn();
const createPrivateGame = vi.fn();
const getGame = vi.fn();
const submitGameForModeration = vi.fn();
const listCollections = vi.fn();
const createCopy = vi.fn();

vi.mock("../src/lib/api/games", () => ({
  listGames: (...arguments_: unknown[]) => listGames(...arguments_),
  createPrivateGame: (...arguments_: unknown[]) =>
    createPrivateGame(...arguments_),
  getGame: (...arguments_: unknown[]) => getGame(...arguments_),
}));

vi.mock("../src/lib/api/moderation", () => ({
  submitGameForModeration: (...arguments_: unknown[]) =>
    submitGameForModeration(...arguments_),
}));

vi.mock("../src/lib/api/collections", () => ({
  listCollections: (...arguments_: unknown[]) => listCollections(...arguments_),
}));

vi.mock("../src/lib/api/copies", () => ({
  createCopy: (...arguments_: unknown[]) => createCopy(...arguments_),
}));

const game = {
  id: "7f23ee38-31b5-45ec-ab1c-c1906bb1e456",
  name: "Azul",
  description: "Diseña un palacio con azulejos.",
  publicationYear: 2017,
  minPlayers: 2,
  maxPlayers: 4,
  mechanics: ["Colocación de losetas"],
  minDurationMinutes: 30,
  maxDurationMinutes: 45,
  minAge: 8,
  maxAge: null,
  complexity: 1.8,
  classification: "OFFICIAL" as const,
  visibility: "PUBLIC" as const,
  moderationStatus: "APPROVED" as const,
  isOwnedByViewer: false,
  createdAt: "2026-09-21T20:00:00.000Z",
  updatedAt: "2026-09-21T20:00:00.000Z",
};

const privateGame = {
  ...game,
  id: "86f890e4-3782-4979-82a9-503be7ac418f",
  name: "Prototipo familiar",
  classification: "PRIVATE" as const,
  visibility: "PRIVATE" as const,
  moderationStatus: "DRAFT" as const,
  isOwnedByViewer: true,
};

const collection = {
  id: "3297a863-b2f0-4746-bfec-e76517342f86",
  type: "PERSONAL" as const,
  status: "ACTIVE" as const,
  name: "Juegos de mesa",
  description: null,
  visibility: "PRIVATE" as const,
  isForSale: false,
  gameCount: 2,
  createdByUserId: "2723328b-6f03-4772-8470-4fda87cbe886",
  effectiveRole: "OWNER" as const,
  createdAt: game.createdAt,
  updatedAt: game.updatedAt,
  archivedAt: null,
};

describe("GameCatalogWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listGames.mockResolvedValue({
      games: [game, privateGame],
      pagination: { page: 1, pageSize: 12, totalItems: 13, totalPages: 2 },
    });
  });

  test("searches, sorts, paginates and identifies the viewer's private game", async () => {
    render(<GameCatalogWorkspace />);

    expect(await screen.findByText("Prototipo familiar")).toBeInTheDocument();
    expect(screen.getByText("Privado · Tuyo")).toBeInTheDocument();
    expect(screen.getAllByText("Ver ficha →")).toHaveLength(2);
    expect(screen.getAllByText("Colocación de losetas")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Buscar juegos"), {
      target: { value: " azul " },
    });
    fireEvent.change(screen.getByLabelText("Mecánica"), {
      target: { value: " losetas " },
    });
    fireEvent.change(screen.getByLabelText("Jugadores desde"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText("Jugadores hasta"), {
      target: { value: "6" },
    });
    fireEvent.submit(screen.getByRole("search"));
    await waitFor(() =>
      expect(listGames).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "azul",
          mechanic: "losetas",
          minPlayers: 4,
          maxPlayers: 6,
          page: 1,
          pageSize: 12,
          sort: "name",
        }),
      ),
    );
    fireEvent.change(screen.getByLabelText("Orden"), {
      target: { value: "newest" },
    });
    await waitFor(() =>
      expect(listGames).toHaveBeenCalledWith(
        expect.objectContaining({ sort: "newest" }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() =>
      expect(listGames).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    );
  });

  test("rejects an inverted player filter before requesting the API", async () => {
    render(<GameCatalogWorkspace />);
    await screen.findByText("Prototipo familiar");
    const callsBeforeSubmit = listGames.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Jugadores desde"), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByLabelText("Jugadores hasta"), {
      target: { value: "4" },
    });
    fireEvent.submit(screen.getByRole("search"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El máximo de jugadores",
    );
    expect(listGames).toHaveBeenCalledTimes(callsBeforeSubmit);
  });

  test("creates a private game and links to its detail", async () => {
    createPrivateGame.mockResolvedValue({
      game: { ...privateGame, editions: [] },
    });
    render(<GameCatalogWorkspace />);
    await screen.findByText("Prototipo familiar");
    fireEvent.click(
      screen.getByRole("button", { name: "Crear juego privado" }),
    );
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Mi diseño" },
    });
    fireEvent.change(screen.getByLabelText("Jugadores mínimos"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Jugadores máximos"), {
      target: { value: "5" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Crear juego privado" })
        .closest("form")!,
    );

    await waitFor(() =>
      expect(createPrivateGame).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Mi diseño",
          minPlayers: 2,
          maxPlayers: 5,
        }),
      ),
    );
    expect(await screen.findByText(/solo tú puedes verlo/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir juego/ })).toHaveAttribute(
      "href",
      `/catalogo/${privateGame.id}`,
    );
  });

  test("shows empty, retryable error, and unauthenticated creation states", async () => {
    listGames.mockResolvedValueOnce({
      games: [],
      pagination: { page: 1, pageSize: 12, totalItems: 0, totalPages: 0 },
    });
    const first = render(<GameCatalogWorkspace />);
    expect(
      await screen.findByText("El catálogo está listo para crecer"),
    ).toBeInTheDocument();
    first.unmount();

    listGames.mockRejectedValueOnce(new Error("offline"));
    listGames.mockResolvedValueOnce({
      games: [],
      pagination: { page: 1, pageSize: 12, totalItems: 0, totalPages: 0 },
    });
    const second = render(<GameCatalogWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByText("El catálogo está listo para crecer"),
    ).toBeInTheDocument();
    second.unmount();

    createPrivateGame.mockRejectedValue(
      new ApiRequestError(401, "AUTHENTICATION_REQUIRED"),
    );
    render(<GameCatalogWorkspace />);
    await screen.findByText("Prototipo familiar");
    fireEvent.click(
      screen.getByRole("button", { name: "Crear juego privado" }),
    );
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Crear juego privado" })
        .closest("form")!,
    );
    expect(
      await screen.findByText(/Necesitas iniciar sesión/),
    ).toBeInTheDocument();
  });

  test("renders server-side field validation", async () => {
    createPrivateGame.mockRejectedValue(
      new ApiRequestError(400, "VALIDATION_ERROR", "Invalid", {
        fields: { name: ["Nombre inválido"], maxPlayers: ["Rango inválido"] },
      }),
    );
    render(<GameCatalogWorkspace />);
    await screen.findByText("Prototipo familiar");
    fireEvent.click(
      screen.getByRole("button", { name: "Crear juego privado" }),
    );
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Crear juego privado" })
        .closest("form")!,
    );
    expect(await screen.findByText("Nombre inválido")).toBeInTheDocument();
    expect(screen.getByText("Rango inválido")).toBeInTheDocument();
  });
});

describe("GameDetailWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCollections.mockResolvedValue({
      collections: [collection],
      pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
    });
    createCopy.mockResolvedValue({ copy: { id: "copy-id" } });
    getGame.mockResolvedValue({
      game: {
        ...game,
        editions: [
          {
            id: "47168814-162a-470e-adc6-945cdcfdd345",
            editionName: "Edición en español",
            editionNumber: "2",
            languageCode: "es",
            publicationYear: 2020,
            isbn: null,
            sku: null,
            upc: null,
            notes: null,
            createdAt: game.createdAt,
          },
        ],
      },
    });
  });

  test("shows the full public information and registers the selected edition", async () => {
    render(<GameDetailWorkspace gameId={game.id} />);
    expect(await screen.findByText("Ficha del catálogo")).toBeInTheDocument();
    expect(screen.getByText("30–45 min")).toBeInTheDocument();
    expect(screen.getByText("Desde 8 años")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Sin edición específica/ }),
    );
    expect(await screen.findByLabelText("Ludoteca")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Edición en español/ }));
    fireEvent.change(screen.getByLabelText("Ludoteca"), {
      target: { value: collection.id },
    });
    fireEvent.change(screen.getByLabelText("Alias (opcional)"), {
      target: { value: "Mi copia azul" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar copia" }));

    await waitFor(() =>
      expect(createCopy).toHaveBeenCalledWith(collection.id, {
        gameId: game.id,
        gameEditionId: "47168814-162a-470e-adc6-945cdcfdd345",
        condition: "GOOD",
        alias: "Mi copia azul",
        notes: null,
      }),
    );
    expect(
      await screen.findByText(/quedó registrada en tu ludoteca/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Abrir ludoteca/ }),
    ).toHaveAttribute("href", `/ludotecas/${collection.id}`);
  });

  test("keeps the public detail visible and asks anonymous visitors to sign in", async () => {
    listCollections.mockRejectedValueOnce(
      new ApiRequestError(401, "AUTHENTICATION_REQUIRED"),
    );
    render(<GameDetailWorkspace gameId={game.id} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Sin edición específica/ }),
    );
    expect(
      await screen.findByText(/Inicia sesión para registrar esta copia/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveAttribute("href", "/acceso");
  });

  test("submits an owned private game for global moderation", async () => {
    getGame.mockResolvedValueOnce({ game: { ...privateGame, editions: [] } });
    submitGameForModeration.mockResolvedValue({
      moderationCase: {
        game: { ...privateGame, moderationStatus: "PENDING_REVIEW" },
      },
    });
    render(<GameDetailWorkspace gameId={privateGame.id} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Proponer como global" }),
    );
    fireEvent.change(screen.getByLabelText(/Nota para moderación/), {
      target: { value: "Ficha completa y verificada" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enviar a moderación" }),
    );

    await waitFor(() =>
      expect(submitGameForModeration).toHaveBeenCalledWith(privateGame.id, {
        note: "Ficha completa y verificada",
      }),
    );
    expect(
      await screen.findByText(/fue enviado a moderación/),
    ).toBeInTheDocument();
    expect(screen.getByText(/esperando la decisión/)).toBeInTheDocument();
  });

  test("handles no editions, not found, and retryable failures", async () => {
    getGame.mockResolvedValueOnce({ game: { ...privateGame, editions: [] } });
    const first = render(<GameDetailWorkspace gameId={privateGame.id} />);
    expect(
      await screen.findByText("No hay ediciones registradas"),
    ).toBeInTheDocument();
    expect(screen.getByText("Juego privado · Tuyo")).toBeInTheDocument();
    first.unmount();

    getGame.mockRejectedValueOnce(new ApiRequestError(404, "NOT_FOUND"));
    const second = render(<GameDetailWorkspace gameId={game.id} />);
    expect(
      await screen.findByText("No encontramos este juego"),
    ).toBeInTheDocument();
    second.unmount();

    getGame.mockRejectedValueOnce(new Error("offline"));
    getGame.mockResolvedValueOnce({ game: { ...game, editions: [] } });
    render(<GameDetailWorkspace gameId={game.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Azul")).toBeInTheDocument();
  });
});
