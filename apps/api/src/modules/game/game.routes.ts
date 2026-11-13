import { Router } from "express";

import {
  optionalAuth,
  requireAuth,
  requireCsrf,
} from "../../middleware/authentication.js";
import { requirePermission } from "../../middleware/authorization.js";
import { requireWebOrigin } from "../../middleware/require-web-origin.js";
import {
  createGame,
  getGame,
  listGames,
  updateGame,
} from "./game.controller.js";

export const gameRouter = Router();

gameRouter.options("/games", requireWebOrigin, (_request, response) => {
  response.setHeader("Access-Control-Allow-Methods", "GET, POST");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-CSRF-Token",
  );
  response.sendStatus(204);
});

gameRouter.get("/games", requireWebOrigin, optionalAuth, listGames);

gameRouter.post(
  "/games",
  requireWebOrigin,
  requireAuth,
  requirePermission("game.create"),
  requireCsrf,
  createGame,
);

gameRouter.options("/games/:gameId", requireWebOrigin, (_request, response) => {
  response.setHeader("Access-Control-Allow-Methods", "GET, PATCH");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-CSRF-Token",
  );
  response.sendStatus(204);
});

gameRouter.get("/games/:gameId", requireWebOrigin, optionalAuth, getGame);

gameRouter.patch(
  "/games/:gameId",
  requireWebOrigin,
  requireAuth,
  requirePermission("catalog.game.manage"),
  requireCsrf,
  updateGame,
);
