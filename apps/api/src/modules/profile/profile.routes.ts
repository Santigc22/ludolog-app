import { Router } from "express";

import { requireWebOrigin } from "../../middleware/require-web-origin.js";
import { requireAuth, requireCsrf } from "../../middleware/authentication.js";
import { requirePermission } from "../../middleware/authorization.js";
import { getOwnProfile, patchOwnProfile } from "./profile.controller.js";

export const profileRouter = Router();

profileRouter.options(
  "/profiles/me",
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
profileRouter.get("/profiles/me", requireWebOrigin, requireAuth, getOwnProfile);
profileRouter.patch(
  "/profiles/me",
  requireWebOrigin,
  requireAuth,
  requirePermission("profile.update"),
  requireCsrf,
  patchOwnProfile,
);
