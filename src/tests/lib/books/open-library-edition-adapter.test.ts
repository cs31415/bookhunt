import { fetchOpenLibraryEditionDetails } from '../../../lib/books/open-library-edition-adapter';

jest.mock('../../../lib/books/open-library-rate-limiter', () => ({
  throttleOpenLibrary: jest.fn().mockResolvedValue(undefined),
  OPENLIBRARY_API_URL: 'https://openlibrary.org',
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
