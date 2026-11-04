import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CollectionDetailWorkspace } from "../src/components/collections/collection-detail-workspace";
import { CollectionListWorkspace } from "../src/components/collections/collection-list-workspace";
import { ApiRequestError } from "../src/lib/api/client";

vi.mock("../src/components/copies/copy-inventory-workspace", () => ({
  CopyInventoryWorkspace: () => <div>Inventario de copias</div>,
}));

const listCollections = vi.fn();
const createCollection = vi.fn();
const getCollection = vi.fn();
const updateCollection = vi.fn();
const archiveCollection = vi.fn();

vi.mock("../src/lib/api/collections", () => ({
  listCollections: (...arguments_: unknown[]) => listCollections(...arguments_),
  createCollection: (...arguments_: unknown[]) =>
    createCollection(...arguments_),
  getCollection: (...arguments_: unknown[]) => getCollection(...arguments_),
  updateCollection: (...arguments_: unknown[]) =>
    updateCollection(...arguments_),
  archiveCollection: (...arguments_: unknown[]) =>
    archiveCollection(...arguments_),
}));

const collection = {
  id: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
  type: "PERSONAL" as const,
  status: "ACTIVE" as const,
  name: "Juegos de casa",
  description: null,
  visibility: "PRIVATE" as const,
  isForSale: false,
  gameCount: 3,
  createdByUserId: "3297a863-b2f0-4746-bfec-e76517342f86",
  effectiveRole: "OWNER" as const,
  createdAt: "2026-09-21T20:00:00.000Z",
  updatedAt: "2026-09-21T20:00:00.000Z",
  archivedAt: null,
};

describe("CollectionListWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCollections.mockResolvedValue({
      collections: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
      },
    });
  });

  test("offers a clear empty state and creates the first collection", async () => {
    createCollection.mockResolvedValue({ collection });
    render(<CollectionListWorkspace />);

    expect(
      await screen.findByText("Tu primera estantería empieza aquí"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Crear mi primera ludoteca" }),
    );
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Juegos de casa" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Crear ludoteca" }).closest("form")!,
    );

    await waitFor(() => {
      expect(createCollection).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Juegos de casa",
          visibility: "PRIVATE",
        }),
      );
    });
    expect(
      await screen.findByText("Tu ludoteca quedó creada."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Juegos de casa/ }),
    ).toHaveAttribute("href", `/ludotecas/${collection.id}`);
  });

  test("redirects an unauthenticated visitor toward access", async () => {
    listCollections.mockRejectedValue(
      new ApiRequestError(401, "AUTHENTICATION_REQUIRED"),
    );
    render(<CollectionListWorkspace />);

    expect(
      await screen.findByText("Tu colección te espera"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al acceso" })).toHaveAttribute(
      "href",
      "/acceso",
    );
  });

  test("renders collections, archived state, filter, and pagination", async () => {
    const archived = {
      ...collection,
      id: "55a6d21e-27cf-4daa-afc4-89a77d8cc155",
      name: "Archivo público",
      description: "Juegos históricos",
      visibility: "PUBLIC" as const,
      status: "ARCHIVED" as const,
      archivedAt: "2026-09-21T21:00:00.000Z",
    };
    listCollections.mockResolvedValue({
      collections: [collection, archived],
      pagination: { page: 1, pageSize: 20, totalItems: 21, totalPages: 2 },
    });
    render(<CollectionListWorkspace />);

    expect(await screen.findByText("Archivo público")).toBeInTheDocument();
    expect(screen.getByText("Archivada")).toBeInTheDocument();
    expect(screen.getByText("Pública")).toBeInTheDocument();
    expect(screen.getAllByText("3 juegos")).not.toHaveLength(0);
    expect(screen.getByText("Sin descripción todavía.")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Mostrar archivadas"));
    await waitFor(() => {
      expect(listCollections).toHaveBeenCalledWith({
        page: 1,
        includeArchived: true,
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => {
      expect(listCollections).toHaveBeenCalledWith({
        page: 2,
        includeArchived: true,
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await waitFor(() => {
      expect(listCollections).toHaveBeenLastCalledWith({
        page: 1,
        includeArchived: true,
      });
    });
  });

  test("shows a recoverable load failure", async () => {
    listCollections.mockRejectedValue(new Error("offline"));
    render(<CollectionListWorkspace />);

    expect(
      await screen.findByText("No pudimos cargar tus ludotecas"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });

  test("shows field validation returned by the create endpoint", async () => {
    createCollection.mockRejectedValue(
      new ApiRequestError(400, "VALIDATION_ERROR", "Invalid", {
        fields: {
          name: ["El nombre ya está en uso"],
          description: ["Descripción inválida"],
        },
      }),
    );
    render(<CollectionListWorkspace />);
    await screen.findByText("Tu primera estantería empieza aquí");
    fireEvent.click(screen.getByRole("button", { name: "Nueva ludoteca" }));
    fireEvent.submit(
      screen.getByRole("button", { name: "Crear ludoteca" }).closest("form")!,
    );

    expect(
      await screen.findByText("El nombre ya está en uso"),
    ).toBeInTheDocument();
    expect(screen.getByText("Descripción inválida")).toBeInTheDocument();
  });

  test("moves to access when the session expires during creation", async () => {
    createCollection.mockRejectedValue(
      new ApiRequestError(401, "SESSION_EXPIRED"),
    );
    render(<CollectionListWorkspace />);
    await screen.findByText("Tu primera estantería empieza aquí");
    fireEvent.click(
      screen.getByRole("button", { name: "Crear mi primera ludoteca" }),
    );
    fireEvent.submit(
      screen.getByRole("button", { name: "Crear ludoteca" }).closest("form")!,
    );

    expect(
      await screen.findByText("Tu colección te espera"),
    ).toBeInTheDocument();
  });
});

describe("CollectionDetailWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCollection.mockResolvedValue({
      collection: { ...collection, canEdit: true },
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  test("edits metadata when the API grants capability", async () => {
    updateCollection.mockResolvedValue({
      collection: {
        ...collection,
        name: "Colección principal",
        canEdit: true,
      },
    });
    render(<CollectionDetailWorkspace collectionId={collection.id} />);

    expect(await screen.findByText("Edita tu ludoteca")).toBeInTheDocument();
    expect(screen.getByText("3 juegos")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Colección principal" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Guardar cambios" }).closest("form")!,
    );

    await waitFor(() => {
      expect(updateCollection).toHaveBeenCalledWith(
        collection.id,
        expect.objectContaining({ name: "Colección principal" }),
      );
    });
    expect(
      await screen.findByText("Los cambios quedaron guardados."),
    ).toBeInTheDocument();
  });

  test("archives only when the API reports OWNER and preserves read-only UI", async () => {
    archiveCollection.mockResolvedValue({
      collection: {
        ...collection,
        status: "ARCHIVED",
        archivedAt: "2026-09-21T21:00:00.000Z",
        canEdit: false,
      },
    });
    render(<CollectionDetailWorkspace collectionId={collection.id} />);

    fireEvent.click(await screen.findByRole("button", { name: "Archivar" }));

    await waitFor(() => {
      expect(archiveCollection).toHaveBeenCalledWith(collection.id);
    });
    expect(
      await screen.findByText("Esta ludoteca está archivada"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archivar" })).toBeNull();
  });

  test("renders not-found and ordinary API failures distinctly", async () => {
    getCollection.mockRejectedValueOnce(new ApiRequestError(404, "NOT_FOUND"));
    const first = render(
      <CollectionDetailWorkspace collectionId={collection.id} />,
    );
    expect(
      await screen.findByText("No encontramos esta ludoteca"),
    ).toBeInTheDocument();
    first.unmount();

    getCollection.mockRejectedValueOnce(new Error("offline"));
    render(<CollectionDetailWorkspace collectionId={collection.id} />);
    expect(
      await screen.findByText("No pudimos abrir la ludoteca"),
    ).toBeInTheDocument();
  });

  test("renders a public visitor and an archived owner as read-only", async () => {
    getCollection.mockResolvedValueOnce({
      collection: {
        ...collection,
        visibility: "PUBLIC",
        effectiveRole: null,
        canEdit: false,
      },
    });
    const first = render(
      <CollectionDetailWorkspace collectionId={collection.id} />,
    );
    expect(
      await screen.findByText("Puedes consultar este espacio"),
    ).toBeInTheDocument();
    expect(screen.getByText("Visitante")).toBeInTheDocument();
    first.unmount();

    getCollection.mockResolvedValueOnce({
      collection: { ...collection, status: "ARCHIVED", canEdit: false },
    });
    render(<CollectionDetailWorkspace collectionId={collection.id} />);
    expect(
      await screen.findByText("Esta ludoteca está archivada"),
    ).toBeInTheDocument();
  });

  test("does not archive when confirmation is declined", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    render(<CollectionDetailWorkspace collectionId={collection.id} />);

    fireEvent.click(await screen.findByRole("button", { name: "Archivar" }));
    expect(archiveCollection).not.toHaveBeenCalled();
  });

  test("reports update validation and archived conflicts", async () => {
    updateCollection
      .mockRejectedValueOnce(
        new ApiRequestError(400, "VALIDATION_ERROR", "Invalid", {
          fields: { name: ["Nombre inválido"], ignored: [] },
        }),
      )
      .mockRejectedValueOnce(new ApiRequestError(409, "COLLECTION_ARCHIVED"));
    render(<CollectionDetailWorkspace collectionId={collection.id} />);
    await screen.findByText("Edita tu ludoteca");
    const form = screen
      .getByRole("button", { name: "Guardar cambios" })
      .closest("form")!;

    fireEvent.submit(form);
    expect(await screen.findByText("Nombre inválido")).toBeInTheDocument();
    fireEvent.submit(form);
    expect(
      await screen.findByText(/ya está archivada y no admite cambios/),
    ).toBeInTheDocument();
  });

  test("reports an archive failure", async () => {
    archiveCollection.mockRejectedValue(new Error("offline"));
    render(<CollectionDetailWorkspace collectionId={collection.id} />);

    fireEvent.click(await screen.findByRole("button", { name: "Archivar" }));
    expect(
      await screen.findByText(/No pudimos archivar la ludoteca/),
    ).toBeInTheDocument();
  });
});
