import { SearchResult } from './books-types';
import { slugifyName, authorSlugMatches } from '../slug';

/**
 * Choosing between editions of the same book (LOS-361).
 *
 * The provider's own ranking used to decide outright: resolveMatch took the
 * first candidate crediting the requested author, and a Tamil edition credits
 * Morgan Housel exactly as well as the English one does. That is how
 * /books/the-psychology-of-money-tamil came to exist -- the wrong edition won,
 * and its title became the slug, so the mistake is in the URL and not only the
 * metadata.
 *
 * Three checks, in the order they matter. Author is worth more than title
 * because a different author is a different book, while a differing title is
 * usually the same book dressed differently. Language is the tiebreaker rather
 * than a filter, so a genuinely foreign-language book is still reachable when
 * nothing English matches.
 */
const AUTHOR_MATCH = 4;
const TITLE_MATCH = 2;
const ENGLISH = 1;

/**
 * Case and punctuation are noise; everything else is kept.
 *
 * Notably it does NOT strip parenthesised text. That was the first attempt and
 * it defeated the whole check: "The Psychology of Money (Tamil)" reduced to
 * exactly "The Psychology of Money", so the edition this is meant to rank down
 * scored as an exact match. The "(Tamil)" is the signal, not noise.
 *
 * The cost is that a genuine subtitle in brackets no longer counts as an exact
 * title. That only forfeits the title points -- it disqualifies nothing -- so a
 * subtitled edition still wins on author and language.
 */
function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleMatches(candidate: string, wanted: string): boolean {
  return normalizeTitle(candidate) === normalizeTitle(wanted);
}

/**
 * The column holds both ISO codes and English names -- 251 rows say "en" and
 * 114 say "English" -- because it was defaulted to 'English' before providers
 * began writing codes into it. Anything comparing against 'en' alone would
 * quietly treat those 114 as foreign.
 */
export function isEnglish(language: string | null | undefined): boolean {
  if (!language) return false;
  const value = language.trim().toLowerCase();
  return value === 'en' || value === 'eng' || value === 'english' || value.startsWith('en-');
}

function score(match: SearchResult, wantedTitle: string, authorSlug?: string): number {
  let total = 0;
  if (authorSlug && match.authors.some((n) => authorSlugMatches(slugifyName(n), authorSlug))) {
    total += AUTHOR_MATCH;
  }
  if (titleMatches(match.title, wantedTitle)) total += TITLE_MATCH;
  if (isEnglish(match.language)) total += ENGLISH;
  return total;
}

/**
 * The best candidate, or the provider's first if none scores at all.
 *
 * Ties keep the provider's order: it knows things this does not, and there is
 * no reason to reshuffle candidates this cannot tell apart.
 */
export function pickBestCandidate(
  matches: SearchResult[],
  wantedTitle: string,
  authorSlug?: string,
): SearchResult | null {
  if (matches.length === 0) return null;

  let best = matches[0];
  let bestScore = score(best, wantedTitle, authorSlug);

  for (const match of matches.slice(1)) {
    const current = score(match, wantedTitle, authorSlug);
    if (current > bestScore) {
      best = match;
      bestScore = current;
    }
  }

  return best;
}
