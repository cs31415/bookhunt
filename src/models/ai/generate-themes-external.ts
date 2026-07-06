import { ANTHROPIC_MODEL, getAnthropic } from '../../lib/anthropic';
import { extractResponseText } from '../../lib/extract-response-text';
import { parseJsonResponse } from '../../lib/parse-json-response';

export interface GenreThemes {
  genres: string[];
  themes: string[];
}

export async function generateThemesExternal(title: string, authorName: string): Promise<GenreThemes> {
  const prompt = `For the book '${title}' by ${authorName}, generate a JSON object with two arrays: 'genres' (3-5 micro-genre tags like 'Popular Science', 'Paradigm-Shifter') and 'themes' (3-6 deeper thematic tags like 'altruism & selfishness', 'units of selection'). Return ONLY valid JSON, no other text.`;

  const response = await getAnthropic().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = extractResponseText(response, '{}');
  return parseJsonResponse<GenreThemes>(rawText);
}
