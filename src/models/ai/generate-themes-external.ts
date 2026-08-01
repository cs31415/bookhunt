import { completeText } from '../../lib/llm/complete-text';
import { parseJsonResponse } from '../../lib/parse-json-response';
import { buildVocabularyClause, Vocabularies } from './build-vocabulary-clause';

export interface GenreThemes {
  genres: string[];
  themes: string[];
  moods: string[];
}

/**
 * Genres, themes and moods for one book that is not in the catalog.
 *
 * All three kinds get the catalog's existing vocabulary, not just themes: they
 * fragment identically without it -- 94 distinct genres across the library with
 * only 10 on more than one book. See buildVocabularyClause for why the wording
 * of the reuse instruction is the mechanism rather than a detail.
 */
export async function generateThemesExternal(
  title: string,
  authorName: string,
  vocabularies: Vocabularies = {},
): Promise<GenreThemes> {
  // 'genres' in the response, 'categories' in the vocabulary: the column is
  // named genres and BookDetailPage reads it, while the catalog-wide tag it is
  // drawn from lives in subjects. Same values, two homes -- see LOS-194.
  const prompt = `For the book '${title}' by ${authorName}, generate a JSON object with three arrays: 'genres' (3-5 micro-genre tags like 'Popular Science', 'Paradigm-Shifter'), 'themes' (3-6 deeper thematic tags like 'altruism & selfishness', 'units of selection'), and 'moods' (3-5 reader mood/feel tags like 'Mind-expanding', 'Rigorous').${buildVocabularyClause(vocabularies)} Return ONLY valid JSON, no other text.`;

  return completeText<GenreThemes>(prompt, {
    maxTokens: 1024,
    transform: (rawText) => parseJsonResponse<GenreThemes>(rawText),
  });
}
