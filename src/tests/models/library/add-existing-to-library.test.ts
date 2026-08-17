import { addExistingToLibrary } from '../../../models/library/add-existing-to-library';
import * as libraryData from '../../../data/library-data';

jest.mock('../../../data/library-data');

const mockAddToLibrary = libraryData.addToLibrary as jest.Mock;

describe('addExistingToLibrary model', () => {
  it('delegates to the idempotent data-layer addToLibrary', async () => {
    const entry = { user_id: 1, book_id: 2, status: 'queued' };
    mockAddToLibrary.mockResolvedValue(entry);

    const result = await addExistingToLibrary(1, 2, 'queued');

    expect(mockAddToLibrary).toHaveBeenCalledWith(1, 2, 'queued', {});
    expect(result).toEqual(entry);
  });

  it('carries the format an import read from its file', async () => {
    mockAddToLibrary.mockResolvedValue({});

    await addExistingToLibrary(1, 2, 'queued', { isAudiobook: true });

    expect(mockAddToLibrary).toHaveBeenCalledWith(1, 2, 'queued', { isAudiobook: true });
  });
});
