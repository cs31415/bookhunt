import { searchBooks, matchLibraryEntries } from '../../../models/ai/search';
import * as aiData from '../../../data/ai-data';

jest.mock('../../../data/ai-data');
jest.mock('../../../lib/open-library-rate-limiter', () => ({
  throttleOpenLibrary: jest.fn().mockResolvedValue(undefined),
}));

const mockMatchData = aiData.matchLibraryEntries as jest.Mock;

const GOOGLE_URL = 'googleapis.com';
const OL_URL = 'openlibrary.org';

function mockFetch(handlers: Record<string, () => any>) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    for (const [key, handler] of Object.entries(handlers)) {
      if (url.includes(key)) return handler();
    }
    return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
  });
}

const googleItem = {
  id: 'abc123',
  volumeInfo: {
    title: 'Cat Science',
    authors: ['Dr Cat'],
    publishedDate: '2020-05-10',
    publisher: 'CatPress',
    pageCount: 200,
    averageRating: 4.5,
    imageLinks: { thumbnail: 'http://example.com/cover.jpg' },
    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781234567890' }],
    language: 'en',
    description: 'About cats',
  },
};

const olDoc = {
  key: '/works/OL1W',
  title: 'Open Cat',
  author_name: ['OL Author'],
  cover_i: 99,
  first_publish_year: 2019,
  isbn: ['9789999999999', '123'],
  edition_key: ['OL7170815M'],
};

describe('searchBooks', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('returns Google Books results on success and sets source: google_books', async () => {
    mockFetch({
      [GOOGLE_URL]: () => Promise.resolve({ ok: true, json: async () => ({ items: [googleItem] }) }),
    });

    const result = await searchBooks('cats', 1);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      googleBooksId: 'abc123',
      title: 'Cat Science',
      source: 'google_books',
    });
  });

  it('maps Google Books response fields correctly', async () => {
    mockFetch({
      [GOOGLE_URL]: () => Promise.resolve({ ok: true, json: async () => ({ items: [googleItem] }) }),
    });

    const [book] = await searchBooks('cats', 1);

    expect(book).toMatchObject({
      googleBooksId: 'abc123',
      title: 'Cat Science',
      authors: ['Dr Cat'],
      year: 2020,
      publisher: 'CatPress',
      pages: 200,
      rating: 4.5,
      coverUrl: 'https://example.com/cover.jpg',
      isbn13: '9781234567890',
      language: 'en',
      blurb: 'About cats',
      inLibrary: false,
      libraryStatus: null,
      source: 'google_books',
    });
  });

  it('falls back to OpenLibrary when Google Books throws', async () => {
    mockFetch({
      [GOOGLE_URL]: () => Promise.reject(new Error('network')),
      [OL_URL]: () => Promise.resolve({ ok: true, json: async () => ({ docs: [olDoc] }) }),
    });

    const result = await searchBooks('cats', 5);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('open_library');
    expect(result[0].title).toBe('Open Cat');
  });

  it('falls back to OpenLibrary when Google Books returns non-ok', async () => {
    mockFetch({
      [GOOGLE_URL]: () => Promise.resolve({ ok: false }),
      [OL_URL]: () => Promise.resolve({ ok: true, json: async () => ({ docs: [olDoc] }) }),
    });

    const result = await searchBooks('cats', 5);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('open_library');
  });

  it('falls back to OpenLibrary when Google Books returns empty results', async () => {
    mockFetch({
      [GOOGLE_URL]: () => Promise.resolve({ ok: true, json: async () => ({}) }),
      [OL_URL]: () => Promise.resolve({ ok: true, json: async () => ({ docs: [olDoc] }) }),
    });

    const result = await searchBooks('unknown', 5);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('open_library');
  });

  it('returns empty array when both Google Books and OpenLibrary fail', async () => {
    mockFetch({
      [GOOGLE_URL]: () => Promise.reject(new Error('network')),
      [OL_URL]: () => Promise.reject(new Error('ol network')),
    });

    expect(await searchBooks('cats', 5)).toEqual([]);
  });

  it('returns empty array when both return non-ok', async () => {
    mockFetch({
      [GOOGLE_URL]: () => Promise.resolve({ ok: false }),
      [OL_URL]: () => Promise.resolve({ ok: false }),
    });

    expect(await searchBooks('cats', 5)).toEqual([]);
  });

  it('maps OpenLibrary response fields correctly and sets source: open_library', async () => {
    mockFetch({
      [GOOGLE_URL]: () => Promise.resolve({ ok: true, json: async () => ({}) }),
      [OL_URL]: () => Promise.resolve({ ok: true, json: async () => ({ docs: [olDoc] }) }),
    });

    const [book] = await searchBooks('cats', 5);

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
      inLibrary: false,
      libraryStatus: null,
      source: 'open_library',
    });
  });

  it('sets openLibraryId to null when OpenLibrary doc has no edition_key', async () => {
    const docNoEdition = { ...olDoc, edition_key: undefined };
    mockFetch({
      [GOOGLE_URL]: () => Promise.resolve({ ok: true, json: async () => ({}) }),
      [OL_URL]: () => Promise.resolve({ ok: true, json: async () => ({ docs: [docNoEdition] }) }),
    });

    const [book] = await searchBooks('cats', 5);
    expect(book.openLibraryId).toBeNull();
  });

  it('sets coverUrl to null for OpenLibrary docs without cover_i', async () => {
    const docNoCover = { ...olDoc, cover_i: undefined };
    mockFetch({
      [GOOGLE_URL]: () => Promise.resolve({ ok: true, json: async () => ({}) }),
      [OL_URL]: () => Promise.resolve({ ok: true, json: async () => ({ docs: [docNoCover] }) }),
    });

    const [book] = await searchBooks('cats', 5);
    expect(book.coverUrl).toBeNull();
  });

  it('sets isbn13 to null when no 13-digit ISBN in OpenLibrary doc', async () => {
    const docShortIsbn = { ...olDoc, isbn: ['0123456789'] };
    mockFetch({
      [GOOGLE_URL]: () => Promise.resolve({ ok: true, json: async () => ({}) }),
      [OL_URL]: () => Promise.resolve({ ok: true, json: async () => ({ docs: [docShortIsbn] }) }),
    });

    const [book] = await searchBooks('cats', 5);
    expect(book.isbn13).toBeNull();
  });

  it('returns empty array when OpenLibrary returns malformed JSON', async () => {
    mockFetch({
      [GOOGLE_URL]: () => Promise.resolve({ ok: true, json: async () => ({}) }),
      [OL_URL]: () =>
        Promise.resolve({
          ok: true,
          json: async () => {
            throw new SyntaxError('bad json');
          },
        }),
    });

    expect(await searchBooks('cats', 5)).toEqual([]);
  });

  it('upgrades Google Books cover URL from http to https', async () => {
    const item = { id: 'x', volumeInfo: { imageLinks: { thumbnail: 'http://books.google.com/cover.jpg' } } };
    mockFetch({
      [GOOGLE_URL]: () => Promise.resolve({ ok: true, json: async () => ({ items: [item] }) }),
    });

    const [book] = await searchBooks('x', 1);
    expect(book.coverUrl).toMatch(/^https:/);
  });

  it('clamps limit to max of 40', async () => {
    mockFetch({
      [GOOGLE_URL]: () => Promise.resolve({ ok: true, json: async () => ({ items: [] }) }),
      [OL_URL]: () => Promise.resolve({ ok: true, json: async () => ({ docs: [] }) }),
    });
    await searchBooks('q', 100);
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('maxResults=40');
  });

  it('clamps limit to min of 1', async () => {
    mockFetch({
      [GOOGLE_URL]: () => Promise.resolve({ ok: true, json: async () => ({ items: [] }) }),
      [OL_URL]: () => Promise.resolve({ ok: true, json: async () => ({ docs: [] }) }),
    });
    await searchBooks('q', 0);
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('maxResults=1');
  });

  it('throttles OpenLibrary calls via rate limiter', async () => {
    const { throttleOpenLibrary } = require('../../../lib/open-library-rate-limiter');
    mockFetch({
      [GOOGLE_URL]: () => Promise.resolve({ ok: true, json: async () => ({}) }),
      [OL_URL]: () => Promise.resolve({ ok: true, json: async () => ({ docs: [] }) }),
    });

    await searchBooks('q', 5);
    expect(throttleOpenLibrary).toHaveBeenCalledTimes(1);
  });
});

describe('matchLibraryEntries', () => {
  it('marks books as inLibrary when matched by googleBooksId', async () => {
    mockMatchData.mockResolvedValue([
      { google_books_id: 'gid1', isbn13: null, status: 'read' },
    ]);
    const books: any[] = [
      { googleBooksId: 'gid1', isbn13: null, inLibrary: false, libraryStatus: null, source: 'google_books' },
      { googleBooksId: 'gid2', isbn13: null, inLibrary: false, libraryStatus: null, source: 'google_books' },
    ];
    await matchLibraryEntries(1, books);
    expect(books[0].inLibrary).toBe(true);
    expect(books[0].libraryStatus).toBe('read');
    expect(books[1].inLibrary).toBe(false);
  });

  it('marks books as inLibrary when matched by isbn13', async () => {
    mockMatchData.mockResolvedValue([
      { google_books_id: null, isbn13: '9781234567890', status: 'queued' },
    ]);
    const books: any[] = [
      { googleBooksId: 'unknown', isbn13: '9781234567890', inLibrary: false, libraryStatus: null, source: 'google_books' },
    ];
    await matchLibraryEntries(1, books);
    expect(books[0].inLibrary).toBe(true);
    expect(books[0].libraryStatus).toBe('queued');
  });

  it('matches OpenLibrary books by isbn13 (googleBooksId is null)', async () => {
    mockMatchData.mockResolvedValue([
      { google_books_id: null, isbn13: '9789999999999', status: 'reading' },
    ]);
    const books: any[] = [
      { googleBooksId: null, isbn13: '9789999999999', inLibrary: false, libraryStatus: null, source: 'open_library' },
    ];
    await matchLibraryEntries(1, books);
    expect(books[0].inLibrary).toBe(true);
    expect(books[0].libraryStatus).toBe('reading');
  });

  it('passes correct userId and id arrays to data layer', async () => {
    mockMatchData.mockResolvedValue([]);
    const books: any[] = [
      { googleBooksId: 'g1', isbn13: '111', inLibrary: false, libraryStatus: null, source: 'google_books' },
      { googleBooksId: 'g2', isbn13: null, inLibrary: false, libraryStatus: null, source: 'google_books' },
    ];
    await matchLibraryEntries(5, books);
    expect(mockMatchData).toHaveBeenCalledWith(5, ['g1', 'g2'], ['111']);
  });

  it('excludes null googleBooksId from the ids passed to data layer', async () => {
    mockMatchData.mockResolvedValue([]);
    const books: any[] = [
      { googleBooksId: null, isbn13: '9789999999999', inLibrary: false, libraryStatus: null, source: 'open_library' },
    ];
    await matchLibraryEntries(1, books);
    expect(mockMatchData).toHaveBeenCalledWith(1, [], ['9789999999999']);
  });
});
