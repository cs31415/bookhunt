import { matchLibraryEntries as matchLibraryEntriesData } from '../../data/ai-data';
import { throttleOpenLibrary, OPENLIBRARY_API_URL, OPENLIBRARY_COVERS_URL } from '../../lib/open-library-rate-limiter';

interface SearchResult {
  googleBooksId: string | null;
  openLibraryId: string | null;
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  pages: number | null;
  rating: number | null;
  coverUrl: string | null;
  isbn13: string | null;
  language: string | null;
  blurb: string | null;
  inLibrary: boolean;
  libraryStatus: string | null;
  source: 'google_books' | 'open_library';
}

async function searchOpenLibrary(query: string, limit: number): Promise<SearchResult[]> {
  await throttleOpenLibrary();

  const url = `${OPENLIBRARY_API_URL}/search.json?q=${encodeURIComponent(query.trim())}&limit=${limit}&fields=key,title,author_name,cover_i,first_publish_year,isbn,edition_key`;

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
      inLibrary: false,
      libraryStatus: null,
      source: 'open_library' as const,
    };
  });
}

export async function searchBooks(query: string, limit: number): Promise<SearchResult[]> {
  const maxResults = Math.min(Math.max(1, limit), 40);
  let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query.trim())}&maxResults=${maxResults}`;
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    url += `&key=${process.env.GOOGLE_BOOKS_API_KEY}`;
  }

  let gResponse: globalThis.Response;
  try {
    gResponse = await fetch(url);
  } catch {
    return searchOpenLibrary(query, maxResults);
  }

  if (!gResponse.ok) {
    return searchOpenLibrary(query, maxResults);
  }

  const data: any = await gResponse.json();
  const items: any[] = data.items || [];

  if (items.length === 0) {
    return searchOpenLibrary(query, maxResults);
  }

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
      inLibrary: false,
      libraryStatus: null,
      source: 'google_books' as const,
    };
  });
}

export interface LibraryMatchable {
  googleBooksId: string | null;
  isbn13: string | null;
  inLibrary: boolean;
  libraryStatus: string | null;
}

export async function matchLibraryEntries(userId: number, books: LibraryMatchable[]) {
  const googleIds = books.map((b) => b.googleBooksId).filter((id): id is string => Boolean(id));
  const isbns = books.map((b) => b.isbn13).filter(Boolean) as string[];

  const rows = await matchLibraryEntriesData(userId, googleIds, isbns);

  const byGoogleId = new Map<string, string>();
  const byIsbn = new Map<string, string>();
  for (const row of rows) {
    if (row.google_books_id) byGoogleId.set(row.google_books_id, row.status);
    if (row.isbn13) byIsbn.set(row.isbn13, row.status);
  }

  for (const book of books) {
    const status =
      (book.googleBooksId ? byGoogleId.get(book.googleBooksId) : undefined) ||
      (book.isbn13 ? byIsbn.get(book.isbn13) : undefined);
    if (status) {
      book.inLibrary = true;
      book.libraryStatus = status;
    }
  }
}
