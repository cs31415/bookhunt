import { pool } from '../lib/db';

export async function fetchBookContext(bookId: number) {
  const result = await pool.query(
    `SELECT b.title, a.name as author_name, b.blurb, b.subjects
     FROM books b JOIN authors a ON a.id = b.author_id
     WHERE b.id = $1`,
    [bookId],
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function getCachedSummary(bookId: number) {
  const result = await pool.query('SELECT * FROM fn_get_ai_summary($1)', [bookId]);
  if (result.rows.length > 0 && result.rows[0].summary) {
    return {
      bookId,
      summary: result.rows[0].summary,
      generatedAt: result.rows[0].generated_at,
    };
  }
  return null;
}

export async function saveSummary(bookId: number, summary: string) {
  const result = await pool.query('SELECT * FROM fn_save_ai_summary($1, $2)', [bookId, summary]);
  const row = result.rows[0];
  return {
    bookId: row.book_id,
    summary: row.summary,
    generatedAt: row.generated_at,
  };
}

export async function getBookGenresThemes(bookId: number) {
  const result = await pool.query(
    'SELECT genres, themes FROM books WHERE id = $1',
    [bookId],
  );
  if (
    result.rows.length > 0 &&
    result.rows[0].genres?.length > 0 &&
    result.rows[0].themes?.length > 0
  ) {
    return {
      genres: result.rows[0].genres as string[],
      themes: result.rows[0].themes as string[],
    };
  }
  return null;
}

export async function updateBookAiMetadata(bookId: number, genres: string[], themes: string[]) {
  await pool.query('SELECT fn_update_book_ai_metadata($1, $2, $3)', [bookId, genres, themes]);
}

export async function matchLibraryEntries(userId: number, googleIds: string[], isbns: string[]) {
  const result = await pool.query(
    `SELECT b.google_books_id, b.isbn13, le.status
     FROM library_entries le
     JOIN books b ON b.id = le.book_id
     WHERE le.user_id = $1
       AND (b.google_books_id = ANY($2) OR b.isbn13 = ANY($3))`,
    [userId, googleIds, isbns],
  );
  return result.rows;
}
