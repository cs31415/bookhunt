import { getPublicLibrary, getPublicProfile, getPublicLibraryFacets } from '../../data/users-data';
import type { PublicLibraryFilters } from '../../data/users-data';

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
  /** Title or author (LOS-304). */
  q?: unknown;
  /** One category, as clicked on a pill. */
  subject?: unknown;
  /** One mood, and one theme (LOS-342). */
  mood?: unknown;
  theme?: unknown;
}

/**
 * Trimmed, with blank read as absent. A search box that has been typed into and
 * cleared again sends an empty string, and that means "no filter" rather than
 * "match the empty string".
 */
function asFilter(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const STATUSES = new Set(['queued', 'reading', 'finished', 'abandoned']);

export interface ParsedLibraryQuery {
  page: number;
  pageSize: number;
  /** True when the query asked for something that cannot match anything. */
  rejected: boolean;
  filters: PublicLibraryFilters;
}

/**
 * One parser for both addresses a shelf has: the handle and the share token
 * (LOS-305). Shared rather than copied, so search, categories, paging and the
 * unrecognised-status rule cannot come to differ between them.
 */
export function publicLibraryFilters(query: PublicLibraryQuery): ParsedLibraryQuery {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.limit) || DEFAULT_PAGE_SIZE));

  // An unrecognised status narrows to nothing rather than being ignored: a
  // typo that quietly returned the whole shelf would look like it worked.
  const status =
    typeof query.status === 'string' && STATUSES.has(query.status) ? query.status : null;

  return {
    page,
    pageSize,
    rejected: typeof query.status === 'string' && status === null,
    filters: {
      status,
      favoritesOnly: query.favorites === 'true',
      limit: pageSize,
      offset: (page - 1) * pageSize,
      query: asFilter(query.q),
      subject: asFilter(query.subject),
      mood: asFilter(query.mood),
      theme: asFilter(query.theme),
    },
  };
}

/**
 * The values a shelf's filters can take, over the whole shelf.
 *
 * Grouped into the shape the rail renders rather than returned as flat rows:
 * the caller wants "the moods", and doing the grouping here means the two
 * addresses a shelf has cannot come to group it differently.
 */
export interface ShelfFacets {
  subject: string[];
  mood: string[];
  theme: string[];
  status: string[];
}

export function groupFacets(rows: { facet: string; value: string }[]): ShelfFacets {
  const grouped: ShelfFacets = { subject: [], mood: [], theme: [], status: [] };
  for (const row of rows) {
    const bucket = grouped[row.facet as keyof ShelfFacets];
    if (bucket) bucket.push(row.value);
  }
  return grouped;
}

export async function publicLibraryFacets(handle: string): Promise<ShelfFacets> {
  return groupFacets(await getPublicLibraryFacets(handle));
}

/**
 * One reader's entry for one book, as a visitor may see it (LOS-360).
 *
 * Goes through the same function as the shelf, with its book filter set, rather
 * than a query of its own: the sharing gate lives in that SELECT, and a second
 * query would be a second place for it to drift out of step.
 *
 * Null when the reader has no such entry, when their page is not listed, and
 * when the book is hidden -- all of which are the same answer to a visitor, and
 * deliberately indistinguishable.
 */
export async function publicLibraryEntry(handle: string, bookId: number) {
  const rows = await getPublicLibrary(handle, {
    status: null,
    favoritesOnly: false,
    limit: 1,
    offset: 0,
    query: null,
    subject: null,
    mood: null,
    theme: null,
    bookId,
  });
  return rows[0] ?? null;
}

export async function publicLibrary(handle: string, query: PublicLibraryQuery) {
  const { page, pageSize, rejected, filters } = publicLibraryFilters(query);
  if (rejected) return { entries: [], total: 0, page, pageSize };

  const rows = await getPublicLibrary(handle, filters);

  return {
    entries: rows,
    // The window count comes back on every row; no rows means no entries.
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page,
    pageSize,
  };
}
