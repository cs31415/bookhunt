import { getBookBySlug, setBookCover } from '../../data/books-data';
import { getGoogleBooksById, searchGoogleBooks } from '../../lib/books/google-books-adapter';
import { firstAuthorSurname } from '../../lib/books/first-author-surname';
import { slugifyName, authorSlugMatches } from '../../lib/slug';
import { cacheGet } from '../../lib/cache/cache-get';
import { cacheSet } from '../../lib/cache/cache-set';
import { cacheKey } from '../../lib/cache/cache-key';
import type { SearchResult } from '../../lib/books/books-types';

const COVER_MISS_VERSION = 1;

/**
 * A day, not the week a resolve miss gets. The thing that sends a book here is
 * usually a provider outage, and a cover that could not be replaced during one
 * is worth asking about again once it ends.
 */
const COVER_MISS_TTL_SECONDS = 24 * 60 * 60;

/**
 * How long the existing cover gets to prove it is alive. Matches the client's
 * own patience: a cover slower than this is one no reader waits for anyway.
 */
const REACHABILITY_TIMEOUT_MS = 3000;

export type RepairCoverResult =
  | { outcome: 'not_found' }
  | { outcome: 'alive'; coverUrl: string }
  | { outcome: 'repaired'; coverUrl: string }
  | { outcome: 'no_replacement' };

/** Leading articles are the one difference a provider spells differently. */
function titleKey(title: string): string {
  return slugifyName(title).replace(/^(the|a|an)-/, '');
}

/**
 * Whether a provider result is the same book, not merely a plausible one.
 *
 * A different edition's cover is fine — that is what a cover repair is. A
 * different book's is not, and a bare title search will happily return one.
 *
 * Prefix rather than equality, because a provider routinely carries the
 * subtitle the catalog dropped: "Enlightenment" and "The Enlightenment: The
 * Pursuit of Happiness" are the same book.
 */
function looksLikeSameBook(
  book: { title: string; author_name?: string | null },
  candidate: SearchResult,
): boolean {
  if (!candidate.coverUrl || !candidate.title) return false;

  const wanted = titleKey(book.title);
  const found = titleKey(candidate.title);
  if (!wanted || !found) return false;
  if (!found.startsWith(wanted) && !wanted.startsWith(found)) return false;

  // No author on either side is not a match worth trusting: the title alone is
  // what returns a different book in the first place.
  const wantedSurname = firstAuthorSurname(book.author_name);
  const foundSurname = firstAuthorSurname(candidate.authors?.join(', '));
  if (!wantedSurname || !foundSurname) return false;

  return authorSlugMatches(slugifyName(foundSurname), slugifyName(wantedSurname));
}

/** True when the URL answers at all. Any failure, including a timeout, is dead. */
async function isReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function googleCoverFor(book: {
  title: string;
  author_name?: string | null;
  google_books_id?: string | null;
}): Promise<string | null> {
  // The exact edition when we know it. None of the books this was written for
  // has one -- they were all resolved through OpenLibrary -- but a book that
  // does deserves its own cover rather than a search's best guess.
  if (book.google_books_id) {
    const volume = await getGoogleBooksById(book.google_books_id);
    if (volume?.coverUrl) return volume.coverUrl;
  }

  const surname = firstAuthorSurname(book.author_name);
  const query = surname ? `${book.title} ${surname}` : book.title;

  let results: SearchResult[];
  try {
    results = await searchGoogleBooks(query, 5);
  } catch (error) {
    // A provider being down is not a miss worth remembering: the caller leaves
    // the row alone and the next reader tries again.
    console.error(`[books] cover search for "${book.title}" failed:`, error);
    return null;
  }

  return results.find((result) => looksLikeSameBook(book, result))?.coverUrl ?? null;
}

/**
 * Replaces a book's unreachable cover with one from Google Books.
 *
 * Written for the day covers.openlibrary.org stopped accepting connections and
 * took 97 books' covers with it (LOS-272). A reader's browser reports the
 * failure, but the report is only a trigger: this checks the URL itself before
 * writing, so no client can make the catalog churn on demand.
 */
export async function repairCover(slug: string): Promise<RepairCoverResult> {
  const book = await getBookBySlug(slug);
  if (!book?.cover_url) return { outcome: 'not_found' };

  if (await isReachable(book.cover_url)) {
    return { outcome: 'alive', coverUrl: book.cover_url };
  }

  // Asked before the provider, so a grid of dead covers costs one search per
  // book rather than one per mount.
  const key = cacheKey('books:cover-miss', COVER_MISS_VERSION, slug);
  if (await cacheGet<true>(key)) return { outcome: 'no_replacement' };

  const coverUrl = await googleCoverFor(book);
  if (!coverUrl) {
    await cacheSet(key, true, COVER_MISS_TTL_SECONDS);
    return { outcome: 'no_replacement' };
  }

  const updated = await setBookCover(book.id, coverUrl);
  if (!updated) return { outcome: 'not_found' };

  return { outcome: 'repaired', coverUrl };
}
