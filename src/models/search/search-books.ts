import { searchBooks as searchBooksData } from '../../data/search-data';
import { tokenizeQuery } from './tokenize-query';

const VALID_SORTS = ['relevance', 'rating', 'newest', 'oldest', 'title'];
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

function toArray(value: unknown): string[] | null {
  if (value === undefined) return null;
  const arr = Array.isArray(value) ? value : [value];
  const cleaned = arr.map((v) => String(v).trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : null;
}

export interface SearchQuery {
  q?: unknown;
  subjects?: unknown;
  moods?: unknown;
  decade?: unknown;
  authorSlug?: unknown;
  status?: unknown;
  inLibraryOnly?: unknown;
  sort?: unknown;
  page?: unknown;
  limit?: unknown;
}

export async function searchBooks(query: SearchQuery, userId: number | null) {
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  const terms = q ? tokenizeQuery(q.toLowerCase()) : null;
  const phrase = q ? q.toLowerCase() : null;

  const decadeNum = query.decade !== undefined ? parseInt(String(query.decade), 10) : NaN;
  const decade = Number.isFinite(decadeNum) ? decadeNum : null;

  const authorSlug = typeof query.authorSlug === 'string' && query.authorSlug ? query.authorSlug : null;

  // status/inLibraryOnly are only honored for authenticated callers.
  const status = userId && typeof query.status === 'string' && query.status ? query.status : null;
  const inLibraryOnly = Boolean(userId) && query.inLibraryOnly === 'true';

  const sortParam = typeof query.sort === 'string' ? query.sort : null;
  const sort = sortParam && VALID_SORTS.includes(sortParam) ? sortParam : (q ? 'relevance' : 'newest');

  const page = Math.max(parseInt(String(query.page ?? '1'), 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(String(query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const offset = (page - 1) * limit;

  const rows = await searchBooksData({
    terms,
    phrase,
    subjects: toArray(query.subjects),
    moods: toArray(query.moods),
    decade,
    authorSlug,
    userId,
    status,
    inLibraryOnly,
    sort,
    limit,
    offset,
  });

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

  return {
    books: rows.map(({ total_count, ...book }: any) => book),
    total,
    page,
    pageSize: limit,
    query: q,
  };
}
