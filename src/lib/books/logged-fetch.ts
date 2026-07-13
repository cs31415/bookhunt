import { BooksProvider } from './books-types';
import { isBooksProviderLoggingEnabled } from './is-books-provider-logging-enabled';

export async function loggedFetch(provider: BooksProvider, url: string): Promise<globalThis.Response> {
  if (!isBooksProviderLoggingEnabled()) {
    return fetch(url);
  }

  const start = Date.now();
  try {
    const response = await fetch(url);
    console.log(`[books:${provider}] ${url} -> ${response.status}, ${Date.now() - start}ms`);
    return response;
  } catch (error) {
    console.log(`[books:${provider}] ${url} -> failed, ${Date.now() - start}ms`);
    throw error;
  }
}
