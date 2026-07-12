import { searchOpenLibrary } from '../../../lib/books/open-library-search-adapter';

jest.mock('../../../lib/books/open-library-rate-limiter', () => ({
  throttleOpenLibrary: jest.fn().mockResolvedValue(undefined),
  OPENLIBRARY_API_URL: 'https://openlibrary.org',
  OPENLIBRARY_COVERS_URL: 'https://covers.openlibrary.org',
}));

function mockFetch(handler: () => any) {
  global.fetch = jest.fn().mockImplementation(handler) as any;
}

const olDoc = {
  key: '/works/OL1W',
  title: 'Open Cat',
  author_name: ['OL Author'],
  cover_i: 99,
  first_publish_year: 2019,
  isbn: ['9789999999999', '123'],
  edition_key: ['OL7170815M'],
  subject: ['Cats', 'Humor'],
};

describe('searchOpenLibrary', () => {
  it('maps response fields correctly', async () => {
    mockFetch(() => Promise.resolve({ ok: true, json: async () => ({ docs: [olDoc] }) }));

    const [book] = await searchOpenLibrary('cats', 5);

    expect(book).toMatchObject({
      googleBooksId: null,
      openLibraryId: 'OL7170815M',
      title: 'Open Cat',
      authors: ['OL Author'],
      year: 2019,
      coverUrl: 'https://covers.openlibrary.org/b/id/99-M.jpg',
      isbn13: '9789999999999',
      publisher: null,
      pages: null,
      rating: null,
      language: null,
      blurb: null,
      categories: ['Cats', 'Humor'],
      moods: [],
      inLibrary: false,
      libraryStatus: null,
      source: 'open_library',
    });
  });

  it('requests the subject field and defaults categories to an empty array when absent', async () => {
    const doc = { ...olDoc, subject: undefined };
    mockFetch(() => Promise.resolve({ ok: true, json: async () => ({ docs: [doc] }) }));

    const [book] = await searchOpenLibrary('cats', 5);
    expect(book.categories).toEqual([]);
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('fields=key,title,author_name,cover_i,first_publish_year,isbn,edition_key,subject');
  });

  it('sets openLibraryId to null when doc has no edition_key', async () => {
    const doc = { ...olDoc, edition_key: undefined };
    mockFetch(() => Promise.resolve({ ok: true, json: async () => ({ docs: [doc] }) }));

    const [book] = await searchOpenLibrary('cats', 5);
    expect(book.openLibraryId).toBeNull();
  });

  it('sets coverUrl to null when doc has no cover_i', async () => {
    const doc = { ...olDoc, cover_i: undefined };
    mockFetch(() => Promise.resolve({ ok: true, json: async () => ({ docs: [doc] }) }));

    const [book] = await searchOpenLibrary('cats', 5);
    expect(book.coverUrl).toBeNull();
  });

  it('sets isbn13 to null when no 13-digit ISBN is present', async () => {
    const doc = { ...olDoc, isbn: ['0123456789'] };
    mockFetch(() => Promise.resolve({ ok: true, json: async () => ({ docs: [doc] }) }));

    const [book] = await searchOpenLibrary('cats', 5);
    expect(book.isbn13).toBeNull();
  });

  it('returns empty array when fetch throws', async () => {
    mockFetch(() => Promise.reject(new Error('network')));
    expect(await searchOpenLibrary('cats', 5)).toEqual([]);
  });

  it('returns empty array when response is non-ok', async () => {
    mockFetch(() => Promise.resolve({ ok: false }));
    expect(await searchOpenLibrary('cats', 5)).toEqual([]);
  });

  it('returns empty array on malformed JSON', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        json: async () => {
          throw new SyntaxError('bad json');
        },
      }),
    );
    expect(await searchOpenLibrary('cats', 5)).toEqual([]);
  });

  it('throttles calls via the rate limiter', async () => {
    const { throttleOpenLibrary } = require('../../../lib/books/open-library-rate-limiter');
    mockFetch(() => Promise.resolve({ ok: true, json: async () => ({ docs: [] }) }));

    await searchOpenLibrary('q', 5);
    expect(throttleOpenLibrary).toHaveBeenCalledTimes(1);
  });
});
