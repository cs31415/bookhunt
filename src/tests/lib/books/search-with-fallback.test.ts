import { searchWithFallback } from '../../../lib/books/search-with-fallback';
import { getBooksProviderAdapter } from '../../../lib/books/get-books-provider-adapter';
import { AllProvidersFailedError } from '../../../lib/books/all-providers-failed-error';

jest.mock('../../../lib/books/get-books-provider-adapter');

const mockGetAdapter = getBooksProviderAdapter as jest.Mock;

// The retry loop is real; the waiting between rounds is not worth the seconds.
beforeEach(() => {
  process.env.BOOKS_PRIMARY_BACKOFF_MS = '1';
});

afterEach(() => {
  delete process.env.BOOKS_PRIMARY_BACKOFF_MS;
  delete process.env.BOOKS_PRIMARY_ATTEMPTS;
});

describe('searchWithFallback', () => {
  it('returns the first provider result when non-empty', async () => {
    const googleSearch = jest.fn().mockResolvedValue([{ title: 'Google Book' }]);
    const olSearch = jest.fn();
    mockGetAdapter.mockImplementation((provider) =>
      provider === 'google_books' ? { search: googleSearch } : { search: olSearch },
    );

    const result = await searchWithFallback(['google_books', 'open_library'], 'cats', 5);

    expect(result).toEqual([{ title: 'Google Book' }]);
    expect(olSearch).not.toHaveBeenCalled();
  });

  it('falls through to the next provider when a provider throws', async () => {
    const googleSearch = jest.fn().mockRejectedValue(new Error('network'));
    const olSearch = jest.fn().mockResolvedValue([{ title: 'OL Book' }]);
    mockGetAdapter.mockImplementation((provider) =>
      provider === 'google_books' ? { search: googleSearch } : { search: olSearch },
    );

    const result = await searchWithFallback(['google_books', 'open_library'], 'cats', 5);

    expect(result).toEqual([{ title: 'OL Book' }]);
  });

  it('falls through to the next provider when a provider returns empty results', async () => {
    const googleSearch = jest.fn().mockResolvedValue([]);
    const olSearch = jest.fn().mockResolvedValue([{ title: 'OL Book' }]);
    mockGetAdapter.mockImplementation((provider) =>
      provider === 'google_books' ? { search: googleSearch } : { search: olSearch },
    );

    const result = await searchWithFallback(['google_books', 'open_library'], 'cats', 5);

    expect(result).toEqual([{ title: 'OL Book' }]);
  });

  /*
   * This used to assert an empty array, which was the bug rather than the
   * contract (LOS-318). A chain where nothing answered has learned nothing, and
   * returning [] tells the reader their book does not exist -- when what
   * happened is that we could not look. It matters more now that the chain is
   * Google alone and there is no second provider to cover the gap.
   */
  it('throws when every provider fails, rather than reporting no results', async () => {
    process.env.BOOKS_PRIMARY_ATTEMPTS = '1';
    mockGetAdapter.mockReturnValue({ search: jest.fn().mockRejectedValue(new Error('fail')) });

    await expect(
      searchWithFallback(['google_books', 'open_library'], 'cats', 5),
    ).rejects.toBeInstanceOf(AllProvidersFailedError);
  });

  // The other half of the distinction: a provider that answered "nothing" has
  // told us something true, and that is a real empty result.
  it('returns an empty array when a provider answered with nothing', async () => {
    mockGetAdapter.mockReturnValue({ search: jest.fn().mockResolvedValue([]) });

    await expect(searchWithFallback(['google_books'], 'cats', 5)).resolves.toEqual([]);
  });

  // One provider answering is enough to make the empty result honest, even if
  // the other blew up.
  it('believes an empty answer even when another provider failed', async () => {
    process.env.BOOKS_PRIMARY_ATTEMPTS = '1';
    mockGetAdapter.mockImplementation((provider) =>
      provider === 'google_books'
        ? { search: jest.fn().mockRejectedValue(new Error('fail')) }
        : { search: jest.fn().mockResolvedValue([]) },
    );

    await expect(
      searchWithFallback(['google_books', 'open_library'], 'cats', 5),
    ).resolves.toEqual([]);
  });

  /*
   * Search had no outer retry at all: it got two HTTP attempts and gave up,
   * while an import of the same book got six. Invisible while a second provider
   * covered the gap; the whole behaviour once Google runs alone.
   */
  it('retries the provider before giving up', async () => {
    process.env.BOOKS_PRIMARY_ATTEMPTS = '3';
    const search = jest.fn().mockRejectedValue(new Error('503'));
    mockGetAdapter.mockReturnValue({ search });

    await expect(searchWithFallback(['google_books'], 'cats', 5)).rejects.toBeInstanceOf(
      AllProvidersFailedError,
    );
    expect(search).toHaveBeenCalledTimes(3);
  });

  it('stops retrying as soon as a round succeeds', async () => {
    process.env.BOOKS_PRIMARY_ATTEMPTS = '3';
    const search = jest
      .fn()
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValue([{ title: 'Second time lucky' }]);
    mockGetAdapter.mockReturnValue({ search });

    await expect(searchWithFallback(['google_books'], 'cats', 5)).resolves.toEqual([
      { title: 'Second time lucky' },
    ]);
    expect(search).toHaveBeenCalledTimes(2);
  });

  // So the caller can tell "come back in a minute" from "something is broken".
  it('reports a rate limit distinctly from a plain failure', async () => {
    process.env.BOOKS_PRIMARY_ATTEMPTS = '1';
    const limited = Object.assign(new Error('429'), { status: 429, provider: 'google_books' });
    mockGetAdapter.mockReturnValue({ search: jest.fn().mockRejectedValue(limited) });

    const error = await searchWithFallback(['google_books'], 'cats', 5).catch((e) => e);

    expect(error).toBeInstanceOf(AllProvidersFailedError);
    expect(error.rateLimited).toBe(true);
    expect(error.providers).toEqual(['google_books']);
  });

  it('respects chain order and provider count', async () => {
    const search = jest.fn().mockResolvedValue([]);
    mockGetAdapter.mockReturnValue({ search });

    await searchWithFallback(['open_library'], 'cats', 5);

    expect(mockGetAdapter).toHaveBeenCalledTimes(1);
    expect(mockGetAdapter).toHaveBeenCalledWith('open_library');
  });
});
