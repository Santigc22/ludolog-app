import type {
  Acquisition,
  Copy,
  CopyDetail,
  CopyListItem,
  CopyListQuery,
  CopyListResponse,
  NormalizedCreateCopyRequest,
  NormalizedExitCopyRequest,
  NormalizedMoveCopyRequest,
  NormalizedUpdateCopyRequest,
} from "@ludoteca/contracts";
import type { PoolClient } from "pg";

import { databasePool } from "../../infrastructure/database/index.js";

type CopyRow = Readonly<{
  id: string;
  game_id: string;
  game_edition_id: string | null;
  current_collection_id: string | null;
  lifecycle_code: "ACTIVE" | "EXITED";
  condition_code: Copy["condition"];
  alias: string | null;
  notes: string | null;
  exit_reason_code: string | null;
  exited_at: Date | null;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
}>;

type AcquisitionRow = Readonly<{
  id: string;
  copy_id: string;
  collection_id: string;
  acquired_by_user_id: string;
  type_code: Acquisition["type"];
  acquired_on: Date | string | null;
  price_amount: string | null;
  currency_code: string | null;
  source_name: string | null;
  notes: string | null;
  created_at: Date;
}>;

export type CreateCopyResult =
  | Readonly<{ kind: "collection_not_found" }>
  | Readonly<{ kind: "role_denied" }>
  | Readonly<{ kind: "collection_archived" }>
  | Readonly<{ kind: "game_not_found" }>
  | Readonly<{ kind: "edition_not_found" }>
  | Readonly<{ kind: "success"; copy: Copy; acquisition: Acquisition | null }>;

type CopyListRow = CopyRow &
  Readonly<{
    game_name: string;
    game_min_players: number;
    game_max_players: number;
    game_mechanics: string[];
    edition_name: string | null;
    edition_number: string | null;
    language_code: string | null;
    edition_publication_year: number | null;
  }>;

type CopyHistoryRow = Readonly<{
  id: string;
  collection_id: string;
  collection_name: string;
  started_at: Date;
  ended_at: Date | null;
}>;

export type CopyListResult =
  | Readonly<{ kind: "collection_not_found" }>
  | Readonly<{ kind: "success"; response: CopyListResponse }>;

export type UpdateCopyResult =
  | Readonly<{ kind: "copy_not_found" }>
  | Readonly<{ kind: "role_denied" }>
  | Readonly<{ kind: "collection_archived" }>
  | Readonly<{ kind: "success"; copy: Copy }>;

export type MoveCopyResult =
  | Readonly<{ kind: "copy_not_found" }>
  | Readonly<{ kind: "copy_not_active" }>
  | Readonly<{ kind: "source_role_denied" }>
  | Readonly<{ kind: "source_archived" }>
  | Readonly<{ kind: "destination_not_found" }>
  | Readonly<{ kind: "destination_role_denied" }>
  | Readonly<{ kind: "destination_archived" }>
  | Readonly<{ kind: "same_destination" }>
  | Readonly<{ kind: "history_inconsistent" }>
  | Readonly<{ kind: "success"; copy: Copy }>;

export type ExitCopyResult =
  | Readonly<{ kind: "copy_not_found" }>
  | Readonly<{ kind: "copy_not_active" }>
  | Readonly<{ kind: "role_denied" }>
  | Readonly<{ kind: "collection_archived" }>
  | Readonly<{ kind: "history_inconsistent" }>
  | Readonly<{ kind: "success"; copy: Copy }>;

function mapCopy(row: CopyRow): Copy {
  return {
    id: row.id,
    gameId: row.game_id,
    gameEditionId: row.game_edition_id,
    currentCollectionId: row.current_collection_id,
    lifecycle: row.lifecycle_code,
    condition: row.condition_code,
    alias: row.alias,
    notes: row.notes,
    exitReason: row.exit_reason_code,
    exitedAt: row.exited_at?.toISOString() ?? null,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapAcquisition(row: AcquisitionRow): Acquisition {
  return {
    id: row.id,
    copyId: row.copy_id,
    collectionId: row.collection_id,
    acquiredByUserId: row.acquired_by_user_id,
    type: row.type_code,
    acquiredOn:
      row.acquired_on instanceof Date
        ? row.acquired_on.toISOString().slice(0, 10)
        : row.acquired_on,
    priceAmount: row.price_amount === null ? null : Number(row.price_amount),
    currencyCode: row.currency_code,
    sourceName: row.source_name,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
  };
}

function mapCopyListItem(row: CopyListRow): CopyListItem {
  return {
    ...mapCopy(row),
    game: {
      id: row.game_id,
      name: row.game_name,
      minPlayers: row.game_min_players,
      maxPlayers: row.game_max_players,
      mechanics: row.game_mechanics,
    },
    edition:
      row.game_edition_id === null
        ? null
        : {
            id: row.game_edition_id,
            editionName: row.edition_name,
            editionNumber: row.edition_number,
            languageCode: row.language_code,
            publicationYear: row.edition_publication_year,
          },
  };
}

function escapeLikePattern(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

async function rollback<T>(client: PoolClient, result: T): Promise<T> {
  await client.query("ROLLBACK");
  return result;
}

export async function createCopyInCollection(
  collectionId: string,
  userId: string,
  input: NormalizedCreateCopyRequest,
): Promise<CreateCopyResult> {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");
    const membership = await client.query<{
      role_code: "OWNER" | "MANAGER" | "MEMBER" | "VIEWER";
      status_code: "ACTIVE" | "ARCHIVED";
    }>(
      `SELECT collection_members.role_code, collections.status_code
       FROM collections
       INNER JOIN collection_members
         ON collection_members.collection_id = collections.id
        AND collection_members.user_id = $2
       WHERE collections.id = $1
       FOR UPDATE OF collections`,
      [collectionId, userId],
    );
    const access = membership.rows[0];

    if (access === undefined) {
      return rollback(client, { kind: "collection_not_found" } as const);
    }
    if (access.role_code !== "OWNER" && access.role_code !== "MANAGER") {
      return rollback(client, { kind: "role_denied" } as const);
    }
    if (access.status_code === "ARCHIVED") {
      return rollback(client, { kind: "collection_archived" } as const);
    }

    const game = await client.query<{ id: string }>(
      `SELECT id
       FROM games
       WHERE id = $1
         AND archived_at IS NULL
         AND (
           (
             visibility_code = 'PUBLIC'
             AND classification_code IN ('OFFICIAL', 'COMMUNITY')
             AND moderation_status_code = 'APPROVED'
           ) OR (
             visibility_code = 'PRIVATE'
             AND classification_code = 'PRIVATE'
             AND moderation_status_code <> 'ARCHIVED'
             AND created_by_user_id = $2
           )
         )`,
      [input.gameId, userId],
    );

    if (game.rows[0] === undefined) {
      return rollback(client, { kind: "game_not_found" } as const);
    }

    if (input.gameEditionId != null) {
      const edition = await client.query<{ id: string }>(
        `SELECT id FROM game_editions WHERE id = $1 AND game_id = $2`,
        [input.gameEditionId, input.gameId],
      );
      if (edition.rows[0] === undefined) {
        return rollback(client, { kind: "edition_not_found" } as const);
      }
    }

    const insertedCopy = await client.query<CopyRow>(
      `INSERT INTO copies (
         game_id, game_edition_id, current_collection_id, lifecycle_code,
         condition_code, alias, notes, created_by_user_id
       ) VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6, $7)
       RETURNING id, game_id, game_edition_id, current_collection_id,
                 lifecycle_code, condition_code, alias, notes,
                 exit_reason_code, exited_at, created_by_user_id,
                 created_at, updated_at`,
      [
        input.gameId,
        input.gameEditionId ?? null,
        collectionId,
        input.condition,
        input.alias ?? null,
        input.notes ?? null,
        userId,
      ],
    );
    const copyRow = insertedCopy.rows[0];

    if (copyRow === undefined) {
      throw new Error("Copy insert did not return a row");
    }

    const history = await client.query<{ id: string }>(
      `INSERT INTO copy_collection_history (
         copy_id, collection_id, changed_by_user_id
       ) VALUES ($1, $2, $3)
       RETURNING id`,
      [copyRow.id, collectionId, userId],
    );
    const historyId = history.rows[0]?.id;

    if (historyId === undefined) {
      throw new Error("Copy history insert did not return a row");
    }

    let acquisition: Acquisition | null = null;
    if (input.acquisition !== undefined) {
      const insertedAcquisition = await client.query<AcquisitionRow>(
        `INSERT INTO acquisitions (
           copy_id, collection_id, acquired_by_user_id, type_code,
           acquired_on, price_amount, currency_code, source_name, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, copy_id, collection_id, acquired_by_user_id, type_code,
                   acquired_on, price_amount, currency_code, source_name,
                   notes, created_at`,
        [
          copyRow.id,
          collectionId,
          userId,
          input.acquisition.type,
          input.acquisition.acquiredOn ?? null,
          input.acquisition.priceAmount ?? null,
          input.acquisition.currencyCode ?? null,
          input.acquisition.sourceName ?? null,
          input.acquisition.notes ?? null,
        ],
      );
      const acquisitionRow = insertedAcquisition.rows[0];
      if (acquisitionRow === undefined) {
        throw new Error("Acquisition insert did not return a row");
      }
      acquisition = mapAcquisition(acquisitionRow);
    }

    const copy = mapCopy(copyRow);
    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, resource_type, resource_id, after_state, context
       ) VALUES ($1, 'copy.created', 'COPY', $2, $3::jsonb, $4::jsonb)`,
      [
        userId,
        copy.id,
        JSON.stringify(copy),
        JSON.stringify({
          collectionId,
          historyId,
          acquisitionId: acquisition?.id ?? null,
        }),
      ],
    );

    await client.query("COMMIT");
    return { kind: "success", copy, acquisition };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const copyListColumns = `
  copies.id, copies.game_id, copies.game_edition_id,
  copies.current_collection_id, copies.lifecycle_code,
  copies.condition_code, copies.alias, copies.notes,
  copies.exit_reason_code, copies.exited_at, copies.created_by_user_id,
  copies.created_at, copies.updated_at, games.name AS game_name,
  games.min_players AS game_min_players,
  games.max_players AS game_max_players,
  ARRAY(
    SELECT mechanics.name
    FROM game_mechanics
    INNER JOIN mechanics ON mechanics.id = game_mechanics.mechanic_id
    WHERE game_mechanics.game_id = games.id
    ORDER BY lower(mechanics.name), mechanics.id
  ) AS game_mechanics,
  game_editions.edition_name, game_editions.edition_number,
  game_editions.language_code,
  game_editions.publication_year AS edition_publication_year`;

export async function findCopiesForCollection(
  collectionId: string,
  userId: string,
  query: CopyListQuery,
): Promise<CopyListResult> {
  const access = await databasePool.query<{ found: boolean }>(
    `SELECT true AS found
     FROM collections
     INNER JOIN collection_members
       ON collection_members.collection_id = collections.id
      AND collection_members.user_id = $2
     WHERE collections.id = $1`,
    [collectionId, userId],
  );

  if (access.rows[0] === undefined) return { kind: "collection_not_found" };

  const membershipCondition = `EXISTS (
    SELECT 1 FROM copy_collection_history
    WHERE copy_collection_history.copy_id = copies.id
      AND copy_collection_history.collection_id = $1
  )`;
  const lifecycleCondition = {
    ACTIVE:
      "copies.lifecycle_code = 'ACTIVE' AND copies.current_collection_id = $1",
    EXITED: `copies.lifecycle_code = 'EXITED' AND ${membershipCondition}`,
    ALL: membershipCondition,
  }[query.lifecycle];
  const values: unknown[] = [collectionId];
  const filters: string[] = [lifecycleCondition];
  if (query.q !== undefined) {
    filters.push(
      `games.name ILIKE $${values.push(`%${escapeLikePattern(query.q)}%`)} ESCAPE '\\'`,
    );
  }
  if (query.mechanic !== undefined) {
    filters.push(`EXISTS (
      SELECT 1
      FROM game_mechanics AS filtered_game_mechanics
      INNER JOIN mechanics AS filtered_mechanics
        ON filtered_mechanics.id = filtered_game_mechanics.mechanic_id
      WHERE filtered_game_mechanics.game_id = games.id
        AND filtered_mechanics.name ILIKE $${values.push(`%${escapeLikePattern(query.mechanic)}%`)} ESCAPE '\\'
    )`);
  }
  if (query.minPlayers !== undefined && query.maxPlayers !== undefined) {
    filters.push(
      `games.min_players = $${values.push(query.minPlayers)}`,
      `games.max_players = $${values.push(query.maxPlayers)}`,
    );
  } else if (query.minPlayers !== undefined) {
    filters.push(`games.max_players >= $${values.push(query.minPlayers)}`);
  } else if (query.maxPlayers !== undefined) {
    filters.push(`games.max_players <= $${values.push(query.maxPlayers)}`);
  }
  const offset = (query.page - 1) * query.pageSize;
  const listValues = [...values, query.pageSize, offset];
  const limitParameter = `$${values.length + 1}`;
  const offsetParameter = `$${values.length + 2}`;
  const whereCondition = filters.join(" AND ");
  const [items, count] = await Promise.all([
    databasePool.query<CopyListRow>(
      `SELECT ${copyListColumns}
       FROM copies
       INNER JOIN games ON games.id = copies.game_id
       LEFT JOIN game_editions ON game_editions.id = copies.game_edition_id
       WHERE ${whereCondition}
       ORDER BY copies.created_at DESC, copies.id DESC
       LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
      listValues,
    ),
    databasePool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM copies
       INNER JOIN games ON games.id = copies.game_id
       WHERE ${whereCondition}`,
      values,
    ),
  ]);
  const totalItems = Number(count.rows[0]?.count ?? 0);

  return {
    kind: "success",
    response: {
      copies: items.rows.map(mapCopyListItem),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    },
  };
}

export async function findCopyDetailForUser(
  copyId: string,
  userId: string,
): Promise<CopyDetail | null> {
  const copyResult = await databasePool.query<CopyListRow>(
    `SELECT ${copyListColumns}
     FROM copies
     INNER JOIN games ON games.id = copies.game_id
     LEFT JOIN game_editions ON game_editions.id = copies.game_edition_id
     INNER JOIN LATERAL (
       SELECT copy_collection_history.collection_id
       FROM copy_collection_history
       WHERE copy_collection_history.copy_id = copies.id
       ORDER BY
         (copy_collection_history.ended_at IS NULL) DESC,
         copy_collection_history.started_at DESC,
         copy_collection_history.id DESC
       LIMIT 1
     ) AS authorized_collection ON true
     INNER JOIN collection_members
       ON collection_members.collection_id = authorized_collection.collection_id
      AND collection_members.user_id = $2
     WHERE copies.id = $1`,
    [copyId, userId],
  );
  const row = copyResult.rows[0];

  if (row === undefined) return null;

  const [history, acquisitions] = await Promise.all([
    databasePool.query<CopyHistoryRow>(
      `SELECT copy_collection_history.id,
              copy_collection_history.collection_id,
              collections.name AS collection_name,
              copy_collection_history.started_at,
              copy_collection_history.ended_at
       FROM copy_collection_history
       INNER JOIN collections
         ON collections.id = copy_collection_history.collection_id
       WHERE copy_collection_history.copy_id = $1
       ORDER BY copy_collection_history.started_at ASC,
                copy_collection_history.id ASC`,
      [copyId],
    ),
    databasePool.query<AcquisitionRow>(
      `SELECT id, copy_id, collection_id, acquired_by_user_id, type_code,
              acquired_on, price_amount, currency_code, source_name, notes,
              created_at
       FROM acquisitions
       WHERE copy_id = $1
       ORDER BY acquired_on ASC NULLS LAST, created_at ASC, id ASC`,
      [copyId],
    ),
  ]);

  return {
    ...mapCopyListItem(row),
    collectionHistory: history.rows.map((period) => ({
      id: period.id,
      collectionId: period.collection_id,
      collectionName: period.collection_name,
      startedAt: period.started_at.toISOString(),
      endedAt: period.ended_at?.toISOString() ?? null,
    })),
    acquisitions: acquisitions.rows.map(mapAcquisition),
  };
}

export async function updateCopyMetadata(
  copyId: string,
  userId: string,
  input: NormalizedUpdateCopyRequest,
): Promise<UpdateCopyResult> {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");
    const locked = await client.query<
      CopyRow & {
        role_code: "OWNER" | "MANAGER" | "MEMBER" | "VIEWER";
        collection_status_code: "ACTIVE" | "ARCHIVED";
        authorized_collection_id: string;
      }
    >(
      `SELECT copies.id, copies.game_id, copies.game_edition_id,
              copies.current_collection_id, copies.lifecycle_code,
              copies.condition_code, copies.alias, copies.notes,
              copies.exit_reason_code, copies.exited_at,
              copies.created_by_user_id, copies.created_at, copies.updated_at,
              collection_members.role_code,
              collections.status_code AS collection_status_code,
              authorized_collection.collection_id AS authorized_collection_id
       FROM copies
       INNER JOIN LATERAL (
         SELECT copy_collection_history.collection_id
         FROM copy_collection_history
         WHERE copy_collection_history.copy_id = copies.id
         ORDER BY
           (copy_collection_history.ended_at IS NULL) DESC,
           copy_collection_history.started_at DESC,
           copy_collection_history.id DESC
         LIMIT 1
       ) AS authorized_collection ON true
       INNER JOIN collections
         ON collections.id = authorized_collection.collection_id
       INNER JOIN collection_members
         ON collection_members.collection_id = collections.id
        AND collection_members.user_id = $2
       WHERE copies.id = $1
       FOR UPDATE OF copies, collections`,
      [copyId, userId],
    );
    const current = locked.rows[0];

    if (current === undefined) {
      return rollback(client, { kind: "copy_not_found" } as const);
    }
    if (current.role_code !== "OWNER" && current.role_code !== "MANAGER") {
      return rollback(client, { kind: "role_denied" } as const);
    }
    if (current.collection_status_code === "ARCHIVED") {
      return rollback(client, { kind: "collection_archived" } as const);
    }

    const assignments: string[] = [];
    const values: unknown[] = [];
    const fields = [
      ["condition", "condition_code"],
      ["alias", "alias"],
      ["notes", "notes"],
    ] as const;

    for (const [property, column] of fields) {
      if (Object.hasOwn(input, property)) {
        values.push(input[property]);
        assignments.push(`${column} = $${values.length}`);
      }
    }

    values.push(copyId);
    const updated = await client.query<CopyRow>(
      `UPDATE copies
       SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length}
       RETURNING id, game_id, game_edition_id, current_collection_id,
                 lifecycle_code, condition_code, alias, notes,
                 exit_reason_code, exited_at, created_by_user_id,
                 created_at, updated_at`,
      values,
    );
    const updatedRow = updated.rows[0];

    if (updatedRow === undefined) {
      throw new Error("Copy update did not return a row");
    }

    const before = mapCopy(current);
    const after = mapCopy(updatedRow);
    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, resource_type, resource_id,
         before_state, after_state, context
       ) VALUES ($1, 'copy.updated', 'COPY', $2, $3::jsonb, $4::jsonb, $5::jsonb)`,
      [
        userId,
        copyId,
        JSON.stringify(before),
        JSON.stringify(after),
        JSON.stringify({
          collectionId: current.authorized_collection_id,
          changedFields: Object.keys(input),
        }),
      ],
    );

    await client.query("COMMIT");
    return { kind: "success", copy: after };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function moveCopyToCollection(
  copyId: string,
  userId: string,
  input: NormalizedMoveCopyRequest,
): Promise<MoveCopyResult> {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");
    const lockedCopy = await client.query<CopyRow>(
      `SELECT id, game_id, game_edition_id, current_collection_id,
              lifecycle_code, condition_code, alias, notes,
              exit_reason_code, exited_at, created_by_user_id,
              created_at, updated_at
       FROM copies
       WHERE id = $1
       FOR UPDATE`,
      [copyId],
    );
    const current = lockedCopy.rows[0];

    if (current === undefined) {
      return rollback(client, { kind: "copy_not_found" } as const);
    }

    const latestHistory = await client.query<{ collection_id: string }>(
      `SELECT collection_id
       FROM copy_collection_history
       WHERE copy_id = $1
       ORDER BY (ended_at IS NULL) DESC, started_at DESC, id DESC
       LIMIT 1`,
      [copyId],
    );
    const authorizedCollectionId = latestHistory.rows[0]?.collection_id;

    if (authorizedCollectionId === undefined) {
      return rollback(client, { kind: "history_inconsistent" } as const);
    }

    const collectionIds = [
      authorizedCollectionId,
      input.destinationCollectionId,
    ].sort();
    const lockedCollections = await client.query<{
      id: string;
      status_code: "ACTIVE" | "ARCHIVED";
      role_code: "OWNER" | "MANAGER" | "MEMBER" | "VIEWER" | null;
    }>(
      `SELECT collections.id, collections.status_code,
              collection_members.role_code
       FROM collections
       LEFT JOIN collection_members
         ON collection_members.collection_id = collections.id
        AND collection_members.user_id = $2
       WHERE collections.id = ANY($1::uuid[])
       ORDER BY collections.id
       FOR UPDATE OF collections`,
      [collectionIds, userId],
    );
    const source = lockedCollections.rows.find(
      ({ id }) => id === authorizedCollectionId,
    );

    if (source?.role_code == null) {
      return rollback(client, { kind: "copy_not_found" } as const);
    }
    if (source.role_code !== "OWNER" && source.role_code !== "MANAGER") {
      return rollback(client, { kind: "source_role_denied" } as const);
    }
    if (source.status_code === "ARCHIVED") {
      return rollback(client, { kind: "source_archived" } as const);
    }
    if (current.lifecycle_code !== "ACTIVE") {
      return rollback(client, { kind: "copy_not_active" } as const);
    }
    if (current.current_collection_id !== authorizedCollectionId) {
      return rollback(client, { kind: "history_inconsistent" } as const);
    }
    if (input.destinationCollectionId === authorizedCollectionId) {
      return rollback(client, { kind: "same_destination" } as const);
    }

    const destination = lockedCollections.rows.find(
      ({ id }) => id === input.destinationCollectionId,
    );
    if (destination?.role_code == null) {
      return rollback(client, { kind: "destination_not_found" } as const);
    }
    if (
      destination.role_code !== "OWNER" &&
      destination.role_code !== "MANAGER"
    ) {
      return rollback(client, { kind: "destination_role_denied" } as const);
    }
    if (destination.status_code === "ARCHIVED") {
      return rollback(client, { kind: "destination_archived" } as const);
    }

    const time = await client.query<{ moved_at: Date }>(
      "SELECT clock_timestamp() AS moved_at",
    );
    const movedAt = time.rows[0]?.moved_at;
    if (movedAt === undefined)
      throw new Error("Move timestamp was not returned");

    const closed = await client.query<{ id: string }>(
      `UPDATE copy_collection_history
       SET ended_at = $3
       WHERE copy_id = $1 AND collection_id = $2 AND ended_at IS NULL
       RETURNING id`,
      [copyId, authorizedCollectionId, movedAt],
    );
    if (closed.rows.length !== 1) {
      return rollback(client, { kind: "history_inconsistent" } as const);
    }

    const updated = await client.query<CopyRow>(
      `UPDATE copies
       SET current_collection_id = $2, updated_at = $3
       WHERE id = $1
       RETURNING id, game_id, game_edition_id, current_collection_id,
                 lifecycle_code, condition_code, alias, notes,
                 exit_reason_code, exited_at, created_by_user_id,
                 created_at, updated_at`,
      [copyId, input.destinationCollectionId, movedAt],
    );
    const updatedRow = updated.rows[0];
    if (updatedRow === undefined) {
      throw new Error("Moved copy update did not return a row");
    }

    const opened = await client.query<{ id: string }>(
      `INSERT INTO copy_collection_history (
         copy_id, collection_id, started_at, changed_by_user_id
       ) VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [copyId, input.destinationCollectionId, movedAt, userId],
    );
    const openedHistoryId = opened.rows[0]?.id;
    if (openedHistoryId === undefined) {
      throw new Error("Moved copy history insert did not return a row");
    }

    const before = mapCopy(current);
    const after = mapCopy(updatedRow);
    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, resource_type, resource_id,
         before_state, after_state, context
       ) VALUES ($1, 'copy.moved', 'COPY', $2, $3::jsonb, $4::jsonb, $5::jsonb)`,
      [
        userId,
        copyId,
        JSON.stringify(before),
        JSON.stringify(after),
        JSON.stringify({
          sourceCollectionId: authorizedCollectionId,
          destinationCollectionId: input.destinationCollectionId,
          closedHistoryId: closed.rows[0]?.id,
          openedHistoryId,
          movedAt: movedAt.toISOString(),
        }),
      ],
    );

    await client.query("COMMIT");
    return { kind: "success", copy: after };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function exitCopyFromCollection(
  copyId: string,
  userId: string,
  input: NormalizedExitCopyRequest,
): Promise<ExitCopyResult> {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");
    const locked = await client.query<
      CopyRow & {
        authorized_collection_id: string;
        collection_status_code: "ACTIVE" | "ARCHIVED";
        role_code: "OWNER" | "MANAGER" | "MEMBER" | "VIEWER";
      }
    >(
      `SELECT copies.id, copies.game_id, copies.game_edition_id,
              copies.current_collection_id, copies.lifecycle_code,
              copies.condition_code, copies.alias, copies.notes,
              copies.exit_reason_code, copies.exited_at,
              copies.created_by_user_id, copies.created_at, copies.updated_at,
              authorized_collection.collection_id AS authorized_collection_id,
              collections.status_code AS collection_status_code,
              collection_members.role_code
       FROM copies
       INNER JOIN LATERAL (
         SELECT copy_collection_history.collection_id
         FROM copy_collection_history
         WHERE copy_collection_history.copy_id = copies.id
         ORDER BY
           (copy_collection_history.ended_at IS NULL) DESC,
           copy_collection_history.started_at DESC,
           copy_collection_history.id DESC
         LIMIT 1
       ) AS authorized_collection ON true
       INNER JOIN collections
         ON collections.id = authorized_collection.collection_id
       INNER JOIN collection_members
         ON collection_members.collection_id = collections.id
        AND collection_members.user_id = $2
       WHERE copies.id = $1
       FOR UPDATE OF copies, collections`,
      [copyId, userId],
    );
    const current = locked.rows[0];

    if (current === undefined) {
      return rollback(client, { kind: "copy_not_found" } as const);
    }
    if (current.role_code !== "OWNER" && current.role_code !== "MANAGER") {
      return rollback(client, { kind: "role_denied" } as const);
    }
    if (current.collection_status_code === "ARCHIVED") {
      return rollback(client, { kind: "collection_archived" } as const);
    }
    if (current.lifecycle_code !== "ACTIVE") {
      return rollback(client, { kind: "copy_not_active" } as const);
    }
    if (current.current_collection_id !== current.authorized_collection_id) {
      return rollback(client, { kind: "history_inconsistent" } as const);
    }

    const time = await client.query<{ exited_at: Date }>(
      "SELECT clock_timestamp() AS exited_at",
    );
    const exitedAt = time.rows[0]?.exited_at;
    if (exitedAt === undefined) {
      throw new Error("Exit timestamp was not returned");
    }

    const closed = await client.query<{ id: string }>(
      `UPDATE copy_collection_history
       SET ended_at = $3
       WHERE copy_id = $1 AND collection_id = $2 AND ended_at IS NULL
       RETURNING id`,
      [copyId, current.authorized_collection_id, exitedAt],
    );
    if (closed.rows.length !== 1) {
      return rollback(client, { kind: "history_inconsistent" } as const);
    }

    const updated = await client.query<CopyRow>(
      `UPDATE copies
       SET current_collection_id = NULL,
           lifecycle_code = 'EXITED',
           exit_reason_code = $2,
           exited_at = $3,
           updated_at = $3
       WHERE id = $1
       RETURNING id, game_id, game_edition_id, current_collection_id,
                 lifecycle_code, condition_code, alias, notes,
                 exit_reason_code, exited_at, created_by_user_id,
                 created_at, updated_at`,
      [copyId, input.reason, exitedAt],
    );
    const updatedRow = updated.rows[0];
    if (updatedRow === undefined) {
      throw new Error("Exited copy update did not return a row");
    }

    const before = mapCopy(current);
    const after = mapCopy(updatedRow);
    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, resource_type, resource_id,
         before_state, after_state, context
       ) VALUES ($1, 'copy.exited', 'COPY', $2, $3::jsonb, $4::jsonb, $5::jsonb)`,
      [
        userId,
        copyId,
        JSON.stringify(before),
        JSON.stringify(after),
        JSON.stringify({
          collectionId: current.authorized_collection_id,
          closedHistoryId: closed.rows[0]?.id,
          reason: input.reason,
          exitedAt: exitedAt.toISOString(),
        }),
      ],
    );

    await client.query("COMMIT");
    return { kind: "success", copy: after };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
