import crypto from 'crypto';
import { findUserByEmail, setResetToken } from '../../data/auth-data';
import { normalizeEmail } from '../../lib/validate/normalize-email';
import { sendEmail } from '../../lib/email/send-email';
import {
  RESET_TOKEN_TTL_MS,
  passwordResetEmail,
} from '../../lib/email/templates/password-reset-email';

/**
 * Issues a reset token and mails it. Until LOS-218 the token was stored and
 * nobody was ever told, so the flow could not actually be completed.
 *
 * Nothing happens when the address is unknown, and the caller replies the same
 * either way. Minting and mailing unconditionally would avoid a timing
 * difference, but at the price of letting anyone make this server send mail to
 * any address they like -- a worse problem than the one it solves.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = normalizeEmail(email);

  const user = await findUserByEmail(normalized);
  if (!user) return;

  const resetToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await setResetToken(normalized, resetToken, expiresAt);

  const { subject, html, text } = passwordResetEmail(resetToken);
  await sendEmail({ to: user.email, subject, html, text });
}
