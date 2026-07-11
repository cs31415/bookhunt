import { AuthorDetails, BooksProvider } from './books-types';
import { getBooksProviderAdapter } from './get-books-provider-adapter';

export async function getAuthorDetailsWithFallback(
  chain: BooksProvider[],
  name: string,
): Promise<AuthorDetails> {
  for (const provider of chain) {
    const adapter = getBooksProviderAdapter(provider);
    if (!adapter.getAuthorDetails) continue;

    try {
      const result = await adapter.getAuthorDetails(name);
      if (result.birthYear !== null || result.bio !== null) return result;
    } catch (error) {
      console.error(`[books] ${provider} author lookup failed, trying next provider:`, error);
    }
  }
  return { birthYear: null, bio: null };
}
