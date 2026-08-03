import { bulkRemoveFromLibrary } from '../../../models/library/bulk-remove-from-library';
import * as libraryData from '../../../data/library-data';

jest.mock('../../../data/library-data');

const mockRemoveMany = libraryData.removeManyFromLibrary as jest.Mock;

describe('bulkRemoveFromLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRemoveMany.mockResolvedValue(0);
  });

  it('passes the ids straight through', async () => {
    mockRemoveMany.mockResolvedValue(3);

    const result = await bulkRemoveFromLibrary(7, [1, 2, 3]);

    expect(mockRemoveMany).toHaveBeenCalledWith(7, [1, 2, 3]);
    expect(result).toEqual({ removed: 3, requested: 3 });
  });

  // The SQL is a set operation, so the database would count a repeat once
  // regardless -- deduping here keeps `removed` comparable to `requested`
  // rather than making the duplicate look like a failed removal.
  it('dedupes repeated ids before counting them as requested', async () => {
    mockRemoveMany.mockResolvedValue(2);

    const result = await bulkRemoveFromLibrary(7, [1, 2, 2, 1]);

    expect(mockRemoveMany).toHaveBeenCalledWith(7, [1, 2]);
    expect(result).toEqual({ removed: 2, requested: 2 });
  });

  // Ids belonging to someone else match nothing. Reported, not thrown: the
  // caller wanted those books out of their library, and they are.
  it('reports removing fewer than were asked for', async () => {
    mockRemoveMany.mockResolvedValue(1);

    const result = await bulkRemoveFromLibrary(7, [1, 999]);

    expect(result).toEqual({ removed: 1, requested: 2 });
  });

  it('does not query at all for an empty list', async () => {
    const result = await bulkRemoveFromLibrary(7, []);

    expect(mockRemoveMany).not.toHaveBeenCalled();
    expect(result).toEqual({ removed: 0, requested: 0 });
  });
});
