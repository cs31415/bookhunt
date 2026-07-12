import { getBookBySlug, getLibraryEntry } from '../../data/books-data';
import { searchBooks } from '../ai/search';

export { getLibraryEntry };

function deslugify(value: string): string {
  return value.replace(/-/g, ' ').trim();
}

/**
 * Resolves a book by slug. Falls back to a live provider search (no catalog
 * write) when the slug doesn't match an existing book and an author-slug
 * hint is given - this is how a not-yet-cataloged search result's detail
 * page can always load. See LOS-127.
 */
export async function resolveBookBySlug(slug: string, authorSlug?: string) {
  const real = await getBookBySlug(slug);
  if (real) {
    return { ...real, cataloged: true as const };
  }

  if (!authorSlug) return null;

  const title = deslugify(slug);
  const author = deslugify(authorSlug);
  const [match] = await searchBooks(`${title} by ${author}`, 1);
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
    author_name: match.authors.join(', ') || author,
    author_slug: authorSlug,
    cataloged: false as const,
  };
}
