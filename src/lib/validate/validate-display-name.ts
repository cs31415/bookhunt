// VARCHAR(255) in the users table.
const MAX_DISPLAY_NAME_LENGTH = 255;

/**
 * Returns a message describing what is wrong, or null when the name is
 * acceptable. Whitespace-only counts as missing: it satisfies the NOT NULL
 * constraint but leaves the reader with a blank name everywhere it is shown.
 */
export function validateDisplayName(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'Display name is required.';
  }
  if (value.trim().length > MAX_DISPLAY_NAME_LENGTH) {
    return `Display name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters.`;
  }
  return null;
}
