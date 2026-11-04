import { Router } from "express";

import { requireWebOrigin } from "../../middleware/require-web-origin.js";
import { requireAuth, requireCsrf } from "../../middleware/authentication.js";
import { login, logout, me, register } from "./auth.controller.js";

export const authRouter = Router();

authRouter.options("/auth/{*path}", requireWebOrigin, (_request, response) => {
  response.setHeader("Access-Control-Allow-Methods", "GET, POST");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-CSRF-Token",
  );
  response.sendStatus(204);
});
authRouter.post("/auth/register", requireWebOrigin, register);
authRouter.post("/auth/login", requireWebOrigin, login);
authRouter.get("/auth/me", requireWebOrigin, requireAuth, me);
authRouter.post(
  "/auth/logout",
  requireWebOrigin,
  requireAuth,
  requireCsrf,
  logout,
);
