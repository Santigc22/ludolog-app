import {
  CreatePublicGameRequestSchema,
  type CreatePublicGameRequest,
} from "@ludoteca/contracts";

export const GAME_IMPORT_TEMPLATE = `nombre;descripcion;anioPublicacion;jugadoresMinimos;jugadoresMaximos;duracionMinima;duracionMaxima;edadMinima;edadMaxima;complejidad;clasificacion;mecanicas;categorias;portada
Harmonies;Construye paisajes y hábitats;2024;1;4;30;45;10;;1,9;OFICIAL;Colocación de losetas|Drafting;Naturaleza|Animales;harmonies.webp
`;

export type ParsedGameImportRow = Readonly<{
  rowNumber: number;
  game: CreatePublicGameRequest;
  coverFileName: string | null;
}>;

export type GameImportParseResult = Readonly<{
  rows: ParsedGameImportRow[];
  errors: string[];
}>;

const headerAliases = {
  name: ["nombre", "name"],
  description: ["descripcion", "description"],
  publicationYear: ["aniopublicacion", "publicationyear"],
  minPlayers: ["jugadoresminimos", "minplayers"],
  maxPlayers: ["jugadoresmaximos", "maxplayers"],
  minDurationMinutes: ["duracionminima", "mindurationminutes"],
  maxDurationMinutes: ["duracionmaxima", "maxdurationminutes"],
  minAge: ["edadminima", "minage"],
  maxAge: ["edadmaxima", "maxage"],
  complexity: ["complejidad", "complexity"],
  classification: ["clasificacion", "classification"],
  mechanics: ["mecanicas", "mechanics"],
  categories: ["categorias", "categories"],
  coverFileName: ["portada", "coverfile"],
} as const;

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLocaleLowerCase();
}

function delimiterCounts(line: string) {
  let quoted = false;
  let commas = 0;
  let semicolons = 0;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && character === ",") commas += 1;
    else if (!quoted && character === ";") semicolons += 1;
  }
  return { commas, semicolons };
}

function parseTable(text: string): string[][] {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const counts = delimiterCounts(firstLine);
  const delimiter = counts.semicolons > counts.commas ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("El CSV contiene una comilla sin cerrar.");
  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function nullableNumber(
  value: string,
  label: string,
  rowNumber: number,
  errors: string[],
) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const number = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(number)) {
    errors.push(`Fila ${rowNumber}: ${label} debe ser un número.`);
    return null;
  }
  return number;
}

function requiredInteger(
  value: string,
  label: string,
  rowNumber: number,
  errors: string[],
) {
  const number = nullableNumber(value, label, rowNumber, errors);
  if (number === null) {
    if (!value.trim()) errors.push(`Fila ${rowNumber}: falta ${label}.`);
    return 0;
  }
  if (!Number.isInteger(number)) {
    errors.push(`Fila ${rowNumber}: ${label} debe ser un número entero.`);
  }
  return number;
}

function tags(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function fileName(value: string) {
  return value.trim().split(/[\\/]/).pop()?.trim() || null;
}

function classification(value: string) {
  const code = normalized(value);
  if (!code || code === "oficial" || code === "official") return "OFFICIAL";
  if (code === "comunitario" || code === "community") return "COMMUNITY";
  return value.trim().toLocaleUpperCase();
}

export function parseGameImportCsv(text: string): GameImportParseResult {
  let table: string[][];
  try {
    table = parseTable(text);
  } catch (error) {
    return {
      rows: [],
      errors: [
        error instanceof Error ? error.message : "No pudimos leer el CSV.",
      ],
    };
  }
  if (table.length < 2) {
    return {
      rows: [],
      errors: ["El CSV debe incluir encabezados y al menos un juego."],
    };
  }

  const headers = table[0]!.map(normalized);
  const indexes = Object.fromEntries(
    Object.entries(headerAliases).map(([field, aliases]) => [
      field,
      headers.findIndex((header) => aliases.includes(header as never)),
    ]),
  ) as Record<keyof typeof headerAliases, number>;
  const missing = (["name", "minPlayers", "maxPlayers"] as const).filter(
    (field) => indexes[field] < 0,
  );
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        `Faltan columnas obligatorias: ${missing
          .map((field) => headerAliases[field][0])
          .join(", ")}.`,
      ],
    };
  }

  const errors: string[] = [];
  const rows: ParsedGameImportRow[] = [];
  const seenNames = new Map<string, number>();
  const value = (row: string[], field: keyof typeof headerAliases) =>
    indexes[field] < 0 ? "" : (row[indexes[field]] ?? "");

  table.slice(1).forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const name = value(row, "name").trim();
    if (!name) errors.push(`Fila ${rowNumber}: falta nombre.`);
    if (name) {
      const nameKey = name.toLocaleLowerCase();
      const previous = seenNames.get(nameKey);
      if (previous !== undefined) {
        errors.push(
          `Filas ${previous} y ${rowNumber}: el nombre ${name} está duplicado en el archivo.`,
        );
      } else {
        seenNames.set(nameKey, rowNumber);
      }
    }
    const candidate = {
      name,
      description: value(row, "description").trim() || null,
      publicationYear: nullableNumber(
        value(row, "publicationYear"),
        "año de publicación",
        rowNumber,
        errors,
      ),
      minPlayers: requiredInteger(
        value(row, "minPlayers"),
        "jugadores mínimos",
        rowNumber,
        errors,
      ),
      maxPlayers: requiredInteger(
        value(row, "maxPlayers"),
        "jugadores máximos",
        rowNumber,
        errors,
      ),
      minDurationMinutes: nullableNumber(
        value(row, "minDurationMinutes"),
        "duración mínima",
        rowNumber,
        errors,
      ),
      maxDurationMinutes: nullableNumber(
        value(row, "maxDurationMinutes"),
        "duración máxima",
        rowNumber,
        errors,
      ),
      minAge: nullableNumber(
        value(row, "minAge"),
        "edad mínima",
        rowNumber,
        errors,
      ),
      maxAge: nullableNumber(
        value(row, "maxAge"),
        "edad máxima",
        rowNumber,
        errors,
      ),
      complexity: nullableNumber(
        value(row, "complexity"),
        "complejidad",
        rowNumber,
        errors,
      ),
      classification: classification(value(row, "classification")),
      mechanics: tags(value(row, "mechanics")),
      categories: tags(value(row, "categories")),
    };
    const parsed = CreatePublicGameRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(
          `Fila ${rowNumber}: ${issue.path.join(".") || "datos"}: ${issue.message}`,
        );
      }
      return;
    }
    rows.push({
      rowNumber,
      game: parsed.data,
      coverFileName: fileName(value(row, "coverFileName")),
    });
  });

  if (rows.length > 500) {
    errors.push("El archivo supera el máximo de 500 juegos por lote.");
  }
  return { rows, errors };
}
