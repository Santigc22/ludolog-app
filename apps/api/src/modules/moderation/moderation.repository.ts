import type {
  GameModerationCase,
  GameModerationListQuery,
  GameModerationListResponse,
  NormalizedRejectModerationCaseRequest,
  NormalizedSubmitGameForModerationRequest,
} from "@ludoteca/contracts";
import type { PoolClient } from "pg";

import { databasePool } from "../../infrastructure/database/index.js";

type ModerationStatus = GameModerationCase["status"];

type ModerationCaseRow = Readonly<{
  case_id: string;
  current_status_code: ModerationStatus;
  submission_note: string | null;
  resolution_note: string | null;
  submitted_by_user_id: string;
  assigned_to_user_id: string | null;
  case_created_at: Date;
  case_updated_at: Date;
  closed_at: Date | null;
  submitter_username: string;
  submitter_display_name: string | null;
  game_id: string;
  game_name: string;
  game_description: string | null;
  game_publication_year: number | null;
  game_min_players: number;
  game_max_players: number;
  game_mechanics: string[];
  game_min_duration_minutes: number | null;
  game_max_duration_minutes: number | null;
  game_min_age: number | null;
  game_max_age: number | null;
  game_complexity: string | null;
  game_classification_code: "OFFICIAL" | "COMMUNITY" | "PRIVATE";
  game_visibility_code: "PRIVATE" | "PUBLIC";
  game_moderation_status_code:
    | "DRAFT"
    | "PENDING_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "REJECTED_DUPLICATE"
    | "BLOCKED";
  is_owned_by_viewer: boolean;
  game_created_at: Date;
  game_updated_at: Date;
}>;

const moderationCaseColumns = `
  moderation_cases.id AS case_id,
  moderation_cases.current_status_code,
  moderation_cases.submission_note,
  moderation_cases.resolution_note,
  moderation_cases.submitted_by_user_id,
  moderation_cases.assigned_to_user_id,
  moderation_cases.created_at AS case_created_at,
  moderation_cases.updated_at AS case_updated_at,
  moderation_cases.closed_at,
  submitters.username AS submitter_username,
  submitter_profiles.display_name AS submitter_display_name,
  games.id AS game_id,
  games.name AS game_name,
  games.description AS game_description,
  games.publication_year AS game_publication_year,
  games.min_players AS game_min_players,
  games.max_players AS game_max_players,
  ARRAY(
    SELECT mechanics.name
    FROM game_mechanics
    INNER JOIN mechanics ON mechanics.id = game_mechanics.mechanic_id
    WHERE game_mechanics.game_id = games.id
    ORDER BY lower(mechanics.name), mechanics.id
  ) AS game_mechanics,
  games.min_duration_minutes AS game_min_duration_minutes,
  games.max_duration_minutes AS game_max_duration_minutes,
  games.min_age AS game_min_age,
  games.max_age AS game_max_age,
  games.complexity AS game_complexity,
  games.classification_code AS game_classification_code,
  games.visibility_code AS game_visibility_code,
  games.moderation_status_code AS game_moderation_status_code,
  COALESCE(games.created_by_user_id = $2, false) AS is_owned_by_viewer,
  games.created_at AS game_created_at,
  games.updated_at AS game_updated_at`;

function mapModerationCase(row: ModerationCaseRow): GameModerationCase {
  return {
    id: row.case_id,
    status: row.current_status_code,
    submissionNote: row.submission_note,
    resolutionNote: row.resolution_note,
    submittedBy: {
      id: row.submitted_by_user_id,
      username: row.submitter_username,
      displayName: row.submitter_display_name,
    },
    assignedToUserId: row.assigned_to_user_id,
    game: {
      id: row.game_id,
      name: row.game_name,
      description: row.game_description,
      publicationYear: row.game_publication_year,
      minPlayers: row.game_min_players,
      maxPlayers: row.game_max_players,
      mechanics: row.game_mechanics,
      minDurationMinutes: row.game_min_duration_minutes,
      maxDurationMinutes: row.game_max_duration_minutes,
      minAge: row.game_min_age,
      maxAge: row.game_max_age,
      complexity:
        row.game_complexity === null ? null : Number(row.game_complexity),
      classification: row.game_classification_code,
      visibility: row.game_visibility_code,
      moderationStatus: row.game_moderation_status_code,
      isOwnedByViewer: row.is_owned_by_viewer,
      createdAt: row.game_created_at.toISOString(),
      updatedAt: row.game_updated_at.toISOString(),
    },
    createdAt: row.case_created_at.toISOString(),
    updatedAt: row.case_updated_at.toISOString(),
    closedAt: row.closed_at?.toISOString() ?? null,
  };
}

async function findCaseWithClient(
  client: PoolClient,
  caseId: string,
  viewerUserId: string,
): Promise<GameModerationCase> {
  const result = await client.query<ModerationCaseRow>(
    `SELECT ${moderationCaseColumns}
     FROM moderation_cases
     INNER JOIN games ON games.id = moderation_cases.game_id
     INNER JOIN users AS submitters
       ON submitters.id = moderation_cases.submitted_by_user_id
     INNER JOIN profiles AS submitter_profiles
       ON submitter_profiles.user_id = submitters.id
     WHERE moderation_cases.id = $1`,
    [caseId, viewerUserId],
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error("Moderation case disappeared");
  return mapModerationCase(row);
}

export type SubmitGameForModerationResult =
  | Readonly<{ kind: "not_found" }>
  | Readonly<{ kind: "invalid_state"; status: string }>
  | Readonly<{ kind: "success"; moderationCase: GameModerationCase }>;

export async function submitGameForModeration(
  gameId: string,
  userId: string,
  input: NormalizedSubmitGameForModerationRequest,
): Promise<SubmitGameForModerationResult> {
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{
      id: string;
      classification_code: string;
      visibility_code: string;
      moderation_status_code: string;
    }>(
      `SELECT id, classification_code, visibility_code, moderation_status_code
       FROM games
       WHERE id = $1 AND created_by_user_id = $2 AND archived_at IS NULL
       FOR UPDATE`,
      [gameId, userId],
    );
    const game = locked.rows[0];
    if (game === undefined) {
      await client.query("ROLLBACK");
      return { kind: "not_found" };
    }
    if (
      game.classification_code !== "PRIVATE" ||
      game.visibility_code !== "PRIVATE" ||
      !["DRAFT", "REJECTED"].includes(game.moderation_status_code)
    ) {
      await client.query("ROLLBACK");
      return { kind: "invalid_state", status: game.moderation_status_code };
    }

    const time = await client.query<{ submitted_at: Date }>(
      "SELECT clock_timestamp() AS submitted_at",
    );
    const submittedAt = time.rows[0]!.submitted_at;
    await client.query(
      `UPDATE games
       SET moderation_status_code = 'PENDING_REVIEW', updated_at = $2
       WHERE id = $1`,
      [gameId, submittedAt],
    );
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO moderation_cases (
         game_id, current_status_code, submitted_by_user_id,
         submission_note, created_at, updated_at
       ) VALUES ($1, 'PENDING_REVIEW', $2, $3, $4, $4)
       RETURNING id`,
      [gameId, userId, input.note ?? null, submittedAt],
    );
    const caseId = inserted.rows[0]!.id;
    await client.query(
      `INSERT INTO moderation_actions (
         moderation_case_id, actor_user_id, from_status_code,
         to_status_code, reason, created_at
       ) VALUES ($1, $2, $3, 'PENDING_REVIEW', $4, $5)`,
      [
        caseId,
        userId,
        game.moderation_status_code,
        input.note ?? null,
        submittedAt,
      ],
    );
    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, resource_type, resource_id,
         before_state, after_state, context, occurred_at
       ) VALUES ($1, 'game.moderation_submitted', 'GAME', $2,
                 $3::jsonb, $4::jsonb, $5::jsonb, $6)`,
      [
        userId,
        gameId,
        JSON.stringify({ moderationStatus: game.moderation_status_code }),
        JSON.stringify({ moderationStatus: "PENDING_REVIEW" }),
        JSON.stringify({ moderationCaseId: caseId }),
        submittedAt,
      ],
    );
    const moderationCase = await findCaseWithClient(client, caseId, userId);
    await client.query("COMMIT");
    return { kind: "success", moderationCase };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listGameModerationCases(
  reviewerUserId: string,
  query: GameModerationListQuery,
): Promise<GameModerationListResponse> {
  const offset = (query.page - 1) * query.pageSize;
  const [items, count] = await Promise.all([
    databasePool.query<ModerationCaseRow>(
      `SELECT ${moderationCaseColumns}
       FROM moderation_cases
       INNER JOIN games ON games.id = moderation_cases.game_id
       INNER JOIN users AS submitters
         ON submitters.id = moderation_cases.submitted_by_user_id
       INNER JOIN profiles AS submitter_profiles
         ON submitter_profiles.user_id = submitters.id
       WHERE moderation_cases.current_status_code = $1
       ORDER BY moderation_cases.created_at ASC, moderation_cases.id ASC
       LIMIT $3 OFFSET $4`,
      [query.status, reviewerUserId, query.pageSize, offset],
    ),
    databasePool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM moderation_cases
       WHERE current_status_code = $1`,
      [query.status],
    ),
  ]);
  const totalItems = Number(count.rows[0]?.count ?? 0);
  return {
    moderationCases: items.rows.map(mapModerationCase),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    },
  };
}

export type ResolveModerationResult =
  | Readonly<{ kind: "not_found" }>
  | Readonly<{ kind: "already_resolved"; status: ModerationStatus }>
  | Readonly<{ kind: "success"; moderationCase: GameModerationCase }>;

async function resolveModerationCase(
  caseId: string,
  reviewerUserId: string,
  decision: "APPROVED" | "REJECTED",
  resolutionNote: string | null,
): Promise<ResolveModerationResult> {
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{
      case_id: string;
      game_id: string;
      current_status_code: ModerationStatus;
      game_name: string;
    }>(
      `SELECT moderation_cases.id AS case_id, moderation_cases.game_id,
              moderation_cases.current_status_code, games.name AS game_name
       FROM moderation_cases
       INNER JOIN games ON games.id = moderation_cases.game_id
       WHERE moderation_cases.id = $1
       FOR UPDATE OF moderation_cases, games`,
      [caseId],
    );
    const current = locked.rows[0];
    if (current === undefined) {
      await client.query("ROLLBACK");
      return { kind: "not_found" };
    }
    if (current.current_status_code !== "PENDING_REVIEW") {
      await client.query("ROLLBACK");
      return { kind: "already_resolved", status: current.current_status_code };
    }

    const time = await client.query<{ resolved_at: Date }>(
      "SELECT clock_timestamp() AS resolved_at",
    );
    const resolvedAt = time.rows[0]!.resolved_at;
    if (decision === "APPROVED") {
      await client.query(
        `UPDATE games
         SET classification_code = 'COMMUNITY', visibility_code = 'PUBLIC',
             moderation_status_code = 'APPROVED', updated_at = $2
         WHERE id = $1`,
        [current.game_id, resolvedAt],
      );
    } else {
      await client.query(
        `UPDATE games
         SET moderation_status_code = 'REJECTED', updated_at = $2
         WHERE id = $1`,
        [current.game_id, resolvedAt],
      );
    }
    await client.query(
      `UPDATE moderation_cases
       SET current_status_code = $2, assigned_to_user_id = $3,
           resolution_note = $4, updated_at = $5, closed_at = $5
       WHERE id = $1`,
      [caseId, decision, reviewerUserId, resolutionNote, resolvedAt],
    );
    await client.query(
      `INSERT INTO moderation_actions (
         moderation_case_id, actor_user_id, from_status_code,
         to_status_code, reason, created_at
       ) VALUES ($1, $2, 'PENDING_REVIEW', $3, $4, $5)`,
      [caseId, reviewerUserId, decision, resolutionNote, resolvedAt],
    );
    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, resource_type, resource_id,
         before_state, after_state, context, occurred_at
       ) VALUES ($1, $2, 'GAME', $3, $4::jsonb, $5::jsonb, $6::jsonb, $7)`,
      [
        reviewerUserId,
        decision === "APPROVED"
          ? "game.moderation_approved"
          : "game.moderation_rejected",
        current.game_id,
        JSON.stringify({
          classification: "PRIVATE",
          visibility: "PRIVATE",
          moderationStatus: "PENDING_REVIEW",
        }),
        JSON.stringify(
          decision === "APPROVED"
            ? {
                classification: "COMMUNITY",
                visibility: "PUBLIC",
                moderationStatus: "APPROVED",
              }
            : {
                classification: "PRIVATE",
                visibility: "PRIVATE",
                moderationStatus: "REJECTED",
              },
        ),
        JSON.stringify({ moderationCaseId: caseId, resolutionNote }),
        resolvedAt,
      ],
    );
    const moderationCase = await findCaseWithClient(
      client,
      caseId,
      reviewerUserId,
    );
    await client.query("COMMIT");
    return { kind: "success", moderationCase };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function approveGameModerationCase(
  caseId: string,
  reviewerUserId: string,
): Promise<ResolveModerationResult> {
  return resolveModerationCase(caseId, reviewerUserId, "APPROVED", null);
}

export function rejectGameModerationCase(
  caseId: string,
  reviewerUserId: string,
  input: NormalizedRejectModerationCaseRequest,
): Promise<ResolveModerationResult> {
  return resolveModerationCase(
    caseId,
    reviewerUserId,
    "REJECTED",
    input.reason,
  );
}
