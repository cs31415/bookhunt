const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'by', 'with', 'from',
]);

function tokenize(text: string): string[] {
  const all = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 2);
  const informative = all.filter((t) => !STOP_WORDS.has(t));
  return informative.length > 0 ? informative : all;
}

/**
 * Whether a search result plausibly is the book detected in a photo. Vision
 * titles are noisy (misread spines), so this checks token overlap rather than
 * equality: accept when nearly all detected title words appear in the result
 * title, or when most of them do and an author word matches too. Missing
 * authors on either side cannot disprove a match, so they count as matching.
 */
export function matchesDetectedBook(
  result: { title: string; authors: string[] },
  detectedTitle: string,
  detectedAuthor: string | null,
): boolean {
  const detected = tokenize(detectedTitle);
  if (detected.length === 0) return false;

  const resultTitleTokens = new Set(tokenize(result.title ?? ''));
  const titleOverlap = detected.filter((t) => resultTitleTokens.has(t)).length / detected.length;

  const resultAuthorTokens = new Set(tokenize(result.authors.join(' ')));
  const authorMatches =
    !detectedAuthor ||
    result.authors.length === 0 ||
    tokenize(detectedAuthor).some((t) => resultAuthorTokens.has(t));

  return titleOverlap >= 0.75 || (titleOverlap >= 0.6 && authorMatches);
}
