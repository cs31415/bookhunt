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
 */
export function tokenizeQuery(query: string): string[] {
  const terms = query.split(/[\s,]+/).filter(Boolean);
  const content = terms.filter((t) => !STOP_WORDS.has(t));
  return content.length > 0 ? content : terms;
}
