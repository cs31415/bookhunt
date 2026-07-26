import { getBookBySlug, getLibraryEntry } from '../../data/books-data';
import { upsertBook } from '../../data/library-data';
import { searchBooks } from '../ai/search';
import { getBooksProviderAdapter } from '../../lib/books/get-books-provider-adapter';
import { BooksProvider, SearchResult } from '../../lib/books/books-types';

export { getLibraryEntry };

export interface ProviderIdHint {
  source: BooksProvider;
  id: string;
}

function deslugify(value: string): string {
  return value.replace(/-/g, ' ').trim();
}

async function resolveMatch(
  slug: string,
  authorSlug: string,
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
  const author = deslugify(authorSlug);
  // No literal "by" here -- Google Books tolerates it, but Open Library's
  // search treats it as a literal token and returns zero matches.
  const [match] = await searchBooks(`${title} ${author}`, 1);
  return match ?? null;
}

/**
 * Resolves a book by slug. On a miss - when the slug doesn't match an existing
 * book and an author-slug hint is given - the book is resolved live from a
 * provider and persisted to the catalog, so a not-yet-cataloged search result's
 * detail page both loads and is saved on first view. See LOS-127, LOS-151.
 *
 * When `providerId` is given, the exact provider edition is fetched by ID
 * first, so the detail page shows the same edition the search result
 * resolved to instead of a re-search that can land on a different one. See
 * LOS-135.
 */
export async function resolveBookBySlug(slug: string, authorSlug?: string, providerId?: ProviderIdHint) {
  const real = await getBookBySlug(slug);
  if (real) {
    return { ...real, cataloged: true as const };
  }

  if (!authorSlug) return null;

  const match = await resolveMatch(slug, authorSlug, providerId);
  if (!match) return null;

  // Persist the resolved book (fn_upsert_book also upserts its author) so
  // subsequent requests hit the catalog path instead of re-resolving live
  // (LOS-151). fn_upsert_book links a book to a single author, so persist the
  // primary credited author, falling back to the deslugified author-slug hint.
  const persisted = await upsertBook({
    googleBooksId: match.googleBooksId,
    openLibraryId: match.openLibraryId,
    source: match.googleBooksId ? 'google_books' : match.openLibraryId ? 'open_library' : undefined,
    slug,
    title: match.title,
    authorName: match.authors[0] || deslugify(authorSlug),
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
