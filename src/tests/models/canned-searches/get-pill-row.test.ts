import { getPillRow } from '../../../models/canned-searches/get-pill-row';
import * as cannedSearchesData from '../../../data/canned-searches-data';

jest.mock('../../../data/canned-searches-data');

const mockGetPinnedForUser = cannedSearchesData.getPinnedForUser as jest.Mock;
const mockGetActiveByIds = cannedSearchesData.getActiveByIds as jest.Mock;
const mockGetRandomActive = cannedSearchesData.getRandomActive as jest.Mock;
const mockGetRecentDraws = cannedSearchesData.getRecentDraws as jest.Mock;
const mockRecordDraw = cannedSearchesData.recordDraw as jest.Mock;
const mockPruneDraws = cannedSearchesData.pruneDraws as jest.Mock;
const mockGetLatestDraw = cannedSearchesData.getLatestDraw as jest.Mock;

function search(id: number) {
  return { id, query: `query ${id}`, category: 'mood' };
}

describe('getPillRow model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPinnedForUser.mockResolvedValue([]);
    mockGetActiveByIds.mockResolvedValue([]);
    mockGetRandomActive.mockResolvedValue([]);
    mockGetRecentDraws.mockResolvedValue([]);
    mockGetLatestDraw.mockResolvedValue(null);
  });

  describe('for a signed-in reader', () => {
    it('takes pins from the database and ignores the ids the client sent', async () => {
      mockGetPinnedForUser.mockResolvedValue([search(1)]);

      await getPillRow({ userId: 7, pinnedIds: [99] });

      expect(mockGetPinnedForUser).toHaveBeenCalledWith(7);
      expect(mockGetActiveByIds).not.toHaveBeenCalled();
    });
  });

  describe('for a guest', () => {
    it('resolves the pins from the ids the client sent', async () => {
      mockGetActiveByIds.mockResolvedValue([search(4)]);

      const row = await getPillRow({ userId: null, pinnedIds: [4] });

      expect(mockGetActiveByIds).toHaveBeenCalledWith([4]);
      expect(mockGetPinnedForUser).not.toHaveBeenCalled();
      expect(row.pinned).toEqual([search(4)]);
    });
  });

  it('excludes pinned ids from the random draw so nothing appears twice', async () => {
    mockGetPinnedForUser.mockResolvedValue([search(1), search(2)]);

    await getPillRow({ userId: 7, pinnedIds: [] });

    expect(mockGetRandomActive).toHaveBeenCalledWith(expect.any(Number), [1, 2]);
  });

  it('fills the row out to the requested size', async () => {
    mockGetPinnedForUser.mockResolvedValue([search(1), search(2)]);

    await getPillRow({ userId: 7, pinnedIds: [], rowSize: 6 });

    expect(mockGetRandomActive).toHaveBeenCalledWith(4, expect.anything());
  });

  describe('persistence of the current row', () => {
    it('restores the row the reader was last shown instead of drawing a new one', async () => {
      mockGetLatestDraw.mockResolvedValue({ id: 5, searchIds: [7, 8] });
      mockGetActiveByIds.mockResolvedValue([search(7), search(8)]);

      const row = await getPillRow({ userId: 7, pinnedIds: [] });

      expect(row.suggested).toEqual([search(7), search(8)]);
      expect(mockGetRandomActive).not.toHaveBeenCalled();
      // Nothing new was shown, so nothing new to remember.
      expect(mockRecordDraw).not.toHaveBeenCalled();
    });

    it('restores a guest row from the ids their browser sent', async () => {
      // Resolves by id: the guest path calls this twice, once for pins and once
      // for the row, and a blanket return would feed the same rows to both.
      mockGetActiveByIds.mockImplementation(async (ids: number[]) => ids.map(search));

      const row = await getPillRow({ userId: null, pinnedIds: [], drawIds: [7] });

      expect(row.suggested).toEqual([search(7)]);
      expect(mockGetRandomActive).not.toHaveBeenCalled();
    });

    it('draws and records a new row when asked to refresh', async () => {
      mockGetLatestDraw.mockResolvedValue({ id: 5, searchIds: [7, 8] });
      mockGetRandomActive.mockResolvedValue([search(1), search(2)]);

      const row = await getPillRow({ userId: 7, pinnedIds: [], refresh: true });

      expect(row.suggested).toEqual([search(1), search(2)]);
      expect(mockRecordDraw).toHaveBeenCalledWith(7, [1, 2]);
      expect(mockPruneDraws).toHaveBeenCalled();
    });

    it('draws a first row when the reader has no stored one', async () => {
      mockGetLatestDraw.mockResolvedValue(null);
      mockGetRandomActive.mockResolvedValue([search(1)]);

      await getPillRow({ userId: 7, pinnedIds: [] });

      expect(mockRecordDraw).toHaveBeenCalledWith(7, [1]);
    });

    it('drops a restored search the reader has pinned since, so it is not shown twice', async () => {
      mockGetPinnedForUser.mockResolvedValue([search(7)]);
      mockGetLatestDraw.mockResolvedValue({ id: 5, searchIds: [7, 8] });
      mockGetActiveByIds.mockResolvedValue([search(7), search(8)]);

      const row = await getPillRow({ userId: 7, pinnedIds: [] });

      expect(row.pinned).toEqual([search(7)]);
      expect(row.suggested).toEqual([search(8)]);
    });
  });

  describe('the draw history', () => {
    it('is left out unless asked for', async () => {
      const row = await getPillRow({ userId: 7, pinnedIds: [] });

      expect(row.history).toEqual([]);
      expect(mockGetRecentDraws).not.toHaveBeenCalled();
    });

    it('excludes the restored row, which is the one already on screen', async () => {
      mockGetLatestDraw.mockResolvedValue({ id: 9, searchIds: [7] });
      mockGetRecentDraws.mockResolvedValue([{ id: 9, searchIds: [7] }, { id: 8, searchIds: [1] }]);
      mockGetActiveByIds.mockImplementation(async (ids: number[]) => ids.map(search));

      const row = await getPillRow({ userId: 7, pinnedIds: [], includeHistory: true });

      expect(row.suggested).toEqual([search(7)]);
      expect(row.history).toEqual([[search(1)]]);
    });

    it('keeps every stored draw when the row is newly drawn', async () => {
      mockGetLatestDraw.mockResolvedValue(null);
      mockGetRandomActive.mockResolvedValue([search(3)]);
      mockGetRecentDraws.mockResolvedValue([{ id: 8, searchIds: [1] }]);
      mockGetActiveByIds.mockImplementation(async (ids: number[]) => ids.map(search));

      const row = await getPillRow({ userId: 7, pinnedIds: [], includeHistory: true });

      expect(row.history).toEqual([[search(1)]]);
    });

    it('is always empty for a guest, who has nowhere to keep one', async () => {
      const row = await getPillRow({ userId: null, pinnedIds: [], includeHistory: true });

      expect(row.history).toEqual([]);
      expect(mockGetRecentDraws).not.toHaveBeenCalled();
    });
  });

  it('still draws suggestions when pins alone would fill the row', async () => {
    // A reader at the pin cap. Without the floor the row would be entirely
    // pinned and would never change, which defeats the rotation.
    mockGetPinnedForUser.mockResolvedValue([1, 2, 3, 4, 5, 6].map(search));

    await getPillRow({ userId: 7, pinnedIds: [], rowSize: 6 });

    expect(mockGetRandomActive).toHaveBeenCalledWith(2, expect.anything());
  });
});
