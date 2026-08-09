import { pool } from '../lib/db';

export async function getAuthorBySlug(slug: string) {
  const result = await pool.query(
    'SELECT * FROM fn_get_author_by_slug($1)',
    [slug],
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function getBooksByAuthor(authorId: number) {
  const result = await pool.query(
    'SELECT * FROM fn_get_books_by_author($1)',
    [authorId],
  );
  return result.rows;
}

// The NULL in both calls below is p_country, which the app stopped producing in
// LOS-228. The column and the parameter stay: both functions COALESCE, so
// passing NULL preserves the values already stored for the handful of authors
// that have one rather than erasing them, and writes none for anyone else.

export async function createAuthor(
  author: { slug: string; name: string; birthYear: number | null; bio: string | null },
) {
  const result = await pool.query(
    'SELECT * FROM fn_create_author($1, $2, $3, NULL, $4)',
    [author.slug, author.name, author.birthYear, author.bio],
  );
  return result.rows[0];
}

export async function updateAuthorDetails(
  authorId: number,
  details: { birthYear: number | null; bio: string | null },
) {
  const result = await pool.query(
    'SELECT * FROM fn_update_author_details($1, $2, NULL, $3)',
    [authorId, details.birthYear, details.bio],
  );
  return result.rows[0];
}
