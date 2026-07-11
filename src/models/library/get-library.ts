import { getUserLibrary, getLibraryStats } from '../../data/library-data';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

export interface GetLibraryQuery {
  page?: unknown;
  limit?: unknown;
}

export async function getLibrary(userId: number, query: GetLibraryQuery = {}) {
  const page = Math.max(parseInt(String(query.page ?? '1'), 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(String(query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const offset = (page - 1) * limit;

  const [rows, stats] = await Promise.all([
    getUserLibrary(userId, { limit, offset }),
    getLibraryStats(userId),
  ]);

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

  return {
    entries: rows.map(({ total_count, ...entry }: any) => entry),
    stats,
    total,
    page,
    pageSize: limit,
  };
}
