import type {
  NormalizedUpdateOwnProfileRequest,
  OwnProfile,
} from "@ludoteca/contracts";

import { databasePool } from "../../infrastructure/database/index.js";

type ProfileRow = Readonly<{
  user_id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  location_text: string | null;
  visibility_code: "PRIVATE" | "PUBLIC";
  created_at: Date;
  updated_at: Date;
}>;

function mapProfile(row: ProfileRow): OwnProfile {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    locationText: row.location_text,
    visibility: row.visibility_code,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const selectOwnProfile = `
  SELECT profiles.user_id, users.username, profiles.display_name, profiles.bio,
         profiles.avatar_url, profiles.location_text, profiles.visibility_code,
         profiles.created_at, profiles.updated_at
  FROM profiles
  INNER JOIN users ON users.id = profiles.user_id`;

export async function findOwnProfile(
  userId: string,
): Promise<OwnProfile | null> {
  const result = await databasePool.query<ProfileRow>(
    `${selectOwnProfile} WHERE profiles.user_id = $1`,
    [userId],
  );
  const row = result.rows[0];

  return row === undefined ? null : mapProfile(row);
}

export async function updateOwnProfile(
  userId: string,
  input: NormalizedUpdateOwnProfileRequest,
): Promise<OwnProfile | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];
  const fields = [
    ["displayName", "display_name"],
    ["bio", "bio"],
    ["avatarUrl", "avatar_url"],
    ["locationText", "location_text"],
    ["visibility", "visibility_code"],
  ] as const;

  for (const [property, column] of fields) {
    if (Object.hasOwn(input, property)) {
      values.push(input[property]);
      assignments.push(`${column} = $${values.length}`);
    }
  }

  values.push(userId);
  await databasePool.query(
    `UPDATE profiles
     SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $${values.length}`,
    values,
  );

  return findOwnProfile(userId);
}
