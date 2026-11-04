import { Router } from "express";

import { requireAuth, requireCsrf } from "../../middleware/authentication.js";
import { requirePermission } from "../../middleware/authorization.js";
import { requireWebOrigin } from "../../middleware/require-web-origin.js";
import {
  createCopy,
  exitCopy,
  getCopy,
  listCopies,
  moveCopy,
  updateCopy,
} from "./copy.controller.js";

export const copyRouter = Router();

copyRouter.options(
  "/collections/:collectionId/copies",
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

copyRouter.get(
  "/collections/:collectionId/copies",
  requireWebOrigin,
  requireAuth,
  listCopies,
);

copyRouter.post(
  "/collections/:collectionId/copies",
  requireWebOrigin,
  requireAuth,
  requirePermission("copy.create"),
  requireCsrf,
  createCopy,
);

copyRouter.options(
  "/copies/:copyId",
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

copyRouter.get("/copies/:copyId", requireWebOrigin, requireAuth, getCopy);

copyRouter.patch(
  "/copies/:copyId",
  requireWebOrigin,
  requireAuth,
  requirePermission("copy.update"),
  requireCsrf,
  updateCopy,
);

copyRouter.options(
  "/copies/:copyId/move",
  requireWebOrigin,
  (_request, response) => {
    response.setHeader("Access-Control-Allow-Methods", "POST");
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-CSRF-Token",
    );
    response.sendStatus(204);
  },
);

copyRouter.post(
  "/copies/:copyId/move",
  requireWebOrigin,
  requireAuth,
  requirePermission("copy.move"),
  requireCsrf,
  moveCopy,
);

copyRouter.options(
  "/copies/:copyId/exit",
  requireWebOrigin,
  (_request, response) => {
    response.setHeader("Access-Control-Allow-Methods", "POST");
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-CSRF-Token",
    );
    response.sendStatus(204);
  },
);

copyRouter.post(
  "/copies/:copyId/exit",
  requireWebOrigin,
  requireAuth,
  requirePermission("copy.remove"),
  requireCsrf,
  exitCopy,
);
