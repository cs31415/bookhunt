import { SearchResult } from '../../lib/books/books-types';
import { BooksProviderError } from '../../lib/books/books-provider-error';
import { isCircuitOpen, openCircuit } from '../../lib/books/provider-circuit';
import { primaryAttempts, primaryBackoffMs } from '../../lib/books/books-retry-config';
import { getBooksProviderAdapter } from '../../lib/books/get-books-provider-adapter';
import { mapWithConcurrency } from '../../lib/map-with-concurrency';
import { RESOLUTION_CONCURRENCY } from '../../lib/upload-constraints';
import {
  isSamePublisher,
  matchesTitleAndAuthor,
  scoreCandidate,
} from '../upload/matches-detected-book';
import { isSameIsbn, normalizeIsbn } from '../../lib/books/normalize-isbn';
import { bareQueryTerm } from '../../lib/books/bare-query-term';
import { findCatalogMatches } from './find-catalog-matches';
import type { CatalogMatch } from './find-catalog-matches';
import type { CatalogBookSummary } from '../../lib/books/format-catalog-book';

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
  /**
   * The matched catalog book, ready to render. Sent alongside the id because the
   * search that found it already returned the cover, slug and author, and a
   * client that had only the id would have to ask for them back — one extra
   * request per batch for data the response was in a position to carry.
   */
  matchedBook?: CatalogBookSummary;
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
 * The title goes in as free text and the author as a bare `inauthor:`, because a
 * quoted `intitle:` demands the phrase match one title string exactly, and a CSV
 * row rarely holds that string (LOS-199). Verified against the live API:
 *
 *   intitle:"half lion" inauthor:"vinay sitapati"  -> 0
 *   half lion inauthor:vinay sitapati              -> 1, the right book
 *
 * "Half Lion" ships as "The Man Who Remade India" outside India, so the exact
 * phrase matches nothing while free text still finds it. A middle initial the
 * catalogue omits, or an author column holding two names joined by "and", does
 * the same — each takes the count to zero rather than ranking the book lower.
 *
 * `inpublisher` keeps its quotes. Unquoted it stops narrowing anything at all:
 * `hong kong inpublisher:frommer` returns Whole World Handbook and a guide to
 * San Francisco.
 *
 * It is also asked for only when there is no author, which predates this change
 * (LOS-168). Google matches it against one publisher string per volume, so a
 * file naming a different-but-correct one excludes the book outright: adding
 * inpublisher:"HMH" to a Tools of Titans query emptied it, and the book is
 * Houghton Mifflin Harcourt's. Six of twenty authored rows sampled from a real
 * import died that way. An author narrows the search perfectly well alone, and
 * scoreCandidate then ranks by publisher far more forgivingly — by token, so
 * "Frommer's" and "Frommers" agree.
 *
 * Free text ranks more loosely than the fielded form did, which leaves
 * scoreCandidate carrying more of the load: `tools of titans inauthor:tim
 * ferriss` puts three translations in the top five.
 */
function googleQuery(hint: ImportRowHint): string {
  const parts = [bareQueryTerm(hint.title)];
  if (hint.author) parts.push(`inauthor:${bareQueryTerm(hint.author)}`);
  else if (hint.publisher) parts.push(`inpublisher:${quoted(hint.publisher)}`);
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
  // Already known to be out of capacity: don't spend a request learning it again.
  if (isCircuitOpen('google_books')) return [];

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

/** Whether the supplied ISBN is already answered by one of the candidates. */
function pinnedByIsbn(collected: SearchResult[], hint: ImportRowHint): boolean {
  if (!normalizeIsbn(hint.isbn)) return false;
  return collected.some((book) => isSameIsbn(book.isbn13, hint.isbn));
}

/**
 * Whether a candidate agrees on both title and author, which identifies the book
 * the way an ISBN does — leaving the publisher nothing to disambiguate.
 *
 * A candidate naming a *different* publisher deliberately does not reopen the
 * question. Google's publisher on search results is unreliable and routinely
 * names another edition of the right book, so treating disagreement as doubt
 * would spend a throttle slot on most rows to re-answer a question already
 * settled — and the reader still picks from the ranked candidates, where a
 * publisher match scores ahead of one that mismatches.
 */
function pinnedByAuthor(collected: SearchResult[], hint: ImportRowHint): boolean {
  return collected.some((book) => matchesTitleAndAuthor(book, hint));
}

/**
 * Whether a row still needs the fallback provider.
 *
 * Open Library is the only one that reliably reports publisher, which is what
 * makes a generic-titled travel guide resolvable — but throttleOpenLibrary() is
 * a process-wide 1 req/sec queue, so every row sent there costs a full second of
 * the import's wall clock. It has to earn that second.
 *
 * It earns it only when the publisher is what identifies the book. Two things
 * already identify it, and neither leaves the publisher anything to do:
 *
 * - An ISBN names one edition outright, so a candidate carrying it settles the
 *   row. Without this a Goodreads export — every row an ISBN *and* a publisher,
 *   which Google routinely omits from search results — serialises its whole
 *   length through the queue.
 * - A title-and-author agreement names the book. Measured on a 372-row import:
 *   Google and Open Library call counts came back equal batch after batch, ~50
 *   throttled calls and ~50 of the 55 second wall clock, because a file with
 *   publishers and no ISBNs failed the publisher test on nearly every row —
 *   including "Cosmos / Carl Sagan / Ballantine", which no second opinion was
 *   going to identify any better.
 *
 * What is left is the case the fallback exists for (LOS-168): a generic title
 * with no author, where the publisher is the only thing telling dozens of
 * identically-titled editions apart.
 */
function needsFallback(collected: SearchResult[], hint: ImportRowHint): boolean {
  if (collected.length === 0) return true;
  if (pinnedByIsbn(collected, hint)) return false;
  if (pinnedByAuthor(collected, hint)) return false;
  return Boolean(hint.publisher) && !collected.some((b) => confirmsPublisher(b, hint));
}

/** Turns whatever the providers returned into the row the client sees. */
function assembleRow(
  hint: ImportRowHint,
  collected: SearchResult[],
  catalogMatch: CatalogMatch | null,
): ResolvedImportRow {
  const byIdentity = new Map<string, SearchResult>();
  for (const book of collected) {
    if (!byIdentity.has(identityOf(book))) byIdentity.set(identityOf(book), book);
  }

  const candidates = [...byIdentity.values()]
    .map((book) => ({ book, score: scoreCandidate(book, hint) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATES_PER_ROW)
    .map(({ book }) => withMatchedPublisher(book, hint));

  return {
    title: hint.title,
    author: hint.author ?? null,
    publisher: hint.publisher ?? null,
    isbn: normalizeIsbn(hint.isbn),
    ...(catalogMatch !== null && {
      matchedBookId: catalogMatch.bookId,
      matchedBook: catalogMatch.book,
    }),
    candidates,
  };
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
 *
 * The catalog lookup runs first, ahead of any provider call, and takes the whole
 * batch in one query. A row the caller already owns is answered outright: the
 * client drops it from the review list and never reads its candidates, so
 * looking any up is work spent on something nobody will see. On the case this
 * exists to serve — re-importing an export against a library that already holds
 * most of it — that skips the providers for the bulk of the file.
 */
export async function resolveImportRows(
  rows: ImportRowHint[],
  userId: number | null,
): Promise<ResolvedImportRow[]> {
  const collected: SearchResult[][] = rows.map(() => []);
  const attempts = primaryAttempts();

  const catalogMatches = await findCatalogMatches(rows, userId);
  const alreadyOwned = (index: number) => catalogMatches[index]?.inLibrary === true;

  let pending = rows
    .map((hint, index) => ({ hint, index }))
    .filter(({ index }) => !alreadyOwned(index));

  for (let round = 1; round <= attempts && pending.length > 0; round++) {
    // No point retrying into a closed door; fall through to the secondary.
    if (isCircuitOpen('google_books')) break;
    if (round > 1) await delay(primaryBackoffMs() * (round - 1));

    const failed: typeof pending = [];
    await mapWithConcurrency(pending, RESOLUTION_CONCURRENCY, async ({ hint, index }) => {
      try {
        collected[index] = await primaryLookup(hint);
      } catch (error) {
        // Anything else is a bug in our own code, not a flaky network, and
        // swallowing it would hide it.
        if (!(error instanceof BooksProviderError)) throw error;
        // 429 means the provider is rationing us, not that this row is unlucky.
        // Retrying the batch would spend the rest of the budget on failures.
        if (error.status === 429) openCircuit('google_books');
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
  // which sends them to the fallback below like any other empty result — but an
  // owned row has no empty result to explain, it was never looked up at all.
  await mapWithConcurrency(rows, RESOLUTION_CONCURRENCY, async (hint, index) => {
    if (alreadyOwned(index)) return;
    if (needsFallback(collected[index], hint)) {
      collected[index] = [...collected[index], ...(await fallbackLookup(hint))];
    }
  });

  return rows.map((hint, index) => assembleRow(hint, collected[index], catalogMatches[index]));
}
