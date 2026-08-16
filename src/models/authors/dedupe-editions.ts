/**
 * Collapses repeated editions of the same book into one.
 *
 * The provider returns every edition it knows: Neal Stephenson's page carried
 * five copies of Snow Crash (1992, 2000, 2001, 2003, 2022) and two each of
 * Cryptonomicon, Seveneves, The Diamond Age and The System of the World. The
 * existing guard only compares googleBooksId and isbn13, and separate editions
 * differ in both, so every one of them came through.
 *
 * Grouped on the title alone, normalized for case and whitespace and nothing
 * else. Stripping punctuation or trailing tokens would fold "Cryptonomicon 8c"
 * into "Cryptonomicon" -- which may well be the same book, but the record does
 * not say so, and merging two genuinely different titles is worse than showing
 * one extra row.
 */

export interface EditionLike {
  title: string;
  year?: number | null;
  inLibrary?: boolean;
  bookId?: number | null;
}

function groupKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Which of two editions to keep.
 *
 * Ownership wins before recency, deliberately. Dropping the edition a reader
 * actually owns would take their own book off the author page and lose the
 * "in your library" mark with it -- a worse outcome than showing an older
 * cover. Recency decides between editions the reader owns none of, and a
 * cataloged row breaks a tie, since it has a slug and links to a real page.
 */
function isBetter(candidate: EditionLike, current: EditionLike): boolean {
  if (Boolean(candidate.inLibrary) !== Boolean(current.inLibrary)) {
    return Boolean(candidate.inLibrary);
  }

  const candidateYear = candidate.year ?? -Infinity;
  const currentYear = current.year ?? -Infinity;
  if (candidateYear !== currentYear) return candidateYear > currentYear;

  return Boolean(candidate.bookId) && !current.bookId;
}

/** Keeps the input order of the surviving editions, so callers can still sort. */
export function dedupeEditions<T extends EditionLike>(works: T[]): T[] {
  const best = new Map<string, T>();

  for (const work of works) {
    const key = groupKey(work.title);
    const current = best.get(key);
    if (!current || isBetter(work, current)) best.set(key, work);
  }

  const kept = new Set(best.values());
  return works.filter((work) => kept.has(work));
}
