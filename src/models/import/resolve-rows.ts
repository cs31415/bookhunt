import { SearchResult } from '../../lib/books/books-types';
import { BooksProviderError } from '../../lib/books/books-provider-error';
import { primaryAttempts, primaryBackoffMs } from '../../lib/books/books-retry-config';
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One primary-provider lookup for a row. Lets BooksProviderError escape, so the
 * caller can gather every failed row and retry them together rather than
 * blocking this row on its own backoff.
 */
async function primaryLookup(hint: ImportRowHint): Promise<SearchResult[]> {
  const google = getBooksProviderAdapter('google_books');
  const isbn = normalizeIsbn(hint.isbn);

  // An ISBN names one edition, so ask for it directly and stop if it lands: no
  // ranking required, and no reason to spend the fuzzy query on an answered row.
  if (isbn) {
    const byIsbn = await google.search(`isbn:${isbn}`, CANDIDATES_PER_ROW);
    if (byIsbn.length > 0) return byIsbn;
  }
  return google.search(googleQuery(hint), CANDIDATES_PER_ROW);
}

/**
 * The fallback gets a single attempt: if it fails too there is nowhere else to
 * look, so retrying only delays an answer we already have.
 */
async function fallbackLookup(hint: ImportRowHint): Promise<SearchResult[]> {
  const openLibrary = getBooksProviderAdapter('open_library');
  const isbn = normalizeIsbn(hint.isbn);
  const query = isbn ? `isbn:${isbn}` : openLibraryQuery(hint);
  try {
    return await openLibrary.search(query, CANDIDATES_PER_ROW);
  } catch (error) {
    console.warn(`[import] open_library failed for "${query}"`, error);
    return [];
  }
}

/**
 * Whether a row still needs the fallback provider.
 *
 * Open Library is the only one that reliably reports publisher, which is what
 * makes a generic-titled travel guide resolvable — but throttleOpenLibrary() is
 * a process-wide 1 req/sec queue, so it stays off the common path.
 */
function needsFallback(collected: SearchResult[], hint: ImportRowHint): boolean {
  if (collected.length === 0) return true;
  return Boolean(hint.publisher) && !collected.some((b) => confirmsPublisher(b, hint));
}

/** Turns whatever the providers returned into the row the client sees. */
async function assembleRow(
  hint: ImportRowHint,
  collected: SearchResult[],
  userId: number | null,
): Promise<ResolvedImportRow> {
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
    isbn: normalizeIsbn(hint.isbn),
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

/**
 * Resolve a batch of rows, preserving input order so the client can align them
 * to CSV lines.
 *
 * Retries are batch-level rather than per-row. A row whose primary lookup fails
 * goes onto a retry list and the pass moves on; the whole list is then retried
 * together, once per round, up to BOOKS_PRIMARY_ATTEMPTS. Retrying inline
 * instead would stall every healthy row behind a flaky one's backoff, and pay
 * that backoff once per row rather than once per round — on a 40-row batch
 * against a wobbling provider that is the difference between seconds and
 * minutes.
 *
 * Only failures are retried. A provider that answers "no results" is believed,
 * so an obscure title costs one round trip, not three.
 */
export async function resolveImportRows(
  rows: ImportRowHint[],
  userId: number | null,
): Promise<ResolvedImportRow[]> {
  const collected: SearchResult[][] = rows.map(() => []);
  const attempts = primaryAttempts();

  let pending = rows.map((hint, index) => ({ hint, index }));

  for (let round = 1; round <= attempts && pending.length > 0; round++) {
    if (round > 1) await delay(primaryBackoffMs() * (round - 1));

    const failed: typeof pending = [];
    await mapWithConcurrency(pending, RESOLUTION_CONCURRENCY, async ({ hint, index }) => {
      try {
        collected[index] = await primaryLookup(hint);
      } catch (error) {
        // Anything else is a bug in our own code, not a flaky network, and
        // swallowing it would hide it.
        if (!(error instanceof BooksProviderError)) throw error;
        failed.push({ hint, index });
      }
    });

    if (failed.length > 0) {
      const remaining = attempts - round;
      console.warn(
        `[import] google_books failed for ${failed.length}/${pending.length} rows on round ` +
          `${round}/${attempts}` +
          (remaining > 0 ? `, retrying those` : `; falling back for them`),
      );
    }
    pending = failed;
  }

  // Rows that failed every round fall through with nothing from the primary,
  // which sends them to the fallback below like any other empty result.
  await mapWithConcurrency(rows, RESOLUTION_CONCURRENCY, async (hint, index) => {
    if (needsFallback(collected[index], hint)) {
      collected[index] = [...collected[index], ...(await fallbackLookup(hint))];
    }
  });

  return mapWithConcurrency(rows, RESOLUTION_CONCURRENCY, (hint, index) =>
    assembleRow(hint, collected[index], userId),
  );
}
