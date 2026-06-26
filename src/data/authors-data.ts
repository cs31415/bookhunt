import { pool } from '../lib/db';

export async function getAuthorBySlug(slug: string) {
  const result = await pool.query(
    'SELECT * FROM sp_get_author_by_slug($1)',
    [slug],
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function getBooksByAuthor(authorId: number) {
  const result = await pool.query(
    'SELECT * FROM sp_get_books_by_author($1)',
    [authorId],
  );
  return result.rows;
}
