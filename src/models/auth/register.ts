import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { registerUser as insertUser } from '../../data/auth-data';
import { normalizeEmail } from '../../lib/validate/normalize-email';
import { normalizeHandle } from '../../lib/validate/normalize-handle';
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
  handle: string;
}

/**
 * Creates an unverified account and mails it a verification link.
 *
 * Throws the raw Postgres error on a duplicate (code 23505) for the controller
 * to map to a 409. Two things can collide now: the address, through the UNIQUE
 * on users.email and idx_users_email_lower, and the handle through
 * idx_users_handle_lower. The controller reads err.constraint to say which,
 * because "already taken" about the wrong field sends the reader to change the
 * wrong box.
 *
 * The email is sent last and cannot fail the registration: sendEmail swallows
 * its own errors, and the account is already committed by then. A reader whose
 * mail never arrives recovers through resend-verification.
 *
 * That ordering is also what makes the invite gate airtight (LOS-376). A code
 * that is spent or unknown raises inside fn_register_user, so insertUser throws
 * and this function returns before sendEmail is reached. No account, and --
 * the point of the whole exercise -- no mail sent to the address that was
 * offered up.
 */
export async function registerUser(
  email: string,
  password: string,
  displayName: string,
  handle: string,
  /** Null when REGISTRATION_MODE=open; the controller decides, not this. */
  inviteCode: string | null,
): Promise<RegisteredUser> {
  const normalized = normalizeEmail(email);
  const trimmedName = displayName.trim();
  const normalizedHandle = normalizeHandle(handle);

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const verificationToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  const row = await insertUser(
    normalized,
    passwordHash,
    trimmedName,
    normalizedHandle,
    verificationToken,
    expiresAt,
    inviteCode,
  );

  const { subject, html, text } = verificationEmail(row.display_name, verificationToken);
  await sendEmail({ to: row.email, subject, html, text });

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    handle: row.handle,
  };
}
