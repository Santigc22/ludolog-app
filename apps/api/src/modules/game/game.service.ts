import type {
  CreatePrivateGameResponse,
  GameDetailResponse,
  GameListQuery,
  GameListResponse,
  NormalizedCreatePrivateGameRequest,
} from "@ludoteca/contracts";

import { ApplicationError } from "../../errors/application-error.js";
import {
  createPrivateGame,
  findVisibleGameDetail,
  findVisibleGames,
} from "./game.repository.js";

export async function createPrivateGameForUser(
  userId: string,
  input: NormalizedCreatePrivateGameRequest,
): Promise<CreatePrivateGameResponse> {
  return { game: await createPrivateGame(userId, input) };
}

export async function listGamesForViewer(
  viewerUserId: string | null,
  query: GameListQuery,
): Promise<GameListResponse> {
  return findVisibleGames(viewerUserId, query);
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
