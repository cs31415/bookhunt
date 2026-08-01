import { pool } from '../lib/db';

export interface MatchImportRowsParams {
  /** One space-joined token string per row, already lowercased. */
  terms: string[];
  /** The full lowercased title per row, index-aligned with `terms`. */
  phrases: string[];
  userId: number | null;
  /** Candidates per row, before the caller re-ranks them. */
  limit: number;
}

/**
 * Catalog candidates for a whole batch of import rows in one query. Rows come
 * back tagged with `row_index`, not grouped — the caller puts them back together.
 */
export async function matchImportRows(params: MatchImportRowsParams) {
  const result = await pool.query('SELECT * FROM fn_match_import_rows($1, $2, $3, $4)', [
    params.terms,
    params.phrases,
    params.userId,
    params.limit,
  ]);
  return result.rows;
}
