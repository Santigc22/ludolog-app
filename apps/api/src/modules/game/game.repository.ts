import type {
  GameDetail,
  GameEdition,
  GameListQuery,
  GameListResponse,
  GameSummary,
  NormalizedCreatePrivateGameRequest,
} from "@ludoteca/contracts";

import { databasePool } from "../../infrastructure/database/index.js";

type GameRow = Readonly<{
  id: string;
  name: string;
  description: string | null;
  publication_year: number | null;
  min_players: number;
  max_players: number;
  mechanics: string[];
  min_duration_minutes: number | null;
  max_duration_minutes: number | null;
  min_age: number | null;
  max_age: number | null;
  complexity: string | null;
  classification_code: "OFFICIAL" | "COMMUNITY" | "PRIVATE";
  visibility_code: "PRIVATE" | "PUBLIC";
  moderation_status_code:
    | "DRAFT"
    | "PENDING_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "REJECTED_DUPLICATE"
    | "BLOCKED";
  is_owned_by_viewer: boolean;
  created_at: Date;
  updated_at: Date;
}>;

type GameEditionJson = Readonly<{
  id: string;
  editionName: string | null;
  editionNumber: string | null;
  languageCode: string | null;
  publicationYear: number | null;
  isbn: string | null;
  sku: string | null;
  upc: string | null;
  notes: string | null;
  createdAt: string;
}>;

type GameDetailRow = GameRow & Readonly<{ editions: GameEditionJson[] }>;

function mapGame(row: GameRow): GameSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    publicationYear: row.publication_year,
    minPlayers: row.min_players,
    maxPlayers: row.max_players,
    mechanics: row.mechanics,
    minDurationMinutes: row.min_duration_minutes,
    maxDurationMinutes: row.max_duration_minutes,
    minAge: row.min_age,
    maxAge: row.max_age,
    complexity: row.complexity === null ? null : Number(row.complexity),
    classification: row.classification_code,
    visibility: row.visibility_code,
    moderationStatus: row.moderation_status_code,
    isOwnedByViewer: row.is_owned_by_viewer,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapEdition(edition: GameEditionJson): GameEdition {
  return {
    ...edition,
    createdAt: new Date(edition.createdAt).toISOString(),
  };
}

function mapGameDetail(row: GameDetailRow): GameDetail {
  return { ...mapGame(row), editions: row.editions.map(mapEdition) };
}

function escapeLikePattern(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

const orderBy = {
  name: "lower(games.name) ASC, games.id ASC",
  newest: "games.created_at DESC, games.id DESC",
  publicationYear:
    "games.publication_year DESC NULLS LAST, lower(games.name) ASC, games.id ASC",
} as const;

const visibleGameCondition = `(
  (
    games.visibility_code = 'PUBLIC'
    AND games.classification_code IN ('OFFICIAL', 'COMMUNITY')
    AND games.moderation_status_code = 'APPROVED'
  ) OR (
    $1::uuid IS NOT NULL
    AND games.visibility_code = 'PRIVATE'
    AND games.classification_code = 'PRIVATE'
    AND games.moderation_status_code <> 'ARCHIVED'
    AND games.created_by_user_id = $1
  )
) AND games.archived_at IS NULL`;

export async function findVisibleGames(
  viewerUserId: string | null,
  query: GameListQuery,
): Promise<GameListResponse> {
  const values: unknown[] = [viewerUserId];
  const filterConditions: string[] = [];
  if (query.q !== undefined) {
    filterConditions.push(
      `games.name ILIKE $${values.push(`%${escapeLikePattern(query.q)}%`)} ESCAPE '\\'`,
    );
  }
  if (query.mechanic !== undefined) {
    filterConditions.push(`EXISTS (
      SELECT 1
      FROM game_mechanics
      INNER JOIN mechanics ON mechanics.id = game_mechanics.mechanic_id
      WHERE game_mechanics.game_id = games.id
        AND mechanics.name ILIKE $${values.push(`%${escapeLikePattern(query.mechanic)}%`)} ESCAPE '\\'
    )`);
  }
  if (query.minPlayers !== undefined && query.maxPlayers !== undefined) {
    filterConditions.push(
      `games.min_players = $${values.push(query.minPlayers)}`,
      `games.max_players = $${values.push(query.maxPlayers)}`,
    );
  } else if (query.minPlayers !== undefined) {
    filterConditions.push(
      `games.max_players >= $${values.push(query.minPlayers)}`,
    );
  } else if (query.maxPlayers !== undefined) {
    filterConditions.push(
      `games.max_players <= $${values.push(query.maxPlayers)}`,
    );
  }
  const filters = filterConditions
    .map((condition) => `AND ${condition}`)
    .join("\n");
  const offset = (query.page - 1) * query.pageSize;
  const listValues = [...values, query.pageSize, offset];
  const limitParameter = `$${values.length + 1}`;
  const offsetParameter = `$${values.length + 2}`;
  const [itemsResult, countResult] = await Promise.all([
    databasePool.query<GameRow>(
      `SELECT games.id, games.name, games.description, games.publication_year,
              games.min_players, games.max_players,
              ARRAY(
                SELECT mechanics.name
                FROM game_mechanics
                INNER JOIN mechanics ON mechanics.id = game_mechanics.mechanic_id
                WHERE game_mechanics.game_id = games.id
                ORDER BY lower(mechanics.name), mechanics.id
              ) AS mechanics,
              games.min_duration_minutes, games.max_duration_minutes,
              games.min_age, games.max_age, games.complexity,
              games.classification_code, games.visibility_code,
              games.moderation_status_code,
              COALESCE(games.created_by_user_id = $1, false) AS is_owned_by_viewer,
              games.created_at, games.updated_at
       FROM games
       WHERE ${visibleGameCondition}
         ${filters}
       ORDER BY ${orderBy[query.sort]}
       LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
      listValues,
    ),
    databasePool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM games
       WHERE ${visibleGameCondition}
         ${filters}`,
      values,
    ),
  ]);
  const totalItems = Number(countResult.rows[0]?.count ?? 0);

  return {
    games: itemsResult.rows.map(mapGame),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    },
  };
}

export async function findVisibleGameDetail(
  gameId: string,
  viewerUserId: string | null,
): Promise<GameDetail | null> {
  const result = await databasePool.query<GameDetailRow>(
    `SELECT games.id, games.name, games.description, games.publication_year,
            games.min_players, games.max_players,
            ARRAY(
              SELECT mechanics.name
              FROM game_mechanics
              INNER JOIN mechanics ON mechanics.id = game_mechanics.mechanic_id
              WHERE game_mechanics.game_id = games.id
              ORDER BY lower(mechanics.name), mechanics.id
            ) AS mechanics,
            games.min_duration_minutes, games.max_duration_minutes,
            games.min_age, games.max_age, games.complexity,
            games.classification_code, games.visibility_code,
            games.moderation_status_code,
            COALESCE(games.created_by_user_id = $1, false) AS is_owned_by_viewer,
            games.created_at, games.updated_at,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', game_editions.id,
                  'editionName', game_editions.edition_name,
                  'editionNumber', game_editions.edition_number,
                  'languageCode', game_editions.language_code,
                  'publicationYear', game_editions.publication_year,
                  'isbn', game_editions.isbn,
                  'sku', game_editions.sku,
                  'upc', game_editions.upc,
                  'notes', game_editions.notes,
                  'createdAt', game_editions.created_at
                ) ORDER BY game_editions.created_at ASC, game_editions.id ASC
              ) FILTER (WHERE game_editions.id IS NOT NULL),
              '[]'::json
            ) AS editions
     FROM games
     LEFT JOIN game_editions ON game_editions.game_id = games.id
     WHERE games.id = $2
       AND ${visibleGameCondition}
     GROUP BY games.id`,
    [viewerUserId, gameId],
  );
  const row = result.rows[0];

  return row === undefined ? null : mapGameDetail(row);
}

export async function createPrivateGame(
  ownerUserId: string,
  input: NormalizedCreatePrivateGameRequest,
): Promise<GameDetail> {
  const result = await databasePool.query<GameRow>(
    `INSERT INTO games (
       name, description, publication_year, min_players, max_players,
       min_duration_minutes, max_duration_minutes, min_age, max_age,
       complexity, classification_code, visibility_code,
       moderation_status_code, created_by_user_id
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       'PRIVATE', 'PRIVATE', 'DRAFT', $11
     )
     RETURNING id, name, description, publication_year, min_players,
               max_players, min_duration_minutes, max_duration_minutes,
               min_age, max_age, complexity, classification_code,
               visibility_code, moderation_status_code,
               ARRAY[]::text[] AS mechanics,
               true AS is_owned_by_viewer, created_at, updated_at`,
    [
      input.name,
      input.description ?? null,
      input.publicationYear ?? null,
      input.minPlayers,
      input.maxPlayers,
      input.minDurationMinutes ?? null,
      input.maxDurationMinutes ?? null,
      input.minAge ?? null,
      input.maxAge ?? null,
      input.complexity ?? null,
      ownerUserId,
    ],
  );
  const row = result.rows[0];

  if (row === undefined) {
    throw new Error("Private game insert did not return a row");
  }

  return { ...mapGame(row), editions: [] };
}
