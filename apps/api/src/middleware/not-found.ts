import type { RequestHandler } from "express";

import { NotFoundError } from "../errors/not-found-error.js";

export const notFound: RequestHandler = (_request, _response, next) => {
  next(new NotFoundError());
};
