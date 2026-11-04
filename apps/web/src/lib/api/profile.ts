import {
  OwnProfileResponseSchema,
  UpdateOwnProfileRequestSchema,
  type UpdateOwnProfileRequest,
} from "@ludoteca/contracts";

import { apiFetch, readBrowserCookie } from "./client";

export function getOwnProfile() {
  return apiFetch("profiles/me", OwnProfileResponseSchema, {
    cache: "no-store",
  });
}

export function updateOwnProfile(input: UpdateOwnProfileRequest) {
  const body = UpdateOwnProfileRequestSchema.parse(input);

  return apiFetch("profiles/me", OwnProfileResponseSchema, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": readBrowserCookie("XSRF-TOKEN") ?? "",
    },
    body: JSON.stringify(body),
  });
}
