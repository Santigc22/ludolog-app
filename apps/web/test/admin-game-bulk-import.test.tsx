import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { AdminGameBulkImport } from "../src/components/games/admin-game-bulk-import";

const createPublicGamesBatch = vi.fn();
const uploadGameCover = vi.fn();
const imageFileError = vi.fn();

vi.mock("../src/lib/api/games", () => ({
  createPublicGamesBatch: (...arguments_: unknown[]) =>
    createPublicGamesBatch(...arguments_),
}));

vi.mock("../src/lib/api/media", () => ({
  imageFileError: (...arguments_: unknown[]) => imageFileError(...arguments_),
  uploadGameCover: (...arguments_: unknown[]) => uploadGameCover(...arguments_),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  imageFileError.mockReturnValue(null);
  uploadGameCover.mockResolvedValue({ coverMediaId: "cover-id" });
});

test("previews a CSV and publishes its games and matched covers", async () => {
  createPublicGamesBatch.mockResolvedValue({
    createdCount: 2,
    games: [{ id: "game-one" }, { id: "game-two" }],
  });
  const onCompleted = vi.fn();
  render(<AdminGameBulkImport onCompleted={onCompleted} />);

  const csv = new File(["csv"], "juegos.csv", { type: "text/csv" });
  Object.defineProperty(csv, "text", {
    value: vi
      .fn()
      .mockResolvedValue(
        [
          "nombre;jugadoresMinimos;jugadoresMaximos;portada",
          "Sky Team;2;2;sky-team.webp",
          "Azul;2;4;",
        ].join("\n"),
      ),
  });
  const cover = new File(["image"], "sky-team.webp", {
    type: "image/webp",
  });

  fireEvent.change(screen.getByLabelText(/^Archivo CSV/), {
    target: { files: [csv] },
  });
  expect(await screen.findByText("2 juegos válidos")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Portadas referenciadas/), {
    target: { files: [cover] },
  });
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Publicar y aprobar 2 juegos" })
      .closest("form")!,
  );

  await waitFor(() =>
    expect(createPublicGamesBatch).toHaveBeenCalledWith({
      games: [
        expect.objectContaining({
          name: "Sky Team",
          minPlayers: 2,
          maxPlayers: 2,
        }),
        expect.objectContaining({
          name: "Azul",
          minPlayers: 2,
          maxPlayers: 4,
        }),
      ],
    }),
  );
  expect(uploadGameCover).toHaveBeenCalledWith("game-one", cover);
  expect(onCompleted).toHaveBeenCalledWith(2);
  expect(await screen.findByText(/2 juegos publicados/)).toHaveTextContent(
    "1 portada guardada",
  );
});

test("does not submit a file with invalid ranges", async () => {
  render(<AdminGameBulkImport onCompleted={vi.fn()} />);
  const csv = new File(["csv"], "invalido.csv", { type: "text/csv" });
  Object.defineProperty(csv, "text", {
    value: vi
      .fn()
      .mockResolvedValue("nombre;jugadoresMinimos;jugadoresMaximos\nAzul;4;2"),
  });

  fireEvent.change(screen.getByLabelText(/^Archivo CSV/), {
    target: { files: [csv] },
  });

  expect(await screen.findByRole("alert")).toHaveTextContent("maxPlayers");
  expect(
    screen.getByRole("button", { name: "Publicar y aprobar 0 juegos" }),
  ).toBeDisabled();
  expect(createPublicGamesBatch).not.toHaveBeenCalled();
});
