import {
  groupFacets,
  publicLibrary,
  publicLibraryFacets,
} from '../../../models/users/public-profile';
import { getPublicLibrary, getPublicLibraryFacets } from '../../../data/users-data';

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

describe('mood and theme filters (LOS-342)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPublicLibrary.mockResolvedValue([]);
  });

  it('passes a mood through', async () => {
    await publicLibrary('ada', { mood: 'Bleak' });

    expect(filtersFrom().mood).toBe('Bleak');
  });

  it('passes a theme through', async () => {
    await publicLibrary('ada', { theme: 'Exile' });

    expect(filtersFrom().theme).toBe('Exile');
  });

  // Same rule the search box and the category pill already follow.
  it('reads a blank mood as no filter', async () => {
    await publicLibrary('ada', { mood: '   ' });

    expect(filtersFrom().mood).toBeNull();
  });

  it('reads an absent theme as no filter', async () => {
    await publicLibrary('ada', {});

    expect(filtersFrom().theme).toBeNull();
  });

  it('carries all four filters at once', async () => {
    await publicLibrary('ada', {
      q: 'dune',
      subject: 'Science Fiction',
      mood: 'Bleak',
      theme: 'Exile',
    });

    expect(filtersFrom()).toMatchObject({
      query: 'dune',
      subject: 'Science Fiction',
      mood: 'Bleak',
      theme: 'Exile',
    });
  });
});

describe('groupFacets', () => {
  it('sorts flat rows into the shape the rail renders', () => {
    expect(
      groupFacets([
        { facet: 'subject', value: 'Fiction' },
        { facet: 'subject', value: 'History' },
        { facet: 'mood', value: 'Bleak' },
        { facet: 'theme', value: 'Exile' },
        { facet: 'status', value: 'finished' },
      ]),
    ).toEqual({
      subject: ['Fiction', 'History'],
      mood: ['Bleak'],
      theme: ['Exile'],
      status: ['finished'],
    });
  });

  // A shelf with no moods yet is the ordinary case, not an error: FilterGroup
  // renders nothing for an empty group.
  it('gives every facet an empty list rather than leaving it undefined', () => {
    expect(groupFacets([])).toEqual({ subject: [], mood: [], theme: [], status: [] });
  });

  // Guards against a future facet in SQL quietly becoming an undefined push.
  it('ignores a facet name it does not know', () => {
    expect(groupFacets([{ facet: 'decade', value: '1970s' }])).toEqual({
      subject: [],
      mood: [],
      theme: [],
      status: [],
    });
  });

  it('groups what the facets query returns', async () => {
    (getPublicLibraryFacets as jest.Mock).mockResolvedValue([
      { facet: 'subject', value: 'Fiction', books: 24 },
      { facet: 'subject', value: 'History', books: 6 },
    ]);

    expect(await publicLibraryFacets('ada')).toEqual({
      subject: ['Fiction', 'History'],
      mood: [],
      theme: [],
      status: [],
    });
  });
});
