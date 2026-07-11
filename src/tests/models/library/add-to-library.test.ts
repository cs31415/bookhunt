import { addToLibrary } from '../../../models/library/add-to-library';
import * as libraryData from '../../../data/library-data';
import { resolveEditionFields } from '../../../models/library/resolve-edition-fields';

jest.mock('../../../data/library-data');
jest.mock('../../../models/library/resolve-edition-fields');

const mockUpsertBook = libraryData.upsertBook as jest.Mock;
const mockAddToLibrary = libraryData.addToLibrary as jest.Mock;
const mockResolveEditionFields = resolveEditionFields as jest.Mock;

const baseParams = {
  googleBooksId: 'gid',
  slug: 'a-book',
  title: 'A Book',
  authorName: 'Author',
};

describe('addToLibrary model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveEditionFields.mockImplementation((params) =>
      Promise.resolve({ blurb: params.blurb, publisher: params.publisher, pages: params.pages }),
    );
  });

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

  it('merges resolved OpenLibrary fields into the upserted book params', async () => {
    mockUpsertBook.mockResolvedValue({ id: 21 });
    mockAddToLibrary.mockResolvedValue({ id: 21, status: 'queued' });
    mockResolveEditionFields.mockResolvedValue({
      blurb: 'Fetched from OpenLibrary',
      publisher: 'OL Press',
      pages: 321,
    });

    const olParams = {
      openLibraryId: 'OL7170815M',
      source: 'open_library' as const,
      slug: 'ol-book',
      title: 'OL Book',
      authorName: 'OL Author',
    };
    await addToLibrary(1, olParams);

    expect(mockResolveEditionFields).toHaveBeenCalledWith(olParams);
    expect(mockUpsertBook).toHaveBeenCalledWith({
      ...olParams,
      blurb: 'Fetched from OpenLibrary',
      publisher: 'OL Press',
      pages: 321,
    });
  });
});
