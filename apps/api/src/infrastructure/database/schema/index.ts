import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

function lookupTable(
  tableName: string,
  codeLength: number,
  nameLength: number,
) {
  return pgTable(tableName, {
    code: varchar("code", { length: codeLength }).primaryKey(),
    name: varchar("name", { length: nameLength }).notNull().unique(),
  });
}

export const userStatuses = lookupTable("user_statuses", 30, 80);
export const visibilityLevels = lookupTable("visibility_levels", 30, 80);
export const moderationStatuses = lookupTable("moderation_statuses", 40, 100);
export const gameClassifications = lookupTable("game_classifications", 30, 80);
export const groupRoles = lookupTable("group_roles", 30, 80);
export const collectionRoles = lookupTable("collection_roles", 30, 80);
export const collectionTypes = lookupTable("collection_types", 30, 80);
export const collectionStatuses = lookupTable("collection_statuses", 30, 80);
export const copyLifecycleStatuses = lookupTable(
  "copy_lifecycle_statuses",
  30,
  80,
);
export const copyExitReasons = lookupTable("copy_exit_reasons", 30, 80);
export const copyConditionStatuses = lookupTable(
  "copy_condition_statuses",
  30,
  80,
);
export const acquisitionTypes = lookupTable("acquisition_types", 30, 80);
export const gameRelationTypes = lookupTable("game_relation_types", 40, 100);
export const resourceTypes = lookupTable("resource_types", 40, 100);
export const gamePersonRoles = lookupTable("game_person_roles", 30, 80);
export const publisherRelationTypes = lookupTable(
  "publisher_relation_types",
  30,
  80,
);
export const matchStatuses = lookupTable("match_statuses", 30, 80);
export const resultTypes = lookupTable("result_types", 40, 100);
export const scoringTypes = lookupTable("scoring_types", 30, 80);
export const scoreDirections = lookupTable("score_directions", 30, 80);
export const winnerResolutionTypes = lookupTable(
  "winner_resolution_types",
  30,
  80,
);
export const statisticValueTypes = lookupTable("statistic_value_types", 30, 80);
export const statisticTargetTypes = lookupTable(
  "statistic_target_types",
  30,
  80,
);
export const outcomeTypes = lookupTable("outcome_types", 30, 80);
export const loanStatuses = lookupTable("loan_statuses", 30, 80);
export const saleListingStatuses = lookupTable("sale_listing_statuses", 30, 80);
export const tradeStatuses = lookupTable("trade_statuses", 30, 80);
export const tradeItemSides = lookupTable("trade_item_sides", 30, 80);
export const sharePermissions = lookupTable("share_permissions", 30, 80);
export const reactionTypes = lookupTable("reaction_types", 30, 80);
export const mergeStatuses = lookupTable("merge_statuses", 30, 80);

export const roles = pgTable("roles", {
  code: varchar("code", { length: 60 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  description: text("description"),
});

export const permissions = pgTable("permissions", {
  code: varchar("code", { length: 120 }).primaryKey(),
  description: text("description").notNull(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleCode: varchar("role_code", { length: 60 })
      .notNull()
      .references(() => roles.code, { onDelete: "cascade" }),
    permissionCode: varchar("permission_code", { length: 120 })
      .notNull()
      .references(() => permissions.code, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.roleCode, table.permissionCode] })],
);

const technicalTimestamp = (columnName: string) =>
  timestamp(columnName, {
    withTimezone: true,
    mode: "date",
    precision: 3,
  })
    .notNull()
    .defaultNow();

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    username: varchar("username", { length: 80 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    statusCode: varchar("status_code", { length: 30 })
      .notNull()
      .references(() => userStatuses.code),
    createdAt: technicalTimestamp("created_at"),
    updatedAt: technicalTimestamp("updated_at"),
    deactivatedAt: timestamp("deactivated_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    }),
  },
  (table) => [
    uniqueIndex("users_email_normalized_unique").on(sql`lower(${table.email})`),
    uniqueIndex("users_username_normalized_unique").on(
      sql`lower(${table.username})`,
    ),
    check(
      "users_deactivation_consistent",
      sql`(${table.statusCode} = 'DEACTIVATED') = (${table.deactivatedAt} IS NOT NULL)`,
    ),
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey(),
    purposeCode: varchar("purpose_code", { length: 30 }).notNull(),
    primaryObjectKey: text("primary_object_key").notNull().unique(),
    thumbnailObjectKey: text("thumbnail_object_key").notNull().unique(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    checksumSha256: varchar("checksum_sha256", { length: 64 }).notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: technicalTimestamp("created_at"),
  },
  (table) => [
    index("media_assets_created_by_user_id_idx").on(table.createdByUserId),
    check(
      "media_assets_purpose_allowed",
      sql`${table.purposeCode} IN ('USER_AVATAR', 'GAME_COVER')`,
    ),
    check("media_assets_byte_size_valid", sql`${table.byteSize} > 0`),
    check(
      "media_assets_dimensions_valid",
      sql`${table.width} > 0 AND ${table.height} > 0`,
    ),
  ],
);

export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: varchar("display_name", { length: 120 }),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    avatarMediaId: uuid("avatar_media_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    locationText: varchar("location_text", { length: 160 }),
    visibilityCode: varchar("visibility_code", { length: 30 })
      .notNull()
      .references(() => visibilityLevels.code),
    createdAt: technicalTimestamp("created_at"),
    updatedAt: technicalTimestamp("updated_at"),
  },
  (table) => [
    check(
      "profiles_visibility_allowed",
      sql`${table.visibilityCode} IN ('PRIVATE', 'PUBLIC')`,
    ),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleCode: varchar("role_code", { length: 60 })
      .notNull()
      .references(() => roles.code, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    })
      .notNull()
      .defaultNow(),
    assignedByUserId: uuid("assigned_by_user_id").references(() => users.id),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleCode] })],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    csrfTokenHash: varchar("csrf_token_hash", { length: 64 }).notNull(),
    createdAt: technicalTimestamp("created_at"),
    lastSeenAt: technicalTimestamp("last_seen_at"),
    idleExpiresAt: timestamp("idle_expires_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    }).notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    }).notNull(),
    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    }),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    check(
      "sessions_expiration_order",
      sql`${table.idleExpiresAt} <= ${table.absoluteExpiresAt}`,
    ),
  ],
);

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    typeCode: varchar("type_code", { length: 30 })
      .notNull()
      .references(() => collectionTypes.code),
    statusCode: varchar("status_code", { length: 30 })
      .notNull()
      .references(() => collectionStatuses.code),
    name: varchar("name", { length: 140 }).notNull(),
    description: text("description"),
    visibilityCode: varchar("visibility_code", { length: 30 })
      .notNull()
      .references(() => visibilityLevels.code),
    isForSale: boolean("is_for_sale").notNull().default(false),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: technicalTimestamp("created_at"),
    updatedAt: technicalTimestamp("updated_at"),
    archivedAt: timestamp("archived_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    }),
  },
  (table) => [
    index("collections_created_by_user_id_idx").on(table.createdByUserId),
    index("collections_status_code_idx").on(table.statusCode),
    check(
      "collections_personal_type_only",
      sql`${table.typeCode} = 'PERSONAL'`,
    ),
    check(
      "collections_personal_visibility_allowed",
      sql`${table.visibilityCode} IN ('PRIVATE', 'PUBLIC')`,
    ),
    check("collections_sale_disabled", sql`${table.isForSale} = false`),
    check(
      "collections_archive_consistent",
      sql`(${table.statusCode} = 'ARCHIVED') = (${table.archivedAt} IS NOT NULL)`,
    ),
  ],
);

export const collectionMembers = pgTable(
  "collection_members",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    roleCode: varchar("role_code", { length: 30 })
      .notNull()
      .references(() => collectionRoles.code),
    joinedAt: technicalTimestamp("joined_at"),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.userId] }),
    index("collection_members_user_id_idx").on(table.userId),
  ],
);

export const mechanics = pgTable(
  "mechanics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
  },
  (table) => [
    uniqueIndex("mechanics_name_normalized_unique").on(
      sql`lower(${table.name})`,
    ),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
  },
  (table) => [
    uniqueIndex("categories_name_normalized_unique").on(
      sql`lower(${table.name})`,
    ),
  ],
);

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 220 }).notNull(),
    description: text("description"),
    publicationYear: smallint("publication_year"),
    minPlayers: smallint("min_players").notNull(),
    maxPlayers: smallint("max_players").notNull(),
    minDurationMinutes: integer("min_duration_minutes"),
    maxDurationMinutes: integer("max_duration_minutes"),
    minAge: smallint("min_age"),
    maxAge: smallint("max_age"),
    complexity: numeric("complexity", { precision: 3, scale: 2 }),
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    classificationCode: varchar("classification_code", { length: 30 })
      .notNull()
      .references(() => gameClassifications.code),
    visibilityCode: varchar("visibility_code", { length: 30 })
      .notNull()
      .references(() => visibilityLevels.code),
    moderationStatusCode: varchar("moderation_status_code", { length: 40 })
      .notNull()
      .references(() => moderationStatuses.code),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: technicalTimestamp("created_at"),
    updatedAt: technicalTimestamp("updated_at"),
    archivedAt: timestamp("archived_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    }),
  },
  (table) => [
    index("games_name_normalized_idx").on(sql`lower(${table.name})`),
    index("games_visibility_moderation_idx").on(
      table.visibilityCode,
      table.moderationStatusCode,
    ),
    index("games_created_by_user_id_idx").on(table.createdByUserId),
    check(
      "games_publication_year_valid",
      sql`${table.publicationYear} IS NULL OR ${table.publicationYear} >= 0`,
    ),
    check("games_min_players_valid", sql`${table.minPlayers} >= 1`),
    check(
      "games_player_range_valid",
      sql`${table.maxPlayers} >= ${table.minPlayers}`,
    ),
    check(
      "games_min_duration_valid",
      sql`${table.minDurationMinutes} IS NULL OR ${table.minDurationMinutes} >= 0`,
    ),
    check(
      "games_duration_range_valid",
      sql`${table.maxDurationMinutes} IS NULL OR (${table.maxDurationMinutes} >= 0 AND (${table.minDurationMinutes} IS NULL OR ${table.maxDurationMinutes} >= ${table.minDurationMinutes}))`,
    ),
    check(
      "games_min_age_valid",
      sql`${table.minAge} IS NULL OR ${table.minAge} >= 0`,
    ),
    check(
      "games_age_range_valid",
      sql`${table.maxAge} IS NULL OR (${table.maxAge} >= 0 AND (${table.minAge} IS NULL OR ${table.maxAge} >= ${table.minAge}))`,
    ),
    check(
      "games_complexity_valid",
      sql`${table.complexity} IS NULL OR (${table.complexity} >= 0 AND ${table.complexity} <= 5)`,
    ),
    check(
      "games_scope_consistent",
      sql`(
        ${table.visibilityCode} = 'PRIVATE'
        AND ${table.classificationCode} = 'PRIVATE'
        AND ${table.createdByUserId} IS NOT NULL
        AND ${table.moderationStatusCode} IN ('DRAFT', 'PENDING_REVIEW', 'REJECTED', 'REJECTED_DUPLICATE', 'BLOCKED', 'ARCHIVED')
      ) OR (
        ${table.visibilityCode} = 'PUBLIC'
        AND ${table.classificationCode} IN ('OFFICIAL', 'COMMUNITY')
        AND ${table.moderationStatusCode} IN ('APPROVED', 'ARCHIVED')
      )`,
    ),
    check(
      "games_archive_consistent",
      sql`(${table.moderationStatusCode} = 'ARCHIVED') = (${table.archivedAt} IS NOT NULL)`,
    ),
  ],
);

export const moderationCases = pgTable(
  "moderation_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }),
    gameEditionId: uuid("game_edition_id").references(() => gameEditions.id, {
      onDelete: "cascade",
    }),
    currentStatusCode: varchar("current_status_code", { length: 40 })
      .notNull()
      .references(() => moderationStatuses.code),
    submittedByUserId: uuid("submitted_by_user_id")
      .notNull()
      .references(() => users.id),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
    submissionNote: text("submission_note"),
    resolutionNote: text("resolution_note"),
    createdAt: technicalTimestamp("created_at"),
    updatedAt: technicalTimestamp("updated_at"),
    closedAt: timestamp("closed_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    }),
  },
  (table) => [
    index("moderation_cases_status_created_idx").on(
      table.currentStatusCode,
      table.createdAt,
    ),
    index("moderation_cases_submitted_by_user_id_idx").on(
      table.submittedByUserId,
    ),
    uniqueIndex("moderation_cases_one_pending_per_game")
      .on(table.gameId)
      .where(
        sql`${table.gameId} IS NOT NULL AND ${table.currentStatusCode} = 'PENDING_REVIEW'`,
      ),
    uniqueIndex("moderation_cases_one_pending_per_edition")
      .on(table.gameEditionId)
      .where(
        sql`${table.gameEditionId} IS NOT NULL AND ${table.currentStatusCode} = 'PENDING_REVIEW'`,
      ),
    check(
      "moderation_cases_single_target",
      sql`(${table.gameId} IS NOT NULL)::integer + (${table.gameEditionId} IS NOT NULL)::integer = 1`,
    ),
    check(
      "moderation_cases_status_allowed",
      sql`${table.currentStatusCode} IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')`,
    ),
    check(
      "moderation_cases_closed_consistent",
      sql`(${table.currentStatusCode} = 'PENDING_REVIEW' AND ${table.closedAt} IS NULL) OR (${table.currentStatusCode} IN ('APPROVED', 'REJECTED') AND ${table.closedAt} IS NOT NULL)`,
    ),
  ],
);

export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moderationCaseId: uuid("moderation_case_id")
      .notNull()
      .references(() => moderationCases.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id),
    fromStatusCode: varchar("from_status_code", { length: 40 }).references(
      () => moderationStatuses.code,
    ),
    toStatusCode: varchar("to_status_code", { length: 40 })
      .notNull()
      .references(() => moderationStatuses.code),
    reason: text("reason"),
    createdAt: technicalTimestamp("created_at"),
  },
  (table) => [
    index("moderation_actions_case_created_idx").on(
      table.moderationCaseId,
      table.createdAt,
    ),
    index("moderation_actions_actor_user_id_idx").on(table.actorUserId),
  ],
);

export const gameMechanics = pgTable(
  "game_mechanics",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    mechanicId: uuid("mechanic_id")
      .notNull()
      .references(() => mechanics.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.mechanicId] }),
    index("game_mechanics_mechanic_id_idx").on(table.mechanicId),
  ],
);

export const gameCategories = pgTable(
  "game_categories",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.categoryId] }),
    index("game_categories_category_id_idx").on(table.categoryId),
  ],
);

export const gameEditions = pgTable(
  "game_editions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id),
    editionName: varchar("edition_name", { length: 180 }),
    editionNumber: varchar("edition_number", { length: 80 }),
    languageCode: varchar("language_code", { length: 12 }),
    publicationYear: smallint("publication_year"),
    isbn: varchar("isbn", { length: 32 }),
    sku: varchar("sku", { length: 80 }),
    upc: varchar("upc", { length: 32 }),
    notes: text("notes"),
    moderationStatusCode: varchar("moderation_status_code", { length: 40 })
      .notNull()
      .default("APPROVED")
      .references(() => moderationStatuses.code),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: technicalTimestamp("created_at"),
    updatedAt: technicalTimestamp("updated_at"),
  },
  (table) => [
    index("game_editions_game_id_idx").on(table.gameId),
    index("game_editions_status_game_idx").on(
      table.moderationStatusCode,
      table.gameId,
    ),
    index("game_editions_created_by_user_id_idx").on(table.createdByUserId),
    unique("game_editions_id_game_id_unique").on(table.id, table.gameId),
    check(
      "game_editions_publication_year_valid",
      sql`${table.publicationYear} IS NULL OR ${table.publicationYear} >= 0`,
    ),
    check(
      "game_editions_moderation_status_allowed",
      sql`${table.moderationStatusCode} IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')`,
    ),
  ],
);

export const copies = pgTable(
  "copies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id),
    gameEditionId: uuid("game_edition_id"),
    currentCollectionId: uuid("current_collection_id").references(
      () => collections.id,
    ),
    lifecycleCode: varchar("lifecycle_code", { length: 30 })
      .notNull()
      .references(() => copyLifecycleStatuses.code),
    conditionCode: varchar("condition_code", { length: 30 })
      .notNull()
      .references(() => copyConditionStatuses.code),
    alias: varchar("alias", { length: 140 }),
    notes: text("notes"),
    exitReasonCode: varchar("exit_reason_code", { length: 30 }).references(
      () => copyExitReasons.code,
    ),
    exitedAt: timestamp("exited_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: technicalTimestamp("created_at"),
    updatedAt: technicalTimestamp("updated_at"),
  },
  (table) => [
    index("copies_game_id_idx").on(table.gameId),
    index("copies_game_edition_id_idx").on(table.gameEditionId),
    index("copies_current_collection_id_idx").on(table.currentCollectionId),
    index("copies_lifecycle_code_idx").on(table.lifecycleCode),
    index("copies_created_by_user_id_idx").on(table.createdByUserId),
    unique("copies_id_game_id_unique").on(table.id, table.gameId),
    foreignKey({
      name: "copies_edition_belongs_to_game_fk",
      columns: [table.gameEditionId, table.gameId],
      foreignColumns: [gameEditions.id, gameEditions.gameId],
    }),
    check(
      "copies_lifecycle_consistent",
      sql`(
        ${table.lifecycleCode} = 'ACTIVE'
        AND ${table.currentCollectionId} IS NOT NULL
        AND ${table.exitReasonCode} IS NULL
        AND ${table.exitedAt} IS NULL
      ) OR (
        ${table.lifecycleCode} = 'EXITED'
        AND ${table.currentCollectionId} IS NULL
        AND ${table.exitReasonCode} IS NOT NULL
        AND ${table.exitedAt} IS NOT NULL
      )`,
    ),
  ],
);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id),
    gameEditionId: uuid("game_edition_id"),
    copyId: uuid("copy_id"),
    collectionId: uuid("collection_id").references(() => collections.id),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    statusCode: varchar("status_code", { length: 30 })
      .notNull()
      .references(() => matchStatuses.code),
    visibilityCode: varchar("visibility_code", { length: 30 })
      .notNull()
      .references(() => visibilityLevels.code),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    }).notNull(),
    durationMinutes: integer("duration_minutes"),
    locationText: varchar("location_text", { length: 220 }),
    notes: text("notes"),
    createdAt: technicalTimestamp("created_at"),
    updatedAt: technicalTimestamp("updated_at"),
  },
  (table) => [
    index("matches_creator_started_idx").on(
      table.createdByUserId,
      table.startedAt,
    ),
    index("matches_game_started_idx").on(table.gameId, table.startedAt),
    index("matches_copy_id_idx").on(table.copyId),
    index("matches_collection_id_idx").on(table.collectionId),
    foreignKey({
      name: "matches_edition_belongs_to_game_fk",
      columns: [table.gameEditionId, table.gameId],
      foreignColumns: [gameEditions.id, gameEditions.gameId],
    }),
    foreignKey({
      name: "matches_copy_belongs_to_game_fk",
      columns: [table.copyId, table.gameId],
      foreignColumns: [copies.id, copies.gameId],
    }),
    check(
      "matches_status_allowed",
      sql`${table.statusCode} IN ('COMPLETED', 'INCOMPLETE', 'CANCELLED')`,
    ),
    check(
      "matches_visibility_allowed",
      sql`${table.visibilityCode} IN ('PRIVATE', 'PUBLIC')`,
    ),
    check(
      "matches_duration_valid",
      sql`${table.durationMinutes} IS NULL OR ${table.durationMinutes} >= 0`,
    ),
  ],
);

export const matchParticipants = pgTable(
  "match_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    guestName: varchar("guest_name", { length: 160 }),
    displayNameSnapshot: varchar("display_name_snapshot", {
      length: 160,
    }).notNull(),
    seatOrder: smallint("seat_order").notNull(),
    outcomeTypeCode: varchar("outcome_type_code", { length: 30 })
      .notNull()
      .default("NO_RESULT")
      .references(() => outcomeTypes.code),
    scoreNumeric: numeric("score_numeric", { precision: 18, scale: 4 }),
    createdAt: technicalTimestamp("created_at"),
  },
  (table) => [
    index("match_participants_match_id_idx").on(table.matchId),
    index("match_participants_user_id_idx").on(table.userId),
    unique("match_participants_seat_unique").on(table.matchId, table.seatOrder),
    uniqueIndex("match_participants_registered_user_unique")
      .on(table.matchId, table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
    check(
      "match_participants_single_identity",
      sql`(${table.userId} IS NOT NULL)::integer + (${table.guestName} IS NOT NULL)::integer = 1`,
    ),
    check("match_participants_seat_valid", sql`${table.seatOrder} >= 1`),
    check(
      "match_participants_outcome_allowed",
      sql`${table.outcomeTypeCode} IN ('WIN', 'LOSS', 'DRAW', 'NO_RESULT')`,
    ),
  ],
);

export const copyCollectionHistory = pgTable(
  "copy_collection_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    copyId: uuid("copy_id")
      .notNull()
      .references(() => copies.id),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    }),
    changedByUserId: uuid("changed_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: technicalTimestamp("created_at"),
  },
  (table) => [
    index("copy_collection_history_copy_id_idx").on(table.copyId),
    index("copy_collection_history_collection_id_idx").on(table.collectionId),
    index("copy_collection_history_changed_by_user_id_idx").on(
      table.changedByUserId,
    ),
    uniqueIndex("copy_collection_history_one_open_per_copy")
      .on(table.copyId)
      .where(sql`${table.endedAt} IS NULL`),
    check(
      "copy_collection_history_period_valid",
      sql`${table.endedAt} IS NULL OR ${table.endedAt} >= ${table.startedAt}`,
    ),
  ],
);

export const acquisitions = pgTable(
  "acquisitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    copyId: uuid("copy_id")
      .notNull()
      .references(() => copies.id),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id),
    acquiredByUserId: uuid("acquired_by_user_id")
      .notNull()
      .references(() => users.id),
    typeCode: varchar("type_code", { length: 30 })
      .notNull()
      .references(() => acquisitionTypes.code),
    acquiredOn: date("acquired_on", { mode: "string" }),
    priceAmount: numeric("price_amount", { precision: 12, scale: 2 }),
    currencyCode: varchar("currency_code", { length: 3 }),
    sourceName: varchar("source_name", { length: 180 }),
    notes: text("notes"),
    createdAt: technicalTimestamp("created_at"),
  },
  (table) => [
    index("acquisitions_copy_id_idx").on(table.copyId),
    index("acquisitions_collection_id_idx").on(table.collectionId),
    index("acquisitions_acquired_by_user_id_idx").on(table.acquiredByUserId),
    check(
      "acquisitions_price_valid",
      sql`${table.priceAmount} IS NULL OR ${table.priceAmount} >= 0`,
    ),
    check(
      "acquisitions_currency_consistent",
      sql`(${table.priceAmount} IS NULL AND ${table.currencyCode} IS NULL) OR (${table.priceAmount} IS NOT NULL AND ${table.currencyCode} IS NOT NULL AND ${table.currencyCode} = upper(${table.currencyCode}))`,
    ),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id),
    action: varchar("action", { length: 120 }).notNull(),
    resourceType: varchar("resource_type", { length: 80 }).notNull(),
    resourceId: uuid("resource_id").notNull(),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    context: jsonb("context"),
    occurredAt: technicalTimestamp("occurred_at"),
  },
  (table) => [
    index("audit_logs_actor_user_id_idx").on(table.actorUserId),
    index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
    index("audit_logs_occurred_at_idx").on(table.occurredAt),
  ],
);
