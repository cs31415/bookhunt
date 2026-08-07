import {
  countPins,
  getActiveByIds,
  getPinnedForUser,
  pinSearch as pinSearchData,
} from '../../data/canned-searches-data';
import { MAX_PINNED_SEARCHES } from './pill-row';
import { PinLimitReachedError, UnknownCannedSearchError } from './pin-errors';

export async function pinSearch(userId: number, cannedSearchId: number) {
  const [search] = await getActiveByIds([cannedSearchId]);
  if (!search) throw new UnknownCannedSearchError(cannedSearchId);

  // Checked here rather than enforced in SQL. Two requests racing could put a
  // reader one pin over the cap; the next pin then fails and the row renders
  // one pill wider, which is not worth a constraint trigger to prevent.
  if (await countPins(userId) >= MAX_PINNED_SEARCHES) {
    // Re-pinning something already pinned adds nothing, so it must not be
    // refused at the cap -- otherwise a reader at six pins gets an error for an
    // action that would have been a no-op.
    const pinned = await getPinnedForUser(userId);
    if (!pinned.some((existing) => existing.id === cannedSearchId)) {
      throw new PinLimitReachedError(MAX_PINNED_SEARCHES);
    }
  }

  await pinSearchData(userId, cannedSearchId);
  return search;
}
