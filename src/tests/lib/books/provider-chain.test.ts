import {
  providerChain,
  primaryProvider,
  fallbackProvider,
  isProviderEnabled,
} from '../../../lib/books/provider-chain';

afterEach(() => {
  delete process.env.BOOKS_SEARCH_PROVIDERS;
});

/*
 * One switch for every provider call (LOS-389). It used to steer search only,
 * while import named google_books and open_library outright and author lookups
 * read a second variable — so setting the chain to google_books left three
 * paths still calling Open Library.
 */
describe('providerChain', () => {
  it('reads the configured chain in order', () => {
    process.env.BOOKS_SEARCH_PROVIDERS = 'open_library,google_books';

    expect(providerChain()).toEqual(['open_library', 'google_books']);
    expect(primaryProvider()).toBe('open_library');
    expect(fallbackProvider()).toBe('google_books');
  });

  // The point of the whole exercise: a single-provider chain has nowhere to
  // fall back to, and callers must do nothing rather than pick a default.
  it('reports no fallback for a single-provider chain', () => {
    process.env.BOOKS_SEARCH_PROVIDERS = 'google_books';

    expect(primaryProvider()).toBe('google_books');
    expect(fallbackProvider()).toBeNull();
    expect(isProviderEnabled('open_library')).toBe(false);
    expect(isProviderEnabled('google_books')).toBe(true);
  });

  // Unset keeps the historical two-provider behaviour: turning a provider off
  // should be something someone chose, not something a missing variable did.
  it('falls back to both providers when unset', () => {
    expect(providerChain()).toEqual(['google_books', 'open_library']);
    expect(fallbackProvider()).toBe('open_library');
  });

  it('is read per call, so configuration can change between calls', () => {
    process.env.BOOKS_SEARCH_PROVIDERS = 'google_books';
    expect(fallbackProvider()).toBeNull();

    process.env.BOOKS_SEARCH_PROVIDERS = 'google_books,open_library';
    expect(fallbackProvider()).toBe('open_library');
  });
});
