import { unpinSearch as unpinSearchData } from '../../data/canned-searches-data';

/**
 * Unpin a search. Idempotent by design -- unpinning something that is not
 * pinned leaves the reader in exactly the state they asked for, so the caller
 * gets a success either way rather than an error about a race it cannot fix.
 */
export async function unpinSearch(userId: number, cannedSearchId: number): Promise<void> {
  await unpinSearchData(userId, cannedSearchId);
}
