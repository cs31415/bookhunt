import { pool } from '../lib/db';

export interface SearchBooksParams {
  terms: string[] | null;
  phrase: string | null;
  subjects: string[] | null;
  moods: string[] | null;
  decade: number | null;
  authorSlug: string | null;
  userId: number | null;
  status: string | null;
  inLibraryOnly: boolean;
  sort: string;
  limit: number;
  offset: number;
}

export async function searchBooks(params: SearchBooksParams) {
  const sql = 'SELECT * FROM fn_search_books($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)';
  const args = [
    params.terms,
    params.phrase,
    params.subjects,
    params.moods,
    params.decade,
    params.authorSlug,
    params.userId,
    params.status,
    params.inLibraryOnly,
    params.sort,
    params.limit,
    params.offset,
  ];
  const result = await pool.query(sql, args);
  return result.rows;
}

export async function getSearchFacets() {
  const result = await pool.query('SELECT * FROM fn_search_facets()');
  return result.rows[0];
}
