import { matchLibraryEntries as matchLibraryEntriesData } from '../../data/ai-data';

interface SearchResult {
  googleBooksId: string;
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
    return [];
  }

  if (!gResponse.ok) {
    return [];
  }

  const data: any = await gResponse.json();
  const items = data.items || [];

  return items.map((item: any) => {
    const info = item.volumeInfo || {};
    const identifiers = info.industryIdentifiers || [];
    const isbn13Entry = identifiers.find((id: any) => id.type === 'ISBN_13');
    return {
      googleBooksId: item.id,
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
    };
  });
}

export async function matchLibraryEntries(userId: number, books: SearchResult[]) {
  const googleIds = books.map((b) => b.googleBooksId).filter(Boolean);
  const isbns = books.map((b) => b.isbn13).filter(Boolean) as string[];

  const rows = await matchLibraryEntriesData(userId, googleIds, isbns);

  const byGoogleId = new Map<string, string>();
  const byIsbn = new Map<string, string>();
  for (const row of rows) {
    if (row.google_books_id) byGoogleId.set(row.google_books_id, row.status);
    if (row.isbn13) byIsbn.set(row.isbn13, row.status);
  }

  for (const book of books) {
    const status = byGoogleId.get(book.googleBooksId) || (book.isbn13 ? byIsbn.get(book.isbn13) : undefined);
    if (status) {
      book.inLibrary = true;
      book.libraryStatus = status;
    }
  }
}
