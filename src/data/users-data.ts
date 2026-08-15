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
) {
  const { rows } = await pool.query(
    'SELECT * FROM fn_update_user_profile($1, $2, $3, $4, $5)',
    [userId, displayName, handle, isDiscoverable, setDiscoverable],
  );
  return rows.length > 0 ? rows[0] : null;
}
