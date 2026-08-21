import { pool } from '../lib/db';

/**
 * Advisory only. Two people can pass this at the same moment and one of them
 * will still lose the INSERT, so the register path treats the resulting 23505
 * as the real answer.
 */
export async function isHandleAvailable(handle: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT fn_is_handle_available($1) AS available',
    [handle],
  );
  return rows[0].available as boolean;
}

/**
 * `setDiscoverable` says whether the caller sent the flag at all. A COALESCE
 * cannot carry a boolean on its own: NULL would be indistinguishable from
 * "make it false", which is the value that takes a public page down again.
 */
export async function updateUserProfile(
  userId: number,
  displayName: string | null,
  handle: string | null,
  isDiscoverable: boolean | null,
  setDiscoverable: boolean,
  preferences: Record<string, unknown> | null,
) {
  const { rows } = await pool.query(
    'SELECT * FROM fn_update_user_profile($1, $2, $3, $4, $5, $6)',
    [userId, displayName, handle, isDiscoverable, setDiscoverable, preferences],
  );
  return rows.length > 0 ? rows[0] : null;
}

/** No rows for an unknown handle and for a private one alike -- deliberately. */
export async function getPublicProfile(handle: string) {
  const { rows } = await pool.query('SELECT * FROM fn_get_public_profile($1)', [handle]);
  return rows.length > 0 ? rows[0] : null;
}

export interface PublicLibraryFilters {
  status: string | null;
  favoritesOnly: boolean;
  limit: number;
  offset: number;
  /** Title or author. Null means no search (LOS-304). */
  query: string | null;
  /** One category, as clicked on a pill. */
  subject: string | null;
}

export async function getPublicLibrary(handle: string, filters: PublicLibraryFilters) {
  const { rows } = await pool.query(
    'SELECT * FROM fn_get_public_library($1, $2, $3, $4, $5, $6, $7)',
    [
      handle,
      filters.status,
      filters.favoritesOnly,
      filters.limit,
      filters.offset,
      filters.query,
      filters.subject,
    ],
  );
  return rows;
}

/** The token a reader currently holds, or null if they have none. */
export async function getShareToken(userId: number): Promise<string | null> {
  const { rows } = await pool.query('SELECT fn_get_share_token($1) AS token', [userId]);
  return (rows[0]?.token as string | null) ?? null;
}

/** Pass null to revoke. Returns what is now stored, not what was asked for. */
export async function setShareToken(
  userId: number,
  token: string | null,
): Promise<string | null> {
  const { rows } = await pool.query('SELECT fn_set_share_token($1, $2) AS token', [userId, token]);
  return (rows[0]?.token as string | null) ?? null;
}

/** Null for an unknown or revoked token alike; the caller 404s both. */
export async function getProfileByToken(token: string) {
  const { rows } = await pool.query('SELECT * FROM fn_get_profile_by_token($1)', [token]);
  return rows.length > 0 ? rows[0] : null;
}

export async function getLibraryByToken(token: string, filters: PublicLibraryFilters) {
  const { rows } = await pool.query(
    'SELECT * FROM fn_get_library_by_token($1, $2, $3, $4, $5, $6, $7)',
    [
      token,
      filters.status,
      filters.favoritesOnly,
      filters.limit,
      filters.offset,
      filters.query,
      filters.subject,
    ],
  );
  return rows;
}

export async function searchUsers(query: string, limit: number) {
  const { rows } = await pool.query('SELECT * FROM fn_search_users($1, $2)', [query, limit]);
  return rows;
}

/** False when the handle is unknown, or is the caller's own. */
export async function addUserFavorite(userId: number, handle: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT fn_add_user_favorite($1, $2) AS ok', [userId, handle]);
  return rows[0].ok as boolean;
}

export async function removeUserFavorite(userId: number, handle: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT fn_remove_user_favorite($1, $2) AS ok', [userId, handle]);
  return rows[0].ok as boolean;
}

export async function listUserFavorites(userId: number) {
  const { rows } = await pool.query('SELECT * FROM fn_get_user_favorites($1)', [userId]);
  return rows;
}

/** Null when the handle is unknown; the caller reads that as a 404. */
export async function getFavoriteState(userId: number, handle: string) {
  const { rows } = await pool.query('SELECT * FROM fn_get_favorite_state($1, $2)', [userId, handle]);
  return rows.length > 0 ? rows[0] : null;
}
