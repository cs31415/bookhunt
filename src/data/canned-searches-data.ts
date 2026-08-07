import { pool } from '../lib/db';

export interface CannedSearchRow {
  id: number;
  query: string;
  category: string | null;
}

/** Fetch specific searches, dropping any that have been retired. */
export async function getActiveByIds(ids: number[]): Promise<CannedSearchRow[]> {
  // Guard rather than let it through: `= ANY('{}')` is never true, so the query
  // is a guaranteed round trip for an empty result. Guests with no pins are the
  // common case on this path.
  if (ids.length === 0) return [];

  const result = await pool.query(
    `SELECT id, query, category
       FROM canned_searches
      WHERE is_active AND id = ANY($1::int[])
      ORDER BY array_position($1::int[], id)`,
    [ids],
  );
  return result.rows;
}

/** A reader's pinned searches, in the order they pinned them. */
export async function getPinnedForUser(userId: number): Promise<CannedSearchRow[]> {
  const result = await pool.query(
    `SELECT c.id, c.query, c.category
       FROM user_pinned_searches p
       JOIN canned_searches c ON c.id = p.canned_search_id
      WHERE p.user_id = $1 AND c.is_active
      ORDER BY p.position, p.created_at`,
    [userId],
  );
  return result.rows;
}

/**
 * A random sample of active searches, at most one per subject, skipping ones
 * already on the row.
 *
 * One per subject is the whole point: drawn flat, a six-pill row regularly came
 * up with three variations on the same topic, which reads as a narrow catalog
 * rather than a broad one. The window picks a random row inside each subject,
 * then the outer ORDER BY random() chooses which subjects make the cut, so both
 * the subjects and the queries within them vary between draws.
 *
 * A consequence worth knowing: this can return fewer rows than asked for, since
 * it can never exceed the number of subjects in the catalog. With fifteen
 * subjects and MAX_ROW_SIZE at twelve there is headroom, but adding row size
 * without adding subjects would silently short the row.
 *
 * ORDER BY random() sorts the whole table, which is nothing at 600 rows and
 * says plainly what it means. Revisit if the catalog ever reaches five figures
 * -- at that size the usual move is a random offset into a keyset scan.
 */
export async function getRandomActive(limit: number, excludeIds: number[]): Promise<CannedSearchRow[]> {
  const result = await pool.query(
    `SELECT id, query, category
       FROM (
         SELECT id, query, category,
                ROW_NUMBER() OVER (PARTITION BY category ORDER BY random()) AS rank_in_category
           FROM canned_searches
          WHERE is_active
            AND created_by_user_id IS NULL
            AND NOT (id = ANY($1::int[]))
       ) ranked
      WHERE rank_in_category = 1
      ORDER BY random()
      LIMIT $2`,
    [excludeIds, limit],
  );
  return result.rows;
}

/**
 * Find or create a search from text a reader typed, and mark it theirs.
 *
 * ON CONFLICT rather than a select-then-insert, so two tabs saving the same
 * text cannot race into a unique violation. The conflict branch deliberately
 * leaves created_by_user_id alone: if the text already exists it is either a
 * catalog row, which must stay catalog, or another reader's saved search, whose
 * provenance is not this reader's to overwrite. Either way they get the id and
 * can pin it.
 */
export async function upsertUserSearch(userId: number, query: string): Promise<CannedSearchRow> {
  const result = await pool.query(
    `INSERT INTO canned_searches (query, category, created_by_user_id)
     VALUES ($1, 'saved', $2)
     ON CONFLICT (query) DO UPDATE SET query = canned_searches.query
     RETURNING id, query, category`,
    [query, userId],
  );
  return result.rows[0];
}

export interface CannedSearchDraw {
  id: number;
  searchIds: number[];
}

/** Record a row of suggestions as shown, so the reader can walk back to it. */
export async function recordDraw(userId: number, searchIds: number[]): Promise<void> {
  await pool.query(
    'INSERT INTO canned_search_draws (user_id, search_ids) VALUES ($1, $2::int[])',
    [userId, searchIds],
  );
}

/**
 * The row this reader is currently looking at.
 *
 * The pills hold still across page loads -- they change when the reader asks
 * them to and not before -- so a return visit restores this rather than
 * drawing something new.
 */
export async function getLatestDraw(userId: number): Promise<CannedSearchDraw | null> {
  const result = await pool.query(
    `SELECT id, search_ids
       FROM canned_search_draws
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [userId],
  );
  const row = result.rows[0];
  return row ? { id: row.id, searchIds: row.search_ids } : null;
}

export async function getRecentDraws(userId: number, limit: number): Promise<CannedSearchDraw[]> {
  const result = await pool.query(
    `SELECT id, search_ids
       FROM canned_search_draws
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2`,
    [userId, limit],
  );
  return result.rows.map((row) => ({ id: row.id, searchIds: row.search_ids }));
}

/**
 * Drop everything older than the most recent `keep` draws.
 *
 * The history is a convenience, not a record, and one reader leaning on the
 * refresh glyph would otherwise accumulate rows without limit.
 */
export async function pruneDraws(userId: number, keep: number): Promise<void> {
  await pool.query(
    `DELETE FROM canned_search_draws
      WHERE user_id = $1
        AND id NOT IN (
          SELECT id FROM canned_search_draws
           WHERE user_id = $1
           ORDER BY created_at DESC, id DESC
           LIMIT $2
        )`,
    [userId, keep],
  );
}

export async function countPins(userId: number): Promise<number> {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS count FROM user_pinned_searches WHERE user_id = $1',
    [userId],
  );
  return result.rows[0].count;
}

/**
 * Pin a search, appending it after whatever the reader has already pinned.
 *
 * Idempotent: pinning something already pinned is a no-op that still returns
 * the row. The ON CONFLICT assigns position to the value it already holds --
 * the standard idiom for an upsert that must RETURNING even when it changed
 * nothing, and specifically not EXCLUDED.position, which would shunt an
 * existing pin to the end of the row every time a double click landed.
 */
export async function pinSearch(userId: number, cannedSearchId: number) {
  const result = await pool.query(
    `INSERT INTO user_pinned_searches (user_id, canned_search_id, position)
     SELECT $1, $2, COALESCE(MAX(position) + 1, 0)
       FROM user_pinned_searches
      WHERE user_id = $1
     ON CONFLICT (user_id, canned_search_id)
     DO UPDATE SET position = user_pinned_searches.position
     RETURNING *`,
    [userId, cannedSearchId],
  );
  return result.rows[0];
}

/** Returns false when there was nothing to unpin. */
export async function unpinSearch(userId: number, cannedSearchId: number): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM user_pinned_searches WHERE user_id = $1 AND canned_search_id = $2',
    [userId, cannedSearchId],
  );
  return (result.rowCount ?? 0) > 0;
}
