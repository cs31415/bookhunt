import { matchLibraryEntries as matchLibraryEntriesData } from '../../data/ai-data';
import { parseBooksProviderConfig } from '../../lib/books/parse-books-provider-config';
import { searchWithFallback } from '../../lib/books/search-with-fallback';
import { SearchResult } from '../../lib/books/books-types';

export type { SearchResult } from '../../lib/books/books-types';

export async function searchBooks(query: string, limit: number): Promise<SearchResult[]> {
  const chain = parseBooksProviderConfig('BOOKS_SEARCH_PROVIDERS');
  const maxResults = Math.min(Math.max(1, limit), 40);
  return searchWithFallback(chain, query, maxResults);
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
