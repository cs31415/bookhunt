import { searchLibrary } from '../../../models/library/search-library';
import * as libraryData from '../../../data/library-data';

jest.mock('../../../data/library-data');

const mockSearchUserLibrary = libraryData.searchUserLibrary as jest.Mock;

beforeEach(() => {
  mockSearchUserLibrary.mockReset();
  mockSearchUserLibrary.mockResolvedValue([]);
});

describe('searchLibrary model', () => {
  it('tokenises the query, keeps the raw phrase, and strips total_count', async () => {
    mockSearchUserLibrary.mockResolvedValue([
      { book_id: 1, title: 'Cosmos', relevance: '11', total_count: '3' },
    ]);

    const result = await searchLibrary(4, { q: '  Carl Sagan ' });

    expect(mockSearchUserLibrary).toHaveBeenCalledWith(4, {
      terms: ['carl', 'sagan'],
      phrase: 'carl sagan',
      status: null,
      sort: 'relevance',
      limit: 24,
      offset: 0,
    });
    expect(result).toEqual({
      entries: [{ book_id: 1, title: 'Cosmos', relevance: '11' }],
      total: 3,
      page: 1,
      pageSize: 24,
      query: 'Carl Sagan',
    });
  });

  // Stop words are dropped by the shared tokenizer, so the library asks the same
  // question as catalog search and import matching.
  it('drops stop words via the shared tokenizer', async () => {
    await searchLibrary(4, { q: 'the best books on evolution' });

    expect(mockSearchUserLibrary.mock.calls[0][1].terms).toEqual(['evolution']);
  });

  it('searches everything when no query is given, ordered by date added', async () => {
    await searchLibrary(4, {});

    expect(mockSearchUserLibrary).toHaveBeenCalledWith(4, {
      terms: null,
      phrase: null,
      status: null,
      sort: 'added',
      limit: 24,
      offset: 0,
    });
  });

  // An unrecognised status would reach Postgres as a reading_status cast and
  // fail the whole request, so a bad param is ignored rather than fatal.
  it('ignores a status outside the enum but honours a valid one', async () => {
    await searchLibrary(4, { q: 'sagan', status: 'nonsense' });
    expect(mockSearchUserLibrary.mock.calls[0][1].status).toBeNull();

    await searchLibrary(4, { q: 'sagan', status: 'finished' });
    expect(mockSearchUserLibrary.mock.calls[1][1].status).toBe('finished');
  });

  it('ignores an unknown sort', async () => {
    await searchLibrary(4, { q: 'sagan', sort: 'wat' });

    expect(mockSearchUserLibrary.mock.calls[0][1].sort).toBe('relevance');
  });

  it('computes offset from page and clamps limit to the maximum', async () => {
    await searchLibrary(4, { q: 'sagan', page: '3', limit: '500' });

    expect(mockSearchUserLibrary.mock.calls[0][1]).toMatchObject({ limit: 60, offset: 120 });
  });

  it('reports zero total when nothing matches', async () => {
    const result = await searchLibrary(4, { q: 'nothingmatchesthis' });

    expect(result.total).toBe(0);
    expect(result.entries).toEqual([]);
  });
});
