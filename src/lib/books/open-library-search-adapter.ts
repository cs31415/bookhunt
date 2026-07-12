import { throttleOpenLibrary, OPENLIBRARY_API_URL, OPENLIBRARY_COVERS_URL } from './open-library-rate-limiter';
import { SearchResult } from './books-types';

export async function searchOpenLibrary(query: string, limit: number): Promise<SearchResult[]> {
  await throttleOpenLibrary();

  const url = `${OPENLIBRARY_API_URL}/search.json?q=${encodeURIComponent(query.trim())}&limit=${limit}&fields=key,title,author_name,cover_i,first_publish_year,isbn,edition_key,subject`;

  let response: globalThis.Response;
  try {
    response = await fetch(url);
  } catch {
    return [];
  }

  if (!response.ok) {
    return [];
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    return [];
  }

  const docs: any[] = data.docs || [];

  return docs.map((doc: any) => {
    const isbns: string[] = doc.isbn || [];
    const isbn13 = isbns.find((id) => id.length === 13) || null;
    const coverUrl = doc.cover_i
      ? `${OPENLIBRARY_COVERS_URL}/b/id/${doc.cover_i}-M.jpg`
      : null;
    const editionKeys: string[] = doc.edition_key || [];
    return {
      googleBooksId: null,
      openLibraryId: editionKeys[0] || null,
      title: doc.title || '',
      authors: doc.author_name || [],
      year: doc.first_publish_year || null,
      publisher: null,
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
