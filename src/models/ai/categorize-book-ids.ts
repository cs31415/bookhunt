import { pool } from '../../lib/db';
import { categorizeBooks, CategorizedBook } from './categorize-books';

/**
 * Matches the import client's default rowsPerRequest, and the backfill's, so
 * every batched path asks the model the same size question.
 */
const BATCH_SIZE = 20;

/** A cap on what one request can spend, since the caller supplies the list. */
const MAX_BOOKS = 200;

/**
 * Categorize books by id, in batches, skipping any that are already tagged.
 *
 * The import adds books one request at a time -- concurrently -- so there is no
 * point in a batch at which the server can see them together. This is that
 * point: the client sends the ids once the import is done. Batching is the
 * whole mechanism, since a model shown one book describes that book and only a
 * batch lets it group.
 */
export async function categorizeBookIds(bookIds: number[]): Promise<CategorizedBook[]> {
  const ids = [...new Set(bookIds)].slice(0, MAX_BOOKS);
  if (ids.length === 0) return [];

  // Already-tagged books are dropped here rather than inside categorizeBooks so
  // a re-import of a mostly-known shelf costs nothing.
  const { rows } = await pool.query(
    `SELECT b.id, b.title, a.name AS author_name
     FROM books b JOIN authors a ON a.id = b.author_id
     WHERE b.id = ANY($1)
       AND (COALESCE(array_length(b.themes, 1), 0) = 0 OR COALESCE(array_length(b.moods, 1), 0) = 0)
     ORDER BY b.id`,
    [ids],
  );

  const books = rows.map((row) => ({ id: row.id, title: row.title, authorName: row.author_name }));
  const categorized: CategorizedBook[] = [];

  // Sequential: categorizeBooks re-reads the vocabulary per call, so each batch
  // feeds the next one's prompt. In parallel they would all see the same stale
  // vocabulary and converge on nothing.
  for (let offset = 0; offset < books.length; offset += BATCH_SIZE) {
    categorized.push(...(await categorizeBooks(books.slice(offset, offset + BATCH_SIZE))));
  }

  return categorized;
}
