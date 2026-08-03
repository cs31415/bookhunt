/** Trailing tokens that name a generation or a qualification, never the author. */
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'md', 'esq']);

/**
 * Where one author's name ends and the next begins, in a single CSV field.
 *
 * Slashes and pipes are separators too. Without them "Tyson/Liu/Irion" reads as
 * one name whose last word is "Irion", and the query goes looking for the wrong
 * person entirely — which is how a row for "The Universe" came back with a book
 * by Curtis Irion (LOS-205).
 */
const AUTHOR_SEPARATOR = /\s+(?:and|with|&)\s+|[,;&/|]/i;

/**
 * The subset of separators that joins two *people*. A comma does not qualify:
 * "Adler, Mortimer J." is one person written backwards, and reading it as two
 * would answer "Mortimer".
 */
const CONJUNCTION = /\s+(?:and|with|&)\s+/i;

function tokensOf(name: string): string[] {
  return name
    .replace(/[^\p{L}\p{N}'’-]+/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * The last token that is a name rather than a suffix or an initial, so
 * "Adler M J" and "Martin Luther King Jr." both answer their surname.
 */
function surnameOf(tokens: string[]): string | null {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.length < 2) continue;
    if (SUFFIXES.has(token.toLowerCase().replace(/[.'’-]/g, ''))) continue;
    return token;
  }
  return null;
}

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

  const chunks = author.split(AUTHOR_SEPARATOR).map(tokensOf).filter((tokens) => tokens.length > 0);
  if (chunks.length === 0) return null;

  /*
   * "Ingri and Edgar Parin d'Aulaire" is one surname shared by two people, and
   * it is written on the last of them. Taking the first chunk answers "Ingri",
   * a forename, and sends the query after a stranger.
   *
   * A forename joined by "and" to a full name is what that shape looks like.
   * The conjunction is load-bearing: "Adler, Mortimer J." has the same token
   * counts but a comma, and is one person written backwards.
   *
   * "Tyson/Liu/Irion" is not it either — every chunk is one token, so each is
   * already a surname and the first one is the one wanted.
   */
  const last = chunks[chunks.length - 1];
  const shared =
    CONJUNCTION.test(author) && chunks.length > 1 && chunks[0].length === 1 && last.length > 1;

  return surnameOf(shared ? last : chunks[0]);
}
