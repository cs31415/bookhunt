import { getLibrary } from '../../../models/library/get-library';
import * as libraryData from '../../../data/library-data';

jest.mock('../../../data/library-data');

const mockGetUserLibrary = libraryData.getUserLibrary as jest.Mock;
const mockGetLibraryStats = libraryData.getLibraryStats as jest.Mock;

describe('getLibrary model', () => {
  it('fetches entries and stats in parallel, defaults pagination, and strips total_count', async () => {
    const rows = [{ id: 1, title: 'A Book', total_count: '3' }];
    const stats = { total: 3, read: 0, queued: 1 };
    mockGetUserLibrary.mockResolvedValue(rows);
    mockGetLibraryStats.mockResolvedValue(stats);

    const result = await getLibrary(42);

    expect(mockGetUserLibrary).toHaveBeenCalledWith(42, { limit: 24, offset: 0 });
    expect(mockGetLibraryStats).toHaveBeenCalledWith(42);
    expect(result).toEqual({
      entries: [{ id: 1, title: 'A Book' }],
      stats,
      total: 3,
      page: 1,
      pageSize: 24,
    });
  });

  it('computes offset from page/limit query params', async () => {
    mockGetUserLibrary.mockResolvedValue([]);
    mockGetLibraryStats.mockResolvedValue({ total: 0 });

    await getLibrary(42, { page: '3', limit: '10' });

    expect(mockGetUserLibrary).toHaveBeenCalledWith(42, { limit: 10, offset: 20 });
  });

  // Stats cover the whole library, so a client walking every page was paying for
  // an identical query per request.
  it('skips the stats query past the first page', async () => {
    mockGetUserLibrary.mockResolvedValue([{ id: 1, total_count: '99' }]);

    const result = await getLibrary(42, { page: '2' });

    expect(mockGetLibraryStats).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('stats');
    // Pagination never depended on the stats, so a later page still reports it.
    expect(result.total).toBe(99);
  });

  it('clamps limit to the maximum and returns 0 total when there are no entries', async () => {
    mockGetUserLibrary.mockResolvedValue([]);
    mockGetLibraryStats.mockResolvedValue({ total: 0 });

    const result = await getLibrary(42, { limit: '999' });

    expect(mockGetUserLibrary).toHaveBeenCalledWith(42, { limit: 60, offset: 0 });
    expect(result.total).toBe(0);
  });
});
