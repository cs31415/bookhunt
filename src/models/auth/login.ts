import { findUserByEmail as findUser } from '../../data/auth-data';
import { normalizeEmail } from '../../lib/validate/normalize-email';

/**
 * fn_find_user_by_email already matches case-insensitively, but not on
 * surrounding whitespace -- and an address pasted from a password manager or
 * autofilled on a phone routinely arrives with a trailing space, which used to
 * read as "no such account".
 */
export async function findUserByEmail(email: string) {
  return findUser(normalizeEmail(email));
}
