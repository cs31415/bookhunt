/**
 * Strips the punctuation ISBNs are written with, so `978-0-441-01359-3`,
 * `978 0 441 01359 3` and `9780441013593` compare equal. The trailing check
 * digit of an ISBN-10 may be `X`, hence uppercasing rather than digits-only.
 *
 * Returns null for anything that isn't a plausible ISBN, so a stray value in a
 * CSV column doesn't become a search query.
 */
export function normalizeIsbn(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (cleaned.length !== 10 && cleaned.length !== 13) return null;
  // Only an ISBN-10 may carry the X check digit, and only in last position.
  if (cleaned.slice(0, -1).includes('X')) return null;
  if (cleaned.length === 13 && cleaned.includes('X')) return null;
  return cleaned;
}

/**
 * Whether two ISBNs refer to the same edition, tolerating punctuation and the
 * ISBN-10/13 split. A 13-digit ISBN in the 978 range carries its 10-digit form
 * as the middle nine digits, so comparing those is enough without recomputing
 * check digits.
 */
export function isSameIsbn(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeIsbn(a);
  const right = normalizeIsbn(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const core = (isbn: string) => (isbn.length === 13 ? isbn.slice(3, 12) : isbn.slice(0, 9));
  // Only 978-prefixed ISBN-13s have an ISBN-10 equivalent; 979 has none.
  if (left.length === 13 && !left.startsWith('978')) return false;
  if (right.length === 13 && !right.startsWith('978')) return false;
  return core(left) === core(right);
}
