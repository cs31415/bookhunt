import { pool } from '../lib/db';

/** False when the slug matches no author. */
export async function addFavoriteAuthor(userId: number, slug: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT fn_add_favorite_author($1, $2) AS ok', [userId, slug]);
  return rows[0].ok as boolean;
}

export async function removeFavoriteAuthor(userId: number, slug: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT fn_remove_favorite_author($1, $2) AS ok', [userId, slug]);
  return rows[0].ok as boolean;
}

export async function listFavoriteAuthors(userId: number) {
  const { rows } = await pool.query('SELECT * FROM fn_get_favorite_authors($1)', [userId]);
  return rows;
}

export async function listPublicFavoriteAuthors(handle: string) {
  const { rows } = await pool.query('SELECT * FROM fn_get_public_favorite_authors($1)', [handle]);
  return rows;
}

/** False when the reader has not favourited that author, so the route can 404. */
export async function setFavoriteAuthorVisibility(
  userId: number,
  slug: string,
  isHidden: boolean,
): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT fn_set_favorite_author_visibility($1, $2, $3) AS ok',
    [userId, slug, isHidden],
  );
  return rows[0].ok as boolean;
}

export async function isFavoriteAuthor(userId: number, slug: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT fn_is_favorite_author($1, $2) AS ok', [userId, slug]);
  return rows[0].ok as boolean;
}
