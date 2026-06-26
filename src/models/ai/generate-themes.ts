import { anthropic } from '../../lib/anthropic';
import { fetchBookContext, getBookGenresThemes, updateBookAiMetadata } from '../../data/ai-data';

export async function generateThemes(bookId: number) {
  const book = await fetchBookContext(bookId);
  if (!book) return null;

  const existing = await getBookGenresThemes(bookId);
  if (existing) return existing;

  const prompt = `For the book '${book.title}' by ${book.author_name}, generate a JSON object with two arrays: 'genres' (3-5 micro-genre tags like 'Popular Science', 'Paradigm-Shifter') and 'themes' (3-6 deeper thematic tags like 'altruism & selfishness', 'units of selection'). Return ONLY valid JSON, no other text.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (response.content[0] as { type: 'text'; text: string }).text;
  const parsed: { genres: string[]; themes: string[] } = JSON.parse(raw);

  await updateBookAiMetadata(bookId, parsed.genres, parsed.themes);

  return { genres: parsed.genres, themes: parsed.themes };
}
