import {
  CopyDetailResponseSchema,
  CopyListResponseSchema,
  CreateCopyRequestSchema,
  CreateCopyResponseSchema,
  ExitCopyRequestSchema,
  MoveCopyRequestSchema,
  UpdateCopyRequestSchema,
  type CreateCopyRequest,
  type ExitCopyRequest,
  type MoveCopyRequest,
  type UpdateCopyRequest,
} from "@ludoteca/contracts";

import { apiFetch, readBrowserCookie } from "./client";

function writeHeaders() {
  return {
    "content-type": "application/json",
    "x-csrf-token": readBrowserCookie("XSRF-TOKEN") ?? "",
  };
}

export function listCopies(
  collectionId: string,
  options?: {
    page?: number;
    pageSize?: number;
    lifecycle?: "ACTIVE" | "EXITED" | "ALL";
    q?: string | undefined;
    mechanic?: string | undefined;
    minPlayers?: number | undefined;
    maxPlayers?: number | undefined;
  },
) {
  const query = new URLSearchParams({
    page: String(options?.page ?? 1),
    pageSize: String(options?.pageSize ?? 100),
    lifecycle: options?.lifecycle ?? "ALL",
  });
  if (options?.q?.trim()) query.set("q", options.q.trim());
  if (options?.mechanic?.trim()) query.set("mechanic", options.mechanic.trim());
  if (options?.minPlayers !== undefined)
    query.set("minPlayers", String(options.minPlayers));
  if (options?.maxPlayers !== undefined)
    query.set("maxPlayers", String(options.maxPlayers));
  return apiFetch(
    `collections/${encodeURIComponent(collectionId)}/copies?${query}`,
    CopyListResponseSchema,
    { cache: "no-store" },
  );
}

export function createCopy(collectionId: string, input: CreateCopyRequest) {
  const body = CreateCopyRequestSchema.parse(input);
  return apiFetch(
    `collections/${encodeURIComponent(collectionId)}/copies`,
    CreateCopyResponseSchema,
    {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify(body),
    },
  );
}

export function getCopy(copyId: string) {
  return apiFetch(
    `copies/${encodeURIComponent(copyId)}`,
    CopyDetailResponseSchema,
    { cache: "no-store" },
  );
}

export function updateCopy(copyId: string, input: UpdateCopyRequest) {
  const body = UpdateCopyRequestSchema.parse(input);
  return apiFetch(
    `copies/${encodeURIComponent(copyId)}`,
    CopyDetailResponseSchema,
    {
      method: "PATCH",
      headers: writeHeaders(),
      body: JSON.stringify(body),
    },
  );
}

export function moveCopy(copyId: string, input: MoveCopyRequest) {
  const body = MoveCopyRequestSchema.parse(input);
  return apiFetch(
    `copies/${encodeURIComponent(copyId)}/move`,
    CopyDetailResponseSchema,
    { method: "POST", headers: writeHeaders(), body: JSON.stringify(body) },
  );
}

export function exitCopy(copyId: string, input: ExitCopyRequest) {
  const body = ExitCopyRequestSchema.parse(input);
  return apiFetch(
    `copies/${encodeURIComponent(copyId)}/exit`,
    CopyDetailResponseSchema,
    { method: "POST", headers: writeHeaders(), body: JSON.stringify(body) },
  );
}
