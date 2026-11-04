import {
  CollectionDetailResponseSchema,
  CollectionListResponseSchema,
  CreateCollectionRequestSchema,
  CreateCollectionResponseSchema,
  UpdateCollectionRequestSchema,
  type CreateCollectionRequest,
  type UpdateCollectionRequest,
} from "@ludoteca/contracts";

import { apiFetch, readBrowserCookie } from "./client";

function csrfHeaders() {
  return { "x-csrf-token": readBrowserCookie("XSRF-TOKEN") ?? "" };
}

export function listCollections(options?: {
  page?: number;
  pageSize?: number;
  includeArchived?: boolean;
}) {
  const query = new URLSearchParams({
    page: String(options?.page ?? 1),
    pageSize: String(options?.pageSize ?? 20),
    includeArchived: String(options?.includeArchived ?? false),
  });

  return apiFetch(`collections?${query}`, CollectionListResponseSchema, {
    cache: "no-store",
  });
}

export function createCollection(input: CreateCollectionRequest) {
  const body = CreateCollectionRequestSchema.parse(input);

  return apiFetch("collections", CreateCollectionResponseSchema, {
    method: "POST",
    headers: { "content-type": "application/json", ...csrfHeaders() },
    body: JSON.stringify(body),
  });
}

export function getCollection(collectionId: string) {
  return apiFetch(
    `collections/${encodeURIComponent(collectionId)}`,
    CollectionDetailResponseSchema,
    { cache: "no-store" },
  );
}

export function updateCollection(
  collectionId: string,
  input: UpdateCollectionRequest,
) {
  const body = UpdateCollectionRequestSchema.parse(input);

  return apiFetch(
    `collections/${encodeURIComponent(collectionId)}`,
    CollectionDetailResponseSchema,
    {
      method: "PATCH",
      headers: { "content-type": "application/json", ...csrfHeaders() },
      body: JSON.stringify(body),
    },
  );
}

export function archiveCollection(collectionId: string) {
  return apiFetch(
    `collections/${encodeURIComponent(collectionId)}/archive`,
    CollectionDetailResponseSchema,
    { method: "POST", headers: csrfHeaders() },
  );
}
