import { completeTextWithModel } from '../../lib/llm/complete-text';
import { parseJsonResponse } from '../../lib/parse-json-response';
import { SearchResult } from './search';

export async function searchBooksWithClaude(query: string, limit: number): Promise<SearchResult[]> {
  const maxResults = Math.min(Math.max(1, limit), 20);
  const prompt = `Suggest up to ${maxResults} books that best match this search: "${query.trim()}". Return ONLY a JSON array of objects with "title", "author" (can be null if unknown), "categories" (2-4 genre tags like 'Popular Science', 'Memoir'), and "moods" (2-4 reader mood/feel tags like 'Mind-expanding', 'Rigorous') fields. Return ONLY valid JSON, no other text.`;

  try {
    const { result: suggestions, model } = await completeTextWithModel(prompt, {
      maxTokens: 2048,
      transform: (rawText) =>
        parseJsonResponse<{ title: string; author: string | null; categories?: string[]; moods?: string[] }[]>(
          rawText,
        ),
    });

    return suggestions
      .filter((s) => s && s.title)
      .map((s) => ({
        googleBooksId: null,
        openLibraryId: null,
        title: s.title,
        authors: s.author ? [s.author] : [],
        year: null,
        publisher: null,
        pages: null,
        rating: null,
        coverUrl: null,
        isbn13: null,
        language: null,
        blurb: null,
        categories: s.categories ?? [],
        moods: s.moods ?? [],
        inLibrary: false,
        libraryStatus: null,
        source: model.model,
      }));
  } catch (error) {
    console.error('[llm] search failed, caller should fall back:', error);
    return [];
  }
}
