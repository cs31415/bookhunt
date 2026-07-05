import { getAnthropic } from '../../lib/anthropic';
import { parseJsonResponse } from '../../lib/parse-json-response';
import { fetchBookContext, getBookGenresThemes, updateBookAiMetadata } from '../../data/ai-data';

export async function generateThemes(bookId: number) {
  const book = await fetchBookContext(bookId);
  if (!book) return null;

  const existing = await getBookGenresThemes(bookId);
  if (existing) return existing;

  const prompt = `For the book '${book.title}' by ${book.author_name}, generate a JSON object with two arrays: 'genres' (3-5 micro-genre tags like 'Popular Science', 'Paradigm-Shifter') and 'themes' (3-6 deeper thematic tags like 'altruism & selfishness', 'units of selection'). Return ONLY valid JSON, no other text.`;

  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const rawText = textBlock && 'text' in textBlock ? textBlock.text : '{}';
  const parsed = parseJsonResponse<{ genres: string[]; themes: string[] }>(rawText);

  await updateBookAiMetadata(bookId, parsed.genres, parsed.themes);

  return { genres: parsed.genres, themes: parsed.themes };
}
