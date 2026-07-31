import { EditionDetails, SearchResult } from './books-types';
import { loggedFetch } from './logged-fetch';
import { BooksProviderError } from './books-provider-error';
import { stripHtml } from '../text/strip-html';

function withApiKey(url: string): string {
  return process.env.GOOGLE_BOOKS_API_KEY ? `${url}&key=${process.env.GOOGLE_BOOKS_API_KEY}` : url;
}

export async function searchGoogleBooks(query: string, limit: number): Promise<SearchResult[]> {
  const url = withApiKey(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query.trim())}&maxResults=${limit}`,
  );

  // Throws rather than returning [] so callers can tell a failed lookup from a
  // book that genuinely isn't there — only the former is worth retrying.
  let response: globalThis.Response;
  try {
    response = await loggedFetch('google_books', url);
  } catch (error) {
    throw new BooksProviderError('google_books', null, error);
  }

  if (!response.ok) {
    throw new BooksProviderError('google_books', response.status);
  }

  const data: any = await response.json();
  const items: any[] = data.items || [];

  return items.map(mapGoogleBooksVolume);
}

function mapGoogleBooksVolume(item: any): SearchResult {
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
    // Google reports at most one publisher, and frequently omits it from search
    // results even for the right book — it's dependable only via the volume
    // detail endpoint (getEditionDetails). So an empty list here means "unknown",
    // never "no publisher", and scoring must not treat it as a mismatch.
    publishers: info.publisher ? [info.publisher] : [],
    pages: info.pageCount || null,
    rating: info.averageRating || null,
    coverUrl: info.imageLinks?.thumbnail?.replace('http://', 'https://') || null,
    isbn13: isbn13Entry?.identifier || null,
    language: info.language || null,
    blurb: stripHtml(info.description),
    categories: info.categories || [],
    moods: [],
    inLibrary: false,
    libraryStatus: null,
    source: 'google_books' as const,
  };
}

export async function getGoogleBooksById(googleBooksId: string): Promise<SearchResult | null> {
  const url = withApiKey(`https://www.googleapis.com/books/v1/volumes/${googleBooksId}?`);

  let response: globalThis.Response;
  try {
    response = await loggedFetch('google_books', url);
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const item: any = await response.json();
  if (!item?.id) {
    return null;
  }

  return mapGoogleBooksVolume(item);
}

export async function getGoogleBooksEditionDetails(googleBooksId: string): Promise<EditionDetails> {
  const empty: EditionDetails = { description: null, publisher: null, pages: null };
  const url = withApiKey(`https://www.googleapis.com/books/v1/volumes/${googleBooksId}?`);

  let response: globalThis.Response;
  try {
    response = await loggedFetch('google_books', url);
  } catch {
    return empty;
  }

  if (!response.ok) {
    return empty;
  }

  const data: any = await response.json();
  const info = data.volumeInfo || {};

  return {
    description: stripHtml(info.description),
    publisher: info.publisher || null,
    pages: info.pageCount || null,
  };
}
