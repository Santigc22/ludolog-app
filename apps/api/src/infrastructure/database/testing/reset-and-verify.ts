import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { config as loadEnvironment } from "dotenv";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import type { PoolClient } from "pg";

import { seedSystemData } from "../seeds/system/seed.js";
import {
  copyInventoryStructuralCodes,
  gameCatalogStructuralCodes,
} from "../seeds/system/data.js";

const testDatabaseName = "ludoteca_test";
const rootEnvironmentPath = fileURLToPath(
  new URL("../../../../../.env", import.meta.url),
);

loadEnvironment({ path: rootEnvironmentPath, quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (testDatabaseUrl === undefined) {
  throw new Error("TEST_DATABASE_URL is required to prepare the test database");
}

const testUrl = new URL(testDatabaseUrl);

if (decodeURIComponent(testUrl.pathname.slice(1)) !== testDatabaseName) {
  throw new Error("TEST_DATABASE_URL must target ludoteca_test");
}

const pool = new Pool({
  connectionString: testUrl.toString(),
  connectionTimeoutMillis: 5_000,
  application_name: "ludoteca-migration-test",
  options: "-c timezone=UTC",
});

async function expectConstraintViolation(
  client: PoolClient,
  savepoint: string,
  query: string,
  values: unknown[],
): Promise<void> {
  await client.query(`SAVEPOINT ${savepoint}`);

  try {
    await client.query(query, values);
  } catch {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    return;
  }

  throw new Error(`Expected constraint violation at ${savepoint}`);
}

async function verifyIdentitySchema(client: PoolClient): Promise<void> {
  await client.query("BEGIN");

  try {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO users (email, username, password_hash, status_code)
       VALUES ($1, $2, $3, 'ACTIVE')
       RETURNING id`,
      ["Alice@Example.com", "Alice", "test-password-hash"],
    );
    const userId = inserted.rows[0]?.id;

    if (userId === undefined) {
      throw new Error("Identity verification user was not created");
    }

    await client.query(
      `INSERT INTO profiles (user_id, display_name, visibility_code)
       VALUES ($1, $2, 'PRIVATE')`,
      [userId, "Alice"],
    );
    await client.query(
      `INSERT INTO user_roles (user_id, role_code)
       VALUES ($1, 'USER')`,
      [userId],
    );

    await expectConstraintViolation(
      client,
      "duplicate_email",
      `INSERT INTO users (email, username, password_hash, status_code)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      ["alice@example.com", "another-user", "test-password-hash"],
    );
    await expectConstraintViolation(
      client,
      "duplicate_username",
      `INSERT INTO users (email, username, password_hash, status_code)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      ["another@example.com", "ALICE", "test-password-hash"],
    );
    await expectConstraintViolation(
      client,
      "duplicate_profile",
      `INSERT INTO profiles (user_id, visibility_code)
       VALUES ($1, 'PUBLIC')`,
      [userId],
    );
    await expectConstraintViolation(
      client,
      "duplicate_user_role",
      `INSERT INTO user_roles (user_id, role_code)
       VALUES ($1, 'USER')`,
      [userId],
    );

    await client.query(
      `UPDATE users
       SET status_code = 'DEACTIVATED',
           deactivated_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId],
    );
    const preserved = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM users
       INNER JOIN profiles ON profiles.user_id = users.id
       INNER JOIN user_roles ON user_roles.user_id = users.id
       WHERE users.id = $1 AND users.status_code = 'DEACTIVATED'`,
      [userId],
    );

    if (preserved.rows[0]?.count !== "1") {
      throw new Error("Deactivation did not preserve the user and profile");
    }
  } finally {
    await client.query("ROLLBACK");
  }
}

async function verifyCollectionSchema(client: PoolClient): Promise<void> {
  await client.query("BEGIN");

  try {
    const owner = await client.query<{ id: string }>(
      `INSERT INTO users (email, username, password_hash, status_code)
       VALUES ($1, $2, $3, 'ACTIVE')
       RETURNING id`,
      ["owner@example.com", "collection-owner", "test-password-hash"],
    );
    const member = await client.query<{ id: string }>(
      `INSERT INTO users (email, username, password_hash, status_code)
       VALUES ($1, $2, $3, 'ACTIVE')
       RETURNING id`,
      ["member@example.com", "collection-member", "test-password-hash"],
    );
    const ownerId = owner.rows[0]?.id;
    const memberId = member.rows[0]?.id;

    if (ownerId === undefined || memberId === undefined) {
      throw new Error("Collection verification users were not created");
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO collections (
         type_code, status_code, name, visibility_code, created_by_user_id
       ) VALUES ('PERSONAL', 'ACTIVE', $1, 'PRIVATE', $2)
       RETURNING id`,
      ["Owner library", ownerId],
    );
    const collectionId = inserted.rows[0]?.id;

    if (collectionId === undefined) {
      throw new Error("Collection verification row was not created");
    }

    await client.query(
      `INSERT INTO collection_members (collection_id, user_id, role_code)
       VALUES ($1, $2, 'OWNER'), ($1, $3, 'VIEWER')`,
      [collectionId, ownerId, memberId],
    );

    await expectConstraintViolation(
      client,
      "duplicate_collection_membership",
      `INSERT INTO collection_members (collection_id, user_id, role_code)
       VALUES ($1, $2, 'MEMBER')`,
      [collectionId, memberId],
    );
    await expectConstraintViolation(
      client,
      "collection_sale_disabled",
      `UPDATE collections SET is_for_sale = true WHERE id = $1`,
      [collectionId],
    );
    await expectConstraintViolation(
      client,
      "collection_archive_consistency",
      `UPDATE collections SET status_code = 'ARCHIVED' WHERE id = $1`,
      [collectionId],
    );

    await client.query(
      `UPDATE collections
       SET status_code = 'ARCHIVED', archived_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [collectionId],
    );

    const preserved = await client.query<{ member_count: string }>(
      `SELECT COUNT(collection_members.user_id)::text AS member_count
       FROM collections
       INNER JOIN collection_members
         ON collection_members.collection_id = collections.id
       WHERE collections.id = $1
         AND collections.status_code = 'ARCHIVED'
         AND collections.archived_at IS NOT NULL`,
      [collectionId],
    );

    if (preserved.rows[0]?.member_count !== "2") {
      throw new Error("Archiving did not preserve collection memberships");
    }
  } finally {
    await client.query("ROLLBACK");
  }
}

async function verifyGameCatalogSystemData(client: PoolClient): Promise<void> {
  const expectedByTable = {
    game_classifications: gameCatalogStructuralCodes.classifications,
    moderation_statuses: gameCatalogStructuralCodes.moderationStatuses,
  } as const;

  for (const [table, expectedCodes] of Object.entries(expectedByTable)) {
    const result = await client.query<{ code: string }>(
      `SELECT code FROM ${table} WHERE code = ANY($1::text[]) ORDER BY code`,
      [[...expectedCodes]],
    );
    const actualCodes = result.rows.map(({ code }) => code).sort();
    const sortedExpectedCodes = [...expectedCodes].sort();

    if (JSON.stringify(actualCodes) !== JSON.stringify(sortedExpectedCodes)) {
      throw new Error(`Missing structural game catalog codes in ${table}`);
    }
  }

  const visibilityResult = await client.query<{ code: string }>(
    `SELECT code FROM visibility_levels WHERE code = ANY($1::text[]) ORDER BY code`,
    [[...gameCatalogStructuralCodes.visibilityLevels]],
  );
  const actualVisibilities = visibilityResult.rows.map(({ code }) => code);

  if (actualVisibilities.join(",") !== "PRIVATE,PUBLIC") {
    throw new Error("Missing supported Game visibility levels");
  }
}

async function verifyGameSchema(client: PoolClient): Promise<void> {
  await client.query("BEGIN");

  try {
    const owner = await client.query<{ id: string }>(
      `INSERT INTO users (email, username, password_hash, status_code)
       VALUES ($1, $2, $3, 'ACTIVE')
       RETURNING id`,
      ["game-owner@example.com", "game-owner", "test-password-hash"],
    );
    const ownerId = owner.rows[0]?.id;

    if (ownerId === undefined) {
      throw new Error("Game verification owner was not created");
    }

    const privateGame = await client.query<{ id: string }>(
      `INSERT INTO games (
         name, min_players, max_players, classification_code,
         visibility_code, moderation_status_code, created_by_user_id
       ) VALUES ($1, 1, 4, 'PRIVATE', 'PRIVATE', 'DRAFT', $2)
       RETURNING id`,
      ["Private prototype", ownerId],
    );
    const privateGameId = privateGame.rows[0]?.id;

    if (privateGameId === undefined) {
      throw new Error("Private game verification row was not created");
    }

    const edition = await client.query<{ id: string }>(
      `INSERT INTO game_editions (game_id, edition_name, language_code)
       VALUES ($1, 'First edition', 'es-CO')
       RETURNING id`,
      [privateGameId],
    );

    if (edition.rows[0]?.id === undefined) {
      throw new Error("Game edition verification row was not created");
    }

    await client.query(
      `INSERT INTO games (
         name, min_players, max_players, classification_code,
         visibility_code, moderation_status_code
       ) VALUES ($1, 2, 5, 'OFFICIAL', 'PUBLIC', 'APPROVED')`,
      ["Public catalog game"],
    );

    await expectConstraintViolation(
      client,
      "game_group_scope_rejected",
      `INSERT INTO games (
         name, min_players, max_players, classification_code,
         visibility_code, moderation_status_code, created_by_user_id
       ) VALUES ($1, 1, 2, 'PRIVATE', 'GROUP', 'DRAFT', $2)`,
      ["Ambiguous group game", ownerId],
    );
    await expectConstraintViolation(
      client,
      "private_game_requires_owner",
      `INSERT INTO games (
         name, min_players, max_players, classification_code,
         visibility_code, moderation_status_code
       ) VALUES ($1, 1, 2, 'PRIVATE', 'PRIVATE', 'DRAFT')`,
      ["Ownerless game"],
    );
    await expectConstraintViolation(
      client,
      "public_game_requires_approval",
      `INSERT INTO games (
         name, min_players, max_players, classification_code,
         visibility_code, moderation_status_code, created_by_user_id
       ) VALUES ($1, 1, 2, 'COMMUNITY', 'PUBLIC', 'DRAFT', $2)`,
      ["Unapproved public game", ownerId],
    );
    await expectConstraintViolation(
      client,
      "game_player_range",
      `INSERT INTO games (
         name, min_players, max_players, classification_code,
         visibility_code, moderation_status_code, created_by_user_id
       ) VALUES ($1, 4, 2, 'PRIVATE', 'PRIVATE', 'DRAFT', $2)`,
      ["Invalid player range", ownerId],
    );
    await expectConstraintViolation(
      client,
      "orphan_game_edition",
      `INSERT INTO game_editions (game_id, edition_name)
       VALUES ('00000000-0000-0000-0000-000000000000', 'Orphan')`,
      [],
    );
    await expectConstraintViolation(
      client,
      "game_with_edition_delete_restricted",
      "DELETE FROM games WHERE id = $1",
      [privateGameId],
    );
  } finally {
    await client.query("ROLLBACK");
  }
}

async function verifyCopyInventorySystemData(
  client: PoolClient,
): Promise<void> {
  const expectedByTable = {
    copy_lifecycle_statuses: copyInventoryStructuralCodes.lifecycleStatuses,
    copy_condition_statuses: copyInventoryStructuralCodes.conditionStatuses,
    copy_exit_reasons: copyInventoryStructuralCodes.exitReasons,
    acquisition_types: copyInventoryStructuralCodes.acquisitionTypes,
  } as const;

  for (const [table, expectedCodes] of Object.entries(expectedByTable)) {
    const result = await client.query<{ code: string }>(
      `SELECT code FROM ${table} WHERE code = ANY($1::text[]) ORDER BY code`,
      [[...expectedCodes]],
    );
    const actualCodes = result.rows.map(({ code }) => code).sort();
    const sortedExpectedCodes = [...expectedCodes].sort();

    if (JSON.stringify(actualCodes) !== JSON.stringify(sortedExpectedCodes)) {
      throw new Error(`Missing structural copy inventory codes in ${table}`);
    }
  }
}

async function verifyCopyInventorySchema(client: PoolClient): Promise<void> {
  await client.query("BEGIN");

  try {
    const owner = await client.query<{ id: string }>(
      `INSERT INTO users (email, username, password_hash, status_code)
       VALUES ('copy-owner@example.com', 'copy-owner', 'test-password-hash', 'ACTIVE')
       RETURNING id`,
    );
    const ownerId = owner.rows[0]?.id;

    if (ownerId === undefined) {
      throw new Error("Copy verification owner was not created");
    }

    const collection = await client.query<{ id: string }>(
      `INSERT INTO collections (
         type_code, status_code, name, visibility_code, created_by_user_id
       ) VALUES ('PERSONAL', 'ACTIVE', 'Copy verification shelf', 'PRIVATE', $1)
       RETURNING id`,
      [ownerId],
    );
    const collectionId = collection.rows[0]?.id;

    const firstGame = await client.query<{ id: string }>(
      `INSERT INTO games (
         name, min_players, max_players, classification_code,
         visibility_code, moderation_status_code
       ) VALUES ('Copy verification game', 1, 4, 'OFFICIAL', 'PUBLIC', 'APPROVED')
       RETURNING id`,
    );
    const secondGame = await client.query<{ id: string }>(
      `INSERT INTO games (
         name, min_players, max_players, classification_code,
         visibility_code, moderation_status_code
       ) VALUES ('Other copy verification game', 2, 5, 'OFFICIAL', 'PUBLIC', 'APPROVED')
       RETURNING id`,
    );
    const gameId = firstGame.rows[0]?.id;
    const otherGameId = secondGame.rows[0]?.id;

    if (
      collectionId === undefined ||
      gameId === undefined ||
      otherGameId === undefined
    ) {
      throw new Error("Copy verification fixtures were not created");
    }

    const edition = await client.query<{ id: string }>(
      `INSERT INTO game_editions (game_id, edition_name)
       VALUES ($1, 'Copy verification edition')
       RETURNING id`,
      [gameId],
    );
    const editionId = edition.rows[0]?.id;

    if (editionId === undefined) {
      throw new Error("Copy verification edition was not created");
    }

    await expectConstraintViolation(
      client,
      "active_copy_requires_collection",
      `INSERT INTO copies (
         game_id, lifecycle_code, condition_code, created_by_user_id
       ) VALUES ($1, 'ACTIVE', 'GOOD', $2)`,
      [gameId, ownerId],
    );
    await expectConstraintViolation(
      client,
      "exited_copy_forbids_collection",
      `INSERT INTO copies (
         game_id, current_collection_id, lifecycle_code, condition_code,
         exit_reason_code, exited_at, created_by_user_id
       ) VALUES ($1, $2, 'EXITED', 'GOOD', 'SOLD', CURRENT_TIMESTAMP, $3)`,
      [gameId, collectionId, ownerId],
    );
    await expectConstraintViolation(
      client,
      "copy_edition_must_belong_to_game",
      `INSERT INTO copies (
         game_id, game_edition_id, current_collection_id, lifecycle_code,
         condition_code, created_by_user_id
       ) VALUES ($1, $2, $3, 'ACTIVE', 'GOOD', $4)`,
      [otherGameId, editionId, collectionId, ownerId],
    );

    const copy = await client.query<{ id: string }>(
      `INSERT INTO copies (
         game_id, game_edition_id, current_collection_id, lifecycle_code,
         condition_code, created_by_user_id
       ) VALUES ($1, $2, $3, 'ACTIVE', 'DAMAGED', $4)
       RETURNING id`,
      [gameId, editionId, collectionId, ownerId],
    );
    const copyId = copy.rows[0]?.id;

    if (copyId === undefined) {
      throw new Error("Copy verification row was not created");
    }

    await client.query(
      `INSERT INTO copy_collection_history (
         copy_id, collection_id, changed_by_user_id
       ) VALUES ($1, $2, $3)`,
      [copyId, collectionId, ownerId],
    );
    await expectConstraintViolation(
      client,
      "one_open_copy_history_period",
      `INSERT INTO copy_collection_history (
         copy_id, collection_id, changed_by_user_id
       ) VALUES ($1, $2, $3)`,
      [copyId, collectionId, ownerId],
    );
    await expectConstraintViolation(
      client,
      "copy_history_period_order",
      `INSERT INTO copy_collection_history (
         copy_id, collection_id, started_at, ended_at, changed_by_user_id
       ) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP - INTERVAL '1 day', $3)`,
      [copyId, collectionId, ownerId],
    );

    await client.query(
      `INSERT INTO acquisitions (
         copy_id, collection_id, acquired_by_user_id, type_code
       ) VALUES ($1, $2, $3, 'GIFT'), ($1, $2, $3, 'PURCHASE')`,
      [copyId, collectionId, ownerId],
    );
    await expectConstraintViolation(
      client,
      "acquisition_price_requires_currency",
      `INSERT INTO acquisitions (
         copy_id, collection_id, acquired_by_user_id, type_code, price_amount
       ) VALUES ($1, $2, $3, 'PURCHASE', 20)`,
      [copyId, collectionId, ownerId],
    );

    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, resource_type, resource_id, after_state, context
       ) VALUES ($1, 'copy.created', 'copy', $2, $3::jsonb, $4::jsonb)`,
      [
        ownerId,
        copyId,
        JSON.stringify({ lifecycle: "ACTIVE", condition: "DAMAGED" }),
        JSON.stringify({ source: "schema-verification" }),
      ],
    );

    const preserved = await client.query<{
      acquisition_count: string;
      audit_count: string;
      open_period_count: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM acquisitions WHERE copy_id = $1)::text AS acquisition_count,
         (SELECT COUNT(*) FROM audit_logs WHERE resource_id = $1)::text AS audit_count,
         (SELECT COUNT(*) FROM copy_collection_history WHERE copy_id = $1 AND ended_at IS NULL)::text AS open_period_count`,
      [copyId],
    );

    if (
      preserved.rows[0]?.acquisition_count !== "2" ||
      preserved.rows[0]?.audit_count !== "1" ||
      preserved.rows[0]?.open_period_count !== "1"
    ) {
      throw new Error(
        "Copy history, acquisitions or audit rows were not preserved",
      );
    }
  } finally {
    await client.query("ROLLBACK");
  }
}

try {
  const identity = await pool.query<{ current_database: string }>(
    "SELECT current_database()",
  );
  const actualDatabase = identity.rows[0]?.current_database;

  if (actualDatabase !== testDatabaseName) {
    throw new Error(
      `Refusing to reset unexpected database: ${actualDatabase ?? "unknown"}`,
    );
  }

  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");

  const testDatabase = drizzle({ client: pool });
  await migrate(testDatabase, { migrationsFolder: "./drizzle" });

  await seedSystemData(pool);
  const firstCount = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM role_permissions",
  );

  await seedSystemData(pool);
  const secondCount = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM role_permissions",
  );

  if (firstCount.rows[0]?.count !== secondCount.rows[0]?.count) {
    throw new Error("System seeds are not idempotent");
  }

  const verificationClient = await pool.connect();

  try {
    await verifyIdentitySchema(verificationClient);
    await verifyCollectionSchema(verificationClient);
    await verifyGameCatalogSystemData(verificationClient);
    await verifyGameSchema(verificationClient);
    await verifyCopyInventorySystemData(verificationClient);
    await verifyCopyInventorySchema(verificationClient);
  } finally {
    verificationClient.release();
  }

  const tableCount = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );

  console.log(
    `Test database verified: ${tableCount.rows[0]?.count ?? "0"} tables, ${secondCount.rows[0]?.count ?? "0"} role permissions, identity, collection, game catalog, game and copy inventory schema constraints OK`,
  );
} finally {
  await pool.end();
}
