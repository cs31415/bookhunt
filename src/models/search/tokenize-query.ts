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
 * Anything that is not a letter, a number or an apostrophe separates words,
 * because the catalog does not agree with itself about punctuation.
 * fn_match_import_rows scores each term with `title ILIKE '%term%'`, so
 * punctuation kept inside a term has to appear in the stored title character
 * for character. Two real cases, both of which made re-importing the reader's
 * own file offer to add a book they already owned (LOS-203):
 *
 *   "half-lion"     scores nothing against a book catalogued as "Half - Lion"
 *   "celebrations!" scores nothing against a book catalogued as "Celebrations"
 *
 * A longer title survives this, because its other words still find the row —
 * "The Well-Trained Mind" matches on "mind" whatever the hyphen does. It is the
 * title of one or two words, where the punctuated word is the whole title, that
 * has nothing else to be found by.
 *
 * Apostrophes stay inside the word, matching how titles and publishers are
 * tokenized for scoring: "Frommer's" is one term, not "frommer" and a stray "s".
 */
export function tokenizeQuery(query: string): string[] {
  const terms = query.split(/[^\p{L}\p{N}'’]+/u).filter(Boolean);
  const content = terms.filter((t) => !STOP_WORDS.has(t));
  return content.length > 0 ? content : terms;
}
