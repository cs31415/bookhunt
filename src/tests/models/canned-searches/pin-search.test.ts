import { pinSearch } from '../../../models/canned-searches/pin-search';
import { unpinSearch } from '../../../models/canned-searches/unpin-search';
import {
  PinLimitReachedError,
  UnknownCannedSearchError,
} from '../../../models/canned-searches/pin-errors';
import { MAX_PINNED_SEARCHES } from '../../../models/canned-searches/pill-row';
import * as cannedSearchesData from '../../../data/canned-searches-data';

jest.mock('../../../data/canned-searches-data');

const mockGetActiveByIds = cannedSearchesData.getActiveByIds as jest.Mock;
const mockGetPinnedForUser = cannedSearchesData.getPinnedForUser as jest.Mock;
const mockCountPins = cannedSearchesData.countPins as jest.Mock;
const mockPinSearch = cannedSearchesData.pinSearch as jest.Mock;
const mockUnpinSearch = cannedSearchesData.unpinSearch as jest.Mock;

function search(id: number) {
  return { id, query: `query ${id}`, category: 'mood' };
}

describe('pinSearch model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActiveByIds.mockResolvedValue([search(3)]);
    mockGetPinnedForUser.mockResolvedValue([]);
    mockCountPins.mockResolvedValue(0);
  });

  it('pins the search and returns it', async () => {
    const result = await pinSearch(7, 3);

    expect(mockPinSearch).toHaveBeenCalledWith(7, 3);
    expect(result).toEqual(search(3));
  });

  it('rejects an id with no active canned search behind it', async () => {
    mockGetActiveByIds.mockResolvedValue([]);

    await expect(pinSearch(7, 999)).rejects.toThrow(UnknownCannedSearchError);
    expect(mockPinSearch).not.toHaveBeenCalled();
  });

  it('refuses a new pin once the reader is at the cap', async () => {
    mockCountPins.mockResolvedValue(MAX_PINNED_SEARCHES);
    mockGetPinnedForUser.mockResolvedValue([search(1)]);

    await expect(pinSearch(7, 3)).rejects.toThrow(PinLimitReachedError);
    expect(mockPinSearch).not.toHaveBeenCalled();
  });

  it('allows re-pinning something already pinned at the cap', async () => {
    // It is a no-op, so refusing it would be an error for an action that
    // changes nothing -- exactly what a double click produces.
    mockCountPins.mockResolvedValue(MAX_PINNED_SEARCHES);
    mockGetPinnedForUser.mockResolvedValue([search(3)]);

    await expect(pinSearch(7, 3)).resolves.toEqual(search(3));
    expect(mockPinSearch).toHaveBeenCalledWith(7, 3);
  });
});

describe('unpinSearch model', () => {
  beforeEach(() => jest.clearAllMocks());

  it('delegates to the data layer', async () => {
    await unpinSearch(7, 3);

    expect(mockUnpinSearch).toHaveBeenCalledWith(7, 3);
  });

  it('succeeds when there was nothing pinned to remove', async () => {
    mockUnpinSearch.mockResolvedValue(false);

    await expect(unpinSearch(7, 3)).resolves.toBeUndefined();
  });
});
