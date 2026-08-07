import { countPins, pinSearch as pinSearchData, upsertUserSearch } from '../../data/canned-searches-data';
import { MAX_PINNED_SEARCHES, MAX_SAVED_QUERY_LENGTH, MIN_SAVED_QUERY_LENGTH } from './pill-row';
import { InvalidSavedQueryError, PinLimitReachedError } from './pin-errors';

/**
 * Save something a reader typed as one of their own pills, and pin it.
 *
 * Pinning is part of saving rather than a second step: a saved search is never
 * drawn as a suggestion (see getRandomActive), so an unpinned one would vanish
 * the moment it was created and look to the reader like the save had failed.
 */
export async function saveSearch(userId: number, rawQuery: string) {
  const query = normalise(rawQuery);
  if (query.length < MIN_SAVED_QUERY_LENGTH || query.length > MAX_SAVED_QUERY_LENGTH) {
    throw new InvalidSavedQueryError(MIN_SAVED_QUERY_LENGTH, MAX_SAVED_QUERY_LENGTH);
  }

  // Checked before the row is created, so a reader at the cap does not leave a
  // saved search behind that nothing points at.
  if (await countPins(userId) >= MAX_PINNED_SEARCHES) {
    throw new PinLimitReachedError(MAX_PINNED_SEARCHES);
  }

  const search = await upsertUserSearch(userId, query);
  await pinSearchData(userId, search.id);
  return search;
}

/**
 * Collapse whitespace and trim. Without it "books   about  bees " and "books
 * about bees" are different rows under the UNIQUE index, and a reader saving
 * the same thing twice would get two pills that read identically.
 */
function normalise(query: string): string {
  return query.replace(/\s+/g, ' ').trim();
}
