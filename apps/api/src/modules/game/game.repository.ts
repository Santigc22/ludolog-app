import type {
  GameDetail,
  GameEdition,
  GameListQuery,
  GameListResponse,
  GameSummary,
  NormalizedCreatePrivateGameRequest,
  NormalizedUpdatePublicGameRequest,
} from "@ludoteca/contracts";
import type { PoolClient } from "pg";

import { databasePool } from "../../infrastructure/database/index.js";

type GameRow = Readonly<{
  id: string;
  name: string;
  description: string | null;
  publication_year: number | null;
  min_players: number;
  max_players: number;
  mechanics: string[];
  categories: string[];
  cover_media_id: string | null;
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
  moderationStatus: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  isOwnedByViewer: boolean;
  createdAt: string;
}>;

type GameDetailRow = GameRow &
  Readonly<{ editions: GameEditionJson[]; can_manage_catalog: boolean }>;

function mapGame(row: GameRow): GameSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    publicationYear: row.publication_year,
    minPlayers: row.min_players,
    maxPlayers: row.max_players,
    mechanics: row.mechanics,
    categories: row.categories,
    coverMediaId: row.cover_media_id,
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
  return {
    ...mapGame(row),
    editions: row.editions.map(mapEdition),
    canManageCatalog: row.can_manage_catalog,
  };
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
  if (query.category !== undefined) {
    filterConditions.push(`EXISTS (
      SELECT 1
      FROM game_categories
      INNER JOIN categories ON categories.id = game_categories.category_id
      WHERE game_categories.game_id = games.id
        AND categories.name ILIKE $${values.push(`%${escapeLikePattern(query.category)}%`)} ESCAPE '\\'
    )`);
  }
  if (query.minPlayers !== undefined && query.maxPlayers !== undefined) {
    filterConditions.push(
      `games.min_players = $${values.push(query.minPlayers)}`,
      `games.max_players = $${values.push(query.maxPlayers)}`,
    );
  } else if (query.minPlayers !== undefined) {
    const playerCountParameter = values.push(query.minPlayers);
    filterConditions.push(
      `games.min_players <= $${playerCountParameter}`,
      `games.max_players >= $${playerCountParameter}`,
    );
  } else if (query.maxPlayers !== undefined) {
    const playerCountParameter = values.push(query.maxPlayers);
    filterConditions.push(
      `games.min_players <= $${playerCountParameter}`,
      `games.max_players >= $${playerCountParameter}`,
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
              games.min_players, games.max_players, games.cover_media_id,
              ARRAY(
                SELECT mechanics.name
                FROM game_mechanics
                INNER JOIN mechanics ON mechanics.id = game_mechanics.mechanic_id
                WHERE game_mechanics.game_id = games.id
                ORDER BY lower(mechanics.name), mechanics.id
              ) AS mechanics,
              ARRAY(
                SELECT categories.name
                FROM game_categories
                INNER JOIN categories ON categories.id = game_categories.category_id
                WHERE game_categories.game_id = games.id
                ORDER BY lower(categories.name), categories.id
              ) AS categories,
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
            games.min_players, games.max_players, games.cover_media_id,
            ARRAY(
              SELECT mechanics.name
              FROM game_mechanics
              INNER JOIN mechanics ON mechanics.id = game_mechanics.mechanic_id
              WHERE game_mechanics.game_id = games.id
              ORDER BY lower(mechanics.name), mechanics.id
            ) AS mechanics,
            ARRAY(
              SELECT categories.name
              FROM game_categories
              INNER JOIN categories ON categories.id = game_categories.category_id
              WHERE game_categories.game_id = games.id
              ORDER BY lower(categories.name), categories.id
            ) AS categories,
            games.min_duration_minutes, games.max_duration_minutes,
            games.min_age, games.max_age, games.complexity,
            games.classification_code, games.visibility_code,
            games.moderation_status_code,
            COALESCE(games.created_by_user_id = $1, false) AS is_owned_by_viewer,
            COALESCE(
              $1::uuid IS NOT NULL AND EXISTS (
                SELECT 1
                FROM user_roles
                INNER JOIN role_permissions
                  ON role_permissions.role_code = user_roles.role_code
                WHERE user_roles.user_id = $1
                  AND role_permissions.permission_code = 'catalog.game.manage'
              ),
              false
            ) AS can_manage_catalog,
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
                  'moderationStatus', game_editions.moderation_status_code,
                  'isOwnedByViewer', COALESCE(game_editions.created_by_user_id = $1, false),
                  'createdAt', game_editions.created_at
                ) ORDER BY game_editions.created_at ASC, game_editions.id ASC
              ) FILTER (
                WHERE game_editions.id IS NOT NULL
                  AND (
                    game_editions.moderation_status_code = 'APPROVED'
                    OR (
                      $1::uuid IS NOT NULL
                      AND game_editions.created_by_user_id = $1
                      AND game_editions.moderation_status_code = 'PENDING_REVIEW'
                    )
                  )
              ),
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
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<GameRow>(
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
               cover_media_id,
               ARRAY[]::text[] AS mechanics,
               ARRAY[]::text[] AS categories,
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
    const mechanics = input.mechanics ?? [];
    const categories = input.categories ?? [];
    await replaceGameMechanics(client, row.id, mechanics);
    await replaceGameCategories(client, row.id, categories);
    await client.query("COMMIT");

    return {
      ...mapGame(row),
      mechanics,
      categories,
      editions: [],
      canManageCatalog: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

type EditableGameRow = Readonly<{
  name: string;
  description: string | null;
  publication_year: number | null;
  min_players: number;
  max_players: number;
  min_duration_minutes: number | null;
  max_duration_minutes: number | null;
  min_age: number | null;
  max_age: number | null;
  complexity: string | null;
  mechanics: string[];
  categories: string[];
}>;

export type UpdatePublicGameResult =
  | Readonly<{ kind: "not_found" }>
  | Readonly<{
      kind: "invalid_range";
      field: "maxPlayers" | "maxDurationMinutes" | "maxAge";
    }>
  | Readonly<{ kind: "success"; game: GameDetail }>;

async function replaceGameMechanics(
  client: PoolClient,
  gameId: string,
  mechanics: string[],
): Promise<void> {
  await client.query("DELETE FROM game_mechanics WHERE game_id = $1", [gameId]);
  for (const mechanic of mechanics) {
    await client.query(
      `INSERT INTO mechanics (name) VALUES ($1) ON CONFLICT DO NOTHING`,
      [mechanic],
    );
    await client.query(
      `INSERT INTO game_mechanics (game_id, mechanic_id)
       SELECT $1, mechanics.id
       FROM mechanics
       WHERE lower(mechanics.name) = lower($2)
       ON CONFLICT DO NOTHING`,
      [gameId, mechanic],
    );
  }
}

async function replaceGameCategories(
  client: PoolClient,
  gameId: string,
  categories: string[],
): Promise<void> {
  await client.query("DELETE FROM game_categories WHERE game_id = $1", [
    gameId,
  ]);
  for (const category of categories) {
    await client.query(
      `INSERT INTO categories (name) VALUES ($1) ON CONFLICT DO NOTHING`,
      [category],
    );
    await client.query(
      `INSERT INTO game_categories (game_id, category_id)
       SELECT $1, categories.id
       FROM categories
       WHERE lower(categories.name) = lower($2)
       ON CONFLICT DO NOTHING`,
      [gameId, category],
    );
  }
}

export async function updatePublicGame(
  gameId: string,
  editorUserId: string,
  input: NormalizedUpdatePublicGameRequest,
): Promise<UpdatePublicGameResult> {
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<EditableGameRow>(
      `SELECT games.name, games.description, games.publication_year,
              games.min_players, games.max_players,
              games.min_duration_minutes, games.max_duration_minutes,
              games.min_age, games.max_age, games.complexity,
              ARRAY(
                SELECT mechanics.name
                FROM game_mechanics
                INNER JOIN mechanics ON mechanics.id = game_mechanics.mechanic_id
                WHERE game_mechanics.game_id = games.id
                ORDER BY lower(mechanics.name), mechanics.id
              ) AS mechanics
              , ARRAY(
                SELECT categories.name
                FROM game_categories
                INNER JOIN categories ON categories.id = game_categories.category_id
                WHERE game_categories.game_id = games.id
                ORDER BY lower(categories.name), categories.id
              ) AS categories
       FROM games
       WHERE games.id = $1
         AND games.visibility_code = 'PUBLIC'
         AND games.classification_code IN ('OFFICIAL', 'COMMUNITY')
         AND games.moderation_status_code = 'APPROVED'
         AND games.archived_at IS NULL
       FOR UPDATE OF games`,
      [gameId],
    );
    const current = locked.rows[0];
    if (current === undefined) {
      await client.query("ROLLBACK");
      return { kind: "not_found" };
    }

    const next = {
      name: input.name ?? current.name,
      description:
        input.description === undefined
          ? current.description
          : input.description,
      publicationYear:
        input.publicationYear === undefined
          ? current.publication_year
          : input.publicationYear,
      minPlayers: input.minPlayers ?? current.min_players,
      maxPlayers: input.maxPlayers ?? current.max_players,
      minDurationMinutes:
        input.minDurationMinutes === undefined
          ? current.min_duration_minutes
          : input.minDurationMinutes,
      maxDurationMinutes:
        input.maxDurationMinutes === undefined
          ? current.max_duration_minutes
          : input.maxDurationMinutes,
      minAge: input.minAge === undefined ? current.min_age : input.minAge,
      maxAge: input.maxAge === undefined ? current.max_age : input.maxAge,
      complexity:
        input.complexity === undefined
          ? current.complexity === null
            ? null
            : Number(current.complexity)
          : input.complexity,
      mechanics: input.mechanics ?? current.mechanics,
      categories: input.categories ?? current.categories,
    };
    if (next.maxPlayers < next.minPlayers) {
      await client.query("ROLLBACK");
      return { kind: "invalid_range", field: "maxPlayers" };
    }
    if (
      next.minDurationMinutes !== null &&
      next.maxDurationMinutes !== null &&
      next.maxDurationMinutes < next.minDurationMinutes
    ) {
      await client.query("ROLLBACK");
      return { kind: "invalid_range", field: "maxDurationMinutes" };
    }
    if (
      next.minAge !== null &&
      next.maxAge !== null &&
      next.maxAge < next.minAge
    ) {
      await client.query("ROLLBACK");
      return { kind: "invalid_range", field: "maxAge" };
    }

    await client.query(
      `UPDATE games
       SET name = $2, description = $3, publication_year = $4,
           min_players = $5, max_players = $6,
           min_duration_minutes = $7, max_duration_minutes = $8,
           min_age = $9, max_age = $10, complexity = $11,
           updated_at = clock_timestamp()
       WHERE id = $1`,
      [
        gameId,
        next.name,
        next.description,
        next.publicationYear,
        next.minPlayers,
        next.maxPlayers,
        next.minDurationMinutes,
        next.maxDurationMinutes,
        next.minAge,
        next.maxAge,
        next.complexity,
      ],
    );
    if (input.mechanics !== undefined) {
      await replaceGameMechanics(client, gameId, next.mechanics);
    }
    if (input.categories !== undefined) {
      await replaceGameCategories(client, gameId, next.categories);
    }
    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, resource_type, resource_id,
         before_state, after_state, context
       ) VALUES ($1, 'game.public_updated', 'GAME', $2, $3::jsonb, $4::jsonb, $5::jsonb)`,
      [
        editorUserId,
        gameId,
        JSON.stringify({
          name: current.name,
          description: current.description,
          publicationYear: current.publication_year,
          minPlayers: current.min_players,
          maxPlayers: current.max_players,
          minDurationMinutes: current.min_duration_minutes,
          maxDurationMinutes: current.max_duration_minutes,
          minAge: current.min_age,
          maxAge: current.max_age,
          complexity:
            current.complexity === null ? null : Number(current.complexity),
          mechanics: current.mechanics,
          categories: current.categories,
        }),
        JSON.stringify(next),
        JSON.stringify({ changedFields: Object.keys(input) }),
      ],
    );
    await client.query("COMMIT");

    const game = await findVisibleGameDetail(gameId, editorUserId);
    if (game === null) throw new Error("Updated public game disappeared");
    return { kind: "success", game };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
