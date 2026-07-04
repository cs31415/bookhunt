import { addToLibrary } from '../../../models/library/add-to-library';
import * as libraryData from '../../../data/library-data';

jest.mock('../../../data/library-data');

const mockUpsertBook = libraryData.upsertBook as jest.Mock;
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

  it('adds a book sourced from OpenLibrary (no googleBooksId)', async () => {
    mockUpsertBook.mockResolvedValue({ id: 20 });
    mockAddToLibrary.mockResolvedValue({ id: 20, status: 'queued' });

    const olParams = {
      openLibraryId: 'OL7170815M',
      source: 'open_library' as const,
      slug: 'ol-book',
      title: 'OL Book',
      authorName: 'OL Author',
    };
    const result = await addToLibrary(1, olParams);

    expect(mockUpsertBook).toHaveBeenCalledWith(olParams);
    expect(result).toEqual({ id: 20, status: 'queued' });
  });
});
