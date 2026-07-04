import { getAnthropic } from '../../lib/anthropic';
import { fetchBookContext, getCachedSummary, saveSummary } from '../../data/ai-data';

async function generateSummary(title: string, author: string, blurb?: string): Promise<string> {
  const blurbContext = blurb ? ` Here is some context about the book: ${blurb}.` : '';
  const prompt = `Write a 3-paragraph summary of the book '${title}' by ${author}.${blurbContext} Focus on key themes and why the book matters.`;

  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  return (response.content[0] as { type: 'text'; text: string }).text;
}

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
