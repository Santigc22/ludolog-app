import type { Pool, PoolClient } from "pg";

import { databasePool } from "../../client.js";
import { hashPassword } from "../../../../modules/auth/password.js";
import {
  developmentCollectionMembers,
  developmentCollections,
  developmentGameEditions,
  developmentGames,
  developmentUserPassword,
  developmentUsers,
} from "./data.js";

async function seedUsers(client: PoolClient): Promise<void> {
  const passwordHash = await hashPassword(developmentUserPassword);

  for (const user of developmentUsers) {
    await client.query(
      `INSERT INTO users (id, email, username, password_hash, status_code)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         username = EXCLUDED.username,
         password_hash = EXCLUDED.password_hash,
         status_code = 'ACTIVE',
         updated_at = CURRENT_TIMESTAMP`,
      [user.id, user.email, user.username, passwordHash],
    );
    await client.query(
      `INSERT INTO profiles (user_id, display_name, visibility_code)
       VALUES ($1, $2, 'PRIVATE')
       ON CONFLICT (user_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         updated_at = CURRENT_TIMESTAMP`,
      [user.id, user.displayName],
    );
    await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [user.id]);
    await client.query(
      `INSERT INTO user_roles (user_id, role_code) VALUES ($1, $2)`,
      [user.id, user.role],
    );
  }
}

async function seedCollections(client: PoolClient): Promise<void> {
  for (const collection of developmentCollections) {
    await client.query(
      `INSERT INTO collections (
         id, type_code, status_code, name, visibility_code,
         created_by_user_id, archived_at
       ) VALUES ($1, 'PERSONAL', 'ACTIVE', $2, 'PRIVATE', $3, NULL)
       ON CONFLICT (id) DO UPDATE SET
         status_code = 'ACTIVE',
         name = EXCLUDED.name,
         created_by_user_id = EXCLUDED.created_by_user_id,
         archived_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [collection.id, collection.name, collection.createdByUserId],
    );
  }

  for (const member of developmentCollectionMembers) {
    await client.query(
      `INSERT INTO collection_members (collection_id, user_id, role_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (collection_id, user_id) DO UPDATE SET
         role_code = EXCLUDED.role_code`,
      [member.collectionId, member.userId, member.role],
    );
  }
}

async function seedGames(client: PoolClient): Promise<void> {
  for (const game of developmentGames) {
    await client.query(
      `INSERT INTO games (
         id, name, publication_year, min_players, max_players,
         min_duration_minutes, max_duration_minutes, min_age, complexity,
         classification_code, visibility_code, moderation_status_code
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'OFFICIAL', 'PUBLIC', 'APPROVED')
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         publication_year = EXCLUDED.publication_year,
         min_players = EXCLUDED.min_players,
         max_players = EXCLUDED.max_players,
         min_duration_minutes = EXCLUDED.min_duration_minutes,
         max_duration_minutes = EXCLUDED.max_duration_minutes,
         min_age = EXCLUDED.min_age,
         complexity = EXCLUDED.complexity,
         classification_code = EXCLUDED.classification_code,
         visibility_code = EXCLUDED.visibility_code,
         moderation_status_code = EXCLUDED.moderation_status_code,
         updated_at = CURRENT_TIMESTAMP,
         archived_at = NULL`,
      [
        game.id,
        game.name,
        game.publicationYear,
        game.minPlayers,
        game.maxPlayers,
        game.minDurationMinutes,
        game.maxDurationMinutes,
        game.minAge,
        game.complexity,
      ],
    );

    for (const mechanicName of game.mechanics) {
      await client.query(
        `INSERT INTO mechanics (name)
         VALUES ($1)
         ON CONFLICT DO NOTHING`,
        [mechanicName],
      );
      await client.query(
        `INSERT INTO game_mechanics (game_id, mechanic_id)
         SELECT $1, mechanics.id
         FROM mechanics
         WHERE lower(mechanics.name) = lower($2)
         ON CONFLICT DO NOTHING`,
        [game.id, mechanicName],
      );
    }
  }
}

async function seedGameEditions(client: PoolClient): Promise<void> {
  for (const edition of developmentGameEditions) {
    await client.query(
      `INSERT INTO game_editions (id, game_id, edition_name, language_code)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         game_id = EXCLUDED.game_id,
         edition_name = EXCLUDED.edition_name,
         language_code = EXCLUDED.language_code`,
      [edition.id, edition.gameId, edition.editionName, edition.languageCode],
    );
  }
}

async function verifySeededRows(client: PoolClient): Promise<void> {
  const games = await client.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM games WHERE id = ANY($1::uuid[])",
    [developmentGames.map(({ id }) => id)],
  );
  const editions = await client.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM game_editions WHERE id = ANY($1::uuid[])",
    [developmentGameEditions.map(({ id }) => id)],
  );
  const users = await client.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM users WHERE id = ANY($1::uuid[])",
    [developmentUsers.map(({ id }) => id)],
  );
  const collections = await client.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM collections WHERE id = ANY($1::uuid[])",
    [developmentCollections.map(({ id }) => id)],
  );
  const members = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM collection_members
     WHERE collection_id = ANY($1::uuid[]) AND user_id = ANY($2::uuid[])`,
    [
      developmentCollections.map(({ id }) => id),
      developmentUsers.map(({ id }) => id),
    ],
  );

  if (games.rows[0]?.count !== String(developmentGames.length)) {
    throw new Error("Development game seed verification failed");
  }

  if (editions.rows[0]?.count !== String(developmentGameEditions.length)) {
    throw new Error("Development game edition seed verification failed");
  }
  if (users.rows[0]?.count !== String(developmentUsers.length)) {
    throw new Error("Development user seed verification failed");
  }
  if (collections.rows[0]?.count !== String(developmentCollections.length)) {
    throw new Error("Development collection seed verification failed");
  }
  if (members.rows[0]?.count !== String(developmentCollectionMembers.length)) {
    throw new Error("Development collection member seed verification failed");
  }
}

export async function seedDevelopmentCatalog(
  pool: Pool = databasePool,
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(473829105)");
    await seedUsers(client);
    await seedCollections(client);
    await seedGames(client);
    await seedGameEditions(client);
    await verifySeededRows(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
