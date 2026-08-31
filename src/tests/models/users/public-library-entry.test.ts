import { publicLibraryEntry } from '../../../models/users/public-profile';
import { getPublicLibrary } from '../../../data/users-data';

jest.mock('../../../data/users-data');

const mockGet = getPublicLibrary as jest.Mock;

describe('publicLibraryEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue([{ book_id: 7, status: 'finished', review: 'Worth it.' }]);
  });

  /*
   * The same gated query as the shelf, with its book filter set, rather than a
   * query of its own: the sharing gate lives in that SELECT and a second query
   * would be a second place for it to drift (LOS-360).
   */
  it('asks the shelf query for one book', async () => {
    await publicLibraryEntry('ada', 7);

    expect(mockGet).toHaveBeenCalledWith('ada', expect.objectContaining({ bookId: 7, limit: 1 }));
  });

  it('applies no other filter, so nothing narrows it by accident', async () => {
    await publicLibraryEntry('ada', 7);

    const filters = mockGet.mock.calls[0][1];
    expect(filters.status).toBeNull();
    expect(filters.favoritesOnly).toBe(false);
    expect(filters.query).toBeNull();
    expect(filters.subject).toBeNull();
  });

  it('returns the entry the query answered with', async () => {
    const entry = await publicLibraryEntry('ada', 7);

    expect(entry).toEqual({ book_id: 7, status: 'finished', review: 'Worth it.' });
  });

  /*
   * No such reader, a page not listed, a book they do not have, and one they
   * hid are all the same answer to a visitor -- the query returns no rows for
   * every one of them, and this returns null for every one of them.
   */
  it('returns null when there is nothing a visitor may see', async () => {
    mockGet.mockResolvedValue([]);

    expect(await publicLibraryEntry('ada', 7)).toBeNull();
  });
});
