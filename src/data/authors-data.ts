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

export async function createAuthor(
  author: { slug: string; name: string; birthYear: number | null; country: string | null; bio: string | null },
) {
  const result = await pool.query(
    'SELECT * FROM fn_create_author($1, $2, $3, $4, $5)',
    [author.slug, author.name, author.birthYear, author.country, author.bio],
  );
  return result.rows[0];
}

export async function updateAuthorDetails(
  authorId: number,
  details: { birthYear: number | null; country: string | null; bio: string | null },
) {
  const result = await pool.query(
    'SELECT * FROM fn_update_author_details($1, $2, $3, $4)',
    [authorId, details.birthYear, details.country, details.bio],
  );
  return result.rows[0];
}
