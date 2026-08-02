import { pool } from '../lib/db';

export async function getBookBySlug(slug: string) {
  const result = await pool.query(
    'SELECT * FROM fn_get_book_by_slug($1)',
    [slug],
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export interface EnrichThinBookFields {
  googleBooksId?: string | null;
  openLibraryId?: string | null;
  year?: number | null;
  publisher?: string | null;
  pages?: number | null;
  rating?: number | null;
  subjects?: string[] | null;
  blurb?: string | null;
  coverUrl?: string | null;
  isbn13?: string | null;
  language?: string | null;
}

/** False when another book already holds that provider id — see fn_enrich_thin_book. */
export async function enrichThinBookRow(bookId: number, fields: EnrichThinBookFields): Promise<boolean> {
  const result = await pool.query('SELECT fn_enrich_thin_book($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) AS enriched', [
    bookId,
    fields.googleBooksId ?? null,
    fields.openLibraryId ?? null,
    fields.year ?? null,
    fields.publisher ?? null,
    fields.pages ?? null,
    fields.rating ?? null,
    fields.subjects ?? null,
    fields.blurb ?? null,
    fields.coverUrl ?? null,
    fields.isbn13 ?? null,
    fields.language ?? null,
  ]);
  return result.rows[0]?.enriched === true;
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
