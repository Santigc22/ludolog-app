import {
  EditionModerationCaseResponseSchema,
  EditionModerationListResponseSchema,
  GameModerationCaseResponseSchema,
  GameModerationListResponseSchema,
  RejectModerationCaseRequestSchema,
  SubmitGameForModerationRequestSchema,
  type EditionModerationListQuery,
  type GameModerationListQuery,
  type RejectModerationCaseRequest,
  type SubmitGameForModerationRequest,
} from "@ludoteca/contracts";

import { apiFetch, readBrowserCookie } from "./client";

function writeHeaders(json = false) {
  return {
    ...(json ? { "content-type": "application/json" } : {}),
    "x-csrf-token": readBrowserCookie("XSRF-TOKEN") ?? "",
  };
}

export function submitGameForModeration(
  gameId: string,
  input: SubmitGameForModerationRequest,
) {
  const body = SubmitGameForModerationRequestSchema.parse(input);
  return apiFetch(
    `games/${encodeURIComponent(gameId)}/moderation-submissions`,
    GameModerationCaseResponseSchema,
    {
      method: "POST",
      headers: writeHeaders(true),
      body: JSON.stringify(body),
    },
  );
}

export function listGameModerationCases(
  options?: Partial<GameModerationListQuery>,
) {
  const query = new URLSearchParams({
    page: String(options?.page ?? 1),
    pageSize: String(options?.pageSize ?? 20),
    status: options?.status ?? "PENDING_REVIEW",
  });
  if (options?.approvedByUserId) {
    query.set("approvedByUserId", options.approvedByUserId);
  }
  return apiFetch(
    `moderation/games?${query}`,
    GameModerationListResponseSchema,
    { cache: "no-store" },
  );
}

export function approveGameModerationCase(caseId: string) {
  return apiFetch(
    `moderation/cases/${encodeURIComponent(caseId)}/approve`,
    GameModerationCaseResponseSchema,
    { method: "POST", headers: writeHeaders() },
  );
}

export function rejectGameModerationCase(
  caseId: string,
  input: RejectModerationCaseRequest,
) {
  const body = RejectModerationCaseRequestSchema.parse(input);
  return apiFetch(
    `moderation/cases/${encodeURIComponent(caseId)}/reject`,
    GameModerationCaseResponseSchema,
    {
      method: "POST",
      headers: writeHeaders(true),
      body: JSON.stringify(body),
    },
  );
}

export function listEditionModerationCases(
  options?: Partial<EditionModerationListQuery>,
) {
  const query = new URLSearchParams({
    page: String(options?.page ?? 1),
    pageSize: String(options?.pageSize ?? 20),
    status: options?.status ?? "PENDING_REVIEW",
  });
  if (options?.approvedByUserId) {
    query.set("approvedByUserId", options.approvedByUserId);
  }
  return apiFetch(
    `moderation/editions?${query}`,
    EditionModerationListResponseSchema,
    { cache: "no-store" },
  );
}

export function approveEditionModerationCase(caseId: string) {
  return apiFetch(
    `moderation/edition-cases/${encodeURIComponent(caseId)}/approve`,
    EditionModerationCaseResponseSchema,
    { method: "POST", headers: writeHeaders() },
  );
}

export function rejectEditionModerationCase(
  caseId: string,
  input: RejectModerationCaseRequest,
) {
  const body = RejectModerationCaseRequestSchema.parse(input);
  return apiFetch(
    `moderation/edition-cases/${encodeURIComponent(caseId)}/reject`,
    EditionModerationCaseResponseSchema,
    {
      method: "POST",
      headers: writeHeaders(true),
      body: JSON.stringify(body),
    },
  );
}
