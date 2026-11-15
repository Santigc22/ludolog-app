import type {
  Match,
  MatchListQuery,
  MatchListResponse,
  MatchOutcome,
  NormalizedCreateMatchRequest,
  NormalizedMatchParticipantInput,
  NormalizedUpdateMatchRequest,
} from "@ludoteca/contracts";
import type { PoolClient } from "pg";

import { databasePool } from "../../infrastructure/database/index.js";

type MatchParticipantJson = Readonly<{
  id: string;
  userId: string | null;
  guestName: string | null;
  displayName: string;
  seatOrder: number;
  outcome: MatchOutcome;
  score: string | number | null;
}>;

type MatchRow = Readonly<{
  id: string;
  game_id: string;
  game_name: string;
  game_cover_media_id: string | null;
  game_min_players: number;
  game_max_players: number;
  game_edition_id: string | null;
  edition_name: string | null;
  copy_id: string | null;
  copy_alias: string | null;
  collection_id: string | null;
  collection_name: string | null;
  created_by_user_id: string;
  status_code: Match["status"];
  visibility_code: Match["visibility"];
  started_at: Date;
  duration_minutes: number | null;
  location_text: string | null;
  notes: string | null;
  participants: MatchParticipantJson[];
  created_at: Date;
  updated_at: Date;
}>;

type MatchValidationRow = Readonly<{
  id: string;
  game_id: string;
  min_players: number;
  max_players: number;
  status_code: Match["status"];
}>;

export type CreateMatchResult =
  | Readonly<{ kind: "game_not_found" }>
  | Readonly<{ kind: "edition_not_found" }>
  | Readonly<{ kind: "copy_not_found" }>
  | Readonly<{ kind: "copy_edition_mismatch" }>
  | Readonly<{ kind: "participant_range"; minimum: number; maximum: number }>
  | Readonly<{ kind: "participant_user_not_found" }>
  | Readonly<{ kind: "success"; match: Match }>;

export type UpdateMatchResult =
  | Readonly<{ kind: "match_not_found" }>
  | Readonly<{ kind: "participant_range"; minimum: number; maximum: number }>
  | Readonly<{ kind: "participant_user_not_found" }>
  | Readonly<{ kind: "final_outcome_not_allowed" }>
  | Readonly<{ kind: "success"; match: Match }>;

function mapMatch(row: MatchRow): Match {
  return {
    id: row.id,
    game: {
      id: row.game_id,
      name: row.game_name,
      coverMediaId: row.game_cover_media_id,
      minPlayers: row.game_min_players,
      maxPlayers: row.game_max_players,
    },
    edition:
      row.game_edition_id === null
        ? null
        : { id: row.game_edition_id, name: row.edition_name },
    copy:
      row.copy_id === null ? null : { id: row.copy_id, alias: row.copy_alias },
    collection:
      row.collection_id === null || row.collection_name === null
        ? null
        : { id: row.collection_id, name: row.collection_name },
    createdByUserId: row.created_by_user_id,
    status: row.status_code,
    visibility: row.visibility_code,
    startedAt: row.started_at.toISOString(),
    durationMinutes: row.duration_minutes,
    location: row.location_text,
    notes: row.notes,
    participants: row.participants.map((participant) => ({
      ...participant,
      score: participant.score === null ? null : Number(participant.score),
    })),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    canEdit: true,
  };
}

const matchSelect = `
  SELECT matches.id, matches.game_id, games.name AS game_name,
         games.cover_media_id AS game_cover_media_id,
         games.min_players AS game_min_players,
         games.max_players AS game_max_players,
         matches.game_edition_id,
         COALESCE(game_editions.edition_name, game_editions.edition_number)
           AS edition_name,
         matches.copy_id, copies.alias AS copy_alias,
         matches.collection_id, collections.name AS collection_name,
         matches.created_by_user_id, matches.status_code,
         matches.visibility_code, matches.started_at,
         matches.duration_minutes, matches.location_text, matches.notes,
         matches.created_at, matches.updated_at,
         COALESCE(
           json_agg(
             json_build_object(
               'id', match_participants.id,
               'userId', match_participants.user_id,
               'guestName', match_participants.guest_name,
               'displayName', match_participants.display_name_snapshot,
               'seatOrder', match_participants.seat_order,
               'outcome', match_participants.outcome_type_code,
               'score', match_participants.score_numeric
             ) ORDER BY match_participants.seat_order
           ) FILTER (WHERE match_participants.id IS NOT NULL),
           '[]'::json
         ) AS participants
  FROM matches
  INNER JOIN games ON games.id = matches.game_id
  LEFT JOIN game_editions ON game_editions.id = matches.game_edition_id
  LEFT JOIN copies ON copies.id = matches.copy_id
  LEFT JOIN collections ON collections.id = matches.collection_id
  LEFT JOIN match_participants ON match_participants.match_id = matches.id`;

const matchGroupBy = `
  GROUP BY matches.id, games.id, game_editions.id, copies.id, collections.id`;

async function findMatchWithClient(
  client: Pick<PoolClient, "query">,
  matchId: string,
  userId: string,
): Promise<Match | null> {
  const result = await client.query<MatchRow>(
    `${matchSelect}
     WHERE matches.id = $1 AND matches.created_by_user_id = $2
     ${matchGroupBy}`,
    [matchId, userId],
  );
  return result.rows[0] === undefined ? null : mapMatch(result.rows[0]);
}

async function insertParticipants(
  client: PoolClient,
  matchId: string,
  actorUserId: string,
  participants: NormalizedMatchParticipantInput[],
): Promise<boolean> {
  const userIds = participants.flatMap(({ userId }) =>
    userId == null ? [] : [userId],
  );
  const users =
    userIds.length === 0
      ? []
      : (
          await client.query<{
            id: string;
            display_name: string;
          }>(
            `SELECT users.id,
                    COALESCE(profiles.display_name, users.username)
                      AS display_name
             FROM users
             LEFT JOIN profiles ON profiles.user_id = users.id
             WHERE users.id = ANY($1::uuid[])
               AND users.id = $2
               AND users.status_code = 'ACTIVE'`,
            [userIds, actorUserId],
          )
        ).rows;
  const names = new Map(users.map((user) => [user.id, user.display_name]));
  if (names.size !== new Set(userIds).size) return false;

  for (const [index, participant] of participants.entries()) {
    const displayName =
      participant.userId == null
        ? participant.guestName!
        : names.get(participant.userId)!;
    await client.query(
      `INSERT INTO match_participants (
         match_id, user_id, guest_name, display_name_snapshot,
         seat_order, outcome_type_code, score_numeric
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        matchId,
        participant.userId ?? null,
        participant.guestName ?? null,
        displayName,
        index + 1,
        participant.outcome,
        participant.score ?? null,
      ],
    );
  }
  return true;
}

async function rollback<T>(client: PoolClient, result: T): Promise<T> {
  await client.query("ROLLBACK");
  return result;
}

export async function createMatch(
  userId: string,
  input: NormalizedCreateMatchRequest,
): Promise<CreateMatchResult> {
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const game = await client.query<{
      id: string;
      min_players: number;
      max_players: number;
    }>(
      `SELECT id, min_players, max_players
       FROM games
       WHERE id = $1 AND archived_at IS NULL
         AND (
           (
             visibility_code = 'PUBLIC'
             AND classification_code IN ('OFFICIAL', 'COMMUNITY')
             AND moderation_status_code = 'APPROVED'
           ) OR (
             visibility_code = 'PRIVATE'
             AND classification_code = 'PRIVATE'
             AND created_by_user_id = $2
           )
         )`,
      [input.gameId, userId],
    );
    const visibleGame = game.rows[0];
    if (visibleGame === undefined) {
      return rollback(client, { kind: "game_not_found" } as const);
    }
    if (
      input.participants.length < visibleGame.min_players ||
      input.participants.length > visibleGame.max_players
    ) {
      return rollback(client, {
        kind: "participant_range",
        minimum: visibleGame.min_players,
        maximum: visibleGame.max_players,
      } as const);
    }

    let collectionId: string | null = null;
    let editionId = input.gameEditionId ?? null;
    if (input.copyId != null) {
      const copy = await client.query<{
        game_edition_id: string | null;
        collection_id: string;
      }>(
        `SELECT copies.game_edition_id,
                authorized_collection.collection_id
         FROM copies
         INNER JOIN LATERAL (
           SELECT copy_collection_history.collection_id
           FROM copy_collection_history
           WHERE copy_collection_history.copy_id = copies.id
           ORDER BY (copy_collection_history.ended_at IS NULL) DESC,
                    copy_collection_history.started_at DESC,
                    copy_collection_history.id DESC
           LIMIT 1
         ) AS authorized_collection ON true
         INNER JOIN collection_members
           ON collection_members.collection_id = authorized_collection.collection_id
          AND collection_members.user_id = $3
         WHERE copies.id = $1 AND copies.game_id = $2`,
        [input.copyId, input.gameId, userId],
      );
      const accessibleCopy = copy.rows[0];
      if (accessibleCopy === undefined) {
        return rollback(client, { kind: "copy_not_found" } as const);
      }
      if (
        input.gameEditionId != null &&
        input.gameEditionId !== accessibleCopy.game_edition_id
      ) {
        return rollback(client, { kind: "copy_edition_mismatch" } as const);
      }
      editionId = accessibleCopy.game_edition_id;
      collectionId = accessibleCopy.collection_id;
    }

    if (editionId !== null) {
      const edition = await client.query<{ id: string }>(
        `SELECT id
         FROM game_editions
         WHERE id = $1 AND game_id = $2
           AND (
             moderation_status_code = 'APPROVED'
             OR created_by_user_id = $3
           )`,
        [editionId, input.gameId, userId],
      );
      if (edition.rows[0] === undefined) {
        return rollback(client, { kind: "edition_not_found" } as const);
      }
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO matches (
         game_id, game_edition_id, copy_id, collection_id,
         created_by_user_id, status_code, visibility_code, started_at,
         duration_minutes, location_text, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        input.gameId,
        editionId,
        input.copyId ?? null,
        collectionId,
        userId,
        input.status,
        input.visibility,
        new Date(input.startedAt),
        input.durationMinutes ?? null,
        input.location ?? null,
        input.notes ?? null,
      ],
    );
    const matchId = inserted.rows[0]!.id;
    if (
      !(await insertParticipants(client, matchId, userId, input.participants))
    ) {
      return rollback(client, { kind: "participant_user_not_found" } as const);
    }
    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, resource_type, resource_id,
         after_state, context
       ) VALUES ($1, 'match.created', 'MATCH', $2, $3::jsonb, $4::jsonb)`,
      [
        userId,
        matchId,
        JSON.stringify({
          gameId: input.gameId,
          status: input.status,
          visibility: input.visibility,
          startedAt: input.startedAt,
          participantCount: input.participants.length,
        }),
        JSON.stringify({
          copyId: input.copyId ?? null,
          collectionId,
          gameEditionId: editionId,
        }),
      ],
    );
    await client.query("COMMIT");
    const match = await findMatchWithClient(client, matchId, userId);
    if (match === null) throw new Error("Created match disappeared");
    return { kind: "success", match };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findMatches(
  userId: string,
  query: MatchListQuery,
): Promise<MatchListResponse> {
  const filters: string[] = ["matches.created_by_user_id = $1"];
  const values: unknown[] = [userId];
  if (query.gameId !== undefined) {
    filters.push(`matches.game_id = $${values.push(query.gameId)}`);
  }
  if (query.status !== undefined) {
    filters.push(`matches.status_code = $${values.push(query.status)}`);
  }
  const where = filters.join(" AND ");
  const offset = (query.page - 1) * query.pageSize;
  const itemValues = [...values, query.pageSize, offset];
  const [items, count] = await Promise.all([
    databasePool.query<MatchRow>(
      `${matchSelect}
       WHERE ${where}
       ${matchGroupBy}
       ORDER BY matches.started_at DESC, matches.id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      itemValues,
    ),
    databasePool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM matches WHERE ${where}`,
      values,
    ),
  ]);
  const totalItems = Number(count.rows[0]?.count ?? 0);
  return {
    matches: items.rows.map(mapMatch),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    },
  };
}

export async function findMatch(
  matchId: string,
  userId: string,
): Promise<Match | null> {
  return findMatchWithClient(databasePool, matchId, userId);
}

export async function updateMatch(
  matchId: string,
  userId: string,
  input: NormalizedUpdateMatchRequest,
): Promise<UpdateMatchResult> {
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<MatchValidationRow>(
      `SELECT matches.id, matches.game_id, games.min_players,
              games.max_players, matches.status_code
       FROM matches
       INNER JOIN games ON games.id = matches.game_id
       WHERE matches.id = $1 AND matches.created_by_user_id = $2
       FOR UPDATE OF matches`,
      [matchId, userId],
    );
    const current = locked.rows[0];
    if (current === undefined) {
      return rollback(client, { kind: "match_not_found" } as const);
    }
    const nextStatus = input.status ?? current.status_code;
    if (input.participants !== undefined) {
      if (
        input.participants.length < current.min_players ||
        input.participants.length > current.max_players
      ) {
        return rollback(client, {
          kind: "participant_range",
          minimum: current.min_players,
          maximum: current.max_players,
        } as const);
      }
      if (
        nextStatus !== "COMPLETED" &&
        input.participants.some(({ outcome }) => outcome !== "NO_RESULT")
      ) {
        return rollback(client, {
          kind: "final_outcome_not_allowed",
        } as const);
      }
    } else if (nextStatus !== "COMPLETED") {
      const finalOutcomes = await client.query<{ found: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM match_participants
           WHERE match_id = $1 AND outcome_type_code <> 'NO_RESULT'
         ) AS found`,
        [matchId],
      );
      if (finalOutcomes.rows[0]?.found) {
        return rollback(client, {
          kind: "final_outcome_not_allowed",
        } as const);
      }
    }

    const assignments: string[] = [];
    const values: unknown[] = [];
    const fields = [
      ["status", "status_code"],
      ["visibility", "visibility_code"],
      ["durationMinutes", "duration_minutes"],
      ["location", "location_text"],
      ["notes", "notes"],
    ] as const;
    for (const [property, column] of fields) {
      if (Object.hasOwn(input, property)) {
        values.push(input[property]);
        assignments.push(`${column} = $${values.length}`);
      }
    }
    if (input.startedAt !== undefined) {
      values.push(new Date(input.startedAt));
      assignments.push(`started_at = $${values.length}`);
    }
    if (assignments.length > 0) {
      values.push(matchId);
      await client.query(
        `UPDATE matches
         SET ${assignments.join(", ")}, updated_at = clock_timestamp()
         WHERE id = $${values.length}`,
        values,
      );
    }
    if (input.participants !== undefined) {
      await client.query("DELETE FROM match_participants WHERE match_id = $1", [
        matchId,
      ]);
      if (
        !(await insertParticipants(client, matchId, userId, input.participants))
      ) {
        return rollback(client, {
          kind: "participant_user_not_found",
        } as const);
      }
    }
    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, resource_type, resource_id, context
       ) VALUES ($1, 'match.updated', 'MATCH', $2, $3::jsonb)`,
      [userId, matchId, JSON.stringify({ changedFields: Object.keys(input) })],
    );
    await client.query("COMMIT");
    const match = await findMatchWithClient(client, matchId, userId);
    if (match === null) throw new Error("Updated match disappeared");
    return { kind: "success", match };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
