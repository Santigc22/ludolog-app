import express from "express";

import { errorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { requestId } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/request-logger.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { collectionRouter } from "./modules/collection/collection.routes.js";
import { copyRouter } from "./modules/copy/copy.routes.js";
import { gameRouter } from "./modules/game/game.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { mediaRouter } from "./modules/media/media.routes.js";
import { matchRouter } from "./modules/match/match.routes.js";
import { moderationRouter } from "./modules/moderation/moderation.routes.js";
import { profileRouter } from "./modules/profile/profile.routes.js";

export const app = express();

app.disable("x-powered-by");
app.use(requestId);
app.use(requestLogger);
app.use("/api/v1/games/public/batch", express.json({ limit: "2mb" }));
app.use(express.json());
app.use("/api/v1", authRouter);
app.use("/api/v1", collectionRouter);
app.use("/api/v1", copyRouter);
app.use("/api/v1", gameRouter);
app.use("/api/v1", mediaRouter);
app.use("/api/v1", matchRouter);
app.use("/api/v1", moderationRouter);
app.use("/api/v1", profileRouter);
app.use("/api/v1", healthRouter);
app.use(notFound);
app.use(errorHandler);
