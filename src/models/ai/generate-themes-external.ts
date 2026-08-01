import { completeText } from '../../lib/llm/complete-text';
import { parseJsonResponse } from '../../lib/parse-json-response';

export interface GenreThemes {
  genres: string[];
  themes: string[];
  moods: string[];
}

/**
 * Asked for themes cold, the model coins a fresh phrase for every book, so
 * almost no two books share one and the library's theme filter has nothing to
 * group by. Moods avoid this by accident -- 'Reflective', 'Rigorous' and the
 * rest are a small conventional set the model returns to on its own. Themes
 * have no such set, so we supply one: the tags the catalog already uses,
 * most-used first (fn_theme_vocabulary).
 *
 * Reuse is a preference, not a constraint. A book whose theme genuinely is not
 * in the list should still get the right tag -- that is how the vocabulary
 * grows -- and forcing a fit would produce tags that are shared but wrong.
 */
export async function generateThemesExternal(
  title: string,
  authorName: string,
  vocabulary: string[] = [],
): Promise<GenreThemes> {
  // Omitted entirely on an empty catalog: an empty list is not a weaker hint,
  // it is a confusing one.
  const vocabularyClause =
    vocabulary.length > 0
      ? ` Themes already in use elsewhere in this catalog: ${vocabulary.join(', ')}. Prefer a theme from that list whenever one genuinely fits the book, copying its capitalisation and punctuation exactly; coin a new theme only when nothing in the list applies.`
      : '';

  const prompt = `For the book '${title}' by ${authorName}, generate a JSON object with three arrays: 'genres' (3-5 micro-genre tags like 'Popular Science', 'Paradigm-Shifter'), 'themes' (3-6 deeper thematic tags like 'altruism & selfishness', 'units of selection'), and 'moods' (3-5 reader mood/feel tags like 'Mind-expanding', 'Rigorous').${vocabularyClause} Return ONLY valid JSON, no other text.`;

  return completeText<GenreThemes>(prompt, {
    maxTokens: 1024,
    transform: (rawText) => parseJsonResponse<GenreThemes>(rawText),
  });
}
