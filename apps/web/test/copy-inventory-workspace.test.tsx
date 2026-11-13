import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { CopyInventoryWorkspace } from "../src/components/copies/copy-inventory-workspace";
import { ApiRequestError } from "../src/lib/api/client";

const listCopies = vi.fn();
const createCopy = vi.fn();
const getCopy = vi.fn();
const updateCopy = vi.fn();
const moveCopy = vi.fn();
const exitCopy = vi.fn();
const listGames = vi.fn();
const listGameTaxonomyOptions = vi.fn();
const getGame = vi.fn();
const listCollections = vi.fn();

vi.mock("../src/lib/api/copies", () => ({
  listCopies: (...arguments_: unknown[]) => listCopies(...arguments_),
  createCopy: (...arguments_: unknown[]) => createCopy(...arguments_),
  getCopy: (...arguments_: unknown[]) => getCopy(...arguments_),
  updateCopy: (...arguments_: unknown[]) => updateCopy(...arguments_),
  moveCopy: (...arguments_: unknown[]) => moveCopy(...arguments_),
  exitCopy: (...arguments_: unknown[]) => exitCopy(...arguments_),
}));
vi.mock("../src/lib/api/games", () => ({
  listGames: (...arguments_: unknown[]) => listGames(...arguments_),
  listGameTaxonomyOptions: (...arguments_: unknown[]) =>
    listGameTaxonomyOptions(...arguments_),
  getGame: (...arguments_: unknown[]) => getGame(...arguments_),
}));
vi.mock("../src/lib/api/collections", () => ({
  listCollections: (...arguments_: unknown[]) => listCollections(...arguments_),
}));

const collection = {
  id: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
  type: "PERSONAL" as const,
  status: "ACTIVE" as const,
  name: "Juegos de casa",
  description: null,
  visibility: "PRIVATE" as const,
  isForSale: false,
  gameCount: 1,
  createdByUserId: "3297a863-b2f0-4746-bfec-e76517342f86",
  effectiveRole: "OWNER" as const,
  canEdit: true,
  createdAt: "2026-09-21T20:00:00.000Z",
  updatedAt: "2026-09-21T20:00:00.000Z",
  archivedAt: null,
};
const destination = {
  ...collection,
  id: "d3637ab1-a02a-4169-bf95-87993e664bbc",
  name: "Juegos del club",
  effectiveRole: "MANAGER" as const,
};
const game = {
  id: "7b962b21-67dd-49bc-97dd-c14ae1805504",
  name: "Azul",
  description: null,
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
  createdAt: "2026-09-21T20:00:00.000Z",
  updatedAt: "2026-09-21T20:00:00.000Z",
};
const edition = {
  id: "930a9d0e-b4f4-4299-bcd1-e51be4d85c13",
  editionName: "Edición en español",
  editionNumber: null,
  languageCode: "es",
  publicationYear: 2018,
  isbn: null,
  sku: null,
  upc: null,
  notes: null,
  moderationStatus: "APPROVED" as const,
  isOwnedByViewer: false,
  createdAt: "2026-09-21T20:00:00.000Z",
};
const copy = {
  id: "a22a3acb-fb3f-463a-9e27-d624b66b97b4",
  gameId: game.id,
  gameEditionId: edition.id,
  currentCollectionId: collection.id,
  lifecycle: "ACTIVE" as const,
  condition: "GOOD" as const,
  alias: "Azul familiar",
  notes: null,
  exitReason: null,
  exitedAt: null,
  createdByUserId: collection.createdByUserId,
  createdAt: "2026-09-21T20:00:00.000Z",
  updatedAt: "2026-09-21T20:00:00.000Z",
  game: {
    id: game.id,
    name: game.name,
    coverMediaId: "57f463df-4ab8-4e62-a433-5edc295c060b",
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    mechanics: game.mechanics,
    categories: game.categories,
  },
  edition: {
    id: edition.id,
    editionName: edition.editionName,
    editionNumber: null,
    languageCode: "es",
    publicationYear: 2018,
    moderationStatus: "APPROVED" as const,
  },
};
const detail = {
  ...copy,
  collectionHistory: [
    {
      id: "57f463df-4ab8-4e62-a433-5edc295c060b",
      collectionId: collection.id,
      collectionName: collection.name,
      startedAt: "2026-09-21T20:00:00.000Z",
      endedAt: null,
    },
  ],
  acquisitions: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  listCopies.mockResolvedValue({
    copies: [copy],
    pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
  });
  getCopy.mockResolvedValue({ copy: detail });
  listGames.mockResolvedValue({
    games: [game],
    pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
  });
  listGameTaxonomyOptions.mockResolvedValue({
    mechanics: ["Colocación de losetas"],
    categories: ["Abstracto", "Cartas", "Mazo de cartas"],
  });
  getGame.mockResolvedValue({ game: { ...game, editions: [edition] } });
  listCollections.mockResolvedValue({
    collections: [collection, destination],
    pagination: { page: 1, pageSize: 100, totalItems: 2, totalPages: 1 },
  });
});

test("lists copies and opens their complete detail", async () => {
  render(<CopyInventoryWorkspace collection={collection} />);

  expect(await screen.findByAltText("Portada de Azul")).toBeInTheDocument();
  expect(
    screen.getByText("Azul", { selector: ".copy-card-title" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Alias:/)).toBeInTheDocument();
  expect(screen.getByText("Azul familiar")).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: /Azul familiar/ }));
  const copyDetail = await screen.findByLabelText("Detalle de la copia");
  expect(copyDetail).toHaveTextContent("Edición en español");
  expect(copyDetail.querySelector("h3")).toHaveTextContent("Azul");
  expect(copyDetail).toHaveTextContent("Alias: Azul familiar");
  expect(getCopy).toHaveBeenCalledWith(copy.id);
});

test("shows a labeled alias even when it matches the game name", async () => {
  listCopies.mockResolvedValue({
    copies: [{ ...copy, alias: "azul" }],
    pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
  });

  render(<CopyInventoryWorkspace collection={collection} />);

  expect(
    await screen.findByText("Azul", { selector: ".copy-card-title" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Alias:/)).toHaveTextContent("Alias: azul");
});

test("refreshes the alias field when selecting a different copy", async () => {
  const secondCopy = {
    ...copy,
    id: "6aed4713-04f7-4c31-97c2-8cce86cbdaca",
    gameId: "c2590165-649a-4dfa-8779-028ac071428c",
    gameEditionId: null,
    alias: "Catan del club",
    game: {
      ...copy.game,
      id: "c2590165-649a-4dfa-8779-028ac071428c",
      name: "Catan",
      coverMediaId: null,
    },
    edition: null,
  };
  const secondDetail = {
    ...secondCopy,
    collectionHistory: detail.collectionHistory,
    acquisitions: [],
  };
  listCopies.mockResolvedValue({
    copies: [copy, secondCopy],
    pagination: { page: 1, pageSize: 100, totalItems: 2, totalPages: 1 },
  });
  getCopy.mockImplementation((copyId: string) =>
    Promise.resolve({
      copy: copyId === secondCopy.id ? secondDetail : detail,
    }),
  );

  render(<CopyInventoryWorkspace collection={collection} />);

  fireEvent.click(await screen.findByRole("button", { name: /Azul familiar/ }));
  expect(
    await screen.findByRole("textbox", { name: /Alias de esta copia/ }),
  ).toHaveValue("Azul familiar");

  fireEvent.click(screen.getByRole("button", { name: /Catan del club/ }));
  await waitFor(() =>
    expect(
      screen.getByRole("textbox", { name: /Alias de esta copia/ }),
    ).toHaveValue("Catan del club"),
  );
});

test("filters inventory games by name, mechanic and overlapping player range", async () => {
  render(<CopyInventoryWorkspace collection={collection} />);
  await screen.findByRole("button", { name: /Azul familiar/ });

  fireEvent.change(screen.getByLabelText("Nombre"), {
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
    expect(listCopies).toHaveBeenCalledWith(
      collection.id,
      expect.objectContaining({
        lifecycle: "ACTIVE",
        q: "azul",
        mechanic: "losetas",
        category: "abstracto",
        minPlayers: 4,
        maxPlayers: 6,
      }),
    ),
  );
  expect(
    screen.getByText("Colocación de losetas", {
      selector: ".mechanic-list span",
    }),
  ).toBeInTheDocument();
});

test("registers a copy and only offers editions from the selected game", async () => {
  createCopy.mockResolvedValue({
    copy,
    acquisition: null,
    editionProposal: null,
  });
  render(<CopyInventoryWorkspace collection={collection} />);

  fireEvent.click(
    await screen.findByRole("button", { name: "Registrar copia" }),
  );
  const gameSelect = await screen.findByLabelText("Juego visible");
  fireEvent.change(gameSelect, { target: { value: game.id } });

  const editionSelect = await screen.findByLabelText(
    "Edición del juego seleccionado",
  );
  await waitFor(() => expect(editionSelect).not.toBeDisabled());
  expect(
    screen.getByRole("option", { name: "Edición en español" }),
  ).toHaveValue(edition.id);
  fireEvent.change(editionSelect, { target: { value: edition.id } });
  fireEvent.submit(
    screen.getByRole("button", { name: "Registrar copia" }).closest("form")!,
  );

  await waitFor(() =>
    expect(createCopy).toHaveBeenCalledWith(
      collection.id,
      expect.objectContaining({ gameId: game.id, gameEditionId: edition.id }),
    ),
  );
});

test("registers the copy while sending a new edition to moderation", async () => {
  createCopy.mockResolvedValue({
    copy,
    acquisition: null,
    editionProposal: {
      editionId: edition.id,
      moderationCaseId: "6aed4713-04f7-4c31-97c2-8cce86cbdaca",
      status: "PENDING_REVIEW",
    },
  });
  render(<CopyInventoryWorkspace collection={collection} />);

  fireEvent.click(
    await screen.findByRole("button", { name: "Registrar copia" }),
  );
  fireEvent.change(await screen.findByLabelText("Juego visible"), {
    target: { value: game.id },
  });
  await screen.findByRole("option", { name: "Edición en español" });
  fireEvent.click(
    screen.getByRole("button", { name: "Proponer una nueva edición" }),
  );
  fireEvent.change(screen.getByLabelText("Nombre de la edición"), {
    target: { value: "Deluxe" },
  });
  fireEvent.change(screen.getByLabelText("Idioma"), {
    target: { value: "es" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Registrar copia" }).closest("form")!,
  );

  await waitFor(() =>
    expect(createCopy).toHaveBeenCalledWith(
      collection.id,
      expect.objectContaining({
        gameId: game.id,
        gameEditionId: null,
        proposedEdition: expect.objectContaining({
          editionName: "Deluxe",
          languageCode: "es",
        }),
      }),
    ),
  );
  expect(
    await screen.findByText(/nueva edición fue enviada a moderación/i),
  ).toBeInTheDocument();
});

test("assigns an existing edition to a copy that had none", async () => {
  const copyWithoutEdition = {
    ...detail,
    gameEditionId: null,
    edition: null,
  };
  getCopy.mockResolvedValue({ copy: copyWithoutEdition });
  updateCopy.mockResolvedValue({
    copy: {
      ...copyWithoutEdition,
      gameEditionId: edition.id,
      edition: copy.edition,
    },
    editionProposal: null,
  });
  render(<CopyInventoryWorkspace collection={collection} />);

  fireEvent.click(await screen.findByRole("button", { name: /Azul familiar/ }));
  const editionSelect = await screen.findByLabelText(/^Edición de esta copia/);
  await waitFor(() => expect(editionSelect).not.toBeDisabled());
  expect(editionSelect).toHaveValue("");
  fireEvent.change(editionSelect, { target: { value: edition.id } });
  fireEvent.submit(
    screen.getByRole("button", { name: "Guardar copia" }).closest("form")!,
  );

  await waitFor(() =>
    expect(updateCopy).toHaveBeenCalledWith(
      copy.id,
      expect.objectContaining({ gameEditionId: edition.id }),
    ),
  );
  expect(await screen.findByText("La copia quedó actualizada.")).toBeVisible();
});

test("proposes and assigns a new edition while editing an existing copy", async () => {
  const copyWithoutEdition = {
    ...detail,
    gameEditionId: null,
    edition: null,
  };
  getCopy.mockResolvedValue({ copy: copyWithoutEdition });
  updateCopy.mockResolvedValue({
    copy: {
      ...copyWithoutEdition,
      gameEditionId: edition.id,
      edition: {
        ...copy.edition,
        id: edition.id,
        editionName: "Deluxe",
        moderationStatus: "PENDING_REVIEW" as const,
      },
    },
    editionProposal: {
      editionId: edition.id,
      moderationCaseId: "6aed4713-04f7-4c31-97c2-8cce86cbdaca",
      status: "PENDING_REVIEW" as const,
    },
  });
  render(<CopyInventoryWorkspace collection={collection} />);

  fireEvent.click(await screen.findByRole("button", { name: /Azul familiar/ }));
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Proponer una nueva edición para esta copia",
    }),
  );
  fireEvent.change(screen.getByLabelText("Nombre de la nueva edición"), {
    target: { value: "Deluxe" },
  });
  fireEvent.change(screen.getByLabelText("Idioma de la nueva edición"), {
    target: { value: "es" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Guardar copia" }).closest("form")!,
  );

  await waitFor(() =>
    expect(updateCopy).toHaveBeenCalledWith(
      copy.id,
      expect.objectContaining({
        gameEditionId: undefined,
        proposedEdition: expect.objectContaining({
          editionName: "Deluxe",
          languageCode: "es",
        }),
      }),
    ),
  );
  expect(
    await screen.findByText(/nueva edición fue enviada a moderación/i),
  ).toBeVisible();
});

test("requires a destination and confirmation to move, and explains exit preservation", async () => {
  moveCopy.mockResolvedValue({
    copy: { ...detail, currentCollectionId: destination.id },
  });
  exitCopy.mockResolvedValue({
    copy: {
      ...detail,
      lifecycle: "EXITED",
      currentCollectionId: null,
      exitReason: "SOLD",
      exitedAt: "2026-09-22T15:00:00.000Z",
    },
  });
  render(<CopyInventoryWorkspace collection={collection} />);
  fireEvent.click(await screen.findByRole("button", { name: /Azul familiar/ }));
  await screen.findByLabelText("Detalle de la copia");

  expect(
    screen.getByText(/conservará historial y adquisiciones/),
  ).toBeInTheDocument();

  const destinationSelect = await screen.findByLabelText("Destino");
  fireEvent.focus(destinationSelect);
  await waitFor(() => expect(listCollections).toHaveBeenCalled());
  fireEvent.change(destinationSelect, { target: { value: destination.id } });
  fireEvent.submit(
    screen.getByRole("button", { name: "Mover copia" }).closest("form")!,
  );
  await waitFor(() =>
    expect(moveCopy).toHaveBeenCalledWith(copy.id, {
      destinationCollectionId: destination.id,
    }),
  );
  expect(window.confirm).toHaveBeenCalledWith(
    expect.stringContaining(destination.name),
  );
});

test("retires a copy only after explaining and confirming the preserved history", async () => {
  exitCopy.mockResolvedValue({
    copy: {
      ...detail,
      lifecycle: "EXITED",
      currentCollectionId: null,
      exitReason: "SOLD",
      exitedAt: "2026-09-22T15:00:00.000Z",
    },
  });
  render(<CopyInventoryWorkspace collection={collection} />);
  fireEvent.click(await screen.findByRole("button", { name: /Azul familiar/ }));
  fireEvent.submit(
    (await screen.findByRole("button", { name: "Retirar copia" })).closest(
      "form",
    )!,
  );

  await waitFor(() =>
    expect(exitCopy).toHaveBeenCalledWith(copy.id, { reason: "SOLD" }),
  );
  expect(window.confirm).toHaveBeenCalledWith(
    expect.stringContaining("conservará su historial y adquisiciones"),
  );
  expect(await screen.findByText(/fue retirada por/)).toBeInTheDocument();
});

test("refreshes the detail after a concurrent conflict", async () => {
  const latest = { ...detail, condition: "DAMAGED" as const };
  getCopy
    .mockResolvedValueOnce({ copy: detail })
    .mockResolvedValueOnce({ copy: latest });
  updateCopy.mockRejectedValue(
    new ApiRequestError(409, "COPY_NOT_ACTIVE", "Concurrent change"),
  );
  render(<CopyInventoryWorkspace collection={collection} />);
  fireEvent.click(await screen.findByRole("button", { name: /Azul familiar/ }));
  const save = await screen.findByRole("button", { name: "Guardar copia" });
  fireEvent.submit(save.closest("form")!);

  expect(
    await screen.findByText(/Mostramos su estado más reciente/),
  ).toBeInTheDocument();
  expect(getCopy).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText("Detalle de la copia")).toHaveTextContent(
    "Dañada",
  );
});
