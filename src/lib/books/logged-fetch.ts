import { BooksProvider } from './books-types';
import { isBooksProviderLoggingEnabled } from './is-books-provider-logging-enabled';
import { httpAttempts, httpBackoffMs } from './books-retry-config';
import { recordProviderCall } from '../stats/record-provider-call';
import { isCallStatsScopeActive } from '../stats/call-stats-store';
import { cacheGet } from '../cache/cache-get';
import { isCacheEnabled } from '../cache/redis-client';
import { cacheSet } from '../cache/cache-set';
import { cacheKey } from '../cache/cache-key';
import { redactUrlSecrets } from './redact-url-secrets';
import { throttleOpenLibrary } from './open-library-rate-limiter';

// Open Library asks callers to identify themselves and throttles anonymous
// traffic more aggressively; sending nothing risks being lumped in with bots.
const HEADERS = { 'User-Agent': 'bookhunt/1.0 (+https://github.com/cs31415/bookhunt)' };

/**
 * Statuses worth trying again. Google Books returns intermittent 503s under
 * bursts — a single one silently demoted a lookup to the fallback provider and
 * produced a visibly worse match for a book Google had all along.
 */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/** Bump if the cached shape below changes. */
const CACHE_VERSION = 1;

/**
 * A specific volume or edition is effectively immutable; a search can pick up
 * newly indexed books, so it is held for a day rather than a week.
 */
const EDITION_TTL_SECONDS = 7 * 24 * 60 * 60;
const SEARCH_TTL_SECONDS = 24 * 60 * 60;

interface CachedResponse {
  status: number;
  body: string;
}

function ttlFor(url: string): number {
  return url.includes('/volumes/') || url.includes('/books/') || url.includes('/works/')
    ? EDITION_TTL_SECONDS
    : SEARCH_TTL_SECONDS;
}

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
  // Suppressed inside a stats scope: that request reports its own totals, and a
  // line per lookup would bury them. Retry warnings below are unaffected —
  // those report a provider misbehaving, not routine traffic.
  const logging = isBooksProviderLoggingEnabled() && !isCallStatsScopeActive();
  const maxAttempts = httpAttempts();
  const backoff = httpBackoffMs();
  const start = Date.now();
  // Bound once here, and never log `url` below: Google Books carries its API key
  // in the query string, so the raw URL is a credential (LOS-188). Anything
  // added to this function should reach for this, not the argument.
  const safeUrl = redactUrlSecrets(url);

  // Imports and photo scans resolve overlapping titles, and every book detail
  // view re-resolves the same volume id, so this is where the quota actually
  // goes: Google's free tier is 1,000 queries/day and Open Library serializes
  // callers at 1/sec.
  const caching = isCacheEnabled();
  const key = cacheKey('books:fetch', CACHE_VERSION, url);
  const cached = caching ? await cacheGet<CachedResponse>(key) : null;
  if (cached) {
    if (logging) {
      console.log(`[books:${provider}] ${safeUrl} -> ${cached.status} (cached), ${Date.now() - start}ms`);
    }
    // Deliberately not counted by recordProviderCall: no request left the
    // process, and counting it would overstate real quota consumption.
    return new globalThis.Response(cached.body, {
      status: cached.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Open Library serializes callers at 1/sec, and this is the only place
      // that knows a request is actually about to leave the process. Held by
      // each adapter before calling in, it also ran ahead of the cache check
      // above — so a fully cached lookup slept a second to reach a 4ms read,
      // and a book detail view paying for two lookups slept two (LOS-217).
      // Per attempt, not per lookup, for the same reason the counter below is:
      // a retry is a real request and owes the same second.
      if (provider === 'open_library') await throttleOpenLibrary();

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
        console.log(`[books:${provider}] ${safeUrl} -> ${response.status}, ${Date.now() - start}ms`);
      }

      // Only successes, and never anything in RETRYABLE: those are exactly the
      // transient failures the loop above exists to paper over, and caching one
      // would keep serving it for the whole TTL. Reading the body consumes it,
      // so the caller gets a fresh Response over the same text -- which is also
      // why this is gated on the cache being configured at all, rather than
      // rebuilding every response for a store that would discard it.
      if (caching && response.ok) {
        const body = await response.text();
        await cacheSet(key, { status: response.status, body }, ttlFor(url));
        return new globalThis.Response(body, {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        });
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
        console.log(`[books:${provider}] ${safeUrl} -> failed, ${Date.now() - start}ms`);
      }
      throw error;
    }
  }

  // Only reachable when the final attempt threw and the loop fell through.
  throw lastError;
}
