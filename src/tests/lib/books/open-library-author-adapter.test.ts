import { fetchOpenLibraryAuthorDetails } from '../../../lib/books/open-library-author-adapter';

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

describe('fetchOpenLibraryAuthorDetails', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('extracts birth year and bio from a matching doc', async () => {
    mockFetch({
      '/search/authors.json': () =>
        Promise.resolve({
          ok: true,
          json: async () => ({ docs: [{ key: 'OL1A', birth_date: '15 March 1900' }] }),
        }),
      '/authors/OL1A.json': () =>
        Promise.resolve({ ok: true, json: async () => ({ bio: 'A famous author.' }) }),
    });

    const result = await fetchOpenLibraryAuthorDetails('Author Name');

    expect(result).toEqual({ birthYear: 1900, bio: 'A famous author.' });
  });

  it('unwraps a bio object with a value field', async () => {
    mockFetch({
      '/search/authors.json': () =>
        Promise.resolve({ ok: true, json: async () => ({ docs: [{ key: 'OL1A' }] }) }),
      '/authors/OL1A.json': () =>
        Promise.resolve({ ok: true, json: async () => ({ bio: { value: 'Wrapped bio' } }) }),
    });

    const result = await fetchOpenLibraryAuthorDetails('Author Name');
    expect(result.bio).toBe('Wrapped bio');
  });

  it('prefers a doc with a birth_date over the first doc', async () => {
    mockFetch({
      '/search/authors.json': () =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            docs: [{ key: 'OL1A' }, { key: 'OL2A', birth_date: '1950' }],
          }),
        }),
      '/authors/OL2A.json': () => Promise.resolve({ ok: true, json: async () => ({}) }),
    });

    const result = await fetchOpenLibraryAuthorDetails('Author Name');
    expect(result.birthYear).toBe(1950);
  });

  it('returns empty details when the author search fails', async () => {
    mockFetch({ '/search/authors.json': () => Promise.resolve({ ok: false }) });

    const result = await fetchOpenLibraryAuthorDetails('Author Name');
    expect(result).toEqual({ birthYear: null, bio: null });
  });

  it('returns empty details when the author search throws', async () => {
    mockFetch({ '/search/authors.json': () => Promise.reject(new Error('network')) });

    const result = await fetchOpenLibraryAuthorDetails('Author Name');
    expect(result).toEqual({ birthYear: null, bio: null });
  });

  it('returns empty details when there are no docs', async () => {
    mockFetch({ '/search/authors.json': () => Promise.resolve({ ok: true, json: async () => ({ docs: [] }) }) });

    const result = await fetchOpenLibraryAuthorDetails('Author Name');
    expect(result).toEqual({ birthYear: null, bio: null });
  });

  it('returns null birthYear when birth_date has no 4-digit year', async () => {
    mockFetch({
      '/search/authors.json': () =>
        Promise.resolve({ ok: true, json: async () => ({ docs: [{ key: 'OL1A', birth_date: 'unknown' }] }) }),
      '/authors/OL1A.json': () => Promise.resolve({ ok: true, json: async () => ({}) }),
    });

    const result = await fetchOpenLibraryAuthorDetails('Author Name');
    expect(result.birthYear).toBeNull();
  });

  it('keeps birthYear when the author detail fetch fails', async () => {
    mockFetch({
      '/search/authors.json': () =>
        Promise.resolve({ ok: true, json: async () => ({ docs: [{ key: 'OL1A', birth_date: '1900' }] }) }),
      '/authors/OL1A.json': () => Promise.resolve({ ok: false }),
    });

    const result = await fetchOpenLibraryAuthorDetails('Author Name');
    expect(result).toEqual({ birthYear: 1900, bio: null });
  });

  it('keeps birthYear when the author detail fetch throws', async () => {
    mockFetch({
      '/search/authors.json': () =>
        Promise.resolve({ ok: true, json: async () => ({ docs: [{ key: 'OL1A', birth_date: '1900' }] }) }),
      '/authors/OL1A.json': () => Promise.reject(new Error('network')),
    });

    const result = await fetchOpenLibraryAuthorDetails('Author Name');
    expect(result).toEqual({ birthYear: 1900, bio: null });
  });
});
