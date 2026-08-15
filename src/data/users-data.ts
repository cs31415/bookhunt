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
