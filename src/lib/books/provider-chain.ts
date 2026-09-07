import { BooksProvider } from './books-types';
import { parseBooksProviderConfig } from './parse-books-provider-config';

/**
 * The one place a provider is chosen (LOS-389).
 *
 * Every provider call in the API resolves through here, so BOOKS_SEARCH_PROVIDERS
 * genuinely governs which catalogues are reachable. It did not before: the
 * variable steered search while import named google_books and open_library
 * outright, and author lookups read a second variable of their own. Setting the
 * chain to google_books therefore left three paths still calling Open Library.
 *
 * Read per call rather than captured at import, so a test can set the variable
 * without reloading the module.
 */
export function providerChain(): BooksProvider[] {
  return parseBooksProviderConfig('BOOKS_SEARCH_PROVIDERS');
}

/** The catalogue asked first. */
export function primaryProvider(): BooksProvider {
  return providerChain()[0];
}

/**
 * The catalogue asked when the primary comes back empty, or none.
 *
 * Null is the answer for a single-provider chain, and callers are expected to
 * do nothing rather than substitute a default -- silently reaching for a
 * provider the configuration leaves out is the bug this module exists to close.
 */
export function fallbackProvider(): BooksProvider | null {
  return providerChain()[1] ?? null;
}

/** Whether a provider is configured at all, for paths that pick by stored id. */
export function isProviderEnabled(provider: BooksProvider): boolean {
  return providerChain().includes(provider);
}
