import { createHash } from "node:crypto";

import sharp from "sharp";

import { ApplicationError } from "../../errors/application-error.js";

export type ImagePurpose = "USER_AVATAR" | "GAME_COVER";

export type ProcessedImage = Readonly<{
  primary: Buffer;
  thumbnail: Buffer;
  mimeType: "image/webp";
  width: number;
  height: number;
  checksumSha256: string;
}>;

function invalidImage(message: string): ApplicationError {
  return new ApplicationError({
    code: "IMAGE_INVALID",
    message,
    statusCode: 400,
  });
}

export async function processImage(
  input: Buffer,
  purpose: ImagePurpose,
): Promise<ProcessedImage> {
  if (input.length === 0) throw invalidImage("The image body is empty.");

  try {
    const source = sharp(input, {
      failOn: "warning",
      limitInputPixels: 40_000_000,
      animated: false,
    });
    const metadata = await source.metadata();
    if (
      !metadata.format ||
      !["jpeg", "png", "webp"].includes(metadata.format)
    ) {
      throw invalidImage("Only JPEG, PNG and WebP images are supported.");
    }
    if ((metadata.pages ?? 1) > 1) {
      throw invalidImage("Animated images are not supported.");
    }

    const avatar = purpose === "USER_AVATAR";
    const primary = await source
      .clone()
      .rotate()
      .resize(
        avatar
          ? { width: 512, height: 512, fit: "cover", position: "centre" }
          : {
              width: 800,
              height: 1_000,
              fit: "inside",
              withoutEnlargement: true,
            },
      )
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    const thumbnail = await source
      .clone()
      .rotate()
      .resize(
        avatar
          ? { width: 128, height: 128, fit: "cover", position: "centre" }
          : {
              width: 320,
              height: 400,
              fit: "inside",
              withoutEnlargement: true,
            },
      )
      .webp({ quality: 78, effort: 4 })
      .toBuffer();
    const outputMetadata = await sharp(primary).metadata();
    if (
      outputMetadata.width === undefined ||
      outputMetadata.height === undefined
    ) {
      throw invalidImage("The processed image has invalid dimensions.");
    }

    return {
      primary,
      thumbnail,
      mimeType: "image/webp",
      width: outputMetadata.width,
      height: outputMetadata.height,
      checksumSha256: createHash("sha256").update(primary).digest("hex"),
    };
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    throw invalidImage("The uploaded file is not a valid image.");
  }
}
