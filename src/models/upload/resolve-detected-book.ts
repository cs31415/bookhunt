import { searchBooks, SearchResult } from '../ai/search';
import { matchesDetectedBook } from './matches-detected-book';
import { bareQueryTerm } from '../../lib/books/bare-query-term';

/**
 * Resolve a vision-detected book to catalog metadata. An author-qualified query
 * runs first because unqualified free text can rank an unrelated book on top;
 * plain free text follows as the fallback, since a title read off a spine is
 * often slightly wrong and the qualifier then matches nothing.
 * Candidates that fail the overlap check are dropped rather than returned —
 * a wrong match silently lands in the user's library, while an unresolved
 * book is merely skipped.
 *
 * The title goes in as free text and the author as a bare `inauthor:`. Quoting
 * either demands an exact phrase match against one catalogue string, which a
 * photographed spine will not reliably produce (LOS-199).
 */
export async function resolveDetectedBook(
  title: string,
  author: string | null,
): Promise<SearchResult | null> {
  // With no author there is nothing to qualify on, and the query would be the
  // free-text one below — so that pass is skipped rather than issued twice.
  if (author) {
    const qualified = `${bareQueryTerm(title)} inauthor:${bareQueryTerm(author)}`;
    const qualifiedResults = await searchBooks(qualified, 3);
    const match = qualifiedResults.find((r) => matchesDetectedBook(r, title, author));
    if (match) return match;
  }

  // No literal "by" -- Google Books tolerates it, but Open Library's search
  // treats it as a literal token and returns zero matches.
  const freeText = author ? `${title} ${author}` : title;
  const freeTextResults = await searchBooks(freeText, 5);
  return freeTextResults.find((r) => matchesDetectedBook(r, title, author)) ?? null;
}
