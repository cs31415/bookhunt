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

export interface SearchUserLibraryParams {
  terms: string[] | null;
  phrase: string | null;
  status: string | null;
  sort: string;
  limit: number;
  offset: number;
}

export async function searchUserLibrary(userId: number, params: SearchUserLibraryParams) {
  const result = await pool.query(
    'SELECT * FROM fn_search_library($1, $2, $3, $4, $5, $6, $7)',
    [userId, params.terms, params.phrase, params.status, params.sort, params.limit, params.offset],
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
  const result = await pool.query(
    'SELECT * FROM fn_upsert_book($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)',
    args,
  );
  return result.rows[0];
}

export async function addToLibrary(userId: number, bookId: number, status: string) {
  const result = await pool.query(
    'SELECT * FROM fn_add_to_library($1, $2, $3)',
    [userId, bookId, status],
  );
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

/** Null when the user does not own the book; the WHERE is the ownership check. */
export async function setLibraryFavorite(userId: number, bookId: number, isFavorite: boolean) {
  const result = await pool.query(
    'SELECT * FROM fn_set_library_favorite($1, $2, $3)',
    [userId, bookId, isFavorite],
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/** Null when the user does not own the book; the WHERE is the ownership check. */
export async function setLibraryVisibility(userId: number, bookId: number, isHidden: boolean) {
  const result = await pool.query(
    'SELECT * FROM fn_set_library_visibility($1, $2, $3)',
    [userId, bookId, isHidden],
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

/** Returns how many entries were actually removed; ids the user does not own match nothing. */
export async function removeManyFromLibrary(userId: number, bookIds: number[]) {
  const result = await pool.query(
    'SELECT * FROM fn_remove_many_from_library($1, $2)',
    [userId, bookIds],
  );
  return result.rows[0]?.fn_remove_many_from_library as number;
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
