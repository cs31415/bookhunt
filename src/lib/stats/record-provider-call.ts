import { BooksProvider } from '../books/books-types';
import { currentCallStats } from './call-stats-store';

/**
 * Counts one HTTP request to a books provider. A no-op outside a
 * runWithCallStats() scope, so provider calls made by routes that don't report
 * stats cost nothing.
 */
export function recordProviderCall(provider: BooksProvider): void {
  const stats = currentCallStats();
  if (!stats) return;
  stats.providerCalls.set(provider, (stats.providerCalls.get(provider) ?? 0) + 1);
}
