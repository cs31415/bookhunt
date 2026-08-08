import { OPENLIBRARY_API_URL, OPENLIBRARY_COVERS_URL } from './open-library-rate-limiter';
import { loggedFetch } from './logged-fetch';
import { BooksProviderError } from './books-provider-error';
import { SearchResult } from './books-types';

export async function searchOpenLibrary(query: string, limit: number): Promise<SearchResult[]> {
  // `publisher` is requested explicitly (LOS-168): it's the only provider field
  // that can disambiguate books sharing a generic title, such as travel guides
  // with no author. Open Library returns it as an array aggregated over every
  // edition of the work.
  const url = `${OPENLIBRARY_API_URL}/search.json?q=${encodeURIComponent(query.trim())}&limit=${limit}&fields=key,title,author_name,cover_i,first_publish_year,isbn,edition_key,subject,publisher`;

  // Throws rather than returning [] so callers can tell a failed lookup from a
  // book that genuinely isn't there — only the former is worth retrying.
  let response: globalThis.Response;
  try {
    response = await loggedFetch('open_library', url);
  } catch (error) {
    throw new BooksProviderError('open_library', null, error);
  }

  if (!response.ok) {
    throw new BooksProviderError('open_library', response.status);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (error) {
    throw new BooksProviderError('open_library', response.status, error);
  }

  const docs: any[] = data.docs || [];

  return docs.map((doc: any) => {
    const isbns: string[] = doc.isbn || [];
    const isbn13 = isbns.find((id) => id.length === 13) || null;
    const coverUrl = doc.cover_i
      ? `${OPENLIBRARY_COVERS_URL}/b/id/${doc.cover_i}-M.jpg`
      : null;
    const editionKeys: string[] = doc.edition_key || [];
    const publishers: string[] = doc.publisher || [];
    return {
      googleBooksId: null,
      openLibraryId: editionKeys[0] || null,
      title: doc.title || '',
      authors: doc.author_name || [],
      year: doc.first_publish_year || null,
      publisher: publishers[0] || null,
      publishers,
      pages: null,
      rating: null,
      coverUrl,
      isbn13,
      language: null,
      blurb: null,
      categories: doc.subject || [],
      moods: [],
      inLibrary: false,
      libraryStatus: null,
      source: 'open_library' as const,
    };
  });
}
