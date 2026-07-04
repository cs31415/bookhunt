import { bulkAddToLibrary } from '../../../models/library/bulk-add-to-library';
import * as libraryData from '../../../data/library-data';

jest.mock('../../../data/library-data');

const mockUpsertBook = libraryData.upsertBook as jest.Mock;
const mockAddToLibrary = libraryData.addToLibrary as jest.Mock;

const book1 = { googleBooksId: 'gid1', slug: 'book-one', title: 'Book One', authorName: 'Author A' };
const book2 = { googleBooksId: 'gid2', slug: 'book-two', title: 'Book Two', authorName: 'Author B' };

describe('bulkAddToLibrary model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls upsertBook and addToLibrary for each book', async () => {
    mockUpsertBook.mockResolvedValueOnce({ id: 10 }).mockResolvedValueOnce({ id: 11 });
    mockAddToLibrary.mockResolvedValueOnce({ id: 10 }).mockResolvedValueOnce({ id: 11 });

    await bulkAddToLibrary(1, [book1, book2]);

    expect(mockUpsertBook).toHaveBeenCalledTimes(2);
    expect(mockAddToLibrary).toHaveBeenCalledWith(1, 10, 'queued');
    expect(mockAddToLibrary).toHaveBeenCalledWith(1, 11, 'queued');
  });

  it('defaults status to queued when not provided', async () => {
    mockUpsertBook.mockResolvedValue({ id: 5 });
    mockAddToLibrary.mockResolvedValue({ id: 5 });

    await bulkAddToLibrary(1, [book1]);

    expect(mockAddToLibrary).toHaveBeenCalledWith(1, 5, 'queued');
  });

  it('uses provided status instead of default', async () => {
    mockUpsertBook.mockResolvedValue({ id: 5 });
    mockAddToLibrary.mockResolvedValue({ id: 5 });

    await bulkAddToLibrary(1, [{ ...book1, status: 'reading' }]);

    expect(mockAddToLibrary).toHaveBeenCalledWith(1, 5, 'reading');
  });

  it('deduplicates by googleBooksId before processing', async () => {
    mockUpsertBook.mockResolvedValue({ id: 10 });
    mockAddToLibrary.mockResolvedValue({ id: 10 });

    await bulkAddToLibrary(1, [book1, book1, book2]);

    expect(mockUpsertBook).toHaveBeenCalledTimes(2);
  });

  it('does not collapse distinct OpenLibrary-sourced books (no googleBooksId)', async () => {
    mockUpsertBook.mockResolvedValueOnce({ id: 30 }).mockResolvedValueOnce({ id: 31 });
    mockAddToLibrary.mockResolvedValueOnce({ id: 30 }).mockResolvedValueOnce({ id: 31 });

    const olBook1 = { openLibraryId: 'OL1M', slug: 'ol-one', title: 'OL One', authorName: 'Author A' };
    const olBook2 = { openLibraryId: 'OL2M', slug: 'ol-two', title: 'OL Two', authorName: 'Author B' };

    await bulkAddToLibrary(1, [olBook1, olBook2]);

    expect(mockUpsertBook).toHaveBeenCalledTimes(2);
  });

  it('returns entries for successful books and errors for failed ones', async () => {
    mockUpsertBook
      .mockResolvedValueOnce({ id: 10 })
      .mockRejectedValueOnce(new Error('fetch failed'));
    mockAddToLibrary.mockResolvedValueOnce({ id: 10, status: 'queued' });

    const { entries, errors } = await bulkAddToLibrary(1, [book1, book2]);

    expect(entries).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({ index: 1, googleBooksId: 'gid2', reason: 'fetch failed' });
  });

  it('returns all entries and empty errors when all succeed', async () => {
    mockUpsertBook.mockResolvedValueOnce({ id: 10 }).mockResolvedValueOnce({ id: 11 });
    mockAddToLibrary.mockResolvedValueOnce({ id: 10 }).mockResolvedValueOnce({ id: 11 });

    const { entries, errors } = await bulkAddToLibrary(1, [book1, book2]);

    expect(entries).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });
});
