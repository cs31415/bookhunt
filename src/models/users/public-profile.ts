import { getPublicLibrary, getPublicProfile } from '../../data/users-data';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 60;

export interface PublicProfile {
  handle: string;
  displayName: string;
  joinedAt: string;
  counts: {
    total: number;
    reading: number;
    finished: number;
    favorites: number;
  };
}

/** Null for an unknown handle and for a private one alike; the caller 404s both. */
export async function publicProfile(handle: string): Promise<PublicProfile | null> {
  const row = await getPublicProfile(handle);
  if (!row) return null;

  return {
    handle: row.handle,
    displayName: row.display_name,
    joinedAt: row.created_at,
    counts: {
      total: Number(row.total_books),
      reading: Number(row.reading_count),
      finished: Number(row.finished_count),
      favorites: Number(row.favorite_count),
    },
  };
}

export interface PublicLibraryQuery {
  page?: unknown;
  limit?: unknown;
  status?: unknown;
  favorites?: unknown;
}

const STATUSES = new Set(['queued', 'reading', 'finished', 'abandoned']);

export async function publicLibrary(handle: string, query: PublicLibraryQuery) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.limit) || DEFAULT_PAGE_SIZE));

  // An unrecognised status narrows to nothing rather than being ignored: a
  // typo that quietly returned the whole shelf would look like it worked.
  const status =
    typeof query.status === 'string' && STATUSES.has(query.status) ? query.status : null;
  if (typeof query.status === 'string' && status === null) {
    return { entries: [], total: 0, page, pageSize };
  }

  const rows = await getPublicLibrary(
    handle,
    status,
    query.favorites === 'true',
    pageSize,
    (page - 1) * pageSize,
  );

  return {
    entries: rows,
    // The window count comes back on every row; no rows means no entries.
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page,
    pageSize,
  };
}
