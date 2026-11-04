import type {
  NormalizedUpdateOwnProfileRequest,
  OwnProfileResponse,
} from "@ludoteca/contracts";

import { ApplicationError } from "../../errors/application-error.js";
import { findOwnProfile, updateOwnProfile } from "./profile.repository.js";

function missingProfile(): ApplicationError {
  return new ApplicationError({
    code: "PROFILE_NOT_FOUND",
    message: "The profile does not exist.",
    statusCode: 404,
  });
}

export async function getProfileForUser(
  userId: string,
): Promise<OwnProfileResponse> {
  const profile = await findOwnProfile(userId);

  if (profile === null) {
    throw missingProfile();
  }

  return { profile };
}

export async function updateProfileForUser(
  userId: string,
  input: NormalizedUpdateOwnProfileRequest,
): Promise<OwnProfileResponse> {
  const profile = await updateOwnProfile(userId, input);

  if (profile === null) {
    throw missingProfile();
  }

  return { profile };
}
