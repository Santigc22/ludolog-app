import type {
  CollectionListQuery,
  CollectionListResponse,
  CollectionDetailResponse,
  CreateCollectionResponse,
  NormalizedCreateCollectionRequest,
  NormalizedUpdateCollectionRequest,
} from "@ludoteca/contracts";

import { ApplicationError } from "../../errors/application-error.js";
import { userHasPermission } from "../auth/authorization.repository.js";
import {
  archiveCollectionForOwner,
  createPersonalCollection,
  findCollectionDetail,
  findCollectionsForMember,
  updateCollectionForMember,
  type CollectionMutationResult,
} from "./collection.repository.js";

export async function createCollectionForUser(
  userId: string,
  input: NormalizedCreateCollectionRequest,
): Promise<CreateCollectionResponse> {
  return { collection: await createPersonalCollection(userId, input) };
}

export async function listCollectionsForUser(
  userId: string,
  query: CollectionListQuery,
): Promise<CollectionListResponse> {
  return findCollectionsForMember(userId, query);
}

export async function getCollectionForViewer(
  collectionId: string,
  userId: string | null,
): Promise<CollectionDetailResponse> {
  const collection = await findCollectionDetail(collectionId, userId);
  const isMember = collection?.effectiveRole !== null;
  const isPublicAndActive =
    collection?.visibility === "PUBLIC" && collection.status === "ACTIVE";

  if (collection === null || (!isMember && !isPublicAndActive)) {
    throw new ApplicationError({
      code: "COLLECTION_NOT_FOUND",
      message: "The collection does not exist.",
      statusCode: 404,
    });
  }

  const hasEditingRole =
    collection.effectiveRole === "OWNER" ||
    collection.effectiveRole === "MANAGER";
  const canEdit =
    userId !== null &&
    hasEditingRole &&
    collection.status === "ACTIVE" &&
    (await userHasPermission(userId, "collection.update"));

  return { collection: { ...collection, canEdit } };
}

function mutationError(result: CollectionMutationResult): never {
  if (result.kind === "not_found") {
    throw new ApplicationError({
      code: "COLLECTION_NOT_FOUND",
      message: "The collection does not exist.",
      statusCode: 404,
    });
  }
  if (result.kind === "role_denied") {
    throw new ApplicationError({
      code: "COLLECTION_ROLE_DENIED",
      message: "Your collection role cannot perform this action.",
      statusCode: 403,
    });
  }

  throw new ApplicationError({
    code: "COLLECTION_ARCHIVED",
    message: "An archived collection cannot be edited.",
    statusCode: 409,
  });
}

export async function updateCollectionForUser(
  collectionId: string,
  userId: string,
  input: NormalizedUpdateCollectionRequest,
): Promise<CollectionDetailResponse> {
  const result = await updateCollectionForMember(collectionId, userId, input);

  if (result.kind !== "success") {
    return mutationError(result);
  }

  return { collection: { ...result.collection, canEdit: true } };
}

export async function archiveCollectionForUser(
  collectionId: string,
  userId: string,
): Promise<CollectionDetailResponse> {
  const result = await archiveCollectionForOwner(collectionId, userId);

  if (result.kind !== "success") {
    return mutationError(result);
  }

  return { collection: { ...result.collection, canEdit: false } };
}
