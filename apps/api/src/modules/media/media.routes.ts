import { Router, type Request, type Response } from "express";

import {
  optionalAuth,
  requireAuth,
  requireCsrf,
} from "../../middleware/authentication.js";
import { requirePermission } from "../../middleware/authorization.js";
import { requireWebOrigin } from "../../middleware/require-web-origin.js";
import { getMedia, uploadAvatar, uploadCover } from "./media.controller.js";
import { parseImageBody } from "./media.middleware.js";

export const mediaRouter = Router();

function uploadOptions(_request: Request, response: Response) {
  response.setHeader("Access-Control-Allow-Methods", "POST");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-CSRF-Token",
  );
  response.sendStatus(204);
}

mediaRouter.options("/profiles/me/avatar", requireWebOrigin, uploadOptions);
mediaRouter.options("/games/:gameId/cover", requireWebOrigin, uploadOptions);

mediaRouter.post(
  "/profiles/me/avatar",
  requireWebOrigin,
  requireAuth,
  requirePermission("profile.update"),
  requireCsrf,
  parseImageBody,
  uploadAvatar,
);

mediaRouter.post(
  "/games/:gameId/cover",
  requireWebOrigin,
  requireAuth,
  requireCsrf,
  parseImageBody,
  uploadCover,
);

mediaRouter.get("/media/:mediaId", optionalAuth, getMedia);
