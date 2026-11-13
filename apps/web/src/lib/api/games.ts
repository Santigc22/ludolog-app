import {
  BulkCreatePublicGamesRequestSchema,
  BulkCreatePublicGamesResponseSchema,
  CreatePrivateGameRequestSchema,
  CreatePrivateGameResponseSchema,
  CreatePublicGameRequestSchema,
  CreatePublicGameResponseSchema,
  GameDetailResponseSchema,
  GameListResponseSchema,
  GameTaxonomyOptionsResponseSchema,
  UpdatePublicGameRequestSchema,
  UpdatePublicGameResponseSchema,
  type CreatePrivateGameRequest,
  type BulkCreatePublicGamesRequest,
  type CreatePublicGameRequest,
  type GameListQuery,
  type UpdatePublicGameRequest,
} from "@ludoteca/contracts";

import { apiFetch, readBrowserCookie } from "./client";

export function listGames(options?: Partial<GameListQuery>) {
  const query = new URLSearchParams({
    page: String(options?.page ?? 1),
    pageSize: String(options?.pageSize ?? 12),
    sort: options?.sort ?? "name",
  });

  if (options?.q?.trim()) query.set("q", options.q.trim());
  if (options?.mechanic?.trim()) query.set("mechanic", options.mechanic.trim());
  if (options?.category?.trim()) query.set("category", options.category.trim());
  if (options?.minPlayers !== undefined)
    query.set("minPlayers", String(options.minPlayers));
  if (options?.maxPlayers !== undefined)
    query.set("maxPlayers", String(options.maxPlayers));

  return apiFetch(`games?${query}`, GameListResponseSchema, {
    cache: "no-store",
  });
}

export function getGame(gameId: string) {
  return apiFetch(
    `games/${encodeURIComponent(gameId)}`,
    GameDetailResponseSchema,
    { cache: "no-store" },
  );
}

export function listGameTaxonomyOptions() {
  return apiFetch("games/taxonomies", GameTaxonomyOptionsResponseSchema, {
    cache: "no-store",
  });
}

export function createPrivateGame(input: CreatePrivateGameRequest) {
  const body = CreatePrivateGameRequestSchema.parse(input);

  return apiFetch("games", CreatePrivateGameResponseSchema, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": readBrowserCookie("XSRF-TOKEN") ?? "",
    },
    body: JSON.stringify(body),
  });
}

export function createPublicGame(input: CreatePublicGameRequest) {
  const body = CreatePublicGameRequestSchema.parse(input);

  return apiFetch("games/public", CreatePublicGameResponseSchema, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": readBrowserCookie("XSRF-TOKEN") ?? "",
    },
    body: JSON.stringify(body),
  });
}

export function createPublicGamesBatch(input: BulkCreatePublicGamesRequest) {
  const body = BulkCreatePublicGamesRequestSchema.parse(input);

  return apiFetch("games/public/batch", BulkCreatePublicGamesResponseSchema, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": readBrowserCookie("XSRF-TOKEN") ?? "",
    },
    body: JSON.stringify(body),
  });
}

export function updatePublicGame(
  gameId: string,
  input: UpdatePublicGameRequest,
) {
  const body = UpdatePublicGameRequestSchema.parse(input);
  return apiFetch(
    `games/${encodeURIComponent(gameId)}`,
    UpdatePublicGameResponseSchema,
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
