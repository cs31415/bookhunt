import {
  CannedSearchRow,
  getActiveByIds,
  getLatestDraw,
  getPinnedForUser,
  getRandomActive,
  getRecentDraws,
  pruneDraws,
  recordDraw,
} from '../../data/canned-searches-data';
import { DEFAULT_ROW_SIZE, DRAW_HISTORY_LIMIT, MIN_SUGGESTIONS } from './pill-row';

export interface GetPillRowParams {
  /** Null for a guest, who has no pins or history stored server-side. */
  userId: number | null;
  /** A guest's pinned ids, kept in their browser and sent with the request. */
  pinnedIds: number[];
  /** A guest's current row, kept in their browser. Ignored when signed in. */
  drawIds?: number[];
  /** Total pills wanted, pinned included. */
  rowSize?: number;
  /** Whether to return the reader's earlier draws, for the < > arrows. */
  includeHistory?: boolean;
  /** Draw a new row instead of restoring the one the reader was looking at. */
  refresh?: boolean;
}

export interface PillRow {
  pinned: CannedSearchRow[];
  suggested: CannedSearchRow[];
  /** Earlier draws, newest first, excluding the row being returned. Empty for a guest. */
  history: CannedSearchRow[][];
}

/**
 * The row of pills for the Discover hero.
 *
 * The suggestions persist: reloading the page restores the row the reader was
 * last shown, and only the refresh glyph draws a new one. Rotating on every
 * load meant a reader who spotted something interesting, followed a link and
 * came back had no way to find it again -- which is also why every draw is
 * recorded for the back and forward arrows.
 */
export async function getPillRow({
  userId,
  pinnedIds,
  drawIds = [],
  rowSize = DEFAULT_ROW_SIZE,
  includeHistory = false,
  refresh = false,
}: GetPillRowParams): Promise<PillRow> {
  // Signed in, the database is the authority and whatever the client sent is
  // stale -- a guest who has since logged in still has the old ids in
  // localStorage until the merge clears them.
  const pinned = userId !== null ? await getPinnedForUser(userId) : await getActiveByIds(pinnedIds);
  const pinnedIdSet = new Set(pinned.map((search) => search.id));

  const restored = refresh ? [] : await restoreCurrentRow(userId, drawIds, pinnedIdSet);
  const isNewDraw = restored.length === 0;

  // Excluding the pinned ids is what keeps a pinned search from also turning up
  // in the random draw and appearing twice in the same row.
  const suggested = isNewDraw
    ? await getRandomActive(Math.max(MIN_SUGGESTIONS, rowSize - pinned.length), [...pinnedIdSet])
    : restored;

  if (userId === null) return { pinned, suggested, history: [] };

  // Read before recording, so a new draw does not show up as the first entry of
  // its own history.
  const recent = includeHistory ? await getRecentDraws(userId, DRAW_HISTORY_LIMIT) : [];
  // When the row was restored, the newest stored draw *is* the row in front of
  // the reader, so it is not something to navigate back to.
  const earlier = isNewDraw ? recent : recent.slice(1);

  if (isNewDraw) {
    await recordDraw(userId, suggested.map((search) => search.id));
    await pruneDraws(userId, DRAW_HISTORY_LIMIT);
  }

  return { pinned, suggested, history: await resolveDraws(earlier) };
}

/**
 * The row the reader was last looking at, or empty if there is not one to
 * restore. Searches pinned since are dropped: they are about to render as
 * pinned pills, and a row must never show the same search twice.
 */
async function restoreCurrentRow(
  userId: number | null,
  drawIds: number[],
  pinnedIdSet: Set<number>,
): Promise<CannedSearchRow[]> {
  const ids = userId !== null ? (await getLatestDraw(userId))?.searchIds ?? [] : drawIds;
  if (ids.length === 0) return [];

  // getActiveByIds also drops anything retired since the draw, so a stale row
  // comes back shorter rather than broken.
  const searches = await getActiveByIds(ids);
  return searches.filter((search) => !pinnedIdSet.has(search.id));
}

/**
 * Resolve stored draws to searches, newest first.
 *
 * One round trip for all of them, then regrouped in memory: twenty draws of six
 * would otherwise be twenty queries to render a pair of arrows.
 */
async function resolveDraws(draws: { searchIds: number[] }[]): Promise<CannedSearchRow[][]> {
  if (draws.length === 0) return [];

  const searches = await getActiveByIds([...new Set(draws.flatMap((draw) => draw.searchIds))]);
  const byId = new Map(searches.map((search) => [search.id, search]));

  return draws
    .map((draw) => draw.searchIds.flatMap((id) => byId.get(id) ?? []))
    .filter((draw) => draw.length > 0);
}
