import { upsertBook } from '../../data/library-data';
import { resolveEditionFields } from '../library/resolve-edition-fields';
import { BooksProvider } from '../../lib/books/books-types';

export interface ResolveOrCreateParams {
  googleBooksId?: string | null;
  openLibraryId?: string | null;
  title: string;
  authorName: string;
  year?: number | null;
  publisher?: string | null;
  pages?: number | null;
  rating?: number | null;
  subjects?: string[] | null;
  blurb?: string | null;
  coverUrl?: string | null;
  isbn13?: string | null;
  language?: string | null;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'book';
}

/**
 * Ensures a search result (from /ai/search or /search/metadata, which never
 * carry a catalog slug) has a catalog row, so its detail page can always
 * load on click - without adding it to the caller's library, a distinct
 * action from viewing. Reuses the same upsertBook the library-add flow
 * already uses; only decides not to touch library_entries.
 */
export async function resolveOrCreateBook(params: ResolveOrCreateParams) {
  const source: BooksProvider = params.googleBooksId ? 'google_books' : 'open_library';
  const resolved = await resolveEditionFields(params);
  return upsertBook({
    ...params,
    ...resolved,
    source,
    slug: slugify(params.title),
  });
}
