import { completeTextWithModel } from '../../lib/llm/complete-text';
import { parseJsonResponse } from '../../lib/parse-json-response';
import { SearchResult } from './search';

export async function searchBooksWithClaude(query: string, limit: number): Promise<SearchResult[]> {
  const maxResults = Math.min(Math.max(1, limit), 40);
  const prompt = `Suggest up to ${maxResults} books that best match this search: "${query.trim()}". Return ONLY a JSON array of objects with "title" and "author" fields (author can be null if unknown). Return ONLY valid JSON, no other text.`;

  try {
    const { result: suggestions, model } = await completeTextWithModel(prompt, {
      maxTokens: 1536,
      transform: (rawText) => parseJsonResponse<{ title: string; author: string | null }[]>(rawText),
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
        inLibrary: false,
        libraryStatus: null,
        source: model.model,
      }));
  } catch (error) {
    console.error('[llm] search failed, caller should fall back:', error);
    return [];
  }
}
