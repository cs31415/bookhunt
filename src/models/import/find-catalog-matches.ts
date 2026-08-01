import { matchImportRows } from '../../data/import-data';
import { formatCatalogBook } from '../../lib/books/format-catalog-book';
import type { CatalogBookSummary } from '../../lib/books/format-catalog-book';
import { scoreCandidate } from '../upload/matches-detected-book';
import { tokenizeQuery } from '../search/tokenize-query';

export interface CatalogMatchHint {
  title: string;
  author?: string | null;
  publisher?: string | null;
  isbn?: string | null;
}

export interface CatalogMatch {
  bookId: number;
  /** Whether the caller already holds this book, which is what lets the row skip the providers. */
  inLibrary: boolean;
  /** The row the search already returned, so the client needn't fetch it back. */
  book: CatalogBookSummary;
}

/** Candidates fetched per row before local re-ranking picks one. */
const CANDIDATES_PER_ROW = 5;

/**
 * Minimum score to treat a catalog row as the book the CSV meant. A bare title
 * match scores 1.0, so this demands the title essentially matches; author and
 * publisher agreement push it higher.
 */
const CATALOG_MATCH_THRESHOLD = 0.9;

/**
 * Best catalog match per hint, or null where nothing clears the bar.
 *
 * One query for the whole batch rather than one per row: a 372-row import used
 * to issue 372 full scans of the catalog, and the answer to "which of these
 * titles do we already have" is naturally a batch question.
 *
 * Deliberately not findBookByTitle (src/data/upload-data.ts): that is
 * `LIKE '%title%'` with no author or publisher check, returning an arbitrary
 * first row — which for a title like "Hong Kong" is a coin flip. The catalog
 * ranks properly and returns the publisher, so the same scoring used for
 * provider candidates applies here too.
 */
export async function findCatalogMatches(
  hints: CatalogMatchHint[],
  userId: number | null,
): Promise<(CatalogMatch | null)[]> {
  if (hints.length === 0) return [];

  const rows = await matchImportRows({
    terms: hints.map((hint) => tokenizeQuery(hint.title.toLowerCase()).join(' ')),
    phrases: hints.map((hint) => hint.title.toLowerCase()),
    userId,
    limit: CANDIDATES_PER_ROW,
  });

  const byRow = new Map<number, any[]>();
  for (const row of rows) {
    const index = Number(row.row_index);
    const forRow = byRow.get(index);
    if (forRow) forRow.push(row);
    else byRow.set(index, [row]);
  }

  return hints.map((hint, index) => {
    const candidates = byRow.get(index) ?? [];
    if (candidates.length === 0) return null;

    const best = candidates
      .map((row) => ({
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

    if (best.score < CATALOG_MATCH_THRESHOLD) return null;
    return {
      bookId: Number(best.row.book_id),
      inLibrary: Boolean(best.row.in_library),
      book: formatCatalogBook(best.row),
    };
  });
}
