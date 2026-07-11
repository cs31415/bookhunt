import { BooksProvider, SearchResult } from './books-types';
import { getBooksProviderAdapter } from './get-books-provider-adapter';

export async function searchWithFallback(
  chain: BooksProvider[],
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  for (const provider of chain) {
    try {
      const results = await getBooksProviderAdapter(provider).search(query, limit);
      if (results.length > 0) return results;
    } catch (error) {
      console.error(`[books] ${provider} search failed, trying next provider:`, error);
    }
  }
  return [];
}
