import { Router, type Request, type Response } from "express";

import { requireAuth, requireCsrf } from "../../middleware/authentication.js";
import { requirePermission } from "../../middleware/authorization.js";
import { requireWebOrigin } from "../../middleware/require-web-origin.js";
import {
  approveEdition,
  approveCase,
  listEditionCases,
  listCases,
  rejectEdition,
  rejectCase,
  submitGame,
} from "./moderation.controller.js";

export const moderationRouter = Router();

function allowModerationWrite(_request: Request, response: Response) {
  response.setHeader("Access-Control-Allow-Methods", "POST");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-CSRF-Token",
  );
  response.sendStatus(204);
}

moderationRouter.options(
  "/games/:gameId/moderation-submissions",
  requireWebOrigin,
  allowModerationWrite,
);
moderationRouter.options(
  "/moderation/cases/:caseId/approve",
  requireWebOrigin,
  allowModerationWrite,
);
moderationRouter.options(
  "/moderation/cases/:caseId/reject",
  requireWebOrigin,
  allowModerationWrite,
);
moderationRouter.options(
  "/moderation/edition-cases/:caseId/approve",
  requireWebOrigin,
  allowModerationWrite,
);
moderationRouter.options(
  "/moderation/edition-cases/:caseId/reject",
  requireWebOrigin,
  allowModerationWrite,
);

moderationRouter.post(
  "/games/:gameId/moderation-submissions",
  requireWebOrigin,
  requireAuth,
  requirePermission("game.propose_publication"),
  requireCsrf,
  submitGame,
);

moderationRouter.get(
  "/moderation/games",
  requireWebOrigin,
  requireAuth,
  requirePermission("moderation.view"),
  listCases,
);

moderationRouter.get(
  "/moderation/editions",
  requireWebOrigin,
  requireAuth,
  requirePermission("moderation.view"),
  listEditionCases,
);

moderationRouter.post(
  "/moderation/cases/:caseId/approve",
  requireWebOrigin,
  requireAuth,
  requirePermission("moderation.approve"),
  requireCsrf,
  approveCase,
);

moderationRouter.post(
  "/moderation/cases/:caseId/reject",
  requireWebOrigin,
  requireAuth,
  requirePermission("moderation.reject"),
  requireCsrf,
  rejectCase,
);

moderationRouter.post(
  "/moderation/edition-cases/:caseId/approve",
  requireWebOrigin,
  requireAuth,
  requirePermission("moderation.approve"),
  requireCsrf,
  approveEdition,
);

moderationRouter.post(
  "/moderation/edition-cases/:caseId/reject",
  requireWebOrigin,
  requireAuth,
  requirePermission("moderation.reject"),
  requireCsrf,
  rejectEdition,
);
