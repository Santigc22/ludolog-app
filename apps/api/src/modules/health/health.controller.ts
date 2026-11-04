import type {
  DatabaseHealthResponse,
  HealthResponse,
} from "@ludoteca/contracts";
import type { RequestHandler } from "express";

import { checkDatabaseHealth } from "../../infrastructure/database/index.js";

export const getHealth: RequestHandler<
  Record<string, never>,
  HealthResponse
> = (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "ludoteca-api",
  });
};

export const getDatabaseHealth: RequestHandler<
  Record<string, never>,
  DatabaseHealthResponse
> = async (_request, response) => {
  try {
    await checkDatabaseHealth();
    response.status(200).json({
      status: "ok",
      service: "database",
    });
  } catch {
    response.status(503).json({
      status: "unavailable",
      service: "database",
    });
  }
};
