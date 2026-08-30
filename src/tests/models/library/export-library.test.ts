import { exportLibrary } from '../../../models/library/export-library';
import { exportLibraryRows } from '../../../data/library-data';
import { myFavoriteAuthors } from '../../../models/authors/favorites';
import { myFavorites } from '../../../models/users/favorites';

jest.mock('../../../data/library-data');
jest.mock('../../../models/authors/favorites');
jest.mock('../../../models/users/favorites');

const mockExportRows = exportLibraryRows as jest.Mock;
const mockFavoriteAuthors = myFavoriteAuthors as jest.Mock;
const mockFavoriteUsers = myFavorites as jest.Mock;

function row(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Dune',
    author_name: 'Frank Herbert',
    publisher: 'Ace',
    isbn13: '9780441013593',
    status: 'finished',
    is_ebook: false,
    is_audiobook: false,
    is_favorite: false,
    total_count: '1',
    ...overrides,
  };
}

describe('exportLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExportRows.mockResolvedValue([row()]);
    mockFavoriteAuthors.mockResolvedValue([]);
    mockFavoriteUsers.mockResolvedValue([]);
  });

  it('carries the fields the CSV importer reads, so a round trip works', async () => {
    const result = await exportLibrary(1);

    expect(result.books).toEqual([
      {
        title: 'Dune',
        author: 'Frank Herbert',
        publisher: 'Ace',
        isbn: '9780441013593',
        status: 'finished',
        format: 'physical',
      },
    ]);
  });

  /*
   * Without this the round trip loses what a reader owns: the CSV importer
   * reads a format column, so an export without one makes every book physical
   * on the way back in (LOS-347).
   */
  it('carries the format, so an ebook comes back an ebook', async () => {
    mockExportRows.mockResolvedValue([row({ is_ebook: true })]);

    const result = await exportLibrary(1);

    expect(result.books[0].format).toBe('ebook');
  });

  it('calls an audiobook an audiobook', async () => {
    mockExportRows.mockResolvedValue([row({ is_audiobook: true })]);

    const result = await exportLibrary(1);

    expect(result.books[0].format).toBe('audiobook');
  });

  // The two flags are independent in the schema but the importer's column is
  // one word, so a row claiming both has to pick one.
  it('calls a book that claims both an ebook', async () => {
    mockExportRows.mockResolvedValue([row({ is_ebook: true, is_audiobook: true })]);

    const result = await exportLibrary(1);

    expect(result.books[0].format).toBe('ebook');
  });

  it('calls everything else physical', async () => {
    const result = await exportLibrary(1);

    expect(result.books[0].format).toBe('physical');
  });

  // A machine-readable file carries the machine-readable word, not the label
  // the import modal shows a reader.
  it('uses the stored status word rather than the display label', async () => {
    mockExportRows.mockResolvedValue([row({ status: 'queued', total_count: '1' })]);

    const result = await exportLibrary(1);

    expect(result.books[0].status).toBe('queued');
  });

  it('stamps the file with when it was made', async () => {
    const result = await exportLibrary(1);

    expect(Number.isNaN(Date.parse(result.exportedAt))).toBe(false);
  });

  it('splits favourites into the three lists the app keeps', async () => {
    mockExportRows.mockResolvedValue([
      row({ title: 'Dune', is_favorite: true, total_count: '2' }),
      row({ title: 'Ubik', is_favorite: false, total_count: '2' }),
    ]);
    mockFavoriteAuthors.mockResolvedValue([
      { name: 'Frank Herbert', slug: 'frank-herbert', bookCount: 3 },
    ]);
    mockFavoriteUsers.mockResolvedValue([
      { handle: 'ada', displayName: 'Ada', isMutual: true },
    ]);

    const result = await exportLibrary(1);

    expect(result.books).toHaveLength(2);
    expect(result.favorites.books.map((b) => b.title)).toEqual(['Dune']);
    expect(result.favorites.authors).toEqual([{ name: 'Frank Herbert', slug: 'frank-herbert' }]);
    expect(result.favorites.users).toEqual([{ handle: 'ada', displayName: 'Ada' }]);
  });

  // The flag is already on the row, so asking the database a second time would
  // put the same question twice.
  it('reads favourite books from the rows it already has', async () => {
    await exportLibrary(1);

    expect(mockExportRows).toHaveBeenCalledTimes(1);
  });

  it('walks every page when the library is longer than one', async () => {
    const full = Array.from({ length: 500 }, (_, i) =>
      row({ title: `Book ${i}`, total_count: '750' }),
    );
    const rest = Array.from({ length: 250 }, (_, i) =>
      row({ title: `Book ${500 + i}`, total_count: '750' }),
    );
    mockExportRows.mockResolvedValueOnce(full).mockResolvedValueOnce(rest);

    const result = await exportLibrary(1);

    expect(result.books).toHaveLength(750);
    expect(mockExportRows).toHaveBeenNthCalledWith(1, 1, { limit: 500, offset: 0 });
    expect(mockExportRows).toHaveBeenNthCalledWith(2, 1, { limit: 500, offset: 500 });
  });

  // A full page whose window total is already met is the last page. Without
  // this the walk asks for one more and gets nothing back, every time.
  it('stops on a full last page rather than asking for one more', async () => {
    mockExportRows.mockResolvedValueOnce(
      Array.from({ length: 500 }, () => row({ total_count: '500' })),
    );

    const result = await exportLibrary(1);

    expect(result.books).toHaveLength(500);
    expect(mockExportRows).toHaveBeenCalledTimes(1);
  });

  it('gives an empty library an empty file rather than failing', async () => {
    mockExportRows.mockResolvedValue([]);

    const result = await exportLibrary(1);

    expect(result.books).toEqual([]);
    expect(result.favorites).toEqual({ books: [], authors: [], users: [] });
  });
});
