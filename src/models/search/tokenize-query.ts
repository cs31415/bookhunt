// Ported from the prototype's localSearch (assets/lib.jsx) for scoring parity.
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'for', 'on', 'in', 'to', 'and', 'or', 'with',
  'about', 'best', 'good', 'some', 'that', 'i', 'can', 'my', 'me', 'is',
  'are', 'books', 'book', 'read', 'reading', 'novel', 'stories',
]);

/**
 * Splits a query into the terms the catalog scores against, dropping words that
 * appear in too many titles to narrow anything — unless that would leave nothing
 * to search for, in which case a query of only stop words searches for itself.
 *
 * Shared by free-text search and import matching so both ask the catalog the
 * same question: the import path passes these terms straight to
 * fn_match_import_rows rather than re-splitting titles in SQL.
 *
 * Hyphens and slashes separate words, because the catalog does not agree with
 * itself about them. fn_match_import_rows scores each term with
 * `title ILIKE '%term%'`, so a hyphen kept inside a term has to appear in the
 * stored title character for character: "half-lion" scores nothing against a
 * book catalogued as "Half - Lion", the row never surfaces, and re-importing
 * the reader's own file offers to add it a second time (LOS-203).
 *
 * A longer title survived this, because its other words still found the row —
 * "The Well-Trained Mind" matches on "mind" whatever the hyphen does. It is the
 * two-word hyphenated title, where the hyphenated word is the whole title, that
 * has nothing else to be found by.
 *
 * Apostrophes stay inside the word, matching how titles and publishers are
 * tokenized for scoring: "Frommer's" is one term, not "frommer" and a stray "s".
 */
export function tokenizeQuery(query: string): string[] {
  const terms = query.split(/[\s,;:/\\|–—-]+/).filter(Boolean);
  const content = terms.filter((t) => !STOP_WORDS.has(t));
  return content.length > 0 ? content : terms;
}
