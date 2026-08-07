import { saveSearch } from '../../../models/canned-searches/save-search';
import {
  InvalidSavedQueryError,
  PinLimitReachedError,
} from '../../../models/canned-searches/pin-errors';
import { MAX_PINNED_SEARCHES } from '../../../models/canned-searches/pill-row';
import * as cannedSearchesData from '../../../data/canned-searches-data';

jest.mock('../../../data/canned-searches-data');

const mockUpsertUserSearch = cannedSearchesData.upsertUserSearch as jest.Mock;
const mockCountPins = cannedSearchesData.countPins as jest.Mock;
const mockPinSearch = cannedSearchesData.pinSearch as jest.Mock;

describe('saveSearch model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCountPins.mockResolvedValue(0);
    mockUpsertUserSearch.mockResolvedValue({ id: 601, query: 'novels about bees', category: 'saved' });
  });

  it('creates the search and pins it, so it is visible at all', async () => {
    const result = await saveSearch(7, 'novels about bees');

    expect(mockUpsertUserSearch).toHaveBeenCalledWith(7, 'novels about bees');
    expect(mockPinSearch).toHaveBeenCalledWith(7, 601);
    expect(result).toEqual({ id: 601, query: 'novels about bees', category: 'saved' });
  });

  // Without this, the same search typed with sloppy spacing becomes a second
  // row under the UNIQUE index and the reader gets two identical-looking pills.
  it('collapses whitespace so the same text does not become two rows', async () => {
    await saveSearch(7, '  novels   about  bees ');

    expect(mockUpsertUserSearch).toHaveBeenCalledWith(7, 'novels about bees');
  });

  it.each(['', '   ', 'ab'])('rejects text too short to be a search: %p', async (query) => {
    await expect(saveSearch(7, query)).rejects.toThrow(InvalidSavedQueryError);
    expect(mockUpsertUserSearch).not.toHaveBeenCalled();
  });

  it('rejects text longer than the limit', async () => {
    await expect(saveSearch(7, 'x'.repeat(201))).rejects.toThrow(InvalidSavedQueryError);
    expect(mockUpsertUserSearch).not.toHaveBeenCalled();
  });

  // Checked before the row is created, so a refusal does not leave an orphaned
  // search behind that nothing points at.
  it('refuses at the pin cap without creating anything', async () => {
    mockCountPins.mockResolvedValue(MAX_PINNED_SEARCHES);

    await expect(saveSearch(7, 'novels about bees')).rejects.toThrow(PinLimitReachedError);
    expect(mockUpsertUserSearch).not.toHaveBeenCalled();
    expect(mockPinSearch).not.toHaveBeenCalled();
  });
});
