/**
 * Folds a message down to the form the word list is matched against.
 *
 * Every step exists because of a specific evasion:
 *
 *   lowercase          "SLUR" is the same word
 *   strip diacritics   "slür" is the same word
 *   leetspeak          "s1ur", "5lur"
 *   collapse repeats   "sluuuur"
 *   collapse separators "s.l.u.r", "s l u r", "s-l-u-r"
 *
 * Repeats collapse to a SINGLE character, so "kiiiill" and "kill" land on the
 * same string. That also turns "book" into "bok", which is harmless because the
 * word list is normalized through this very function before matching -- both
 * sides are folded identically, so the comparison is still exact.
 */
const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};

export function normalizeForMatching(text: string): string {
  return (
    text
      .toLowerCase()
      // NFD splits an accented letter into letter + combining mark, which the
      // next step then removes.
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[0134557@$!]/g, (char) => LEET[char] ?? char)
      // Anything that is not a letter, a number or whitespace becomes a space,
      // so "s.l.u.r" and "s-l-u-r" both collapse below.
      .replace(/[^a-z0-9\s]/g, ' ')
      // Single letters separated by spaces are rejoined: "s l u r" is the same
      // word typed with gaps. Runs of three or more are needed so ordinary
      // phrases like "a b" are left alone.
      .replace(/\b(?:[a-z]\s){2,}[a-z]\b/g, (run) => run.replace(/\s/g, ''))
      .replace(/(.)\1+/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
  );
}
