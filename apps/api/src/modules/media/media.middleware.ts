import express, { type RequestHandler } from "express";

import { apiConfig } from "../../config/environment.js";
import { ApplicationError } from "../../errors/application-error.js";

const supportedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const rawImageBody = express.raw({
  type: supportedImageTypes,
  limit: apiConfig.mediaMaxUploadBytes,
});

export const parseImageBody: RequestHandler = (request, response, next) => {
  if (!request.is(supportedImageTypes)) {
    next(
      new ApplicationError({
        code: "IMAGE_TYPE_UNSUPPORTED",
        message: "Only JPEG, PNG and WebP images are supported.",
        statusCode: 415,
      }),
    );
    return;
  }

  rawImageBody(request, response, (error) => {
    if (
      error instanceof Error &&
      "type" in error &&
      (error as Error & { type?: string }).type === "entity.too.large"
    ) {
      next(
        new ApplicationError({
          code: "IMAGE_TOO_LARGE",
          message: "The image exceeds the configured upload limit.",
          statusCode: 413,
          details: { maximumBytes: apiConfig.mediaMaxUploadBytes },
        }),
      );
      return;
    }
    next(error);
  });
};
