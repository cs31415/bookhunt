import {
  matchLibraryEntries as matchLibraryEntriesData,
  matchLibraryEntriesByTitle,
} from '../../data/ai-data';
import { parseBooksProviderConfig } from '../../lib/books/parse-books-provider-config';
import { searchWithFallback } from '../../lib/books/search-with-fallback';
import { SearchResult } from '../../lib/books/books-types';
import { tokenizeQuery } from '../search/tokenize-query';
import { matchesTitleAndAuthorIgnoringSubtitle, scoreCandidate } from '../matching/match-book-candidate';

export type { SearchResult } from '../../lib/books/books-types';

/** Library candidates fetched per book before local confirmation picks one. */
const CANDIDATES_PER_BOOK = 5;

export async function searchBooks(query: string, limit: number): Promise<SearchResult[]> {
  const chain = parseBooksProviderConfig('BOOKS_SEARCH_PROVIDERS');
  const maxResults = Math.min(Math.max(1, limit), 40);
  return searchWithFallback(chain, query, maxResults);
}

export interface LibraryMatchable {
  googleBooksId: string | null;
  isbn13: string | null;
  title: string;
  authors: string[];
  inLibrary: boolean;
  libraryStatus: string | null;
}

/**
 * Flags the books the caller already owns, in two passes.
 *
 * The id pass alone was the whole implementation, and it silently answered "no"
 * for every LLM suggestion: searchBooksWithLlm has no ids to give, so both id
 * arrays were always empty and nothing was ever flagged as owned. That took the
 * "In my library only" filter down with it, since it filters on this flag.
 *
 * So ids first -- exact, and still the only signal the provider results reaching
 * here from getMetadata carry -- then title and author for whatever is left.
 */
export async function matchLibraryEntries(userId: number, books: LibraryMatchable[]) {
  await matchById(userId, books);

  const unmatched = books.filter((book) => !book.inLibrary);
  if (unmatched.length > 0) await matchByTitleAndAuthor(userId, unmatched);
}

async function matchById(userId: number, books: LibraryMatchable[]) {
  const googleIds = books.map((b) => b.googleBooksId).filter((id): id is string => Boolean(id));
  const isbns = books.map((b) => b.isbn13).filter(Boolean) as string[];
  if (googleIds.length === 0 && isbns.length === 0) return;

  const rows = await matchLibraryEntriesData(userId, googleIds, isbns);

  const byGoogleId = new Map<string, string>();
  const byIsbn = new Map<string, string>();
  for (const row of rows) {
    if (row.google_books_id) byGoogleId.set(row.google_books_id, row.status);
    if (row.isbn13) byIsbn.set(row.isbn13, row.status);
  }

  for (const book of books) {
    const status =
      (book.googleBooksId ? byGoogleId.get(book.googleBooksId) : undefined) ||
      (book.isbn13 ? byIsbn.get(book.isbn13) : undefined);
    if (status) {
      book.inLibrary = true;
      book.libraryStatus = status;
    }
  }
}

/**
 * Text matching against the library only -- one query for the whole batch, the
 * same way findCatalogMatches asks the catalog the same question for an import.
 *
 * Ranking picks the best candidate, but matchesTitleAndAuthorIgnoringSubtitle
 * decides whether there is one at all: the titles have to agree both ways *and*
 * an author token has to match. A ranked-first candidate is merely the closest
 * row in the library, which for a suggestion the caller doesn't own is still a
 * wrong answer -- and a wrong one here mislabels someone's own shelf.
 *
 * Subtitles are set aside, because the LLM answers with the full one ("Broca's
 * Brain: Reflections on the Romance of Science") where the catalog holds the
 * short title. Nothing else is: a library holding "Second Foundation" does not
 * hold "Foundation" (LOS-275).
 */
async function matchByTitleAndAuthor(userId: number, books: LibraryMatchable[]) {
  const withTitles = books.filter((book) => book.title?.trim());
  if (withTitles.length === 0) return;

  const rows = await matchLibraryEntriesByTitle({
    userId,
    terms: withTitles.map((book) => tokenizeQuery(book.title.toLowerCase()).join(' ')),
    phrases: withTitles.map((book) => book.title.toLowerCase()),
    limit: CANDIDATES_PER_BOOK,
  });

  const byRow = new Map<number, any[]>();
  for (const row of rows) {
    const index = Number(row.row_index);
    const forRow = byRow.get(index);
    if (forRow) forRow.push(row);
    else byRow.set(index, [row]);
  }

  withTitles.forEach((book, index) => {
    const hint = { title: book.title, author: book.authors[0] ?? null };
    const best = (byRow.get(index) ?? [])
      .map((row) => ({
        row,
        candidate: {
          title: row.title,
          authors: row.author_name ? [row.author_name] : [],
          isbn13: row.isbn13,
        },
      }))
      .filter(({ candidate }) => matchesTitleAndAuthorIgnoringSubtitle(candidate, hint))
      .sort((a, b) => scoreCandidate(b.candidate, hint) - scoreCandidate(a.candidate, hint))[0];

    if (!best) return;
    book.inLibrary = true;
    book.libraryStatus = best.row.status ?? null;
  });
}
