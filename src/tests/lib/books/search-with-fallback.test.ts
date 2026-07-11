import { searchWithFallback } from '../../../lib/books/search-with-fallback';
import { getBooksProviderAdapter } from '../../../lib/books/get-books-provider-adapter';

jest.mock('../../../lib/books/get-books-provider-adapter');

const mockGetAdapter = getBooksProviderAdapter as jest.Mock;

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

  it('returns an empty array (not a throw) when every provider fails', async () => {
    mockGetAdapter.mockReturnValue({ search: jest.fn().mockRejectedValue(new Error('fail')) });

    const result = await searchWithFallback(['google_books', 'open_library'], 'cats', 5);

    expect(result).toEqual([]);
  });

  it('respects chain order and provider count', async () => {
    const search = jest.fn().mockResolvedValue([]);
    mockGetAdapter.mockReturnValue({ search });

    await searchWithFallback(['open_library'], 'cats', 5);

    expect(mockGetAdapter).toHaveBeenCalledTimes(1);
    expect(mockGetAdapter).toHaveBeenCalledWith('open_library');
  });
});
