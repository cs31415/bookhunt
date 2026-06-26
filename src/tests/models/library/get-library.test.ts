import { getLibrary } from '../../../models/library/get-library';
import * as libraryData from '../../../data/library-data';

jest.mock('../../../data/library-data');

const mockGetUserLibrary = libraryData.getUserLibrary as jest.Mock;
const mockGetLibraryStats = libraryData.getLibraryStats as jest.Mock;

describe('getLibrary model', () => {
  it('fetches entries and stats in parallel and returns combined result', async () => {
    const entries = [{ id: 1, title: 'A Book' }];
    const stats = { total: 1, read: 0, queued: 1 };
    mockGetUserLibrary.mockResolvedValue(entries);
    mockGetLibraryStats.mockResolvedValue(stats);

    const result = await getLibrary(42);

    expect(mockGetUserLibrary).toHaveBeenCalledWith(42);
    expect(mockGetLibraryStats).toHaveBeenCalledWith(42);
    expect(result).toEqual({ entries, stats });
  });
});
