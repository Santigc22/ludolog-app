import type {
  CreateCopyResponse,
  CopyDetailResponse,
  CopyListQuery,
  CopyListResponse,
  NormalizedCreateCopyRequest,
  NormalizedExitCopyRequest,
  NormalizedMoveCopyRequest,
  NormalizedUpdateCopyRequest,
  UpdateCopyResponse,
} from "@ludoteca/contracts";

import { ApplicationError } from "../../errors/application-error.js";
import {
  createCopyInCollection,
  exitCopyFromCollection,
  findCopiesForCollection,
  findCopyDetailForUser,
  moveCopyToCollection,
  updateCopyMetadata,
} from "./copy.repository.js";

export async function createCopyForUser(
  collectionId: string,
  userId: string,
  input: NormalizedCreateCopyRequest,
): Promise<CreateCopyResponse> {
  const result = await createCopyInCollection(collectionId, userId, input);

  if (result.kind === "success") {
    return {
      copy: result.copy,
      acquisition: result.acquisition,
      editionProposal: result.editionProposal,
    };
  }

  const errors = {
    collection_not_found: {
      code: "COLLECTION_NOT_FOUND",
      message: "The collection does not exist.",
      statusCode: 404,
    },
    role_denied: {
      code: "COLLECTION_ROLE_DENIED",
      message: "Your collection role cannot perform this action.",
      statusCode: 403,
    },
    collection_archived: {
      code: "COLLECTION_ARCHIVED",
      message: "An archived collection cannot receive copies.",
      statusCode: 409,
    },
    game_not_found: {
      code: "GAME_NOT_FOUND",
      message: "The game does not exist.",
      statusCode: 404,
    },
    edition_not_found: {
      code: "GAME_EDITION_NOT_FOUND",
      message: "The edition does not belong to the selected game.",
      statusCode: 400,
    },
    edition_proposal_not_allowed: {
      code: "GAME_EDITION_PROPOSAL_NOT_ALLOWED",
      message:
        "New public editions can only be proposed for approved public games.",
      statusCode: 409,
    },
  } as const;

  throw new ApplicationError(errors[result.kind]);
}

export async function listCopiesForUser(
  collectionId: string,
  userId: string,
  query: CopyListQuery,
): Promise<CopyListResponse> {
  const result = await findCopiesForCollection(collectionId, userId, query);

  if (result.kind === "collection_not_found") {
    throw new ApplicationError({
      code: "COLLECTION_NOT_FOUND",
      message: "The collection does not exist.",
      statusCode: 404,
    });
  }

  return result.response;
}

export async function getCopyForUser(
  copyId: string,
  userId: string,
): Promise<CopyDetailResponse> {
  const copy = await findCopyDetailForUser(copyId, userId);

  if (copy === null) {
    throw new ApplicationError({
      code: "COPY_NOT_FOUND",
      message: "The copy does not exist.",
      statusCode: 404,
    });
  }

  return { copy };
}

export async function updateCopyForUser(
  copyId: string,
  userId: string,
  input: NormalizedUpdateCopyRequest,
): Promise<UpdateCopyResponse> {
  const result = await updateCopyMetadata(copyId, userId, input);

  if (result.kind !== "success") {
    const errors = {
      copy_not_found: {
        code: "COPY_NOT_FOUND",
        message: "The copy does not exist.",
        statusCode: 404,
      },
      role_denied: {
        code: "COLLECTION_ROLE_DENIED",
        message: "Your collection role cannot perform this action.",
        statusCode: 403,
      },
      collection_archived: {
        code: "COLLECTION_ARCHIVED",
        message: "A copy in an archived collection cannot be edited.",
        statusCode: 409,
      },
      edition_not_found: {
        code: "GAME_EDITION_NOT_FOUND",
        message: "The edition does not belong to the copy's game.",
        statusCode: 400,
      },
      edition_proposal_not_allowed: {
        code: "GAME_EDITION_PROPOSAL_NOT_ALLOWED",
        message:
          "New public editions can only be proposed for approved public games.",
        statusCode: 409,
      },
    } as const;
    throw new ApplicationError(errors[result.kind]);
  }

  const copy = await findCopyDetailForUser(copyId, userId);
  if (copy === null) {
    throw new Error("Updated copy disappeared before response mapping");
  }
  return { copy, editionProposal: result.editionProposal };
}

export async function moveCopyForUser(
  copyId: string,
  userId: string,
  input: NormalizedMoveCopyRequest,
): Promise<CopyDetailResponse> {
  const result = await moveCopyToCollection(copyId, userId, input);

  if (result.kind !== "success") {
    const errors = {
      copy_not_found: {
        code: "COPY_NOT_FOUND",
        message: "The copy does not exist.",
        statusCode: 404,
      },
      copy_not_active: {
        code: "COPY_NOT_ACTIVE",
        message: "Only an active copy can be moved.",
        statusCode: 409,
      },
      source_role_denied: {
        code: "SOURCE_COLLECTION_ROLE_DENIED",
        message: "Your source collection role cannot move this copy.",
        statusCode: 403,
      },
      source_archived: {
        code: "SOURCE_COLLECTION_ARCHIVED",
        message: "A copy cannot be moved from an archived collection.",
        statusCode: 409,
      },
      destination_not_found: {
        code: "DESTINATION_COLLECTION_NOT_FOUND",
        message: "The destination collection does not exist.",
        statusCode: 404,
      },
      destination_role_denied: {
        code: "DESTINATION_COLLECTION_ROLE_DENIED",
        message: "Your destination collection role cannot receive this copy.",
        statusCode: 403,
      },
      destination_archived: {
        code: "DESTINATION_COLLECTION_ARCHIVED",
        message: "An archived collection cannot receive a copy.",
        statusCode: 409,
      },
      same_destination: {
        code: "COPY_ALREADY_IN_DESTINATION",
        message: "The copy is already in the destination collection.",
        statusCode: 409,
      },
      history_inconsistent: {
        code: "COPY_HISTORY_INCONSISTENT",
        message: "The copy history is inconsistent with its current location.",
        statusCode: 409,
      },
    } as const;
    throw new ApplicationError(errors[result.kind]);
  }

  const copy = await findCopyDetailForUser(copyId, userId);
  if (copy === null) {
    throw new Error("Moved copy disappeared before response mapping");
  }
  return { copy };
}

export async function exitCopyForUser(
  copyId: string,
  userId: string,
  input: NormalizedExitCopyRequest,
): Promise<CopyDetailResponse> {
  const result = await exitCopyFromCollection(copyId, userId, input);

  if (result.kind !== "success") {
    const errors = {
      copy_not_found: {
        code: "COPY_NOT_FOUND",
        message: "The copy does not exist.",
        statusCode: 404,
      },
      copy_not_active: {
        code: "COPY_NOT_ACTIVE",
        message: "Only an active copy can exit a collection.",
        statusCode: 409,
      },
      role_denied: {
        code: "COLLECTION_ROLE_DENIED",
        message: "Your collection role cannot exit this copy.",
        statusCode: 403,
      },
      collection_archived: {
        code: "COLLECTION_ARCHIVED",
        message: "A copy cannot exit an archived collection.",
        statusCode: 409,
      },
      history_inconsistent: {
        code: "COPY_HISTORY_INCONSISTENT",
        message: "The copy history is inconsistent with its current location.",
        statusCode: 409,
      },
    } as const;
    throw new ApplicationError(errors[result.kind]);
  }

  const copy = await findCopyDetailForUser(copyId, userId);
  if (copy === null) {
    throw new Error("Exited copy disappeared before response mapping");
  }
  return { copy };
}
