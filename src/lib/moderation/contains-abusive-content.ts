import { BANNED_TERMS } from './banned-terms';
import { normalizeForMatching } from './normalize-text';

/**
 * True when the message contains a banned term.
 *
 * Matched on word boundaries, not as a substring. A substring match is how a
 * filter ends up refusing "Scunthorpe", "classic" and "therapist" -- the
 * canonical failure of this kind of list, and worse than not filtering, because
 * the reader cannot see what is wrong with what they wrote.
 *
 * Multi-word terms are matched as phrases, with the same boundary rule at each
 * end.
 *
 * The terms are folded through the same normalizer as the message, so the list
 * can be written naturally and the two sides can never drift apart.
 */
const NORMALIZED_TERMS = BANNED_TERMS.map(normalizeForMatching).filter(
  (term) => term.length > 0,
);

export function containsAbusiveContent(text: string): boolean {
  const normalized = normalizeForMatching(text);
  if (normalized.length === 0) return false;

  return NORMALIZED_TERMS.some((term) => {
    const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(term)}(?:\\s|$)`);
    return pattern.test(normalized);
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
