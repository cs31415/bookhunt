import { BooksProvider } from './books-types';
import { isBooksProviderLoggingEnabled } from './is-books-provider-logging-enabled';

// Open Library asks callers to identify themselves and throttles anonymous
// traffic more aggressively; sending nothing risks being lumped in with bots.
const HEADERS = { 'User-Agent': 'bookhunt/1.0 (+https://github.com/cs31415/bookhunt)' };

export async function loggedFetch(provider: BooksProvider, url: string): Promise<globalThis.Response> {
  if (!isBooksProviderLoggingEnabled()) {
    return fetch(url, { headers: HEADERS });
  }

  const start = Date.now();
  try {
    const response = await fetch(url, { headers: HEADERS });
    console.log(`[books:${provider}] ${url} -> ${response.status}, ${Date.now() - start}ms`);
    return response;
  } catch (error) {
    console.log(`[books:${provider}] ${url} -> failed, ${Date.now() - start}ms`);
    throw error;
  }
}
