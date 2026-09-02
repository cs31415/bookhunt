import { SearchResult } from '../../lib/books/books-types';
import { BooksProviderError } from '../../lib/books/books-provider-error';
import { isCircuitOpen, openCircuit } from '../../lib/books/provider-circuit';
import { primaryProvider, fallbackProvider } from '../../lib/books/provider-chain';
import { primaryAttempts, primaryBackoffMs } from '../../lib/books/books-retry-config';
import { getBooksProviderAdapter } from '../../lib/books/get-books-provider-adapter';
import { mapWithConcurrency } from '../../lib/map-with-concurrency';
import { RESOLUTION_CONCURRENCY } from '../../lib/import-constraints';
import {
  isSamePublisher,
  matchesTitleAndAuthor,
  scoreCandidate,
  titleAgrees,
} from '../matching/match-book-candidate';
import { isSameIsbn, normalizeIsbn } from '../../lib/books/normalize-isbn';
import { bareQueryTerm } from '../../lib/books/bare-query-term';
import { firstAuthorSurname } from '../../lib/books/first-author-surname';
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
  /**
   * Set when no candidate answers the title the row asked for, so the list is a
   * suggestion rather than an identification and must not be preselected.
   *
   * These are the rows the alternate-title pass answered: either a genuinely
   * retitled edition ("Half Lion" -> "The Man Who Remade India") or a different
   * book by the same author, and nothing in the response tells the two apart
   * (LOS-199). Both score alike, so this is a provenance flag, not a threshold —
   * the reader is the one who can settle it, and the whole point of the review
   * list is that they get to.
   */
  tentative?: boolean;
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
 * The precise pass: a quoted title phrase and a surname (LOS-199).
 *
 * Both halves are stripped down before they go in, because Google matches a
 * quoted qualifier literally and empties the result set over a detail neither
 * the reader nor the catalogue thinks is part of the name:
 *
 *   intitle:"Celebrations!" inauthor:"Barnabas Kindersley"  -> 0
 *   intitle:"Celebrations"  inauthor:"Kindersley"           -> the right book
 *
 *   intitle:"how to read a book" inauthor:"mortimer j adler and charles van doren"  -> 0
 *   intitle:"how to read a book" inauthor:"adler"                                   -> 300
 *
 * An exclamation mark and a co-author are all it takes. See bareQueryTerm and
 * firstAuthorSurname for what each end removes.
 *
 * `inpublisher` is asked for only when there is no author (LOS-168). Google
 * matches it against one publisher string per volume, so a file naming a
 * different-but-correct one excludes the book outright: adding
 * inpublisher:"HMH" to a Tools of Titans query emptied it, and the book is
 * Houghton Mifflin Harcourt's. Six of twenty authored rows sampled from a real
 * import died that way. An author narrows the search perfectly well alone, and
 * scoreCandidate then ranks by publisher far more forgivingly — by token, so
 * "Frommer's" and "Frommers" agree.
 *
 * The publisher keeps its quotes for the same reason the others lose theirs:
 * unquoted it stops narrowing anything at all, and `hong kong
 * inpublisher:frommer` comes back with Whole World Handbook and a guide to San
 * Francisco.
 */
function googlePreciseQuery(hint: ImportRowHint): string {
  const parts = [`intitle:${quoted(bareQueryTerm(hint.title))}`];
  const surname = firstAuthorSurname(hint.author);
  if (surname) parts.push(`inauthor:${quoted(surname)}`);
  else if (hint.publisher) parts.push(`inpublisher:${quoted(hint.publisher)}`);
  return parts.join(' ');
}

/**
 * The fallback pass: free-text title, bare `inauthor:` — the shape that finds a
 * book the precise pass cannot, because the catalogue files it under another
 * title entirely.
 *
 *   intitle:"half lion" inauthor:"sitapati"  -> 0
 *   half lion inauthor:vinay sitapati        -> "The Man Who Remade India"
 *
 * Which is the same book: Half Lion ships under that title outside India.
 *
 * This form is only safe *after* the precise pass comes back empty. Run on its
 * own it answers a title it cannot find with a different book by the same
 * author — `Celebrations! inauthor:Barnabas Kindersley` returns one volume and
 * it is "Niños como yo" — and one confident wrong answer beats no answer
 * straight into the reader's library. An empty precise pass is what rules that
 * out: it establishes that the catalogue holds nothing under this title by this
 * author, so a title that disagrees is evidence of a retitled edition rather
 * than of the wrong book.
 *
 * Even then the result is not trusted outright; see `tentative` on the row.
 *
 * Pointless without an author — the query would be the bare title, which is what
 * the precise pass just asked for.
 */
function googleAlternateTitleQuery(hint: ImportRowHint): string | null {
  if (!hint.author) return null;
  return `${bareQueryTerm(hint.title)} inauthor:${bareQueryTerm(hint.author)}`;
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
 * One primary-provider lookup for a row, as a cascade: ISBN, then the precise
 * query, then — only if that found nothing on the title it asked for — the
 * alternate-title query.
 *
 * The precise pass is filtered by titleAgrees rather than merely ranked. A
 * result that does not answer the title is not a weak match to be sorted
 * downwards, it is the provider changing the subject, and letting it through
 * would leave the fallback with nothing to distinguish itself from.
 *
 * Lets BooksProviderError escape, so the caller can gather every failed row and
 * retry them together rather than blocking this row on its own backoff.
 */
async function primaryLookup(hint: ImportRowHint): Promise<SearchResult[]> {
  const provider = primaryProvider();
  // Already known to be out of capacity: don't spend a request learning it again.
  if (isCircuitOpen(provider)) return [];

  const google = getBooksProviderAdapter(provider);
  const isbn = normalizeIsbn(hint.isbn);

  // An ISBN names one edition, so ask for it directly and stop if it lands: no
  // ranking required, and no reason to spend the fuzzy query on an answered row.
  if (isbn) {
    const byIsbn = await google.search(`isbn:${isbn}`, CANDIDATES_PER_ROW);
    if (byIsbn.length > 0) return byIsbn;
  }

  const precise = await google.search(googlePreciseQuery(hint), CANDIDATES_PER_ROW);
  const onTitle = precise.filter((book) => titleAgrees(book, hint));
  if (onTitle.length > 0) return onTitle;

  const alternate = googleAlternateTitleQuery(hint);
  return alternate ? google.search(alternate, CANDIDATES_PER_ROW) : [];
}

/**
 * The fallback gets a single attempt: if it fails too there is nowhere else to
 * look, so retrying only delays an answer we already have.
 *
 * Returns nothing when the chain names no second provider, which leaves a row
 * Google could not answer unresolved for the reader to pick rather than filled
 * in from elsewhere.
 */
async function fallbackLookup(hint: ImportRowHint): Promise<SearchResult[]> {
  const provider = fallbackProvider();
  if (!provider) return [];

  const adapter = getBooksProviderAdapter(provider);
  const isbn = normalizeIsbn(hint.isbn);
  const query = isbn ? `isbn:${isbn}` : openLibraryQuery(hint);
  try {
    return await adapter.search(query, CANDIDATES_PER_ROW);
  } catch (error) {
    console.warn(`[import] ${provider} failed for "${query}"`, error);
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
  // Nothing to fall back to, so nothing to decide (LOS-389).
  if (!fallbackProvider()) return false;
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

  // Read off the candidates rather than threaded down from the lookup: an ISBN
  // settles the row whatever the title says, and Open Library's results arrive
  // by a different route than Google's. What matters is whether anything here
  // actually answers the title, not which pass produced it.
  const tentative =
    candidates.length > 0 &&
    !pinnedByIsbn(candidates, hint) &&
    !candidates.some((book) => titleAgrees(book, hint));

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
    ...(tentative && { tentative: true }),
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
    if (isCircuitOpen(primaryProvider())) break;
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
        if (error.status === 429) openCircuit(primaryProvider());
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
