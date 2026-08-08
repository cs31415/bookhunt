export const MIN_PASSWORD_LENGTH = 8;

// bcrypt truncates at 72 bytes, so anything past that is silently not part of
// the password. Rejecting is honest; accepting would mean two different long
// passwords could unlock the same account.
const MAX_PASSWORD_LENGTH = 72;

/**
 * Returns a message describing what is wrong, or null when the password is
 * acceptable. Callers surface the message as a 400 -- these strings are read by
 * the person filling in the form, not only by the log.
 */
export function validatePassword(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return 'Password is required.';
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
