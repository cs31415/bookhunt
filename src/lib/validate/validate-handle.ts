import { isReservedHandle } from './reserved-handles';

// VARCHAR(30) in the users table. Three is short enough to be worth having and
// long enough to be typed correctly from memory.
const MIN_HANDLE_LENGTH = 3;
const MAX_HANDLE_LENGTH = 30;

const HANDLE_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * Returns a message describing what is wrong, or null when the handle is
 * acceptable. Expects an already-normalized handle: case folding belongs to
 * normalizeHandle, so "Ada" is judged as "ada" rather than rejected outright.
 *
 * The leading-letter rule keeps a handle from ever looking like an id -- a bare
 * "42" at the root of the site reads as a database key, not a person.
 */
export function validateHandle(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'Handle is required.';
  }

  const handle = value.trim();

  if (handle.length < MIN_HANDLE_LENGTH || handle.length > MAX_HANDLE_LENGTH) {
    return `Handle must be between ${MIN_HANDLE_LENGTH} and ${MAX_HANDLE_LENGTH} characters.`;
  }

  if (!HANDLE_PATTERN.test(handle)) {
    if (/^[^a-z]/.test(handle)) {
      return 'Handle must start with a letter.';
    }
    return 'Handle can contain only letters, numbers and underscores.';
  }

  if (isReservedHandle(handle)) {
    return 'That handle is reserved.';
  }

  return null;
}
