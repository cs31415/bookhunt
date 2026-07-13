import { searchBooks, SearchResult } from '../ai/search';
import { matchesDetectedBook } from './matches-detected-book';

/**
 * Resolve a vision-detected book to catalog metadata. A fielded Google Books
 * query (intitle/inauthor) runs first because free-text ranking can put an
 * unrelated book on top; free text remains as the fallback since detected
 * titles are often slightly misread and then match no fielded query.
 * Candidates that fail the overlap check are dropped rather than returned —
 * a wrong match silently lands in the user's library, while an unresolved
 * book is merely skipped.
 */
export async function resolveDetectedBook(
  title: string,
  author: string | null,
): Promise<SearchResult | null> {
  const quotedTitle = `"${title.replace(/"/g, '').trim()}"`;
  const fielded = author
    ? `intitle:${quotedTitle} inauthor:"${author.replace(/"/g, '').trim()}"`
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
