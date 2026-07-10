import { fetchBookContext, saveSummary } from '../../data/ai-data';
import { generateSummary } from './generate-summary';

export async function regenerateSummary(bookId: number) {
  const book = await fetchBookContext(bookId);
  if (!book) return null;

  const summary = await generateSummary(book.title, book.author_name, book.blurb);
  return saveSummary(bookId, summary);
}
