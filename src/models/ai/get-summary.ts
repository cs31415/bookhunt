import { fetchBookContext, getCachedSummary, saveSummary } from '../../data/ai-data';
import { generateSummary } from './generate-summary';

export async function getSummary(bookId: number) {
  const book = await fetchBookContext(bookId);
  if (!book) return null;

  if (book.blurb) {
    return { bookId, summary: book.blurb, generatedAt: null };
  }

  const cached = await getCachedSummary(bookId);
  if (cached) return cached;

  const summary = await generateSummary(book.title, book.author_name, book.blurb);
  return saveSummary(bookId, summary);
}
