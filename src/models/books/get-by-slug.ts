import { getBookBySlug, getLibraryEntry, enrichThinBookRow } from '../../data/books-data';
import { upsertBook } from '../../data/library-data';
import { searchBooks } from '../ai/search';
import { getBooksProviderAdapter } from '../../lib/books/get-books-provider-adapter';
import { BooksProvider, SearchResult } from '../../lib/books/books-types';
import { pickBestCandidate } from '../../lib/books/rank-candidates';
import { deslugify, slugifyName, authorSlugMatches } from '../../lib/slug';
import { cacheGet } from '../../lib/cache/cache-get';
import { cacheSet } from '../../lib/cache/cache-set';
import { cacheKey } from '../../lib/cache/cache-key';

export { getLibraryEntry };

/** Bump to retire remembered misses when resolveMatch itself changes. */
const RESOLVE_MISS_VERSION = 1;

/**
 * How long to stop re-asking providers about a book none of them had. Long
 * enough that opening the same page repeatedly is free, short enough that a
 * book a provider adds later gets picked up without anyone intervening.
 */
const RESOLVE_MISS_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface ProviderIdHint {
  source: BooksProvider;
  id: string;
}

async function resolveMatch(
  slug: string,
  authorSlug?: string,
  providerId?: ProviderIdHint,
): Promise<SearchResult | null> {
  if (providerId) {
    const adapter = getBooksProviderAdapter(providerId.source);
    if (adapter.getById) {
      try {
        const byId = await adapter.getById(providerId.id);
        if (byId) return byId;
      } catch (error) {
        console.error(`[books] getById(${providerId.source}) failed, falling back to text search:`, error);
      }
    }
  }

  const title = deslugify(slug);
  if (!title) return null;
  // Narrow with the author hint when we have one; otherwise search by title
  // alone so a bare /books/:slug URL (no ?a= hint) still resolves live.
  // No literal "by" here -- Google Books tolerates it, but Open Library's
  // search treats it as a literal token and returns zero matches.
  const query = authorSlug ? `${title} ${deslugify(authorSlug)}` : title;

  // Without an author hint we can't verify authorship, so take the top result.
  if (!authorSlug) {
    const [match] = await searchBooks(query, 1);
    return match ?? null;
  }

  /*
   * With a hint, pull a few candidates and score them rather than taking the
   * first that credits the author (LOS-361).
   *
   * The old rule was `find(matchesAuthorHint) ?? matches[0]`, and a Tamil
   * edition credits Morgan Housel exactly as well as the English one does -- so
   * whichever Google happened to rank first won, and
   * /books/the-psychology-of-money-tamil is the result. Its title became the
   * slug, so the wrong edition ended up in the URL rather than only in the
   * metadata.
   *
   * Falls back to the provider's top result when nothing scores, rather than
   * 404ing: providers sometimes omit author metadata entirely.
   */
  const matches = await searchBooks(query, 5);
  return pickBestCandidate(matches, title, authorSlug);
}

/**
 * A book nobody looked up: created from a title and an author alone, by an
 * import row that matched no provider (LOS-196). It has no cover, blurb, year
 * or page count, and no id to go and fetch them with.
 */
function isThin(book: { google_books_id?: string | null; openlibrary_id?: string | null }): boolean {
  return !book.google_books_id && !book.openlibrary_id;
}

/**
 * A book that was catalogued from a search result and never had its edition
 * details fetched.
 *
 * An import writes what the provider's *search* response carried, which reliably
 * omits publisher and often the description and page count -- fetching them at
 * import time costs one round trip per row, which is what made adding 300 books
 * take minutes (LOS-202). So the import skips it and this picks up the slack, on
 * the one occasion someone actually wants the detail.
 *
 * Unlike a thin row, this book knows exactly which edition it is. It needs the
 * detail endpoint for that id, not another search.
 */
function needsEditionDetails(book: {
  google_books_id?: string | null;
  openlibrary_id?: string | null;
  blurb?: string | null;
  publisher?: string | null;
  pages?: number | null;
}): boolean {
  if (isThin(book)) return false;
  return !book.blurb || !book.publisher || !book.pages;
}

/**
 * Fetch the edition detail for a book that already knows its provider id, and
 * fold in whatever was missing.
 *
 * Reuses enrichThinBookRow, whose COALESCE means nothing already on the row is
 * overwritten -- this only ever fills blanks.
 *
 * The attempt is remembered either way, so a book the provider has nothing more
 * to say about does not cost a request on every view.
 *
 * Remembering only a *wholly* empty answer was not enough. needsEditionDetails
 * is true when any one of blurb, publisher and pages is blank, and a provider
 * that has two of the three fills those two and leaves the third blank forever
 * -- so the row still qualified, and every single view fetched the same edition
 * again to learn the same thing. Open Library has no page count for OL35961335M,
 * which is how a warm-cache book detail request came to cost 1-2s of rate-limit
 * sleep (LOS-217).
 *
 * A complete fill makes needsEditionDetails false, so the key it leaves behind
 * is never read; it costs one write to keep the two paths the same shape.
 */
async function fillEditionDetails(book: any) {
  const key = cacheKey('books:edition-miss', RESOLVE_MISS_VERSION, book.slug);
  if (await cacheGet<true>(key)) return book;

  const source: BooksProvider = book.google_books_id ? 'google_books' : 'open_library';
  const adapter = getBooksProviderAdapter(source);
  if (!adapter?.getEditionDetails) return book;

  let details;
  try {
    details = await adapter.getEditionDetails(book.google_books_id ?? book.openlibrary_id);
  } catch (error) {
    // A provider being down must not take the detail page with it; the blanks
    // stay blank and the next view tries again.
    console.error(`[books] edition details for "${book.slug}" failed:`, error);
    return book;
  }

  // Asked and answered, whatever the answer was.
  await cacheSet(key, true, RESOLVE_MISS_TTL_SECONDS);

  if (!details.description && !details.publisher && !details.pages) {
    return book;
  }

  await enrichThinBookRow(book.id, {
    blurb: details.description,
    publisher: details.publisher,
    pages: details.pages,
  });

  return (await getBookBySlug(book.slug)) ?? book;
}

/**
 * Try once more to find a thin book at a provider, and fold in whatever comes
 * back.
 *
 * The live-resolve path below only runs when the slug misses the catalog, and a
 * thin row is a hit -- so without this a book typed in during an import would
 * stay a bare title forever. Opening its page is the natural moment to retry:
 * it is when someone wants the detail, and it costs one lookup.
 *
 * A miss is remembered so the next view is free. Only the miss is cached; a
 * success rewrites the row, after which isThin is false and none of this runs
 * again.
 *
 * Existing values win over the provider's. The reader typed this title and
 * author from their own shelf, and a fuzzy title search is exactly the thing
 * that might come back with a different edition's.
 */
async function enrichThinBook(book: any) {
  const key = cacheKey('books:resolve-miss', RESOLVE_MISS_VERSION, book.slug);
  if (await cacheGet<true>(key)) return book;

  let match: SearchResult | null = null;
  try {
    match = await resolveMatch(book.slug, book.author_slug ?? undefined);
  } catch (error) {
    // A provider being down should not take the detail page with it; the book
    // stays thin and the next view tries again.
    console.error(`[books] re-resolving thin book "${book.slug}" failed:`, error);
    return book;
  }

  if (!match || (!match.googleBooksId && !match.openLibraryId)) {
    await cacheSet(key, true, RESOLVE_MISS_TTL_SECONDS);
    return book;
  }

  // Updates this row by id. Not upsertBook: that matches on provider id, which
  // a thin row has none of, so it would insert a *second* book under a suffixed
  // slug and leave this one -- the one the library entry points at -- untouched.
  const enriched = await enrichThinBookRow(book.id, {
    googleBooksId: match.googleBooksId,
    openLibraryId: match.openLibraryId,
    year: match.year,
    publisher: match.publisher,
    pages: match.pages,
    rating: match.rating,
    subjects: match.categories,
    blurb: match.blurb,
    coverUrl: match.coverUrl,
    isbn13: match.isbn13,
    language: match.language,
  });

  // Another book already holds that provider id, so this thin row duplicates a
  // book the catalog has properly. Merging them is a bigger job; remember the
  // miss so we stop asking.
  if (!enriched) {
    await cacheSet(key, true, RESOLVE_MISS_TTL_SECONDS);
    return book;
  }

  return (await getBookBySlug(book.slug)) ?? book;
}

/**
 * Resolves a book by slug. On a miss - when the slug doesn't match an existing
 * book - the book is resolved live from a provider and persisted to the
 * catalog, so a not-yet-cataloged book's detail page both loads and is saved on
 * first view. See LOS-127, LOS-151. An author-slug hint (`?a=`) narrows the
 * live search, but a bare /books/:slug URL still resolves via a title-only
 * search rather than 404ing (LOS-155). When an author hint is given it must
 * match — both for a catalog hit (whose slug can collide with an unrelated
 * title) and for the live result — so `/books/anthem?a=ayn-rand` no longer
 * returns an unrelated book that merely shares the slug.
 *
 * When `providerId` is given, the exact provider edition is fetched by ID
 * first, so the detail page shows the same edition the search result
 * resolved to instead of a re-search that can land on a different one. See
 * LOS-135.
 */
export async function resolveBookBySlug(slug: string, authorSlug?: string, providerId?: ProviderIdHint) {
  const real = await getBookBySlug(slug);
  // A slug is only unique per title, not per author, so a catalog hit can be an
  // unrelated book that happens to share the slug. When an author hint is given,
  // require it to match before trusting the catalog row; otherwise fall through
  // to a live, author-narrowed resolve.
  if (real && (!authorSlug || authorSlugMatches(real.author_slug ?? '', authorSlug))) {
    if (isThin(real)) return { ...(await enrichThinBook(real)), cataloged: true as const };
    // Knows which edition it is, just never fetched the detail for it — the
    // shape an import leaves behind (LOS-202).
    if (needsEditionDetails(real)) {
      return { ...(await fillEditionDetails(real)), cataloged: true as const };
    }
    return { ...real, cataloged: true as const };
  }

  const match = await resolveMatch(slug, authorSlug, providerId);
  if (!match) return null;

  // Persist the resolved book (fn_upsert_book also upserts its author) so
  // subsequent requests hit the catalog path instead of re-resolving live
  // (LOS-151). fn_upsert_book links a book to a single author, so persist the
  // primary credited author, falling back to the deslugified author-slug hint
  // (or 'Unknown' when neither is available).
  const persisted = await upsertBook({
    googleBooksId: match.googleBooksId,
    openLibraryId: match.openLibraryId,
    source: match.googleBooksId ? 'google_books' : match.openLibraryId ? 'open_library' : undefined,
    slug,
    title: match.title,
    authorName: match.authors[0] || (authorSlug ? deslugify(authorSlug) : 'Unknown'),
    year: match.year,
    publisher: match.publisher,
    pages: match.pages,
    rating: match.rating,
    subjects: match.categories,
    blurb: match.blurb,
    coverUrl: match.coverUrl,
    isbn13: match.isbn13,
    language: match.language,
  });

  // Re-read through the catalog projection so the response shape (author_name,
  // author_slug, related, ...) matches a normally-cataloged book. The upsert may
  // have assigned a suffixed slug on conflict, so read back by its slug.
  const cataloged = await getBookBySlug(persisted.slug);
  return { ...(cataloged ?? persisted), cataloged: true as const };
}
