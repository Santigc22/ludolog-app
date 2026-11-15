import {
  CreateMatchRequestSchema,
  MatchListResponseSchema,
  MatchResponseSchema,
  UpdateMatchRequestSchema,
  type CreateMatchRequest,
  type MatchListQuery,
  type UpdateMatchRequest,
} from "@ludoteca/contracts";

import { apiFetch, readBrowserCookie } from "./client";

export function listMatches(options?: Partial<MatchListQuery>) {
  const query = new URLSearchParams({
    page: String(options?.page ?? 1),
    pageSize: String(options?.pageSize ?? 20),
  });
  if (options?.gameId !== undefined) query.set("gameId", options.gameId);
  if (options?.status !== undefined) query.set("status", options.status);
  if (options?.startedFrom !== undefined)
    query.set("startedFrom", options.startedFrom);
  if (options?.startedBefore !== undefined)
    query.set("startedBefore", options.startedBefore);
  return apiFetch(`matches?${query}`, MatchListResponseSchema, {
    cache: "no-store",
  });
}

export function getMatch(matchId: string) {
  return apiFetch(
    `matches/${encodeURIComponent(matchId)}`,
    MatchResponseSchema,
    { cache: "no-store" },
  );
}

export function createMatch(input: CreateMatchRequest) {
  const body = CreateMatchRequestSchema.parse(input);
  return apiFetch("matches", MatchResponseSchema, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": readBrowserCookie("XSRF-TOKEN") ?? "",
    },
    body: JSON.stringify(body),
  });
}

export function updateMatch(matchId: string, input: UpdateMatchRequest) {
  const body = UpdateMatchRequestSchema.parse(input);
  return apiFetch(
    `matches/${encodeURIComponent(matchId)}`,
    MatchResponseSchema,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": readBrowserCookie("XSRF-TOKEN") ?? "",
      },
      body: JSON.stringify(body),
    },
  );
}
