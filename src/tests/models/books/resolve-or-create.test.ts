import { resolveOrCreateBook } from '../../../models/books/resolve-or-create';
import * as libraryData from '../../../data/library-data';
import { resolveEditionFields } from '../../../models/library/resolve-edition-fields';

jest.mock('../../../data/library-data');
jest.mock('../../../models/library/resolve-edition-fields');

const mockUpsertBook = libraryData.upsertBook as jest.Mock;
const mockResolveEditionFields = resolveEditionFields as jest.Mock;

describe('resolveOrCreateBook model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveEditionFields.mockImplementation((params) =>
      Promise.resolve({ blurb: params.blurb, publisher: params.publisher, pages: params.pages }),
    );
  });

  it('slugifies the title and upserts with source google_books when googleBooksId is present', async () => {
    mockUpsertBook.mockResolvedValue({ id: 10, slug: 'a-book-title' });

    const result = await resolveOrCreateBook({
      googleBooksId: 'gid',
      title: 'A Book: Title!',
      authorName: 'Author',
    });

    expect(mockUpsertBook).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'a-book-title', source: 'google_books', googleBooksId: 'gid' }),
    );
    expect(result).toEqual({ id: 10, slug: 'a-book-title' });
  });

  it('uses source open_library when only openLibraryId is present', async () => {
    mockUpsertBook.mockResolvedValue({ id: 11, slug: 'ol-book' });

    await resolveOrCreateBook({
      openLibraryId: 'OL123M',
      title: 'OL Book',
      authorName: 'OL Author',
    });

    expect(mockUpsertBook).toHaveBeenCalledWith(expect.objectContaining({ source: 'open_library' }));
  });

  it('merges resolved edition fields into the upsert params', async () => {
    mockUpsertBook.mockResolvedValue({ id: 12, slug: 'x' });
    mockResolveEditionFields.mockResolvedValue({ blurb: 'Fetched', publisher: 'Press', pages: 200 });

    await resolveOrCreateBook({ googleBooksId: 'gid', title: 'X', authorName: 'Y' });

    expect(mockUpsertBook).toHaveBeenCalledWith(
      expect.objectContaining({ blurb: 'Fetched', publisher: 'Press', pages: 200 }),
    );
  });

  it('falls back to "book" when the title has no alphanumeric characters', async () => {
    mockUpsertBook.mockResolvedValue({ id: 13, slug: 'book' });

    await resolveOrCreateBook({ googleBooksId: 'gid', title: '???', authorName: 'Y' });

    expect(mockUpsertBook).toHaveBeenCalledWith(expect.objectContaining({ slug: 'book' }));
  });
});
