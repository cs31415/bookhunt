/** Trailing tokens that name a generation or a qualification, never the author. */
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'md', 'esq']);

/** Where one author's name ends and the next begins, in a single CSV field. */
const AUTHOR_SEPARATOR = /\s+(?:and|with|&)\s+|[,;&]/i;

/**
 * The surname of the first author named in a free-form author field.
 *
 * Google matches `inauthor:` against a volume's author strings, and it is
 * unforgiving about how much you give it. Anything the catalogue does not spell
 * the same way — a middle initial, a co-author, the word "and" — empties the
 * result set rather than loosening the match:
 *
 *   inauthor:"mortimer j adler and charles van doren"  -> 0
 *   inauthor:"adler"                                   -> the right book
 *   intitle:"Tools of Titans" inauthor:"Ferriss"       -> 1, the right book
 *
 * A surname is the part every edition spells alike, so it is what gets sent.
 * The first author is enough: `inauthor` is a filter, and one true author
 * filters as well as three.
 *
 * "Lastname, Firstname" needs no special case — the comma is a separator, so
 * the first chunk is the surname already.
 */
export function firstAuthorSurname(author: string | null | undefined): string | null {
  if (!author) return null;

  const [first = ''] = author.split(AUTHOR_SEPARATOR);
  const tokens = first
    .replace(/[^\p{L}\p{N}'’-]+/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);

  // Walk back past "Jr" and friends. A lone initial is skipped for the same
  // reason: "Adler M J" should still answer "Adler".
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.length < 2) continue;
    if (SUFFIXES.has(token.toLowerCase().replace(/[.'’-]/g, ''))) continue;
    return token;
  }

  return null;
}
