import { searchBooks, SearchResult } from '../ai/search';
import { matchesDetectedBook } from './matches-detected-book';
import { bareQueryTerm } from '../../lib/books/bare-query-term';
import { firstAuthorSurname } from '../../lib/books/first-author-surname';

/**
 * Resolve a vision-detected book to catalog metadata. A fielded query
 * (intitle/inauthor) runs first because free-text ranking can put an
 * unrelated book on top; free text remains as the fallback since detected
 * titles are often slightly misread and then match no fielded query.
 * Candidates that fail the overlap check are dropped rather than returned —
 * a wrong match silently lands in the user's library, while an unresolved
 * book is merely skipped.
 *
 * Both halves of the fielded query are stripped down first: Google matches a
 * quoted qualifier literally, so a spine's exclamation mark or its full
 * "Firstname M. Lastname" byline is enough to empty the result set, and the
 * pass then falls through for a reason that has nothing to do with the book
 * (LOS-199). matchesDetectedBook is what keeps the looser query honest here —
 * unlike the import path, nothing is offered to a reader to confirm.
 */
export async function resolveDetectedBook(
  title: string,
  author: string | null,
): Promise<SearchResult | null> {
  const quotedTitle = `"${bareQueryTerm(title)}"`;
  const surname = firstAuthorSurname(author);
  const fielded = surname
    ? `intitle:${quotedTitle} inauthor:"${surname}"`
    : `intitle:${quotedTitle}`;
  const fieldedResults = await searchBooks(fielded, 3);
  const fieldedMatch = fieldedResults.find((r) => matchesDetectedBook(r, title, author));
  if (fieldedMatch) return fieldedMatch;

  // No literal "by" -- Google Books tolerates it, but Open Library's search
  // treats it as a literal token and returns zero matches.
  const freeText = author ? `${title} ${author}` : title;
  const freeTextResults = await searchBooks(freeText, 5);
  return freeTextResults.find((r) => matchesDetectedBook(r, title, author)) ?? null;
}
