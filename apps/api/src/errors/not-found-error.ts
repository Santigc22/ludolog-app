import { ApplicationError } from "./application-error.js";

export class NotFoundError extends ApplicationError {
  constructor() {
    super({
      code: "ROUTE_NOT_FOUND",
      message: "The requested route does not exist.",
      statusCode: 404,
    });
    this.name = "NotFoundError";
  }
}
