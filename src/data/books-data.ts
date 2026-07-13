import { pool } from '../lib/db';

export async function getBookBySlug(slug: string) {
  const result = await pool.query(
    'SELECT * FROM fn_get_book_by_slug($1)',
    [slug],
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function getLibraryEntry(userId: number, bookId: number) {
  const result = await pool.query(
    'SELECT * FROM library_entries WHERE user_id = $1 AND book_id = $2',
    [userId, bookId],
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function getBooksByIds(ids: number[]) {
  const result = await pool.query(
    'SELECT * FROM fn_get_books_by_ids($1)',
    [ids],
  );
  return result.rows;
}

export async function getBooksByGoogleIds(googleBooksIds: string[]) {
  const result = await pool.query(
    'SELECT * FROM fn_get_books_by_google_ids($1)',
    [googleBooksIds],
  );
  return result.rows;
}
