import type {
  BulkCreatePublicGamesResponse,
  CreatePrivateGameResponse,
  CreatePublicGameResponse,
  GameDetailResponse,
  GameListQuery,
  GameListResponse,
  GameTaxonomyOptionsResponse,
  NormalizedCreatePrivateGameRequest,
  NormalizedCreatePublicGameRequest,
  NormalizedBulkCreatePublicGamesRequest,
  NormalizedUpdatePublicGameRequest,
  UpdatePublicGameResponse,
} from "@ludoteca/contracts";

import { ApplicationError } from "../../errors/application-error.js";
import {
  createPrivateGame,
  createPublicGameDirectly,
  createPublicGamesBatch,
  findVisibleGameDetail,
  findVisibleGames,
  findVisibleGameTaxonomyOptions,
  updatePublicGame,
} from "./game.repository.js";

export async function createPrivateGameForUser(
  userId: string,
  input: NormalizedCreatePrivateGameRequest,
): Promise<CreatePrivateGameResponse> {
  return { game: await createPrivateGame(userId, input) };
}

export async function createPublicGameForAdmin(
  userId: string,
  input: NormalizedCreatePublicGameRequest,
): Promise<CreatePublicGameResponse> {
  return { game: await createPublicGameDirectly(userId, input) };
}

export async function createPublicGamesForAdmin(
  userId: string,
  input: NormalizedBulkCreatePublicGamesRequest,
): Promise<BulkCreatePublicGamesResponse> {
  const games = await createPublicGamesBatch(userId, input);
  return { games, createdCount: games.length };
}

export async function updatePublicGameForManager(
  gameId: string,
  editorUserId: string,
  input: NormalizedUpdatePublicGameRequest,
): Promise<UpdatePublicGameResponse> {
  const result = await updatePublicGame(gameId, editorUserId, input);
  if (result.kind === "not_found") {
    throw new ApplicationError({
      code: "PUBLIC_GAME_NOT_FOUND",
      message: "The approved public game does not exist.",
      statusCode: 404,
    });
  }
  if (result.kind === "invalid_range") {
    throw new ApplicationError({
      code: "GAME_RANGE_INVALID",
      message: "The game range is invalid.",
      statusCode: 400,
      details: {
        fields: {
          [result.field]: ["The maximum cannot be lower than the minimum."],
        },
      },
    });
  }
  return { game: result.game };
}

export async function listGamesForViewer(
  viewerUserId: string | null,
  query: GameListQuery,
): Promise<GameListResponse> {
  return findVisibleGames(viewerUserId, query);
}

export async function listGameTaxonomyOptionsForViewer(
  viewerUserId: string | null,
): Promise<GameTaxonomyOptionsResponse> {
  return findVisibleGameTaxonomyOptions(viewerUserId);
}

export async function getGameForViewer(
  gameId: string,
  viewerUserId: string | null,
): Promise<GameDetailResponse> {
  const game = await findVisibleGameDetail(gameId, viewerUserId);

  if (game === null) {
    throw new ApplicationError({
      code: "GAME_NOT_FOUND",
      message: "The game does not exist.",
      statusCode: 404,
    });
  }

  return { game };
}
