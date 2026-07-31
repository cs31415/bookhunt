import { BooksProvider } from './books-types';
import { isBooksProviderLoggingEnabled } from './is-books-provider-logging-enabled';

// Open Library asks callers to identify themselves and throttles anonymous
// traffic more aggressively; sending nothing risks being lumped in with bots.
const HEADERS = { 'User-Agent': 'bookhunt/1.0 (+https://github.com/cs31415/bookhunt)' };

/**
 * Statuses worth trying again. Google Books returns intermittent 503s under
 * bursts — a single one silently demoted a lookup to the fallback provider and
 * produced a visibly worse match for a book Google had all along.
 */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = 250;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches from a books provider, retrying transient failures.
 *
 * Retries are here rather than in each adapter because both providers are
 * burst-flaky in the same way, and because the adapters cannot usefully
 * distinguish a failed request from an empty result once they have returned []
 * — which is exactly how a 503 came to look like "this book does not exist".
 */
export async function loggedFetch(provider: BooksProvider, url: string): Promise<globalThis.Response> {
  const logging = isBooksProviderLoggingEnabled();
  const start = Date.now();

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { headers: HEADERS });

      if (RETRYABLE.has(response.status) && attempt < MAX_ATTEMPTS) {
        // Always logged, not just when provider logging is on: a silent retry
        // that eventually succeeds still says something about provider health.
        console.warn(
          `[books:${provider}] ${response.status} on attempt ${attempt}/${MAX_ATTEMPTS}, retrying`,
        );
        await delay(BACKOFF_MS * attempt);
        continue;
      }

      if (logging) {
        console.log(`[books:${provider}] ${url} -> ${response.status}, ${Date.now() - start}ms`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        console.warn(
          `[books:${provider}] request failed on attempt ${attempt}/${MAX_ATTEMPTS}, retrying:`,
          error,
        );
        await delay(BACKOFF_MS * attempt);
        continue;
      }
      if (logging) {
        console.log(`[books:${provider}] ${url} -> failed, ${Date.now() - start}ms`);
      }
      throw error;
    }
  }

  // Only reachable when the final attempt threw and the loop fell through.
  throw lastError;
}
