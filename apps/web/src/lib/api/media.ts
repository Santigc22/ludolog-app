import {
  GameCoverUploadResponseSchema,
  OwnProfileResponseSchema,
} from "@ludoteca/contracts";

import { apiFetch, readBrowserCookie } from "./client";
import { getPublicApiBaseUrl } from "../config/public-env";

export const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;
const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function imageFileError(file: File) {
  if (!supportedImageTypes.has(file.type)) {
    return "Usa una imagen JPG, PNG o WebP.";
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return "La imagen debe pesar 8 MB o menos.";
  }
  return null;
}

function uploadOptions(file: File) {
  return {
    method: "POST",
    headers: {
      "content-type": file.type,
      "x-csrf-token": readBrowserCookie("XSRF-TOKEN") ?? "",
    },
    body: file,
  } as const;
}

export function mediaUrl(
  mediaId: string,
  variant: "primary" | "thumbnail" = "primary",
) {
  return `${getPublicApiBaseUrl()}/media/${encodeURIComponent(mediaId)}?variant=${variant}`;
}

export function uploadOwnAvatar(file: File) {
  return apiFetch(
    "profiles/me/avatar",
    OwnProfileResponseSchema,
    uploadOptions(file),
  );
}

export function uploadGameCover(gameId: string, file: File) {
  return apiFetch(
    `games/${encodeURIComponent(gameId)}/cover`,
    GameCoverUploadResponseSchema,
    uploadOptions(file),
  );
}
