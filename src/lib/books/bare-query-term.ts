/**
 * Flatten a title or author into a term safe to drop into a Google Books `q`,
 * quoted or bare.
 *
 * Punctuation is the thing being removed, because inside a quoted `intitle:` it
 * is matched literally and a single mark is enough to empty the result set:
 *
 *   intitle:"Celebrations!" inauthor:"Kindersley"  -> 0
 *   intitle:"Celebrations"  inauthor:"Kindersley"  -> the right book, top hit
 *
 * A colon is worse than literal — Google reads it as the start of a qualifier,
 * so an unquoted `Dune: Part Two` searches for "Dune" under a field named
 * "Dune". Quotes would nest inside the ones the caller adds.
 *
 * Apostrophes and hyphens stay. They sit inside words rather than between them,
 * and dropping them splits "D'Aulaires" and "Well-Trained" into fragments that
 * match the phrase less well, not more.
 */
export function bareQueryTerm(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}'’-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
