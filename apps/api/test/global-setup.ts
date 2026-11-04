import { Pool } from "pg";

export default async function globalSetup() {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (connectionString === undefined) {
    throw new Error("TEST_DATABASE_URL is required for API test cleanup");
  }

  const pool = new Pool({ connectionString });
  try {
    await pool.query(`
      DROP TRIGGER IF EXISTS fail_copy_audit_for_test ON audit_logs;
      DROP TRIGGER IF EXISTS fail_copy_update_audit_for_test ON audit_logs;
      DROP TRIGGER IF EXISTS fail_copy_move_audit_for_test ON audit_logs;
      DROP TRIGGER IF EXISTS fail_copy_exit_audit_for_test ON audit_logs;
      DROP FUNCTION IF EXISTS fail_copy_audit_for_test();
      DROP FUNCTION IF EXISTS fail_copy_update_audit_for_test();
      DROP FUNCTION IF EXISTS fail_copy_move_audit_for_test();
      DROP FUNCTION IF EXISTS fail_copy_exit_audit_for_test();
    `);
  } finally {
    await pool.end();
  }
}
