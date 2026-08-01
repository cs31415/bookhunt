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
 * Reuse is a rename, not a selection, and the wording works hard to keep it
 * that way. Asked merely to "prefer" a listed theme, the model anchors on the
 * list and answers with it: The Tao of Pooh lost 'the art of effortless
 * action' -- the book's whole subject -- and got 'Individual Agency' back,
 * and across a 64-book run 155 of 321 themes were replaced that way. So the
 * prompt fixes the order (decide, then rename), states that related, broader
 * or same-subject is not a match, shows that failure as the example, and says
 * outright that new themes are expected. A theme that is shared but wrong is
 * worse than one that is right and rare.
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
      ? ` Themes already in use elsewhere in this catalog: ${vocabulary.join(', ')}. Decide this book's themes on their own merits first. Then swap in a theme from that list only where it means the same thing as the theme you chose, copying its capitalisation and punctuation exactly. Merely related, broader, or in the same subject area is NOT a match: a book about wu wei needs 'the art of effortless action', and answering 'Individual Agency' because it is on the list would be wrong. Keep your own wording wherever the list holds no true equivalent -- most books need at least one theme that is not on it.`
      : '';

  const prompt = `For the book '${title}' by ${authorName}, generate a JSON object with three arrays: 'genres' (3-5 micro-genre tags like 'Popular Science', 'Paradigm-Shifter'), 'themes' (3-6 deeper thematic tags like 'altruism & selfishness', 'units of selection'), and 'moods' (3-5 reader mood/feel tags like 'Mind-expanding', 'Rigorous').${vocabularyClause} Return ONLY valid JSON, no other text.`;

  return completeText<GenreThemes>(prompt, {
    maxTokens: 1024,
    transform: (rawText) => parseJsonResponse<GenreThemes>(rawText),
  });
}
