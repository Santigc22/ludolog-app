import { Router } from "express";

import { requireAuth, requireCsrf } from "../../middleware/authentication.js";
import { requirePermission } from "../../middleware/authorization.js";
import { requireWebOrigin } from "../../middleware/require-web-origin.js";
import {
  createMatch,
  getMatch,
  listMatches,
  updateMatch,
} from "./match.controller.js";

export const matchRouter = Router();

matchRouter.options("/matches", requireWebOrigin, (_request, response) => {
  response.setHeader("Access-Control-Allow-Methods", "GET, POST");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-CSRF-Token",
  );
  response.sendStatus(204);
});
matchRouter.get("/matches", requireWebOrigin, requireAuth, listMatches);
matchRouter.post(
  "/matches",
  requireWebOrigin,
  requireAuth,
  requirePermission("match.create"),
  requireCsrf,
  createMatch,
);

matchRouter.options(
  "/matches/:matchId",
  requireWebOrigin,
  (_request, response) => {
    response.setHeader("Access-Control-Allow-Methods", "GET, PATCH");
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-CSRF-Token",
    );
    response.sendStatus(204);
  },
);
matchRouter.get("/matches/:matchId", requireWebOrigin, requireAuth, getMatch);
matchRouter.patch(
  "/matches/:matchId",
  requireWebOrigin,
  requireAuth,
  requirePermission("match.update"),
  requireCsrf,
  updateMatch,
);
