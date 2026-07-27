export function deslugify(value: string): string {
  return value.replace(/-/g, ' ').trim();
}

// Mirrors the frontend/backend slug convention so we can tell whether a
// provider-credited author name is the one a given slug actually refers to.
export function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Loose author-slug match: true when every token of the requested author slug
// is present in the candidate's slug. Lenient enough to survive extra credits
// (translators, "with ...", etc.) while still rejecting an unrelated author.
export function authorSlugMatches(candidateSlug: string, wantedSlug: string): boolean {
  if (!candidateSlug || !wantedSlug) return false;
  const candidateTokens = new Set(candidateSlug.split('-').filter(Boolean));
  const wantedTokens = wantedSlug.split('-').filter(Boolean);
  return wantedTokens.length > 0 && wantedTokens.every((token) => candidateTokens.has(token));
}
