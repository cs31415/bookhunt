import { pool } from '../lib/db';

export async function findBookByTitle(title: string) {
  const result = await pool.query(
    'SELECT id FROM books WHERE LOWER(title) LIKE $1',
    [`%${title.toLowerCase()}%`],
  );
  return result.rows.length > 0 ? result.rows[0].id as number : null;
}
