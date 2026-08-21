import { publicLibrary } from '../../../models/users/public-profile';
import { getPublicLibrary } from '../../../data/users-data';

jest.mock('../../../data/users-data');

const mockGetPublicLibrary = getPublicLibrary as jest.Mock;

/** The filters object the model builds, as the data layer receives it. */
function filtersFrom(call: number = 0) {
  return mockGetPublicLibrary.mock.calls[call][1];
}

describe('publicLibrary filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPublicLibrary.mockResolvedValue([]);
  });

  it('passes a search through to the query', async () => {
    await publicLibrary('ada', { q: 'dune' });

    expect(filtersFrom().query).toBe('dune');
  });

  it('passes a category through', async () => {
    await publicLibrary('ada', { subject: 'Science Fiction' });

    expect(filtersFrom().subject).toBe('Science Fiction');
  });

  // A box that has been typed into and cleared sends an empty string, and that
  // means no filter rather than "match the empty string".
  it('reads a blank search as no search', async () => {
    await publicLibrary('ada', { q: '   ' });

    expect(filtersFrom().query).toBeNull();
  });

  it('reads an absent search as no search', async () => {
    await publicLibrary('ada', {});

    expect(filtersFrom().query).toBeNull();
    expect(filtersFrom().subject).toBeNull();
  });

  it('trims a search rather than sending the spaces', async () => {
    await publicLibrary('ada', { q: '  dune  ' });

    expect(filtersFrom().query).toBe('dune');
  });

  // Query strings can arrive as arrays or objects; neither is a search.
  it('ignores a search that is not a string', async () => {
    await publicLibrary('ada', { q: ['dune', 'ubik'] });

    expect(filtersFrom().query).toBeNull();
  });

  it('keeps searching alongside the tab filters rather than replacing them', async () => {
    await publicLibrary('ada', { q: 'dune', status: 'reading', favorites: 'true' });

    expect(filtersFrom()).toMatchObject({
      query: 'dune',
      status: 'reading',
      favoritesOnly: true,
    });
  });

  // The status check runs first and short-circuits, so a search alongside a
  // bad status must not quietly widen the result.
  it('still narrows to nothing when the status is unrecognised', async () => {
    const result = await publicLibrary('ada', { q: 'dune', status: 'nonsense' });

    expect(result.entries).toEqual([]);
    expect(mockGetPublicLibrary).not.toHaveBeenCalled();
  });

  it('pages the filtered shelf, not the whole one', async () => {
    await publicLibrary('ada', { q: 'dune', page: 3, limit: 24 });

    expect(filtersFrom()).toMatchObject({ limit: 24, offset: 48 });
  });
});
