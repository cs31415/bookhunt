import { BooksProvider } from './books-types';

/**
 * Every provider in the chain failed, so nothing in the catalogue was actually
 * consulted (LOS-318).
 *
 * Distinct from an empty result. A provider that answered "nothing" has told us
 * something true; a chain that never got an answer has told us nothing at all,
 * and reporting the two the same way is what makes a rate limit look like a
 * book that does not exist.
 *
 * That mattered less when the chain had two providers and one covered for the
 * other. Running Google alone, this is the difference between "no such book"
 * and "search is down", which a reader deserves to be told apart.
 */
export class AllProvidersFailedError extends Error {
  constructor(public readonly failures: unknown[]) {
    super('every books provider failed');
    this.name = 'AllProvidersFailedError';
    this.cause = failures[0];
  }

  /** True when any provider refused for capacity rather than breaking. */
  get rateLimited(): boolean {
    return this.failures.some(
      (f) => typeof f === 'object' && f !== null && (f as { status?: number }).status === 429,
    );
  }

  get providers(): BooksProvider[] {
    return this.failures
      .map((f) => (f as { provider?: BooksProvider }).provider)
      .filter((p): p is BooksProvider => Boolean(p));
  }
}
