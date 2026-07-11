import { fetchBookContext, getBookGenresThemes, updateBookAiMetadata } from '../../data/ai-data';
import { generateThemesExternal } from './generate-themes-external';

export async function generateThemes(bookId: number) {
  const book = await fetchBookContext(bookId);
  if (!book) return null;

  const existing = await getBookGenresThemes(bookId);
  if (existing) return existing;

  const parsed = await generateThemesExternal(book.title, book.author_name);

  await updateBookAiMetadata(bookId, parsed.genres, parsed.themes, parsed.moods);

  return parsed;
}
