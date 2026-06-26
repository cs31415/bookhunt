import { addToLibrary } from '../../../models/library/add-to-library';
import * as libraryData from '../../../data/library-data';

jest.mock('../../../data/library-data');

const mockUpsertBook = libraryData.upsertBookFromGoogle as jest.Mock;
const mockAddToLibrary = libraryData.addToLibrary as jest.Mock;

const baseParams = {
  googleBooksId: 'gid',
  slug: 'a-book',
  title: 'A Book',
  authorName: 'Author',
};

describe('addToLibrary model', () => {
  it('upserts book then adds to library with default status queued', async () => {
    mockUpsertBook.mockResolvedValue({ id: 10 });
    mockAddToLibrary.mockResolvedValue({ id: 10, status: 'queued' });

    const result = await addToLibrary(1, baseParams);

    expect(mockUpsertBook).toHaveBeenCalledWith(baseParams);
    expect(mockAddToLibrary).toHaveBeenCalledWith(1, 10, 'queued');
    expect(result).toEqual({ id: 10, status: 'queued' });
  });

  it('uses provided status instead of default', async () => {
    mockUpsertBook.mockResolvedValue({ id: 5 });
    mockAddToLibrary.mockResolvedValue({ id: 5, status: 'read' });

    await addToLibrary(2, { ...baseParams, status: 'read' });

    expect(mockAddToLibrary).toHaveBeenCalledWith(2, 5, 'read');
  });
});
