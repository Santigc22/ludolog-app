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
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    mechanics: game.mechanics,
  },
  edition: {
    id: edition.id,
    editionName: edition.editionName,
    editionNumber: null,
    languageCode: "es",
    publicationYear: 2018,
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
  getGame.mockResolvedValue({ game: { ...game, editions: [edition] } });
  listCollections.mockResolvedValue({
    collections: [collection, destination],
    pagination: { page: 1, pageSize: 100, totalItems: 2, totalPages: 1 },
  });
});

test("lists copies and opens their complete detail", async () => {
  render(<CopyInventoryWorkspace collection={collection} />);

  fireEvent.click(await screen.findByRole("button", { name: /Azul familiar/ }));
  expect(await screen.findByLabelText("Detalle de la copia")).toHaveTextContent(
    "Edición en español",
  );
  expect(getCopy).toHaveBeenCalledWith(copy.id);
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
        minPlayers: 4,
        maxPlayers: 6,
      }),
    ),
  );
  expect(screen.getByText("Colocación de losetas")).toBeInTheDocument();
});

test("registers a copy and only offers editions from the selected game", async () => {
  createCopy.mockResolvedValue({ copy, acquisition: null });
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
