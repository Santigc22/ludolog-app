import type {
  MatchListQuery,
  MatchListResponse,
  MatchResponse,
  NormalizedCreateMatchRequest,
  NormalizedUpdateMatchRequest,
} from "@ludoteca/contracts";

import { ApplicationError } from "../../errors/application-error.js";
import {
  createMatch,
  findMatch,
  findMatches,
  updateMatch,
} from "./match.repository.js";

function creationError(
  result: Exclude<Awaited<ReturnType<typeof createMatch>>, { kind: "success" }>,
): never {
  const errors = {
    game_not_found: ["GAME_NOT_FOUND", "The game is not visible.", 404],
    edition_not_found: [
      "GAME_EDITION_NOT_FOUND",
      "The edition is not available for this game.",
      400,
    ],
    copy_not_found: [
      "COPY_NOT_FOUND",
      "The copy is not accessible for this match.",
      404,
    ],
    copy_edition_mismatch: [
      "COPY_EDITION_MISMATCH",
      "The selected edition does not belong to the copy.",
      400,
    ],
    participant_user_not_found: [
      "MATCH_PARTICIPANT_NOT_FOUND",
      "A registered participant does not exist.",
      400,
    ],
  } as const;
  if (result.kind === "participant_range") {
    throw new ApplicationError({
      code: "MATCH_PARTICIPANT_RANGE_INVALID",
      message: `The game requires between ${result.minimum} and ${result.maximum} participants.`,
      statusCode: 400,
      details: { minimum: result.minimum, maximum: result.maximum },
    });
  }
  const [code, message, statusCode] = errors[result.kind];
  throw new ApplicationError({ code, message, statusCode });
}

export async function createMatchForUser(
  userId: string,
  input: NormalizedCreateMatchRequest,
): Promise<MatchResponse> {
  const result = await createMatch(userId, input);
  if (result.kind !== "success") return creationError(result);
  return { match: result.match };
}

export function listMatchesForUser(
  userId: string,
  query: MatchListQuery,
): Promise<MatchListResponse> {
  return findMatches(userId, query);
}

export async function getMatchForUser(
  matchId: string,
  userId: string,
): Promise<MatchResponse> {
  const match = await findMatch(matchId, userId);
  if (match === null) {
    throw new ApplicationError({
      code: "MATCH_NOT_FOUND",
      message: "The match does not exist.",
      statusCode: 404,
    });
  }
  return { match };
}

export async function updateMatchForUser(
  matchId: string,
  userId: string,
  input: NormalizedUpdateMatchRequest,
): Promise<MatchResponse> {
  const result = await updateMatch(matchId, userId, input);
  if (result.kind === "success") return { match: result.match };
  if (result.kind === "match_not_found") {
    throw new ApplicationError({
      code: "MATCH_NOT_FOUND",
      message: "The match does not exist.",
      statusCode: 404,
    });
  }
  if (result.kind === "participant_range") {
    throw new ApplicationError({
      code: "MATCH_PARTICIPANT_RANGE_INVALID",
      message: `The game requires between ${result.minimum} and ${result.maximum} participants.`,
      statusCode: 400,
      details: { minimum: result.minimum, maximum: result.maximum },
    });
  }
  if (result.kind === "participant_user_not_found") {
    throw new ApplicationError({
      code: "MATCH_PARTICIPANT_NOT_FOUND",
      message: "A registered participant does not exist.",
      statusCode: 400,
    });
  }
  throw new ApplicationError({
    code: "MATCH_FINAL_OUTCOME_NOT_ALLOWED",
    message:
      "Planned, incomplete or cancelled matches cannot have final outcomes; planned matches cannot have scores.",
    statusCode: 400,
  });
}
