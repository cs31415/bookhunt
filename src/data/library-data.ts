import { pool } from '../lib/db';
import { BooksProvider } from '../lib/books/books-types';

export interface GetUserLibraryParams {
  limit: number;
  offset: number;
}

export async function getUserLibrary(userId: number, { limit, offset }: GetUserLibraryParams) {
  const result = await pool.query(
    'SELECT * FROM fn_get_user_library($1, $2, $3)',
    [userId, limit, offset],
  );
  return result.rows;
}

export async function getLibraryStats(userId: number) {
  const result = await pool.query('SELECT * FROM fn_library_stats($1)', [userId]);
  return result.rows[0].fn_library_stats;
}

export interface UpsertBookParams {
  googleBooksId?: string | null;
  openLibraryId?: string | null;
  source?: BooksProvider;
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

export async function upsertBook(params: UpsertBookParams) {
  const sql = 'SELECT * FROM fn_upsert_book($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)';
  const args = [
    params.googleBooksId ?? null,
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
    params.openLibraryId ?? null,
    params.source ?? 'google_books',
  ];
  console.log(`[sql] ${sql}`);
  console.log(`[sql] args:`, JSON.stringify(args));
  const result = await pool.query(sql, args);
  return result.rows[0];
}

export async function addToLibrary(userId: number, bookId: number, status: string) {
  const sql = 'SELECT * FROM fn_add_to_library($1, $2, $3)';
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
    'SELECT * FROM fn_update_library_entry($1, $2, $3, $4, $5, $6)',
    [userId, bookId, status, userRating, notes, review],
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function removeFromLibrary(userId: number, bookId: number) {
  const result = await pool.query(
    'SELECT * FROM fn_remove_from_library($1, $2)',
    [userId, bookId],
  );
  return result.rows[0]?.fn_remove_from_library as boolean;
}

export async function addUserRelated(userId: number, bookId: number, relatedBookId: number) {
  const result = await pool.query(
    'SELECT * FROM fn_add_user_related($1, $2, $3)',
    [userId, bookId, relatedBookId],
  );
  return result.rows[0].fn_add_user_related;
}

export async function removeUserRelated(userId: number, bookId: number, relatedBookId: number) {
  const result = await pool.query(
    'SELECT * FROM fn_remove_user_related($1, $2, $3)',
    [userId, bookId, relatedBookId],
  );
  return result.rows[0].fn_remove_user_related;
}
