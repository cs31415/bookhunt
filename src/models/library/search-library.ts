import { searchUserLibrary } from '../../data/library-data';
import { tokenizeQuery } from '../search/tokenize-query';

// 'added' is the library's own ordering (fn_get_user_library sorts by
// date_added DESC); the rest mirror the catalog's VALID_SORTS so both search
// boxes offer the same options.
const VALID_SORTS = ['relevance', 'added', 'rating', 'newest', 'oldest', 'title'];
const VALID_STATUSES = ['queued', 'reading', 'finished', 'abandoned'];
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

export interface SearchLibraryQuery {
  q?: unknown;
  status?: unknown;
  sort?: unknown;
  page?: unknown;
  limit?: unknown;
}

export async function searchLibrary(userId: number, query: SearchLibraryQuery = {}) {
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  // Same tokenizer as catalog search and import matching, so all three ask the
  // catalog the same question and stop words stay defined in one place.
  const terms = q ? tokenizeQuery(q.toLowerCase()) : null;
  const phrase = q ? q.toLowerCase() : null;

  // Checked against the enum rather than passed through: fn_search_library
  // takes a reading_status, and an unrecognised string is a cast error --
  // a 500 for what is really a malformed query param.
  const status =
    typeof query.status === 'string' && VALID_STATUSES.includes(query.status) ? query.status : null;

  const sortParam = typeof query.sort === 'string' ? query.sort : null;
  const sort = sortParam && VALID_SORTS.includes(sortParam) ? sortParam : (q ? 'relevance' : 'added');

  const page = Math.max(parseInt(String(query.page ?? '1'), 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(String(query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const offset = (page - 1) * limit;

  const rows = await searchUserLibrary(userId, { terms, phrase, status, sort, limit, offset });

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

  return {
    entries: rows.map(({ total_count, ...entry }: any) => entry),
    total,
    page,
    pageSize: limit,
    query: q,
  };
}
