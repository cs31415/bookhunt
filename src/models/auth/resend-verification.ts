import crypto from 'crypto';
import { findUserByEmail, setVerificationToken } from '../../data/auth-data';
import { normalizeEmail } from '../../lib/validate/normalize-email';
import { sendEmail } from '../../lib/email/send-email';
import {
  VERIFICATION_TOKEN_TTL_MS,
  verificationEmail,
} from '../../lib/email/templates/verification-email';

/**
 * Mints a fresh verification link for an account that has not been verified.
 *
 * The hard gate on login makes this endpoint load-bearing rather than a
 * convenience: registration cannot fail on a bad mail send without it, one lost
 * email would leave an account that can never be signed into and whose address
 * can never be registered again.
 *
 * Does nothing for an unknown or already-verified address, and the caller
 * replies the same in every case -- otherwise this becomes a cheap way to test
 * which addresses have accounts.
 */
export async function resendVerification(email: string): Promise<void> {
  const normalized = normalizeEmail(email);

  const user = await findUserByEmail(normalized);
  if (!user || user.email_verified_at) return;

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  await setVerificationToken(normalized, token, expiresAt);

  const { subject, html, text } = verificationEmail(user.display_name, token);
  await sendEmail({ to: user.email, subject, html, text });
}
