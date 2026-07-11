import { parseBooksProviderConfig } from '../../../lib/books/parse-books-provider-config';

const ENV_VAR = 'BOOKS_SEARCH_PROVIDERS';

describe('parseBooksProviderConfig', () => {
  const originalEnv = process.env[ENV_VAR];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[ENV_VAR];
    } else {
      process.env[ENV_VAR] = originalEnv;
    }
  });

  it('parses a multi-entry list in order', () => {
    process.env[ENV_VAR] = 'open_library,google_books';
    expect(parseBooksProviderConfig(ENV_VAR)).toEqual(['open_library', 'google_books']);
  });

  it('trims whitespace around entries', () => {
    process.env[ENV_VAR] = ' google_books , open_library ';
    expect(parseBooksProviderConfig(ENV_VAR)).toEqual(['google_books', 'open_library']);
  });

  it('rejects an unknown provider name', () => {
    process.env[ENV_VAR] = 'google_books,bing_books';
    expect(() => parseBooksProviderConfig(ENV_VAR)).toThrow(/Invalid BOOKS_SEARCH_PROVIDERS entry "bing_books"/);
  });

  it('defaults to google_books,open_library when the env var is unset', () => {
    delete process.env[ENV_VAR];
    expect(parseBooksProviderConfig(ENV_VAR)).toEqual(['google_books', 'open_library']);
  });

  it('defaults to google_books,open_library when the env var is blank', () => {
    process.env[ENV_VAR] = '   ';
    expect(parseBooksProviderConfig(ENV_VAR)).toEqual(['google_books', 'open_library']);
  });
});
