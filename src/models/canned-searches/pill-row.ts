/**
 * Shape of the Discover pill row. Lives server-side so the row obeys one set of
 * rules whether it was drawn for a signed-in reader or a guest, and so the
 * client can render exactly what it is handed.
 */

/** Total pills in the row, pinned included. */
export const DEFAULT_ROW_SIZE = 6;

/** A caller asking for more than this is asking for a wall, not a row. */
export const MAX_ROW_SIZE = 12;

/**
 * Suggestions shown even when the reader has filled the row with pins.
 * Without a floor, a reader who pins the maximum gets a row that never changes
 * -- and the rotation is the reason the catalog exists.
 */
export const MIN_SUGGESTIONS = 2;

/** Pins per reader. Past this the row stops reading as a set of suggestions. */
export const MAX_PINNED_SEARCHES = 6;

/** How many pinned ids a guest may send us, so one request cannot ask for the catalog. */
export const MAX_GUEST_PINNED_IDS = MAX_PINNED_SEARCHES * 2;

/**
 * Draws kept per reader for the < > arrows. Deep enough to walk back to
 * something glimpsed a few refreshes ago, shallow enough that the history stays
 * a convenience rather than a log.
 */
export const DRAW_HISTORY_LIMIT = 20;

/** Bounds on a search a reader types and saves as their own pill. */
export const MIN_SAVED_QUERY_LENGTH = 3;
export const MAX_SAVED_QUERY_LENGTH = 200;
