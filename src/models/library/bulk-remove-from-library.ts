import { removeManyFromLibrary } from '../../data/library-data';

/**
 * Remove several books from a reader's library at once.
 *
 * Deliberately thin next to bulk-add: adding has to upsert a catalog row per
 * book and then categorize the batch, while removing is one statement and has
 * nothing to do afterwards. The books themselves stay in the catalog — they are
 * shared, and another reader may own the same ones.
 *
 * `removed` can be lower than the ids passed. An id the reader does not own
 * matches nothing, which is not an error worth failing the batch over: the
 * caller asked for those books to be out of their library, and they are.
 */
export async function bulkRemoveFromLibrary(userId: number, bookIds: number[]) {
  // The SQL is a set operation, so a repeated id would be counted once by the
  // database anyway — but dedupe here too so `removed` can be compared against
  // what the caller sent without the duplicate making it look like a failure.
  const unique = [...new Set(bookIds)];
  const removed = await bulkRemoveOrZero(userId, unique);
  return { removed, requested: unique.length };
}

async function bulkRemoveOrZero(userId: number, bookIds: number[]): Promise<number> {
  if (bookIds.length === 0) return 0;
  return removeManyFromLibrary(userId, bookIds);
}
