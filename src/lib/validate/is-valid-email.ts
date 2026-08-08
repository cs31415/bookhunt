// Deliberately loose. The only address this has to reject is one that cannot
// receive mail at all -- a full RFC 5322 pattern rejects valid addresses in
// practice, and the verification email is the real check either way: an address
// that does not exist never produces a signed-in account.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

// VARCHAR(255) in the users table; a longer value would be a database error
// rather than a 400.
const MAX_EMAIL_LENGTH = 255;

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(trimmed);
}
