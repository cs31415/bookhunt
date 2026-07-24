import { getBookBySlug, getLibraryEntry } from '../../data/books-data';
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
 * Resolves a book by slug. Falls back to a live provider search (no catalog
 * write) when the slug doesn't match an existing book and an author-slug
 * hint is given - this is how a not-yet-cataloged search result's detail
 * page can always load. See LOS-127.
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

  return {
    id: 0,
    slug,
    title: match.title,
    author_id: 0,
    year: match.year,
    publisher: match.publisher,
    pages: match.pages,
    rating: match.rating,
    subjects: match.categories,
    moods: match.moods,
    genres: [],
    themes: [],
    hue: '#6f7a55',
    blurb: match.blurb ?? '',
    cover_url: match.coverUrl,
    google_books_id: match.googleBooksId,
    isbn13: match.isbn13,
    language: match.language,
    related: [],
    author_name: match.authors.join(', ') || deslugify(authorSlug),
    author_slug: authorSlug,
    cataloged: false as const,
  };
}
