import { SearchResult } from '../../lib/books/books-types';
import { getBooksProviderAdapter } from '../../lib/books/get-books-provider-adapter';
import { mapWithConcurrency } from '../../lib/map-with-concurrency';
import { RESOLUTION_CONCURRENCY } from '../../lib/upload-constraints';
import { isSamePublisher, scoreCandidate } from '../upload/matches-detected-book';
import { normalizeIsbn } from '../../lib/books/normalize-isbn';
import { searchBooks as searchCatalog } from '../search/search-books';

export interface ImportRowHint {
  title: string;
  author?: string | null;
  publisher?: string | null;
  isbn?: string | null;
}

export interface ResolvedImportRow {
  title: string;
  author: string | null;
  publisher: string | null;
  isbn: string | null;
  /** Set when the row already exists in the catalog. */
  matchedBookId?: number;
  /** Ranked best-first, so the client can preselect [0] and offer the rest. */
  candidates: SearchResult[];
}

/** Candidates offered per row. Enough to disambiguate, few enough to scan in a dropdown. */
const CANDIDATES_PER_ROW = 5;

/**
 * Minimum score to treat a catalog row as the book the CSV meant. A bare title
 * match scores 1.0, so this demands the title essentially matches; author and
 * publisher agreement push it higher.
 */
const CATALOG_MATCH_THRESHOLD = 0.9;

function quoted(value: string): string {
  return `"${value.replace(/"/g, '').trim()}"`;
}

/**
 * Google Books honours fielded qualifiers precisely — verified against the live
 * API, where `intitle:"Hong Kong" inpublisher:"Frommer's"` returns exactly the
 * right book. Open Library accepts the same shape but does not strictly AND
 * terms, so its results need the same re-ranking everything else gets.
 */
function googleQuery(hint: ImportRowHint): string {
  const parts = [`intitle:${quoted(hint.title)}`];
  if (hint.author) parts.push(`inauthor:${quoted(hint.author)}`);
  if (hint.publisher) parts.push(`inpublisher:${quoted(hint.publisher)}`);
  return parts.join(' ');
}

function openLibraryQuery(hint: ImportRowHint): string {
  const parts = [`title:${quoted(hint.title)}`];
  if (hint.author) parts.push(`author:${quoted(hint.author)}`);
  if (hint.publisher) parts.push(`publisher:${quoted(hint.publisher)}`);
  return parts.join(' ');
}

/** Provider identity, so the same edition from two queries collapses to one candidate. */
function identityOf(book: SearchResult): string {
  return book.googleBooksId
    ? `g:${book.googleBooksId}`
    : book.openLibraryId
      ? `o:${book.openLibraryId}`
      : `t:${book.title.toLowerCase()}|${book.authors.join(',').toLowerCase()}`;
}

function confirmsPublisher(book: SearchResult, hint: ImportRowHint): boolean {
  if (!hint.publisher) return false;
  return scoreCandidate(book, hint) > scoreCandidate(book, { ...hint, publisher: null });
}

/**
 * Surface the publisher the caller actually asked about.
 *
 * `publisher` is just `publishers[0]`, and Open Library orders that array
 * arbitrarily across a work's editions — so a Frommer's guide can report
 * "Prentice-Hall", which is exactly the wrong thing to show someone who typed
 * "Frommer's". Promote the matching entry so the candidate list is legible.
 */
function withMatchedPublisher(book: SearchResult, hint: ImportRowHint): SearchResult {
  if (!hint.publisher || !book.publishers?.length) return book;
  const matched = book.publishers.find((p) => isSamePublisher(p, hint.publisher!));
  return matched ? { ...book, publisher: matched } : book;
}

/**
 * Resolve one CSV row to a ranked candidate list.
 *
 * Google first: it filters on publisher precisely and is not rate-limited on our
 * side. Open Library is consulted only when Google came back empty or with
 * nothing confirming the publisher hint — it is the only provider that reliably
 * *reports* publisher, which is what makes a generic-titled travel guide
 * resolvable, but throttleOpenLibrary() is a process-wide 1 req/sec queue, so
 * asking it about every row would serialise a 40-row batch into 40+ seconds.
 */
async function resolveOne(hint: ImportRowHint, userId: number | null): Promise<ResolvedImportRow> {
  const google = getBooksProviderAdapter('google_books');
  const openLibrary = getBooksProviderAdapter('open_library');
  const isbn = normalizeIsbn(hint.isbn);

  const collected: SearchResult[] = [];

  // An ISBN names one edition, so ask for it directly and stop if it lands.
  // Both providers return a single result for `isbn:` — no ranking required and
  // no reason to spend the fuzzy queries or the Open Library throttle on a row
  // that is already answered.
  if (isbn) {
    const byIsbn = await google.search(`isbn:${isbn}`, CANDIDATES_PER_ROW).catch(() => []);
    collected.push(...byIsbn);
    if (collected.length === 0) {
      const olByIsbn = await openLibrary.search(`isbn:${isbn}`, CANDIDATES_PER_ROW).catch(() => []);
      collected.push(...olByIsbn);
    }
  }

  if (collected.length === 0) {
    const fromGoogle = await google.search(googleQuery(hint), CANDIDATES_PER_ROW).catch(() => []);
    collected.push(...fromGoogle);

    const needsOpenLibrary =
      collected.length === 0 ||
      (Boolean(hint.publisher) && !collected.some((b) => confirmsPublisher(b, hint)));

    if (needsOpenLibrary) {
      const fromOpenLibrary = await openLibrary
        .search(openLibraryQuery(hint), CANDIDATES_PER_ROW)
        .catch(() => []);
      collected.push(...fromOpenLibrary);
    }
  }

  const byIdentity = new Map<string, SearchResult>();
  for (const book of collected) {
    if (!byIdentity.has(identityOf(book))) byIdentity.set(identityOf(book), book);
  }

  const candidates = [...byIdentity.values()]
    .map((book) => ({ book, score: scoreCandidate(book, hint) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATES_PER_ROW)
    .map(({ book }) => withMatchedPublisher(book, hint));

  const matchedBookId = await findCatalogMatch(hint, userId);

  return {
    title: hint.title,
    author: hint.author ?? null,
    publisher: hint.publisher ?? null,
    isbn,
    ...(matchedBookId !== null && { matchedBookId }),
    candidates,
  };
}

/**
 * Best-scoring catalog row above the threshold, or null.
 *
 * Deliberately not findBookByTitle (src/data/upload-data.ts): that is
 * `LIKE '%title%'` with no author or publisher check, returning an arbitrary
 * first row — which for a title like "Hong Kong" is a coin flip. fn_search_books
 * ranks properly and returns the publisher, so the same scoring used for
 * provider candidates applies here too.
 */
async function findCatalogMatch(hint: ImportRowHint, userId: number | null): Promise<number | null> {
  const { books } = await searchCatalog({ q: hint.title, limit: CANDIDATES_PER_ROW }, userId);
  if (books.length === 0) return null;

  const best = books
    .map((row: any) => ({
      row,
      score: scoreCandidate(
        {
          title: row.title,
          authors: row.author_name ? [row.author_name] : [],
          publishers: row.publisher ? [row.publisher] : [],
          isbn13: row.isbn13,
        },
        hint,
      ),
    }))
    .sort((a, b) => b.score - a.score)[0];

  return best.score >= CATALOG_MATCH_THRESHOLD ? Number(best.row.book_id) : null;
}

/** Resolve a batch of rows, preserving input order so the client can align them to CSV lines. */
export function resolveImportRows(
  rows: ImportRowHint[],
  userId: number | null,
): Promise<ResolvedImportRow[]> {
  return mapWithConcurrency(rows, RESOLUTION_CONCURRENCY, (row) => resolveOne(row, userId));
}
