import { normalizeThemeKey } from '../../lib/themes/normalize-theme-key';

/**
 * Rewrite generated themes to the spelling the catalog already uses.
 *
 * The prompt asks the model to reuse the existing vocabulary, but it still
 * paraphrases -- capitalising differently, dropping a hyphen, adding an
 * article. Those variants each become their own theme in the database, and a
 * theme of one book is not something anyone can filter by. Folding on write
 * means the near-miss lands on the tag it was meant to be.
 *
 * `vocabulary` arrives most-used first (fn_theme_vocabulary), so when several
 * spellings of one theme are already in circulation the winner is the one the
 * catalog uses most, not whichever came back first.
 *
 * Folding can collapse two generated themes into one, hence the de-dup; order
 * is preserved so the model's own ranking survives.
 */
export function foldThemes(themes: string[], vocabulary: string[]): string[] {
  const canonical = new Map<string, string>();
  for (const theme of vocabulary) {
    const key = normalizeThemeKey(theme);
    if (!canonical.has(key)) canonical.set(key, theme);
  }

  const seen = new Set<string>();
  const folded: string[] = [];
  for (const theme of themes) {
    const key = normalizeThemeKey(theme);
    // An empty key means the theme was punctuation or whitespace only; there is
    // nothing to fold onto and nothing worth keeping.
    if (!key || seen.has(key)) continue;
    seen.add(key);
    folded.push(canonical.get(key) ?? theme);
  }
  return folded;
}
