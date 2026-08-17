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
 * A subtitle is delimited: it follows a colon, a spaced dash, or sits in a
 * trailing parenthetical. That punctuation is the whole signal — words a title
 * simply carries on with are part of the title, not a subtitle, which is why
 * "Foundation and Empire" cannot be shortened to "Foundation".
 */
const SUBTITLE_DELIMITER = /\s*[:;]\s+|\s+[-–—]\s+/;

/** The title with any delimited subtitle or trailing parenthetical removed. */
function mainTitle(title: string): string {
  const stripped = (title ?? '')
    .trim()
    // "Dune (Dune Chronicles, Book 1)" -> "Dune". Repeated, because a title can
    // trail more than one: "Foundation (Foundation, #1) (Everyman's Library)".
    .replace(/(\s*[([][^)\]]*[)\]])+$/, '')
    .split(SUBTITLE_DELIMITER)[0]
    .trim();
  // A title that is *only* a parenthetical, or only punctuation, keeps its
  // original text rather than reducing to nothing and matching everything.
  return tokenize(stripped).length > 0 ? stripped : (title ?? '').trim();
}

/** Whether two titles cover each other well enough to name the same book. */
function titlesAgree(a: string, b: string): boolean {
  return titleOverlap(a, b) >= TITLE_CONFIRM_OVERLAP && titleOverlap(b, a) >= TITLE_CONFIRM_OVERLAP;
}

/**
 * Whether candidate and hint name the same book when either side may be the one
 * omitting a subtitle.
 *
 * matchesTitleAndAuthor measures overlap in one direction only — how much of the
 * *hint's* title the candidate covers — which is right wherever the hint is the
 * terse side, as a CSV cell is. It is wrong when the hint is the verbose side: an
 * LLM answers with "Broca's Brain: Reflections on the Romance of Science" for a
 * catalog row titled "Broca's Brain", and every catalog token is present but only
 * a third of the LLM's, so the one-way test rejects a book the reader plainly
 * owns.
 *
 * Accepting either direction outright was the first answer to that and it claimed
 * far too much: any short title is contained in a longer one, so the hint
 * "Foundation" matched a library holding "Second Foundation" and told the reader
 * they owned a book they do not (LOS-275). Both directions have to hold, and the
 * subtitle case is served by dropping the subtitle rather than by loosening the
 * comparison.
 *
 * Only when exactly one side carries a subtitle, because a series prefix puts the
 * distinguishing words *after* the colon: "Star Wars: Heir to the Empire" and
 * "Star Wars: Darth Bane" both reduce to "Star Wars", and stripping both sides
 * would fuse two unrelated books.
 */
export function matchesTitleAndAuthorIgnoringSubtitle(
  candidate: CandidateFields,
  hint: MatchHint,
): boolean {
  // The same strictness as matchesTitleAndAuthor: the author has to confirm the
  // identification, so absent on either side is never a match.
  if (!hint.author || candidate.authors.length === 0) return false;
  if (!anyTokenMatches(hint.author, candidate.authors)) return false;

  const candidateTitle = candidate.title ?? '';
  if (titlesAgree(candidateTitle, hint.title)) return true;

  const candidateMain = mainTitle(candidateTitle);
  const hintMain = mainTitle(hint.title);
  const candidateHasSubtitle = candidateMain !== candidateTitle.trim();
  const hintHasSubtitle = hintMain !== hint.title.trim();
  if (candidateHasSubtitle === hintHasSubtitle) return false;

  return titlesAgree(candidateMain, hintMain);
}
