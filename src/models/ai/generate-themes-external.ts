import { completeText } from '../../lib/llm/complete-text';
import { parseJsonResponse } from '../../lib/parse-json-response';

export interface GenreThemes {
  genres: string[];
  themes: string[];
  moods: string[];
}

export async function generateThemesExternal(title: string, authorName: string): Promise<GenreThemes> {
  const prompt = `For the book '${title}' by ${authorName}, generate a JSON object with three arrays: 'genres' (3-5 micro-genre tags like 'Popular Science', 'Paradigm-Shifter'), 'themes' (3-6 deeper thematic tags like 'altruism & selfishness', 'units of selection'), and 'moods' (3-5 reader mood/feel tags like 'Mind-expanding', 'Rigorous'). Return ONLY valid JSON, no other text.`;

  return completeText<GenreThemes>(prompt, {
    maxTokens: 1024,
    transform: (rawText) => parseJsonResponse<GenreThemes>(rawText),
  });
}
