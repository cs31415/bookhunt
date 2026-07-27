import { getBookBySlug, getLibraryEntry } from '../../data/books-data';
import { upsertBook } from '../../data/library-data';
import { searchBooks } from '../ai/search';
import { getBooksProviderAdapter } from '../../lib/books/get-books-provider-adapter';
import { BooksProvider, SearchResult } from '../../lib/books/books-types';
import { deslugify, slugifyName, authorSlugMatches } from '../../lib/slug';

export { getLibraryEntry };

export interface ProviderIdHint {
  source: BooksProvider;
  id: string;
}

// True when any author credited on the search result matches the requested
// author-slug hint. Used to reject a result whose slug happens to collide with
// the requested title but is by a different author (e.g. /books/anthem?a=ayn-rand
// resolving to an unrelated "Anthems and Anthem Composers").
function matchesAuthorHint(match: SearchResult, authorSlug: string): boolean {
  return match.authors.some((name) => authorSlugMatches(slugifyName(name), authorSlug));
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

  // With a hint, pull a few candidates and prefer the first that is actually by
  // the requested author, so a stronger-ranked title by a different author
  // doesn't win. Fall back to the top result when none credit the author
  // (providers sometimes omit author metadata) rather than 404ing.
  const matches = await searchBooks(query, 5);
  if (matches.length === 0) return null;
  return matches.find((match) => matchesAuthorHint(match, authorSlug)) ?? matches[0];
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
