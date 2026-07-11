import { searchGoogleBooks, getGoogleBooksEditionDetails } from '../../../lib/books/google-books-adapter';

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
      inLibrary: false,
      libraryStatus: null,
      source: 'google_books',
    });
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

  it('returns empty array when fetch throws', async () => {
    mockFetch(() => Promise.reject(new Error('network')));
    expect(await searchGoogleBooks('cats', 5)).toEqual([]);
  });

  it('returns empty array when response is non-ok', async () => {
    mockFetch(() => Promise.resolve({ ok: false }));
    expect(await searchGoogleBooks('cats', 5)).toEqual([]);
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
