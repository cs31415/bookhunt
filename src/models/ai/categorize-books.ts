import {
  appendBookSubjects,
  getTagVocabulary,
  updateBookAiMetadata,
} from '../../data/ai-data';
import { foldThemes } from './fold-themes';
import { categorizeBooksExternal } from './categorize-books-external';
import { curateSubjects } from '../../lib/books/curate-subjects';

// Enough of the catalog's vocabulary for the model to find a fit, without the
// prompt turning into a list the books themselves have to compete with.
const VOCABULARY_LIMIT = 150;

export interface BookToCategorize {
  id: number;
  title: string;
  authorName: string;
}

export interface CategorizedBook {
  id: number;
  categories: string[];
  themes: string[];
  moods: string[];
}

/**
 * Categorize a batch of books and persist the result.
 *
 * Vocabularies are read per call, not per process: each batch feeds the next
 * one's prompt, which is how a catalog converges on shared tags instead of
 * every batch independently inventing its own phrasing. That is also why the
 * backfill runs batches in sequence.
 *
 * Categories land in two places on purpose. books.genres holds just this
 * book's categories, which is what BookDetailPage renders; books.subjects gets
 * them appended alongside the provider's tags, which is what the library's
 * pills tally.
 */
export async function categorizeBooks(books: BookToCategorize[]): Promise<CategorizedBook[]> {
  if (books.length === 0) return [];

  const [categoryVocabulary, themeVocabulary, moodVocabulary] = await Promise.all([
    getTagVocabulary('subjects', VOCABULARY_LIMIT),
    getTagVocabulary('themes', VOCABULARY_LIMIT),
    getTagVocabulary('moods', VOCABULARY_LIMIT),
  ]);

  const results = await categorizeBooksExternal(
    books.map(({ title, authorName }) => ({ title, authorName })),
    { categories: categoryVocabulary, themes: themeVocabulary, moods: moodVocabulary },
  );

  const categorized: CategorizedBook[] = [];
  for (const result of results) {
    const book = books[result.index];
    // The prompt asks for reuse; folding is what enforces it when the model
    // paraphrases a tag it was shown. Each kind folds against its own list.
    const categories = foldThemes(result.categories, categoryVocabulary);
    const themes = foldThemes(result.themes, themeVocabulary);
    const moods = foldThemes(result.moods, moodVocabulary);

    await updateBookAiMetadata(book.id, categories, themes, moods);
    // books.genres keeps the model's wording; books.subjects is curated, so
    // one set of rules decides what that column may hold (LOS-300).
    await appendBookSubjects(book.id, curateSubjects(categories));

    categorized.push({ id: book.id, categories, themes, moods });
  }

  return categorized;
}
