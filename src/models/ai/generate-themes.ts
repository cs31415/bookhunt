import {
  fetchBookContext,
  getBookGenresThemes,
  getTagVocabulary,
  updateBookAiMetadata,
} from '../../data/ai-data';
import { foldThemes } from './fold-themes';
import { generateThemesExternal } from './generate-themes-external';

// Enough of the catalog's vocabulary for the model to find a fit, without the
// prompt turning into a list the book itself has to compete with. At three or
// four words a tag, 150 per kind is a few hundred tokens.
const VOCABULARY_LIMIT = 150;

export interface GenerateThemesOptions {
  /** Re-generate even when the book already has metadata. Only the backfill
   *  wants this; every other caller should take the stored answer. */
  force?: boolean;
}

export async function generateThemes(bookId: number, options: GenerateThemesOptions = {}) {
  const book = await fetchBookContext(bookId);
  if (!book) return null;

  if (!options.force) {
    const existing = await getBookGenresThemes(bookId);
    if (existing) return existing;
  }

  // Read fresh per book rather than once per process: each generated book feeds
  // the next one's prompt, which is how the vocabulary converges instead of
  // every book independently inventing its own phrasing.
  const [categories, themeVocabulary, moods] = await Promise.all([
    getTagVocabulary('subjects', VOCABULARY_LIMIT),
    getTagVocabulary('themes', VOCABULARY_LIMIT),
    getTagVocabulary('moods', VOCABULARY_LIMIT),
  ]);

  const parsed = await generateThemesExternal(book.title, book.author_name, {
    categories,
    themes: themeVocabulary,
    moods,
  });

  // The prompt asks for reuse; folding is what enforces it when the model
  // paraphrases a tag it was shown. Each kind folds against its own vocabulary.
  const folded = {
    genres: foldThemes(parsed.genres ?? [], categories),
    themes: foldThemes(parsed.themes ?? [], themeVocabulary),
    moods: foldThemes(parsed.moods ?? [], moods),
  };

  await updateBookAiMetadata(bookId, folded.genres, folded.themes, folded.moods);

  return folded;
}
