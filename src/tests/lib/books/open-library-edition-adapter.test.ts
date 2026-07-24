import { fetchOpenLibraryEditionDetails, getOpenLibraryById } from '../../../lib/books/open-library-edition-adapter';

jest.mock('../../../lib/books/open-library-rate-limiter', () => ({
  throttleOpenLibrary: jest.fn().mockResolvedValue(undefined),
  OPENLIBRARY_API_URL: 'https://openlibrary.org',
  OPENLIBRARY_COVERS_URL: 'https://covers.openlibrary.org',
}));

function mockFetch(handlers: Record<string, () => any>) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    for (const [key, handler] of Object.entries(handlers)) {
      if (url.includes(key)) return handler();
    }
    return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
  });
}

describe('fetchOpenLibraryEditionDetails', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('reads description, publisher, and pages directly from the edition', async () => {
    mockFetch({
      '/books/OL1M.json': () =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            description: 'An edition-level description',
            publishers: ['Edition Press'],
            number_of_pages: 250,
          }),
        }),
    });

    const result = await fetchOpenLibraryEditionDetails('OL1M');

    expect(result).toEqual({
      description: 'An edition-level description',
      publisher: 'Edition Press',
      pages: 250,
    });
  });

  it('unwraps a description object with a value field', async () => {
    mockFetch({
      '/books/OL1M.json': () =>
        Promise.resolve({
          ok: true,
          json: async () => ({ description: { value: 'Wrapped description' } }),
        }),
    });

    const result = await fetchOpenLibraryEditionDetails('OL1M');
    expect(result.description).toBe('Wrapped description');
  });

  it('falls back to the parent work description when the edition has none', async () => {
    mockFetch({
      '/books/OL1M.json': () =>
        Promise.resolve({
          ok: true,
          json: async () => ({ works: [{ key: '/works/OL9W' }] }),
        }),
      '/works/OL9W.json': () =>
        Promise.resolve({
          ok: true,
          json: async () => ({ description: 'Work-level description' }),
        }),
    });

    const result = await fetchOpenLibraryEditionDetails('OL1M');
    expect(result.description).toBe('Work-level description');
  });

  it('returns nulls when the edition lookup fails', async () => {
    mockFetch({
      '/books/OL1M.json': () => Promise.resolve({ ok: false }),
    });

    const result = await fetchOpenLibraryEditionDetails('OL1M');
    expect(result).toEqual({ description: null, publisher: null, pages: null });
  });

  it('returns nulls when the edition fetch throws', async () => {
    mockFetch({
      '/books/OL1M.json': () => Promise.reject(new Error('network')),
    });

    const result = await fetchOpenLibraryEditionDetails('OL1M');
    expect(result).toEqual({ description: null, publisher: null, pages: null });
  });

  it('keeps publisher and pages even when no description is found anywhere', async () => {
    mockFetch({
      '/books/OL1M.json': () =>
        Promise.resolve({
          ok: true,
          json: async () => ({ publishers: ['No Description Press'], number_of_pages: 100 }),
        }),
    });

    const result = await fetchOpenLibraryEditionDetails('OL1M');
    expect(result).toEqual({ description: null, publisher: 'No Description Press', pages: 100 });
  });

  it('does not fetch the work when the edition has no works reference', async () => {
    mockFetch({
      '/books/OL1M.json': () => Promise.resolve({ ok: true, json: async () => ({}) }),
    });

    await fetchOpenLibraryEditionDetails('OL1M');
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('returns edition-level nulls when the work lookup fails', async () => {
    mockFetch({
      '/books/OL1M.json': () =>
        Promise.resolve({ ok: true, json: async () => ({ works: [{ key: '/works/OL9W' }] }) }),
      '/works/OL9W.json': () => Promise.resolve({ ok: false }),
    });

    const result = await fetchOpenLibraryEditionDetails('OL1M');
    expect(result.description).toBeNull();
  });
});

describe('getOpenLibraryById', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('maps an edition response into a SearchResult', async () => {
    mockFetch({
      '/books/OL1M.json': () =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            title: 'Sapiens',
            publishers: ['Harper'],
            number_of_pages: 443,
            publish_date: 'February 10, 2015',
            isbn_13: ['9780062316097'],
            covers: [12345],
            description: 'A brief history of humankind',
          }),
        }),
    });

    const result = await getOpenLibraryById('OL1M');

    expect(result).toEqual({
      googleBooksId: null,
      openLibraryId: 'OL1M',
      title: 'Sapiens',
      authors: [],
      year: 2015,
      publisher: 'Harper',
      pages: 443,
      rating: null,
      coverUrl: 'https://covers.openlibrary.org/b/id/12345-M.jpg',
      isbn13: '9780062316097',
      language: null,
      blurb: 'A brief history of humankind',
      categories: [],
      moods: [],
      inLibrary: false,
      libraryStatus: null,
      source: 'open_library',
    });
  });

  it('returns null when the edition has no title', async () => {
    mockFetch({ '/books/OL1M.json': () => Promise.resolve({ ok: true, json: async () => ({}) }) });
    expect(await getOpenLibraryById('OL1M')).toBeNull();
  });

  it('returns null when the lookup fails', async () => {
    mockFetch({ '/books/OL1M.json': () => Promise.resolve({ ok: false }) });
    expect(await getOpenLibraryById('OL1M')).toBeNull();
  });

  it('returns null when the fetch throws', async () => {
    mockFetch({ '/books/OL1M.json': () => Promise.reject(new Error('network')) });
    expect(await getOpenLibraryById('OL1M')).toBeNull();
  });

  it('handles missing optional fields gracefully', async () => {
    mockFetch({
      '/books/OL1M.json': () => Promise.resolve({ ok: true, json: async () => ({ title: 'Bare Edition' }) }),
    });

    const result = await getOpenLibraryById('OL1M');

    expect(result).toMatchObject({
      title: 'Bare Edition',
      year: null,
      publisher: null,
      pages: null,
      coverUrl: null,
      isbn13: null,
      blurb: null,
    });
  });
});
