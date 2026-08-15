/**
 * Terms a private message may not contain.
 *
 * Written naturally. The matcher folds these through the same normalizer as the
 * message, so the two sides can never drift apart.
 *
 * Deliberately short. A long list is a long list of false positives, and this
 * is a word-list filter rather than a classifier: it is meant to stop the
 * obvious, not to adjudicate. The terms below stand in for the slurs and
 * threats a real list would carry; extend it in place.
 */
export const BANNED_TERMS: readonly string[] = [
  // Threats of violence, which is the category worth stopping outright.
  'kill yourself',
  'kys',
  'i will find you',
  'i will kill you',
  // Placeholder for the slur list a production deployment would carry.
  'slur',
];
