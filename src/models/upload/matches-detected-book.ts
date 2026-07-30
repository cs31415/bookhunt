const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'by', 'with', 'from',
]);

function tokenize(text: string): string[] {
  const all = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    // Apostrophes are removed rather than treated as separators, so a possessive
    // stays one word: "Frommer's" tokenizes to `frommers`, matching the
    // "Frommers" and "*Frommers" spellings of the same publisher. Splitting on it
    // instead yields `frommer` plus a discarded `s`, which matches none of them.
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 2);
  const informative = all.filter((t) => !STOP_WORDS.has(t));
  return informative.length > 0 ? informative : all;
}

/** Fraction of the hint's title tokens that appear in the candidate's title, 0-1. */
function titleOverlap(candidateTitle: string, hintTitle: string): number {
  const hintTokens = tokenize(hintTitle);
  if (hintTokens.length === 0) return 0;
  const candidateTokens = new Set(tokenize(candidateTitle ?? ''));
  return hintTokens.filter((t) => candidateTokens.has(t)).length / hintTokens.length;
}

/** Do any informative tokens of `hint` appear among `values`' tokens? */
function anyTokenMatches(hint: string, values: string[]): boolean {
  const valueTokens = new Set(tokenize(values.join(' ')));
  return tokenize(hint).some((t) => valueTokens.has(t));
}

/**
 * Whether a publisher name refers to the same publisher as `hint`, under the
 * same normalisation scoring uses — so "Frommer's", "Frommers" and "*Frommers"
 * are one publisher. Exported so callers can pick which of a work's several
 * publishers to display.
 */
export function isSamePublisher(publisher: string, hint: string): boolean {
  return anyTokenMatches(hint, [publisher]);
}

export interface CandidateFields {
  title: string;
  authors: string[];
  publishers?: string[];
}

export interface MatchHint {
  title: string;
  author?: string | null;
  publisher?: string | null;
}

/** Tie-breaker weights. Title recall is the 0-1 base; these only reorder near-ties. */
const AUTHOR_BONUS = 0.5;
const PUBLISHER_BONUS = 0.5;

/**
 * Weight of title *precision* — how much of the candidate's title the hint
 * accounts for. Recall alone cannot separate candidates that both contain every
 * hint token: searching "Hong Kong" scores "Frommer's Hong Kong" and "Suzy
 * Gershman's Born to Shop Hong Kong, Shanghai & Beijing" identically, and the
 * winner is then decided by whatever order the provider happened to return.
 * Kept small so a longer title never outranks a genuinely better match.
 */
const PRECISION_WEIGHT = 0.3;

/**
 * How well a search result matches what we were looking for, as a number so
 * candidates can be ranked rather than merely accepted or rejected.
 *
 * Title overlap is the base and dominates; author and publisher are additive
 * bonuses that break ties between similar titles. That tie-breaking is the whole
 * point for books like `Hong Kong, , Frommer's`, where the title alone matches
 * dozens of unrelated editions and there is no author to narrow it.
 *
 * A field absent on either side scores zero rather than penalising. Google
 * routinely omits publisher from search results even for the right book, and a
 * detected spine often has no author, so treating absence as a mismatch would
 * systematically bury correct answers.
 *
 * Publisher naming is inconsistent across editions of one work — Open Library
 * returns "Frommer's", "Frommers" and "*Frommers" together — so matching is by
 * token after the same normalisation applied to titles, which collapses all
 * three to `frommers`.
 */
export function scoreCandidate(candidate: CandidateFields, hint: MatchHint): number {
  const hintTokens = tokenize(hint.title);
  const candidateTokens = new Set(tokenize(candidate.title ?? ''));
  const matched = hintTokens.filter((t) => candidateTokens.has(t)).length;

  const recall = hintTokens.length > 0 ? matched / hintTokens.length : 0;
  const precision = candidateTokens.size > 0 ? matched / candidateTokens.size : 0;

  let score = recall + PRECISION_WEIGHT * precision;

  if (hint.author && candidate.authors.length > 0 && anyTokenMatches(hint.author, candidate.authors)) {
    score += AUTHOR_BONUS;
  }
  if (
    hint.publisher &&
    candidate.publishers?.length &&
    anyTokenMatches(hint.publisher, candidate.publishers)
  ) {
    score += PUBLISHER_BONUS;
  }
  return score;
}

/**
 * Whether a search result plausibly is the book detected in a photo. Vision
 * titles are noisy (misread spines), so this checks token overlap rather than
 * equality: accept when nearly all detected title words appear in the result
 * title, or when most of them do and an author word matches too. Missing
 * authors on either side cannot disprove a match, so they count as matching.
 *
 * Kept as a boolean for the photo-scan path, which wants one answer rather than
 * a ranking. Import uses scoreCandidate instead and lets the reader choose.
 */
export function matchesDetectedBook(
  result: { title: string; authors: string[] },
  detectedTitle: string,
  detectedAuthor: string | null,
): boolean {
  if (tokenize(detectedTitle).length === 0) return false;

  const overlap = titleOverlap(result.title, detectedTitle);
  const authorMatches =
    !detectedAuthor ||
    result.authors.length === 0 ||
    anyTokenMatches(detectedAuthor, result.authors);

  return overlap >= 0.75 || (overlap >= 0.6 && authorMatches);
}
