import { databasePool } from "../../infrastructure/database/index.js";

export async function userHasPermission(
  userId: string,
  permissionCode: string,
): Promise<boolean> {
  const result = await databasePool.query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM user_roles
       INNER JOIN role_permissions
         ON role_permissions.role_code = user_roles.role_code
       WHERE user_roles.user_id = $1
         AND role_permissions.permission_code = $2
     ) AS allowed`,
    [userId, permissionCode],
  );

  return result.rows[0]?.allowed === true;
}
