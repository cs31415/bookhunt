import { BooksProvider } from './books-types';
import { isBooksProviderLoggingEnabled } from './is-books-provider-logging-enabled';
import { httpAttempts, httpBackoffMs } from './books-retry-config';
import { recordProviderCall } from '../stats/record-provider-call';

// Open Library asks callers to identify themselves and throttles anonymous
// traffic more aggressively; sending nothing risks being lumped in with bots.
const HEADERS = { 'User-Agent': 'bookhunt/1.0 (+https://github.com/cs31415/bookhunt)' };

/**
 * Statuses worth trying again. Google Books returns intermittent 503s under
 * bursts — a single one silently demoted a lookup to the fallback provider and
 * produced a visibly worse match for a book Google had all along.
 */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

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
  const maxAttempts = httpAttempts();
  const backoff = httpBackoffMs();
  const start = Date.now();

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Counted per attempt rather than per lookup: a retry is another request
      // against the provider's quota, and hiding it would understate the cost.
      recordProviderCall(provider);
      const response = await fetch(url, { headers: HEADERS });

      if (RETRYABLE.has(response.status) && attempt < maxAttempts) {
        // Always logged, not just when provider logging is on: a silent retry
        // that eventually succeeds still says something about provider health.
        console.warn(
          `[books:${provider}] ${response.status} on attempt ${attempt}/${maxAttempts}, retrying`,
        );
        await delay(backoff * attempt);
        continue;
      }

      if (logging) {
        console.log(`[books:${provider}] ${url} -> ${response.status}, ${Date.now() - start}ms`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        console.warn(
          `[books:${provider}] request failed on attempt ${attempt}/${maxAttempts}, retrying:`,
          error,
        );
        await delay(backoff * attempt);
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
