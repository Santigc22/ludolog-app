import type {
  EditionModerationCaseResponse,
  EditionModerationListQuery,
  EditionModerationListResponse,
  GameModerationCaseResponse,
  GameModerationListQuery,
  GameModerationListResponse,
  NormalizedRejectModerationCaseRequest,
  NormalizedSubmitGameForModerationRequest,
} from "@ludoteca/contracts";

import { ApplicationError } from "../../errors/application-error.js";
import {
  approveEditionModerationCase,
  approveGameModerationCase,
  listEditionModerationCases,
  listGameModerationCases,
  rejectEditionModerationCase,
  rejectGameModerationCase,
  submitGameForModeration,
  type ResolveModerationResult,
  type ResolveEditionModerationResult,
} from "./moderation.repository.js";

function resolvedResponse(
  result: ResolveModerationResult,
): GameModerationCaseResponse {
  if (result.kind === "not_found") {
    throw new ApplicationError({
      code: "MODERATION_CASE_NOT_FOUND",
      message: "The moderation case does not exist.",
      statusCode: 404,
    });
  }
  if (result.kind === "already_resolved") {
    throw new ApplicationError({
      code: "MODERATION_CASE_ALREADY_RESOLVED",
      message: "The moderation case was already resolved.",
      statusCode: 409,
      details: { status: result.status },
    });
  }
  return { moderationCase: result.moderationCase };
}

function resolvedEditionResponse(
  result: ResolveEditionModerationResult,
): EditionModerationCaseResponse {
  if (result.kind === "not_found") {
    throw new ApplicationError({
      code: "MODERATION_CASE_NOT_FOUND",
      message: "The edition moderation case does not exist.",
      statusCode: 404,
    });
  }
  if (result.kind === "already_resolved") {
    throw new ApplicationError({
      code: "MODERATION_CASE_ALREADY_RESOLVED",
      message: "The edition moderation case was already resolved.",
      statusCode: 409,
      details: { status: result.status },
    });
  }
  return { moderationCase: result.moderationCase };
}

export async function submitGameForModerationByOwner(
  gameId: string,
  userId: string,
  input: NormalizedSubmitGameForModerationRequest,
): Promise<GameModerationCaseResponse> {
  const result = await submitGameForModeration(gameId, userId, input);
  if (result.kind === "not_found") {
    throw new ApplicationError({
      code: "GAME_NOT_FOUND",
      message: "The game does not exist.",
      statusCode: 404,
    });
  }
  if (result.kind === "invalid_state") {
    throw new ApplicationError({
      code: "GAME_NOT_SUBMITTABLE",
      message: "The game cannot be submitted in its current state.",
      statusCode: 409,
      details: { status: result.status },
    });
  }
  return { moderationCase: result.moderationCase };
}

export function listModerationQueue(
  reviewerUserId: string,
  query: GameModerationListQuery,
): Promise<GameModerationListResponse> {
  return listGameModerationCases(reviewerUserId, query);
}

export async function approveModerationCase(
  caseId: string,
  reviewerUserId: string,
): Promise<GameModerationCaseResponse> {
  return resolvedResponse(
    await approveGameModerationCase(caseId, reviewerUserId),
  );
}

export async function rejectModerationCase(
  caseId: string,
  reviewerUserId: string,
  input: NormalizedRejectModerationCaseRequest,
): Promise<GameModerationCaseResponse> {
  return resolvedResponse(
    await rejectGameModerationCase(caseId, reviewerUserId, input),
  );
}

export function listEditionModerationQueue(
  reviewerUserId: string,
  query: EditionModerationListQuery,
): Promise<EditionModerationListResponse> {
  return listEditionModerationCases(reviewerUserId, query);
}

export async function approveEditionCase(
  caseId: string,
  reviewerUserId: string,
): Promise<EditionModerationCaseResponse> {
  return resolvedEditionResponse(
    await approveEditionModerationCase(caseId, reviewerUserId),
  );
}

export async function rejectEditionCase(
  caseId: string,
  reviewerUserId: string,
  input: NormalizedRejectModerationCaseRequest,
): Promise<EditionModerationCaseResponse> {
  return resolvedEditionResponse(
    await rejectEditionModerationCase(caseId, reviewerUserId, input),
  );
}
