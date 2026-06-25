import { pool } from '../lib/db';

export async function registerUser(email: string, passwordHash: string, displayName: string) {
  const { rows } = await pool.query(
    'SELECT * FROM sp_register_user($1, $2, $3)',
    [email, passwordHash, displayName],
  );
  return rows[0];
}

export async function findUserByEmail(email: string) {
  const { rows } = await pool.query(
    'SELECT * FROM sp_find_user_by_email($1)',
    [email],
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function setResetToken(email: string, resetToken: string, expiresAt: Date) {
  await pool.query(
    'SELECT * FROM sp_set_reset_token($1, $2, $3)',
    [email, resetToken, expiresAt],
  );
}

export async function resetPassword(token: string, passwordHash: string) {
  const { rows } = await pool.query(
    'SELECT * FROM sp_reset_password($1, $2)',
    [token, passwordHash],
  );
  return rows[0].sp_reset_password as boolean;
}
