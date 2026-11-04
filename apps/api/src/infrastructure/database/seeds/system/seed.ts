import type { Pool, PoolClient } from "pg";

import { databasePool } from "../../client.js";
import {
  lookupSeeds,
  permissionSeeds,
  rolePermissionSeeds,
  roleSeeds,
} from "./data.js";

const allowedLookupTables = new Set(lookupSeeds.map(({ table }) => table));

function placeholders(rowCount: number, columnCount: number): string {
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const offset = rowIndex * columnCount;
    const columns = Array.from(
      { length: columnCount },
      (_, columnIndex) => `$${offset + columnIndex + 1}`,
    );
    return `(${columns.join(", ")})`;
  }).join(", ");
}

async function seedLookupTables(client: PoolClient): Promise<void> {
  for (const { table, rows } of lookupSeeds) {
    if (!allowedLookupTables.has(table)) {
      throw new Error(`Unexpected system lookup table: ${table}`);
    }

    const values = rows.flatMap(({ code, name }) => [code, name]);
    await client.query(
      `INSERT INTO "${table}" ("code", "name") VALUES ${placeholders(rows.length, 2)}
       ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name"`,
      values,
    );
  }
}

async function seedRoles(client: PoolClient): Promise<void> {
  const values = roleSeeds.flatMap(({ code, name, description }) => [
    code,
    name,
    description,
  ]);

  await client.query(
    `INSERT INTO "roles" ("code", "name", "description") VALUES ${placeholders(roleSeeds.length, 3)}
     ON CONFLICT ("code") DO UPDATE SET
       "name" = EXCLUDED."name",
       "description" = EXCLUDED."description"`,
    values,
  );
}

async function seedPermissions(client: PoolClient): Promise<void> {
  const values = permissionSeeds.flatMap(([code, description]) => [
    code,
    description,
  ]);

  await client.query(
    `INSERT INTO "permissions" ("code", "description") VALUES ${placeholders(permissionSeeds.length, 2)}
     ON CONFLICT ("code") DO UPDATE SET
       "description" = EXCLUDED."description"`,
    values,
  );
}

async function seedRolePermissions(client: PoolClient): Promise<void> {
  const rows = Object.entries(rolePermissionSeeds).flatMap(
    ([roleCode, permissionCodes]) =>
      permissionCodes.map((permissionCode) => [roleCode, permissionCode]),
  );
  const values = rows.flat();

  await client.query(
    `INSERT INTO "role_permissions" ("role_code", "permission_code") VALUES ${placeholders(rows.length, 2)}
     ON CONFLICT ("role_code", "permission_code") DO NOTHING`,
    values,
  );
}

export async function seedSystemData(pool: Pool = databasePool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(473829104)");
    await seedLookupTables(client);
    await seedRoles(client);
    await seedPermissions(client);
    await seedRolePermissions(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
