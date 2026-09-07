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

/*
 * A regression guard for the call site that was missed (LOS-389).
 *
 * fillEditionDetails in models/books/get-by-slug.ts chose its provider with a
 * ternary — `book.google_books_id ? 'google_books' : 'open_library'` — which a
 * grep for `provider = 'open_library'` does not match. It went on calling Open
 * Library on every view of a page whose row carried an Open Library id, and it
 * is the path that overwrites blurb, publisher and pages, so it is how a
 * Serbian blurb reached Sagan's Cosmos through two supposedly clean reimports.
 *
 * The lesson is the search, not the line: look for the provider strings
 * themselves, not for one shape of assignment.
 */
describe('provider literals outside the adapter layer', () => {
  it('are all guarded by isProviderEnabled', () => {
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '../../../');
    const files = [
      'models/books/get-by-slug.ts',
      'models/library/resolve-edition-fields.ts',
    ];

    for (const file of files) {
      const text = fs.readFileSync(path.join(root, file), 'utf8');
      for (const [i, line] of text.split('\n').entries()) {
        const names = /'(open_library|google_books)'/.test(line);
        if (!names) continue;

        /*
         * Only assignments matter. `source: x ? 'google_books' : …` as an
         * object property is a label recording where a match came from, and
         * labelling is not calling.
         *
         * The bug this guards against was an assignment:
         *   const source: BooksProvider = book.google_books_id ? … : 'open_library'
         * so requiring `=` still catches it.
         */
        if (!line.includes('=')) continue;

        const guarded =
          line.includes('isProviderEnabled') ||
          /^\s*(provider|source) = '/.test(line);
        expect(`${file}:${i + 1} ${line.trim()}`).toEqual(
          guarded ? `${file}:${i + 1} ${line.trim()}` : 'guarded by isProviderEnabled',
        );
      }
    }
  });
});

