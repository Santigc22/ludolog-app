import { Router } from "express";

import {
  optionalAuth,
  requireAuth,
  requireCsrf,
} from "../../middleware/authentication.js";
import { requirePermission } from "../../middleware/authorization.js";
import { requireWebOrigin } from "../../middleware/require-web-origin.js";
import {
  archiveCollection,
  createCollection,
  getCollection,
  listCollections,
  updateCollection,
} from "./collection.controller.js";

export const collectionRouter = Router();

collectionRouter.options(
  "/collections",
  requireWebOrigin,
  (_request, response) => {
    response.setHeader("Access-Control-Allow-Methods", "GET, POST");
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-CSRF-Token",
    );
    response.sendStatus(204);
  },
);

collectionRouter.get(
  "/collections",
  requireWebOrigin,
  requireAuth,
  listCollections,
);

collectionRouter.options(
  "/collections/:collectionId",
  requireWebOrigin,
  (_request, response) => {
    response.setHeader("Access-Control-Allow-Methods", "GET, PATCH, POST");
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-CSRF-Token",
    );
    response.sendStatus(204);
  },
);

collectionRouter.get(
  "/collections/:collectionId",
  requireWebOrigin,
  optionalAuth,
  getCollection,
);

collectionRouter.patch(
  "/collections/:collectionId",
  requireWebOrigin,
  requireAuth,
  requirePermission("collection.update"),
  requireCsrf,
  updateCollection,
);

collectionRouter.options(
  "/collections/:collectionId/archive",
  requireWebOrigin,
  (_request, response) => {
    response.setHeader("Access-Control-Allow-Methods", "POST");
    response.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token");
    response.sendStatus(204);
  },
);

collectionRouter.post(
  "/collections/:collectionId/archive",
  requireWebOrigin,
  requireAuth,
  requirePermission("collection.archive"),
  requireCsrf,
  archiveCollection,
);

collectionRouter.post(
  "/collections",
  requireWebOrigin,
  requireAuth,
  requirePermission("collection.create"),
  requireCsrf,
  createCollection,
);
