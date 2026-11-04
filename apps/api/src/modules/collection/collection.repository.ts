import type {
  Collection,
  CollectionDetail,
  CollectionListQuery,
  CollectionListResponse,
  NormalizedCreateCollectionRequest,
  NormalizedUpdateCollectionRequest,
} from "@ludoteca/contracts";
import type { PoolClient } from "pg";

import { databasePool } from "../../infrastructure/database/index.js";

type CollectionRow = Readonly<{
  id: string;
  type_code: "PERSONAL";
  status_code: "ACTIVE" | "ARCHIVED";
  name: string;
  description: string | null;
  visibility_code: "PRIVATE" | "PUBLIC";
  is_for_sale: boolean;
  created_by_user_id: string;
  role_code: "OWNER" | "MANAGER" | "MEMBER" | "VIEWER";
  game_count: number;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}>;

type CollectionDetailRow = Omit<CollectionRow, "role_code"> &
  Readonly<{ role_code: CollectionRow["role_code"] | null }>;

export type CollectionMutationResult =
  | Readonly<{ kind: "not_found" }>
  | Readonly<{ kind: "role_denied" }>
  | Readonly<{ kind: "archived" }>
  | Readonly<{ kind: "success"; collection: CollectionDetail }>;

function mapCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    type: row.type_code,
    status: row.status_code,
    name: row.name,
    description: row.description,
    visibility: row.visibility_code,
    isForSale: row.is_for_sale,
    gameCount: row.game_count,
    createdByUserId: row.created_by_user_id,
    effectiveRole: row.role_code,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    archivedAt: row.archived_at?.toISOString() ?? null,
  };
}

function mapCollectionDetail(row: CollectionDetailRow): CollectionDetail {
  return {
    id: row.id,
    type: row.type_code,
    status: row.status_code,
    name: row.name,
    description: row.description,
    visibility: row.visibility_code,
    isForSale: row.is_for_sale,
    gameCount: row.game_count,
    createdByUserId: row.created_by_user_id,
    effectiveRole: row.role_code,
    canEdit: false,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    archivedAt: row.archived_at?.toISOString() ?? null,
  };
}

async function insertCollection(
  client: PoolClient,
  userId: string,
  input: NormalizedCreateCollectionRequest,
): Promise<Collection> {
  const collectionResult = await client.query<CollectionRow>(
    `INSERT INTO collections (
       type_code, status_code, name, description, visibility_code,
       is_for_sale, created_by_user_id
     ) VALUES ('PERSONAL', 'ACTIVE', $1, $2, $3, false, $4)
     RETURNING id, type_code, status_code, name, description, visibility_code,
               is_for_sale, created_by_user_id, created_at, updated_at,
               archived_at, 'OWNER'::text AS role_code,
               0::integer AS game_count`,
    [input.name, input.description ?? null, input.visibility, userId],
  );
  const collection = collectionResult.rows[0];

  if (collection === undefined) {
    throw new Error("Collection insert did not return a row");
  }

  await client.query(
    `INSERT INTO collection_members (collection_id, user_id, role_code)
     VALUES ($1, $2, 'OWNER')`,
    [collection.id, userId],
  );

  return mapCollection(collection);
}

export async function createPersonalCollection(
  userId: string,
  input: NormalizedCreateCollectionRequest,
): Promise<Collection> {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");
    const collection = await insertCollection(client, userId, input);
    await client.query("COMMIT");
    return collection;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findCollectionsForMember(
  userId: string,
  query: CollectionListQuery,
): Promise<CollectionListResponse> {
  const archivedCondition = query.includeArchived
    ? ""
    : "AND collections.status_code = 'ACTIVE'";
  const offset = (query.page - 1) * query.pageSize;
  const [itemsResult, countResult] = await Promise.all([
    databasePool.query<CollectionRow>(
      `SELECT collections.id, collections.type_code, collections.status_code,
              collections.name, collections.description,
              collections.visibility_code, collections.is_for_sale,
              collections.created_by_user_id, collections.created_at,
              collections.updated_at, collections.archived_at,
              collection_members.role_code,
              (
                SELECT COUNT(*)::integer
                FROM copies
                WHERE copies.current_collection_id = collections.id
                  AND copies.lifecycle_code = 'ACTIVE'
              ) AS game_count
       FROM collection_members
       INNER JOIN collections
         ON collections.id = collection_members.collection_id
       WHERE collection_members.user_id = $1
         ${archivedCondition}
       ORDER BY collections.created_at DESC, collections.id DESC
       LIMIT $2 OFFSET $3`,
      [userId, query.pageSize, offset],
    ),
    databasePool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM collection_members
       INNER JOIN collections
         ON collections.id = collection_members.collection_id
       WHERE collection_members.user_id = $1
         ${archivedCondition}`,
      [userId],
    ),
  ]);
  const totalItems = Number(countResult.rows[0]?.count ?? 0);

  return {
    collections: itemsResult.rows.map(mapCollection),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    },
  };
}

export async function findCollectionDetail(
  collectionId: string,
  userId: string | null,
): Promise<CollectionDetail | null> {
  const result = await databasePool.query<CollectionDetailRow>(
    `SELECT collections.id, collections.type_code, collections.status_code,
            collections.name, collections.description,
            collections.visibility_code, collections.is_for_sale,
            collections.created_by_user_id, collections.created_at,
            collections.updated_at, collections.archived_at,
            collection_members.role_code,
            (
              SELECT COUNT(*)::integer
              FROM copies
              WHERE copies.current_collection_id = collections.id
                AND copies.lifecycle_code = 'ACTIVE'
            ) AS game_count
     FROM collections
     LEFT JOIN collection_members
       ON collection_members.collection_id = collections.id
      AND collection_members.user_id = $2
     WHERE collections.id = $1`,
    [collectionId, userId],
  );
  const row = result.rows[0];

  return row === undefined ? null : mapCollectionDetail(row);
}

async function findLockedMembership(
  client: PoolClient,
  collectionId: string,
  userId: string,
): Promise<Pick<CollectionDetailRow, "role_code" | "status_code"> | null> {
  const result = await client.query<
    Pick<CollectionDetailRow, "role_code" | "status_code">
  >(
    `SELECT collection_members.role_code, collections.status_code
     FROM collections
     INNER JOIN collection_members
       ON collection_members.collection_id = collections.id
      AND collection_members.user_id = $2
     WHERE collections.id = $1
     FOR UPDATE OF collections`,
    [collectionId, userId],
  );

  return result.rows[0] ?? null;
}

async function findCollectionDetailWithClient(
  client: PoolClient,
  collectionId: string,
  userId: string,
): Promise<CollectionDetail> {
  const result = await client.query<CollectionDetailRow>(
    `SELECT collections.id, collections.type_code, collections.status_code,
            collections.name, collections.description,
            collections.visibility_code, collections.is_for_sale,
            collections.created_by_user_id, collections.created_at,
            collections.updated_at, collections.archived_at,
            collection_members.role_code,
            (
              SELECT COUNT(*)::integer
              FROM copies
              WHERE copies.current_collection_id = collections.id
                AND copies.lifecycle_code = 'ACTIVE'
            ) AS game_count
     FROM collections
     INNER JOIN collection_members
       ON collection_members.collection_id = collections.id
      AND collection_members.user_id = $2
     WHERE collections.id = $1`,
    [collectionId, userId],
  );
  const row = result.rows[0];

  if (row === undefined) {
    throw new Error("Locked collection disappeared during transaction");
  }

  return mapCollectionDetail(row);
}

export async function updateCollectionForMember(
  collectionId: string,
  userId: string,
  input: NormalizedUpdateCollectionRequest,
): Promise<CollectionMutationResult> {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");
    const membership = await findLockedMembership(client, collectionId, userId);

    if (membership === null) {
      await client.query("ROLLBACK");
      return { kind: "not_found" };
    }
    if (
      membership.role_code !== "OWNER" &&
      membership.role_code !== "MANAGER"
    ) {
      await client.query("ROLLBACK");
      return { kind: "role_denied" };
    }
    if (membership.status_code === "ARCHIVED") {
      await client.query("ROLLBACK");
      return { kind: "archived" };
    }

    const assignments: string[] = [];
    const values: unknown[] = [];
    const fields = [
      ["name", "name"],
      ["description", "description"],
      ["visibility", "visibility_code"],
    ] as const;

    for (const [property, column] of fields) {
      if (Object.hasOwn(input, property)) {
        values.push(input[property]);
        assignments.push(`${column} = $${values.length}`);
      }
    }

    values.push(collectionId);
    await client.query(
      `UPDATE collections
       SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length}`,
      values,
    );
    const collection = await findCollectionDetailWithClient(
      client,
      collectionId,
      userId,
    );
    await client.query("COMMIT");
    return { kind: "success", collection };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function archiveCollectionForOwner(
  collectionId: string,
  userId: string,
): Promise<CollectionMutationResult> {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");
    const membership = await findLockedMembership(client, collectionId, userId);

    if (membership === null) {
      await client.query("ROLLBACK");
      return { kind: "not_found" };
    }
    if (membership.role_code !== "OWNER") {
      await client.query("ROLLBACK");
      return { kind: "role_denied" };
    }

    if (membership.status_code !== "ARCHIVED") {
      await client.query(
        `UPDATE collections
         SET status_code = 'ARCHIVED', archived_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [collectionId],
      );
    }

    const collection = await findCollectionDetailWithClient(
      client,
      collectionId,
      userId,
    );
    await client.query("COMMIT");
    return { kind: "success", collection };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
