import { pool } from '../lib/db';

export async function getRecommendations(userId: number, limit: number) {
  const result = await pool.query(
    'SELECT * FROM fn_recommendations($1, $2)',
    [userId, limit],
  );
  return result.rows;
}
