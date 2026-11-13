import { expect, test } from "vitest";

import {
  GAME_IMPORT_TEMPLATE,
  parseGameImportCsv,
} from "../src/lib/csv/game-bulk-import";

test("parses the Spanish semicolon template and decimal commas", () => {
  const result = parseGameImportCsv(GAME_IMPORT_TEMPLATE);

  expect(result.errors).toEqual([]);
  expect(result.rows[0]).toMatchObject({
    rowNumber: 2,
    coverFileName: "harmonies.webp",
    game: {
      name: "Harmonies",
      publicationYear: 2024,
      minPlayers: 1,
      maxPlayers: 4,
      complexity: 1.9,
      classification: "OFFICIAL",
      mechanics: ["Colocación de losetas", "Drafting"],
      categories: ["Naturaleza", "Animales"],
    },
  });
});

test("supports comma CSV, quoted fields and a path reduced to its file name", () => {
  const result = parseGameImportCsv(
    'name,description,minPlayers,maxPlayers,classification,coverFile\n"Game, one","Text with ""quotes""",2,5,community,C:\\\\covers\\game.webp',
  );

  expect(result.errors).toEqual([]);
  expect(result.rows[0]).toMatchObject({
    coverFileName: "game.webp",
    game: {
      name: "Game, one",
      description: 'Text with "quotes"',
      classification: "COMMUNITY",
    },
  });
});

test("reports missing columns, invalid ranges and duplicate names", () => {
  expect(
    parseGameImportCsv("nombre;jugadoresMinimos\nAzul;2").errors[0],
  ).toMatch(/jugadoresmaximos/);

  const result = parseGameImportCsv(
    "nombre;jugadoresMinimos;jugadoresMaximos\nAzul;4;2\nazul;2;4",
  );
  expect(result.errors.join(" ")).toMatch(/maxPlayers/);
  expect(result.errors.join(" ")).toMatch(/duplicado/);
});
