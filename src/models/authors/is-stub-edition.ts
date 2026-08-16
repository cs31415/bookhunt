/**
 * A record the provider has heard of but knows nothing about.
 *
 * Google returns these freely: an id, an ISBN, a title, sometimes a year, and
 * nothing else. "Cryptonomicon 8c" is one -- no cover, no blurb, no page count,
 * no rating -- and it renders as a bare coloured rectangle with a title on it,
 * next to the real Cryptonomicon that has all four.
 *
 * Note this is not the same as "cannot be resolved". A stub resolves fine; it
 * has a googleBooksId. Every book in the catalog has at least one provider id,
 * so filtering on their absence would drop nothing at all. Thinness is the
 * thing that shows.
 *
 * All three signals have to be missing. A real book occasionally lacks a cover,
 * or a blurb, or a page count; a stub lacks the lot.
 */
export interface EditionFields {
  coverUrl?: string | null;
  blurb?: string | null;
  pages?: number | null;
}

/**
 * Deliberately takes no view of ownership.
 *
 * A guard on inLibrary looks right and is not: matchLibraryEntries is a fuzzy
 * title match, and it marks "Cryptonomicon 8c" as owned on the strength of the
 * reader's real Cryptonomicon. Trusting that flag would protect precisely the
 * records this exists to remove. The caller runs this before the match instead.
 */
export function isStubEdition(work: EditionFields): boolean {
  const hasCover = Boolean(work.coverUrl);
  const hasBlurb = Boolean(work.blurb && work.blurb.trim().length > 0);
  const hasPages = typeof work.pages === 'number' && work.pages > 0;

  return !hasCover && !hasBlurb && !hasPages;
}
