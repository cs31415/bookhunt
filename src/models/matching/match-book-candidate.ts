import { isSameIsbn } from '../../lib/books/normalize-isbn';

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
  isbn13?: string | null;
}

export interface MatchHint {
  title: string;
  author?: string | null;
  publisher?: string | null;
  isbn?: string | null;
}

/** Title overlap at which two titles are taken to name the same book. */
const TITLE_CONFIRM_OVERLAP = 0.75;

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
 * An ISBN identifies one edition outright, so a match settles the question —
 * this deliberately swamps every other signal, including a title that looks
 * nothing alike. Title wording varies between a book's editions and its
 * catalogue entries; its ISBN does not.
 */
const ISBN_BONUS = 10;

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

  if (isSameIsbn(hint.isbn, candidate.isbn13)) {
    score += ISBN_BONUS;
  }
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
 * Whether a candidate's title names the book the hint asked for, ignoring the
 * author entirely.
 *
 * The question this answers is narrower than "is this the right book": it is
 * whether the provider found something on the title it was given, or answered
 * with a different book by the same author. Google does the latter readily —
 * `Celebrations! inauthor:Barnabas Kindersley` returns exactly one volume, and
 * it is "Niños como yo" — and one confident wrong answer is worse than none,
 * because it is what the client preselects (LOS-199).
 *
 * The author is left out on purpose. It has already done its work as a query
 * qualifier, and requiring it again here would reject the correct edition of
 * any book whose author string the catalogue spells differently.
 */
export function titleAgrees(candidate: CandidateFields, hint: MatchHint): boolean {
  return titleOverlap(candidate.title, hint.title) >= TITLE_CONFIRM_OVERLAP;
}

/**
 * Whether a candidate agrees with the hint on both title and author — enough to
 * say it is the same book, not merely a plausible ranking.
 *
 * Deliberately stricter than a ranking score, which tolerates an author missing
 * on either side: that is right where absence is the norm and a match cannot be
 * disproved, and wrong here, where the caller is asking whether the author
 * *confirms* the identification. So a hint with no author, or a candidate
 * listing none, is never a match.
 */
export function matchesTitleAndAuthor(candidate: CandidateFields, hint: MatchHint): boolean {
  if (!hint.author || candidate.authors.length === 0) return false;
  return (
    titleOverlap(candidate.title, hint.title) >= TITLE_CONFIRM_OVERLAP &&
    anyTokenMatches(hint.author, candidate.authors)
  );
}

/**
 * Whether candidate and hint name the same book when either side may be the one
 * carrying a subtitle.
 *
 * matchesTitleAndAuthor measures overlap in one direction only — how much of the
 * *hint's* title the candidate covers — which is right wherever the hint is the
 * terse side, as a CSV cell is. It is wrong when the
 * hint is the verbose side: an LLM answers with "Broca's Brain: Reflections on
 * the Romance of Science" for a catalog row titled "Broca's Brain", and every
 * catalog token is present but only a third of the LLM's, so the one-way test
 * rejects a book the reader plainly owns. Trying it both ways accepts either
 * side omitting a subtitle.
 *
 * The cost is that a short title now matches any longer one containing it —
 * "Chronicle" against "The Wind-Up Bird Chronicle" — bounded by the author
 * having to agree as well. Worth it where the two sides are a catalog row and a
 * model's answer, both describing books someone already owns; not worth it for
 * the one-directional callers, which keep matchesTitleAndAuthor.
 */
export function matchesTitleAndAuthorEitherWay(candidate: CandidateFields, hint: MatchHint): boolean {
  return (
    matchesTitleAndAuthor(candidate, hint) ||
    matchesTitleAndAuthor(
      { title: hint.title, authors: hint.author ? [hint.author] : [] },
      { title: candidate.title, author: candidate.authors[0] ?? null },
    )
  );
}
