import { BooksProvider, SearchResult } from './books-types';
import { getBooksProviderAdapter } from './get-books-provider-adapter';
import { AllProvidersFailedError } from './all-providers-failed-error';
import { primaryAttempts, primaryBackoffMs } from './books-retry-config';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One provider, retried (LOS-318).
 *
 * Import has had this outer loop since it was written; search never did, so a
 * search got two HTTP attempts and then gave up while an import of the same
 * book got six. That asymmetry was invisible while a second provider covered
 * the gap.
 *
 * Only failures are retried. A provider that answers "no results" is believed
 * the first time and asking again would just be slower.
 */
async function searchOneProvider(
  provider: BooksProvider,
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  const attempts = primaryAttempts();
  let lastError: unknown;

  for (let round = 1; round <= attempts; round += 1) {
    if (round > 1) await delay(primaryBackoffMs() * (round - 1));
    try {
      return await getBooksProviderAdapter(provider).search(query, limit);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

/**
 * Searches the chain in order, and says which kind of nothing it found.
 *
 * The distinction is the point. Returning `[]` for a provider that answered
 * "no such book" is honest; returning `[]` because every provider was rate
 * limited is a lie the caller cannot see through, and it is exactly what turned
 * a transient Google 503 into "this book does not exist".
 *
 * So: if any provider answered, an empty result is a real answer and is
 * returned. If none did, this throws.
 */
export async function searchWithFallback(
  chain: BooksProvider[],
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  const failures: unknown[] = [];
  let someoneAnswered = false;

  for (const provider of chain) {
    try {
      const results = await searchOneProvider(provider, query, limit);
      if (results.length > 0) return results;
      // Answered, with nothing. Worth trying the next catalogue, but this is
      // now a real "not found" rather than silence.
      someoneAnswered = true;
    } catch (error) {
      failures.push(error);
      console.error(`[books] ${provider} search failed after retries:`, error);
    }
  }

  if (!someoneAnswered && failures.length > 0) {
    throw new AllProvidersFailedError(failures);
  }

  return [];
}
