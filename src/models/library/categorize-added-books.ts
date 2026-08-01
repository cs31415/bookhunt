import { categorizeBooks, BookToCategorize } from '../ai/categorize-books';

/**
 * Categorize books that have just been added to a library, without ever
 * failing the add.
 *
 * A book sitting in the library untagged is recoverable -- the backfill picks
 * it up later, and the library page simply shows fewer pills in the meantime.
 * A 500 on "add to library" is not recoverable: the user loses the add and has
 * no idea why. So every failure here is logged and swallowed.
 *
 * Callers pass the whole request's books at once. The import client already
 * batches at rowsPerRequest (default 20), so this works out to one LLM call
 * per import request with no batching machinery of its own.
 */
export async function categorizeAddedBooks(books: BookToCategorize[]): Promise<void> {
  if (books.length === 0) return;

  try {
    const categorized = await categorizeBooks(books);
    console.log(`[categorize] tagged ${categorized.length}/${books.length} newly added books`);
  } catch (error) {
    console.error('[categorize] failed, books were still added:', error);
  }
}
