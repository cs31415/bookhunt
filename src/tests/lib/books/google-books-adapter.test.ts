import { searchGoogleBooks, getGoogleBooksEditionDetails, getGoogleBooksById } from '../../../lib/books/google-books-adapter';
import { BooksProviderError } from '../../../lib/books/books-provider-error';

function mockFetch(handler: () => any) {
  global.fetch = jest.fn().mockImplementation(handler) as any;
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
    categories: ['Science > Life Sciences > Zoology'],
  },
};

describe('searchGoogleBooks', () => {
  it('maps response fields correctly', async () => {
    mockFetch(() => Promise.resolve({ ok: true, json: async () => ({ items: [googleItem] }) }));

    const [book] = await searchGoogleBooks('cats', 5);

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
      categories: ['Science > Life Sciences > Zoology'],
      moods: [],
      inLibrary: false,
      libraryStatus: null,
      source: 'google_books',
    });
  });

  it('exposes the single publisher as a one-item publishers list', async () => {
    mockFetch(() => Promise.resolve({ ok: true, json: async () => ({ items: [googleItem] }) }));

    const [book] = await searchGoogleBooks('cats', 5);

    expect(book.publishers).toEqual(['CatPress']);
  });

  // Google omits publisher from search results even for the correct book, so an
  // empty list means "unknown" and must not be scored as a mismatch (LOS-168).
  it('leaves publishers empty when the volume omits a publisher', async () => {
    const item = { id: 'nopub', volumeInfo: { title: 'Hong Kong Day by Day' } };
    mockFetch(() => Promise.resolve({ ok: true, json: async () => ({ items: [item] }) }));

    const [book] = await searchGoogleBooks('hong kong', 1);

    expect(book.publishers).toEqual([]);
    expect(book.publisher).toBeNull();
  });

  it('strips embedded HTML from the description into blurb', async () => {
    const item = {
      id: 'h1',
      volumeInfo: { title: 'Tagged', description: '<p>A saga &amp; more.</p><p>Book two.</p>' },
    };
    mockFetch(() => Promise.resolve({ ok: true, json: async () => ({ items: [item] }) }));

    const [book] = await searchGoogleBooks('tagged', 1);
    expect(book.blurb).toBe('A saga & more. Book two.');
  });

  it('upgrades cover URL from http to https', async () => {
    const item = { id: 'x', volumeInfo: { imageLinks: { thumbnail: 'http://books.google.com/cover.jpg' } } };
    mockFetch(() => Promise.resolve({ ok: true, json: async () => ({ items: [item] }) }));

    const [book] = await searchGoogleBooks('x', 1);
    expect(book.coverUrl).toMatch(/^https:/);
  });

  it('defaults categories to an empty array when volumeInfo has none', async () => {
    const item = { id: 'x', volumeInfo: { title: 'No Categories' } };
    mockFetch(() => Promise.resolve({ ok: true, json: async () => ({ items: [item] }) }));

    const [book] = await searchGoogleBooks('x', 1);
    expect(book.categories).toEqual([]);
  });

  // Throws rather than returning [], so a caller can tell a failed lookup from a
  // book that genuinely isn't there — only the former is worth retrying.
  it('throws BooksProviderError when fetch keeps failing', async () => {
    mockFetch(() => Promise.reject(new Error('network')));
    await expect(searchGoogleBooks('cats', 5)).rejects.toBeInstanceOf(BooksProviderError);
  });

  it('throws BooksProviderError when response is non-ok', async () => {
    mockFetch(() => Promise.resolve({ ok: false, status: 400 }));
    await expect(searchGoogleBooks('cats', 5)).rejects.toMatchObject({
      provider: 'google_books',
      status: 400,
    });
  });

  it('returns empty array when items are missing', async () => {
    mockFetch(() => Promise.resolve({ ok: true, json: async () => ({}) }));
    expect(await searchGoogleBooks('cats', 5)).toEqual([]);
  });

  it('uses the requested limit as maxResults', async () => {
    mockFetch(() => Promise.resolve({ ok: true, json: async () => ({ items: [] }) }));
    await searchGoogleBooks('q', 7);
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('maxResults=7');
  });
});

describe('getGoogleBooksEditionDetails', () => {
  it('maps description, publisher, and pageCount from volumeInfo', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          volumeInfo: { description: 'A description', publisher: 'A Press', pageCount: 300 },
        }),
      }),
    );

    const result = await getGoogleBooksEditionDetails('abc123');

    expect(result).toEqual({ description: 'A description', publisher: 'A Press', pages: 300 });
  });

  it('strips embedded HTML from the edition description', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ volumeInfo: { description: 'Line one.<br>Line two &amp; three.' } }),
      }),
    );

    const result = await getGoogleBooksEditionDetails('abc123');

    expect(result.description).toBe('Line one. Line two & three.');
  });

  it('returns nulls when the volume fetch fails', async () => {
    mockFetch(() => Promise.resolve({ ok: false }));
    expect(await getGoogleBooksEditionDetails('abc123')).toEqual({
      description: null,
      publisher: null,
      pages: null,
    });
  });

  it('returns nulls when the fetch throws', async () => {
    mockFetch(() => Promise.reject(new Error('network')));
    expect(await getGoogleBooksEditionDetails('abc123')).toEqual({
      description: null,
      publisher: null,
      pages: null,
    });
  });

  it('returns nulls for missing fields when volumeInfo is empty', async () => {
    mockFetch(() => Promise.resolve({ ok: true, json: async () => ({ volumeInfo: {} }) }));
    expect(await getGoogleBooksEditionDetails('abc123')).toEqual({
      description: null,
      publisher: null,
      pages: null,
    });
  });
});

describe('getGoogleBooksById', () => {
  it('maps a single-volume response the same way as a search result', async () => {
    mockFetch(() => Promise.resolve({ ok: true, json: async () => googleItem }));

    const result = await getGoogleBooksById('abc123');

    expect(result).toMatchObject({
      googleBooksId: 'abc123',
      title: 'Cat Science',
      authors: ['Dr Cat'],
      year: 2020,
      publisher: 'CatPress',
      pages: 200,
      rating: 4.5,
      isbn13: '9781234567890',
      source: 'google_books',
    });
  });

  it('returns null when the volume has no id', async () => {
    mockFetch(() => Promise.resolve({ ok: true, json: async () => ({}) }));
    expect(await getGoogleBooksById('missing')).toBeNull();
  });

  it('returns null when the response is non-ok', async () => {
    mockFetch(() => Promise.resolve({ ok: false }));
    expect(await getGoogleBooksById('abc123')).toBeNull();
  });

  it('returns null when the fetch throws', async () => {
    mockFetch(() => Promise.reject(new Error('network')));
    expect(await getGoogleBooksById('abc123')).toBeNull();
  });
});
