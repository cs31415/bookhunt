import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { registerUser as insertUser } from '../../data/auth-data';
import { normalizeEmail } from '../../lib/validate/normalize-email';
import { sendEmail } from '../../lib/email/send-email';
import {
  VERIFICATION_TOKEN_TTL_MS,
  verificationEmail,
} from '../../lib/email/templates/verification-email';

const BCRYPT_ROUNDS = 10;

export interface RegisteredUser {
  id: number;
  email: string;
  displayName: string;
}

/**
 * Creates an unverified account and mails it a verification link.
 *
 * Throws the raw Postgres error on a duplicate address (code 23505) for the
 * controller to map to a 409 -- both the UNIQUE on users.email and
 * idx_users_email_lower raise it, so an address that differs only in
 * capitalisation is now rejected rather than becoming a second account.
 *
 * The email is sent last and cannot fail the registration: sendEmail swallows
 * its own errors, and the account is already committed by then. A reader whose
 * mail never arrives recovers through resend-verification.
 */
export async function registerUser(
  email: string,
  password: string,
  displayName: string,
): Promise<RegisteredUser> {
  const normalized = normalizeEmail(email);
  const trimmedName = displayName.trim();

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const verificationToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  const row = await insertUser(
    normalized,
    passwordHash,
    trimmedName,
    verificationToken,
    expiresAt,
  );

  const { subject, html, text } = verificationEmail(row.display_name, verificationToken);
  await sendEmail({ to: row.email, subject, html, text });

  return { id: row.id, email: row.email, displayName: row.display_name };
}
