import { EditionDetails, SearchResult } from './books-types';

function withApiKey(url: string): string {
  return process.env.GOOGLE_BOOKS_API_KEY ? `${url}&key=${process.env.GOOGLE_BOOKS_API_KEY}` : url;
}

export async function searchGoogleBooks(query: string, limit: number): Promise<SearchResult[]> {
  const url = withApiKey(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query.trim())}&maxResults=${limit}`,
  );

  let response: globalThis.Response;
  try {
    response = await fetch(url);
  } catch {
    return [];
  }

  if (!response.ok) {
    return [];
  }

  const data: any = await response.json();
  const items: any[] = data.items || [];

  return items.map((item: any) => {
    const info = item.volumeInfo || {};
    const identifiers = info.industryIdentifiers || [];
    const isbn13Entry = identifiers.find((id: any) => id.type === 'ISBN_13');
    return {
      googleBooksId: item.id,
      openLibraryId: null,
      title: info.title,
      authors: info.authors || [],
      year: info.publishedDate ? parseInt(info.publishedDate.substring(0, 4), 10) : null,
      publisher: info.publisher || null,
      pages: info.pageCount || null,
      rating: info.averageRating || null,
      coverUrl: info.imageLinks?.thumbnail?.replace('http://', 'https://') || null,
      isbn13: isbn13Entry?.identifier || null,
      language: info.language || null,
      blurb: info.description || null,
      categories: info.categories || [],
      moods: [],
      inLibrary: false,
      libraryStatus: null,
      source: 'google_books' as const,
    };
  });
}

export async function getGoogleBooksEditionDetails(googleBooksId: string): Promise<EditionDetails> {
  const empty: EditionDetails = { description: null, publisher: null, pages: null };
  const url = withApiKey(`https://www.googleapis.com/books/v1/volumes/${googleBooksId}?`);

  let response: globalThis.Response;
  try {
    response = await fetch(url);
  } catch {
    return empty;
  }

  if (!response.ok) {
    return empty;
  }

  const data: any = await response.json();
  const info = data.volumeInfo || {};

  return {
    description: info.description || null,
    publisher: info.publisher || null,
    pages: info.pageCount || null,
  };
}
