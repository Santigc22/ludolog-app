import type {
  GlobalRole,
  NormalizedRegisterRequest,
} from "@ludoteca/contracts";

import { databasePool } from "../../infrastructure/database/index.js";

type SessionPersistence = Readonly<{
  tokenHash: string;
  csrfTokenHash: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}>;

export type RegisteredUser = Readonly<{
  id: string;
  email: string;
  username: string;
  displayName: string | null;
}>;

export type LoginIdentity = RegisteredUser &
  Readonly<{
    passwordHash: string;
    status: string;
    visibility: "PRIVATE" | "PUBLIC";
    roles: GlobalRole[];
  }>;

export type PersistedSession = RegisteredUser &
  Readonly<{
    sessionId: string;
    csrfTokenHash: string;
    status: string;
    visibility: "PRIVATE" | "PUBLIC";
    roles: GlobalRole[];
    idleExpiresAt: Date;
    absoluteExpiresAt: Date;
    revokedAt: Date | null;
  }>;

export async function createUserWithSession(
  input: NormalizedRegisterRequest,
  passwordHash: string,
  session: SessionPersistence,
): Promise<RegisteredUser> {
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");
    const userResult = await client.query<{
      id: string;
      email: string;
      username: string;
    }>(
      `INSERT INTO users (email, username, password_hash, status_code)
       VALUES ($1, $2, $3, 'ACTIVE')
       RETURNING id, email, username`,
      [input.email, input.username, passwordHash],
    );
    const user = userResult.rows[0];

    if (user === undefined) {
      throw new Error("User insert returned no row");
    }

    await client.query(
      `INSERT INTO profiles (user_id, display_name, visibility_code)
       VALUES ($1, $2, 'PRIVATE')`,
      [user.id, input.displayName ?? null],
    );
    await client.query(
      `INSERT INTO user_roles (user_id, role_code)
       VALUES ($1, 'USER')`,
      [user.id],
    );
    await client.query(
      `INSERT INTO sessions (
         user_id, token_hash, csrf_token_hash, idle_expires_at,
         absolute_expires_at
       ) VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        session.tokenHash,
        session.csrfTokenHash,
        session.idleExpiresAt,
        session.absoluteExpiresAt,
      ],
    );
    await client.query("COMMIT");

    return {
      ...user,
      displayName: input.displayName ?? null,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findLoginIdentity(
  email: string,
): Promise<LoginIdentity | null> {
  const result = await databasePool.query<{
    id: string;
    email: string;
    username: string;
    password_hash: string;
    status_code: string;
    display_name: string | null;
    visibility_code: "PRIVATE" | "PUBLIC";
    roles: GlobalRole[];
  }>(
    `SELECT users.id, users.email, users.username, users.password_hash,
            users.status_code, profiles.display_name, profiles.visibility_code,
            ARRAY(
              SELECT user_roles.role_code
              FROM user_roles
              WHERE user_roles.user_id = users.id
              ORDER BY user_roles.role_code
            ) AS roles
     FROM users
     INNER JOIN profiles ON profiles.user_id = users.id
     WHERE lower(users.email) = $1`,
    [email],
  );
  const row = result.rows[0];

  return row === undefined
    ? null
    : {
        id: row.id,
        email: row.email,
        username: row.username,
        passwordHash: row.password_hash,
        status: row.status_code,
        displayName: row.display_name,
        visibility: row.visibility_code,
        roles: row.roles,
      };
}

export async function persistSession(
  userId: string,
  session: SessionPersistence,
): Promise<void> {
  await databasePool.query(
    `INSERT INTO sessions (
       user_id, token_hash, csrf_token_hash, idle_expires_at,
       absolute_expires_at
     ) VALUES ($1, $2, $3, $4, $5)`,
    [
      userId,
      session.tokenHash,
      session.csrfTokenHash,
      session.idleExpiresAt,
      session.absoluteExpiresAt,
    ],
  );
}

export async function findSession(
  tokenHash: string,
): Promise<PersistedSession | null> {
  const result = await databasePool.query<{
    session_id: string;
    csrf_token_hash: string;
    idle_expires_at: Date;
    absolute_expires_at: Date;
    revoked_at: Date | null;
    id: string;
    email: string;
    username: string;
    status_code: string;
    display_name: string | null;
    visibility_code: "PRIVATE" | "PUBLIC";
    roles: GlobalRole[];
  }>(
    `SELECT sessions.id AS session_id, sessions.csrf_token_hash,
            sessions.idle_expires_at, sessions.absolute_expires_at,
            sessions.revoked_at, users.id, users.email, users.username,
            users.status_code, profiles.display_name, profiles.visibility_code,
            ARRAY(
              SELECT user_roles.role_code
              FROM user_roles
              WHERE user_roles.user_id = users.id
              ORDER BY user_roles.role_code
            ) AS roles
     FROM sessions
     INNER JOIN users ON users.id = sessions.user_id
     INNER JOIN profiles ON profiles.user_id = users.id
     WHERE sessions.token_hash = $1`,
    [tokenHash],
  );
  const row = result.rows[0];

  return row === undefined
    ? null
    : {
        sessionId: row.session_id,
        csrfTokenHash: row.csrf_token_hash,
        idleExpiresAt: row.idle_expires_at,
        absoluteExpiresAt: row.absolute_expires_at,
        revokedAt: row.revoked_at,
        id: row.id,
        email: row.email,
        username: row.username,
        status: row.status_code,
        displayName: row.display_name,
        visibility: row.visibility_code,
        roles: row.roles,
      };
}

export async function renewSession(
  sessionId: string,
  idleExpiresAt: Date,
): Promise<void> {
  await databasePool.query(
    `UPDATE sessions
     SET last_seen_at = CURRENT_TIMESTAMP,
         idle_expires_at = $2
     WHERE id = $1`,
    [sessionId, idleExpiresAt],
  );
}

export async function revokeSession(sessionId: string): Promise<void> {
  await databasePool.query(
    `UPDATE sessions
     SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
         last_seen_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [sessionId],
  );
}
