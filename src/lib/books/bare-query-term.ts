/**
 * Flatten a title or author into a term safe to drop unquoted into a Google
 * Books `q`.
 *
 * Quotes would reimpose the exact-phrase match this form exists to avoid, and a
 * colon is worse than noise: Google reads `Dune: Part Two` as a qualifier named
 * "Dune", so a subtitled title silently searches for something else. Both go,
 * along with the whitespace that separated them.
 */
export function bareQueryTerm(value: string): string {
  return value
    .replace(/["():]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
