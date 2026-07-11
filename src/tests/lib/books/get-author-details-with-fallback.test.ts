import { getAuthorDetailsWithFallback } from '../../../lib/books/get-author-details-with-fallback';
import { getBooksProviderAdapter } from '../../../lib/books/get-books-provider-adapter';

jest.mock('../../../lib/books/get-books-provider-adapter');

const mockGetAdapter = getBooksProviderAdapter as jest.Mock;

describe('getAuthorDetailsWithFallback', () => {
  it('skips a provider whose adapter has no getAuthorDetails', async () => {
    const olGetAuthorDetails = jest.fn().mockResolvedValue({ birthYear: 1900, bio: 'A bio' });
    mockGetAdapter.mockImplementation((provider) =>
      provider === 'google_books' ? { search: jest.fn() } : { search: jest.fn(), getAuthorDetails: olGetAuthorDetails },
    );

    const result = await getAuthorDetailsWithFallback(['google_books', 'open_library'], 'Author Name');

    expect(result).toEqual({ birthYear: 1900, bio: 'A bio' });
    expect(olGetAuthorDetails).toHaveBeenCalledWith('Author Name');
  });

  it('returns empty details when no provider in the chain has the capability', async () => {
    mockGetAdapter.mockReturnValue({ search: jest.fn() });

    const result = await getAuthorDetailsWithFallback(['google_books'], 'Author Name');

    expect(result).toEqual({ birthYear: null, bio: null });
  });

  it('falls through to the next provider when a capable provider throws', async () => {
    const firstGetAuthorDetails = jest.fn().mockRejectedValue(new Error('network'));
    const secondGetAuthorDetails = jest.fn().mockResolvedValue({ birthYear: 1950, bio: null });
    mockGetAdapter
      .mockImplementationOnce(() => ({ search: jest.fn(), getAuthorDetails: firstGetAuthorDetails }))
      .mockImplementationOnce(() => ({ search: jest.fn(), getAuthorDetails: secondGetAuthorDetails }));

    const result = await getAuthorDetailsWithFallback(['open_library', 'open_library'], 'Author Name');

    expect(result).toEqual({ birthYear: 1950, bio: null });
  });

  it('falls through when a capable provider returns fully empty details', async () => {
    const firstGetAuthorDetails = jest.fn().mockResolvedValue({ birthYear: null, bio: null });
    const secondGetAuthorDetails = jest.fn().mockResolvedValue({ birthYear: 1950, bio: 'Bio' });
    mockGetAdapter
      .mockImplementationOnce(() => ({ search: jest.fn(), getAuthorDetails: firstGetAuthorDetails }))
      .mockImplementationOnce(() => ({ search: jest.fn(), getAuthorDetails: secondGetAuthorDetails }));

    const result = await getAuthorDetailsWithFallback(['open_library', 'open_library'], 'Author Name');

    expect(result).toEqual({ birthYear: 1950, bio: 'Bio' });
  });
});
