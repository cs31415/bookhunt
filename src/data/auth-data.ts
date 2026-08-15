import { pool } from '../lib/db';

export async function registerUser(
  email: string,
  passwordHash: string,
  displayName: string,
  handle: string,
  verificationToken: string,
  verificationExpiresAt: Date,
) {
  const { rows } = await pool.query(
    'SELECT * FROM fn_register_user($1, $2, $3, $4, $5, $6)',
    [email, passwordHash, displayName, handle, verificationToken, verificationExpiresAt],
  );
  return rows[0];
}

export async function findUserByEmail(email: string) {
  const { rows } = await pool.query(
    'SELECT * FROM fn_find_user_by_email($1)',
    [email],
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function setResetToken(email: string, resetToken: string, expiresAt: Date) {
  await pool.query(
    'SELECT * FROM fn_set_reset_token($1, $2, $3)',
    [email, resetToken, expiresAt],
  );
}

export async function resetPassword(token: string, passwordHash: string) {
  const { rows } = await pool.query(
    'SELECT * FROM fn_reset_password($1, $2)',
    [token, passwordHash],
  );
  return rows[0].fn_reset_password as boolean;
}

/** Returns the verified user, or null when the token is unknown or expired. */
export async function verifyEmail(token: string) {
  const { rows } = await pool.query(
    'SELECT * FROM fn_verify_email($1)',
    [token],
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function setVerificationToken(email: string, token: string, expiresAt: Date) {
  await pool.query(
    'SELECT * FROM fn_set_verification_token($1, $2, $3)',
    [email, token, expiresAt],
  );
}
