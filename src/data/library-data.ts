import { pool } from '../lib/db';

export async function getUserLibrary(userId: number) {
  const result = await pool.query('SELECT * FROM sp_get_user_library($1)', [userId]);
  return result.rows;
}

export async function getLibraryStats(userId: number) {
  const result = await pool.query('SELECT * FROM sp_library_stats($1)', [userId]);
  return result.rows[0].sp_library_stats;
}

export interface UpsertBookParams {
  googleBooksId: string;
  slug: string;
  title: string;
  authorName: string;
  year?: number | null;
  publisher?: string | null;
  pages?: number | null;
  rating?: number | null;
  subjects?: string[] | null;
  blurb?: string | null;
  coverUrl?: string | null;
  isbn13?: string | null;
  language?: string | null;
  hue?: string | null;
}

export async function upsertBookFromGoogle(params: UpsertBookParams) {
  const sql = 'SELECT * FROM sp_upsert_book_from_google($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)';
  const args = [
    params.googleBooksId,
    params.slug,
    params.title,
    params.authorName,
    params.year ?? null,
    params.publisher ?? null,
    params.pages ?? null,
    params.rating ?? null,
    params.subjects ?? null,
    params.blurb ?? null,
    params.coverUrl ?? null,
    params.isbn13 ?? null,
    params.language ?? null,
    params.hue ?? null,
  ];
  console.log(`[sql] ${sql}`);
  console.log(`[sql] args:`, JSON.stringify(args));
  const result = await pool.query(sql, args);
  return result.rows[0];
}

export async function addToLibrary(userId: number, bookId: number, status: string) {
  const sql = 'SELECT * FROM sp_add_to_library($1, $2, $3)';
  const args = [userId, bookId, status];
  console.log(`[sql] ${sql}`);
  console.log(`[sql] args:`, JSON.stringify(args));
  const result = await pool.query(sql, args);
  return result.rows[0];
}

export async function updateLibraryEntry(
  userId: number,
  bookId: number,
  status: string | null,
  userRating: number | null,
  notes: string | null,
  review: string | null,
) {
  const result = await pool.query(
    'SELECT * FROM sp_update_library_entry($1, $2, $3, $4, $5, $6)',
    [userId, bookId, status, userRating, notes, review],
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function removeFromLibrary(userId: number, bookId: number) {
  const result = await pool.query(
    'SELECT * FROM sp_remove_from_library($1, $2)',
    [userId, bookId],
  );
  return result.rows[0]?.sp_remove_from_library as boolean;
}

export async function addUserRelated(userId: number, bookId: number, relatedBookId: number) {
  const result = await pool.query(
    'SELECT * FROM sp_add_user_related($1, $2, $3)',
    [userId, bookId, relatedBookId],
  );
  return result.rows[0].sp_add_user_related;
}

export async function removeUserRelated(userId: number, bookId: number, relatedBookId: number) {
  const result = await pool.query(
    'SELECT * FROM sp_remove_user_related($1, $2, $3)',
    [userId, bookId, relatedBookId],
  );
  return result.rows[0].sp_remove_user_related;
}
