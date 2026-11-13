import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { GameCatalogWorkspace } from "../src/components/games/game-catalog-workspace";
import { GameDetailWorkspace } from "../src/components/games/game-detail-workspace";
import { ApiRequestError } from "../src/lib/api/client";

const getCurrentSession = vi.fn();
const listGames = vi.fn();
const createPrivateGame = vi.fn();
const createPublicGame = vi.fn();
const createPublicGamesBatch = vi.fn();
const getGame = vi.fn();
const listGameTaxonomyOptions = vi.fn();
const updatePublicGame = vi.fn();
const submitGameForModeration = vi.fn();
const listCollections = vi.fn();
const createCopy = vi.fn();
const uploadGameCover = vi.fn();
const imageFileError = vi.fn();

vi.mock("../src/lib/api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/api/auth")>();
  return {
    ...original,
    getCurrentSession: (...arguments_: unknown[]) =>
      getCurrentSession(...arguments_),
  };
});

vi.mock("../src/lib/api/games", () => ({
  listGames: (...arguments_: unknown[]) => listGames(...arguments_),
  createPrivateGame: (...arguments_: unknown[]) =>
    createPrivateGame(...arguments_),
  createPublicGame: (...arguments_: unknown[]) =>
    createPublicGame(...arguments_),
  createPublicGamesBatch: (...arguments_: unknown[]) =>
    createPublicGamesBatch(...arguments_),
  getGame: (...arguments_: unknown[]) => getGame(...arguments_),
  listGameTaxonomyOptions: (...arguments_: unknown[]) =>
    listGameTaxonomyOptions(...arguments_),
  updatePublicGame: (...arguments_: unknown[]) =>
    updatePublicGame(...arguments_),
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

vi.mock("../src/lib/api/media", () => ({
  imageFileError: (...arguments_: unknown[]) => imageFileError(...arguments_),
  mediaUrl: (mediaId: string) => `http://localhost/media/${mediaId}`,
  uploadGameCover: (...arguments_: unknown[]) => uploadGameCover(...arguments_),
}));

const game = {
  id: "7f23ee38-31b5-45ec-ab1c-c1906bb1e456",
  name: "Azul",
  description: "Diseña un palacio con azulejos.",
  publicationYear: 2017,
  minPlayers: 2,
  maxPlayers: 4,
  mechanics: ["Colocación de losetas"],
  categories: ["Abstracto"],
  coverMediaId: null,
  minDurationMinutes: 30,
  maxDurationMinutes: 45,
  minAge: 8,
  maxAge: null,
  complexity: 1.8,
  classification: "OFFICIAL" as const,
  visibility: "PUBLIC" as const,
  moderationStatus: "APPROVED" as const,
  isOwnedByViewer: false,
  canManageCatalog: false,
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
    getCurrentSession.mockResolvedValue({ user: { roles: ["USER"] } });
    listGameTaxonomyOptions.mockResolvedValue({
      mechanics: ["Construcción de mazos", "Drafting"],
      categories: ["Cartas", "Mazo de cartas"],
    });
    imageFileError.mockReturnValue(null);
    listGames.mockResolvedValue({
      games: [game, privateGame],
      pagination: { page: 1, pageSize: 12, totalItems: 13, totalPages: 2 },
    });
  });

  test("keeps the public catalog visible but hides creation from visitors", async () => {
    getCurrentSession.mockRejectedValueOnce(
      new ApiRequestError(401, "AUTHENTICATION_REQUIRED"),
    );

    render(<GameCatalogWorkspace />);

    expect(await screen.findByText("Azul")).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: "Inicia sesión para crear" }),
    ).toHaveAttribute("href", "/acceso");
    expect(
      screen.queryByRole("button", { name: "Crear juego privado" }),
    ).not.toBeInTheDocument();
    expect(createPrivateGame).not.toHaveBeenCalled();
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
    fireEvent.change(screen.getByLabelText("Categoría"), {
      target: { value: " abstracto " },
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
          category: "abstracto",
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

  test("lets an admin publish a game directly with an approved history", async () => {
    getCurrentSession.mockResolvedValueOnce({ user: { roles: ["ADMIN"] } });
    createPublicGame.mockResolvedValueOnce({
      game: {
        ...game,
        id: privateGame.id,
        name: "Harmonies",
        minPlayers: 1,
        maxPlayers: 4,
        isOwnedByViewer: true,
        canManageCatalog: true,
      },
    });
    render(<GameCatalogWorkspace />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Publicar juego directamente",
      }),
    );
    expect(screen.getByText("Nuevo juego público")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Harmonies" },
    });
    fireEvent.change(screen.getByLabelText("Jugadores máximos"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText("Clasificación"), {
      target: { value: "COMMUNITY" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar y aprobar" }));

    await waitFor(() =>
      expect(createPublicGame).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Harmonies",
          minPlayers: 1,
          maxPlayers: 4,
          classification: "COMMUNITY",
        }),
      ),
    );
    expect(
      await screen.findByText(/figura como aprobado por ti/),
    ).toBeInTheDocument();
    expect(createPrivateGame).not.toHaveBeenCalled();
  });

  test("shows batch creation only to administrators", async () => {
    const regularUser = render(<GameCatalogWorkspace />);
    await screen.findByText("Prototipo familiar");
    expect(
      screen.queryByRole("button", { name: "Carga por lote" }),
    ).not.toBeInTheDocument();
    regularUser.unmount();

    getCurrentSession.mockResolvedValueOnce({ user: { roles: ["ADMIN"] } });
    render(<GameCatalogWorkspace />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Carga por lote" }),
    );

    expect(screen.getByText("Cargar juegos por lote")).toBeInTheDocument();
    expect(screen.getByText("Descargar plantilla CSV")).toBeInTheDocument();
  });

  test("keeps an approved game visually public for its original owner", async () => {
    listGames.mockResolvedValueOnce({
      games: [{ ...game, isOwnedByViewer: true }],
      pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
    });
    render(<GameCatalogWorkspace />);

    const visibility = await screen.findByText("Catálogo público");
    expect(visibility).toHaveClass("visibility-public");
    expect(visibility).not.toHaveClass("visibility-private");
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
    expect(uploadGameCover).not.toHaveBeenCalled();
  });

  test("creates a private game with its cover from the same form", async () => {
    createPrivateGame.mockResolvedValue({
      game: { ...privateGame, editions: [] },
    });
    uploadGameCover.mockResolvedValue({
      coverMediaId: "3297a863-b2f0-4746-bfec-e76517342f86",
    });
    render(<GameCatalogWorkspace />);
    await screen.findByText("Prototipo familiar");
    fireEvent.click(
      screen.getByRole("button", { name: "Crear juego privado" }),
    );
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Feed the Kraken" },
    });
    const cover = new File(["cover"], "feed-the-kraken.webp", {
      type: "image/webp",
    });
    fireEvent.change(screen.getByLabelText(/^Portada \(opcional\)/), {
      target: { files: [cover] },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Crear juego privado" })
        .closest("form")!,
    );

    await waitFor(() =>
      expect(uploadGameCover).toHaveBeenCalledWith(privateGame.id, cover),
    );
    expect(createPrivateGame).toHaveBeenCalledBefore(uploadGameCover);
    expect(
      await screen.findByText(/juego privado y su portada quedaron guardados/i),
    ).toBeVisible();
  });

  test("keeps the created game accessible when its cover upload fails", async () => {
    createPrivateGame.mockResolvedValue({
      game: { ...privateGame, editions: [] },
    });
    uploadGameCover.mockRejectedValue(
      new ApiRequestError(500, "INTERNAL_SERVER_ERROR"),
    );
    render(<GameCatalogWorkspace />);
    await screen.findByText("Prototipo familiar");
    fireEvent.click(
      screen.getByRole("button", { name: "Crear juego privado" }),
    );
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Mi juego" },
    });
    fireEvent.change(screen.getByLabelText(/^Portada \(opcional\)/), {
      target: {
        files: [new File(["cover"], "cover.png", { type: "image/png" })],
      },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Crear juego privado" })
        .closest("form")!,
    );

    expect(
      await screen.findByText(/juego privado quedó creado, pero no pudimos/i),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /Abrir juego/ })).toHaveAttribute(
      "href",
      `/catalogo/${privateGame.id}`,
    );
  });

  test("validates the optional cover before creating the private game", async () => {
    imageFileError.mockReturnValue("Usa una imagen JPG, PNG o WebP.");
    render(<GameCatalogWorkspace />);
    await screen.findByText("Prototipo familiar");
    fireEvent.click(
      screen.getByRole("button", { name: "Crear juego privado" }),
    );
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "No debe crearse todavía" },
    });
    fireEvent.change(screen.getByLabelText(/^Portada \(opcional\)/), {
      target: {
        files: [new File(["invalid"], "cover.gif", { type: "image/gif" })],
      },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Crear juego privado" })
        .closest("form")!,
    );

    expect(await screen.findByText(/Usa una imagen JPG/)).toBeVisible();
    expect(createPrivateGame).not.toHaveBeenCalled();
    expect(uploadGameCover).not.toHaveBeenCalled();
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
    listGameTaxonomyOptions.mockResolvedValue({
      mechanics: ["Construcción de mazos", "Drafting"],
      categories: ["Abstracto", "Cartas", "Mazo de cartas"],
    });
    listCollections.mockResolvedValue({
      collections: [collection],
      pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
    });
    createCopy.mockResolvedValue({ copy: { id: "copy-id" } });
    updatePublicGame.mockResolvedValue({});
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
            moderationStatus: "APPROVED",
            isOwnedByViewer: false,
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

  test("uploads a cover for an owned private game", async () => {
    const coverMediaId = "3297a863-b2f0-4746-bfec-e76517342f86";
    getGame.mockResolvedValueOnce({ game: { ...privateGame, editions: [] } });
    uploadGameCover.mockResolvedValue({ coverMediaId });
    render(<GameDetailWorkspace gameId={privateGame.id} />);
    await screen.findByText("Juego privado · Tuyo");
    const file = new File(["image"], "cover.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Añadir portada"), {
      target: { files: [file] },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Guardar portada" }).closest("form")!,
    );

    await waitFor(() =>
      expect(uploadGameCover).toHaveBeenCalledWith(privateGame.id, file),
    );
    expect(await screen.findByAltText(/Portada de Prototipo/)).toHaveAttribute(
      "src",
      expect.stringContaining(coverMediaId),
    );
  });

  test("lets a catalog manager edit public metadata and cover", async () => {
    const manageableGame = { ...game, canManageCatalog: true, editions: [] };
    getGame.mockResolvedValueOnce({ game: manageableGame });
    updatePublicGame.mockResolvedValueOnce({
      game: {
        ...manageableGame,
        name: "Azul corregido",
        mechanics: ["Drafting"],
      },
    });
    render(<GameDetailWorkspace gameId={game.id} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Editar ficha pública" }),
    );
    fireEvent.change(screen.getByLabelText("Nombre del juego"), {
      target: { value: "Azul corregido" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Quitar Colocación de losetas" }),
    );
    fireEvent.change(screen.getByLabelText("Mecánicas"), {
      target: { value: "Drafting" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Añadir" })[0]!);
    fireEvent.change(screen.getByLabelText("Mecánicas"), {
      target: { value: "Colección de conjuntos" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Añadir" })[0]!);
    fireEvent.change(screen.getByLabelText("Categorías"), {
      target: { value: "Familiar" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Añadir" })[1]!);
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(updatePublicGame).toHaveBeenCalledWith(
        game.id,
        expect.objectContaining({
          name: "Azul corregido",
          minPlayers: 2,
          maxPlayers: 4,
          mechanics: ["Drafting", "Colección de conjuntos"],
          categories: ["Abstracto", "Familiar"],
        }),
      ),
    );
    expect(await screen.findByText("Azul corregido")).toBeInTheDocument();
    expect(
      screen.getByText(/ficha pública quedó actualizada/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Añadir portada")).toBeInTheDocument();
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
