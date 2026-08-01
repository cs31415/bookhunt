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

  // Stats describe the whole library rather than the page, so a caller walking
  // every page needs them once — and asking per page meant an identical
  // fn_library_stats query per request, five of them on a 300-book library.
  // `total` is on every page, so pagination never depends on having them.
  const [rows, stats] = await Promise.all([
    getUserLibrary(userId, { limit, offset }),
    page === 1 ? getLibraryStats(userId) : Promise.resolve(undefined),
  ]);

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

  return {
    entries: rows.map(({ total_count, ...entry }: any) => entry),
    ...(stats !== undefined && { stats }),
    total,
    page,
    pageSize: limit,
  };
}
