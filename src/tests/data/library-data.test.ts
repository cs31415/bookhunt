import {
  getUserLibrary,
  getLibraryStats,
  addToLibrary,
  removeFromLibrary,
  addUserRelated,
  removeUserRelated,
  upsertBook,
} from '../../data/library-data';
import { pool } from '../../lib/db';

jest.mock('../../lib/db', () => ({
  pool: { query: jest.fn() },
}));

const mockQuery = (pool as any).query as jest.Mock;

describe('library-data', () => {
  describe('getUserLibrary', () => {
    it('returns rows from fn_get_user_library', async () => {
      const rows = [{ id: 1, title: 'A Book' }];
      mockQuery.mockResolvedValue({ rows });
      const result = await getUserLibrary(5, { limit: 24, offset: 0 });
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM fn_get_user_library($1, $2, $3)',
        [5, 24, 0],
      );
      expect(result).toEqual(rows);
    });
  });

  describe('getLibraryStats', () => {
    it('returns the fn_library_stats JSON object', async () => {
      const stats = { total: 3, read: 1 };
      mockQuery.mockResolvedValue({ rows: [{ fn_library_stats: stats }] });
      const result = await getLibraryStats(5);
      expect(result).toEqual(stats);
    });
  });

  describe('upsertBook', () => {
    it('passes all params to fn_upsert_book', async () => {
      const book = { id: 10, title: 'A' };
      mockQuery.mockResolvedValue({ rows: [book] });
      const params = {
        googleBooksId: 'gid',
        slug: 'a-book',
        title: 'A Book',
        authorName: 'Author',
        year: 2020,
        publisher: 'Press',
        pages: 300,
        rating: 4.2,
        subjects: ['Science'],
        blurb: 'desc',
        coverUrl: 'https://cover.jpg',
        isbn13: '978123',
        language: 'en',
        hue: '#ff0000',
        openLibraryId: 'OL7170815M',
        source: 'open_library' as const,
      };
      const result = await upsertBook(params);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('fn_upsert_book'),
        [
          'gid', 'a-book', 'A Book', 'Author',
          2020, 'Press', 300, 4.2, ['Science'], 'desc',
          'https://cover.jpg', '978123', 'en', '#ff0000',
          'OL7170815M', 'open_library',
        ],
      );
      expect(result).toEqual(book);
    });

    it('substitutes null for optional params when omitted', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      await upsertBook({
        googleBooksId: 'g',
        slug: 's',
        title: 'T',
        authorName: 'A',
      });
      const args = mockQuery.mock.calls[0][1];
      expect(args[4]).toBeNull(); // year
      expect(args[5]).toBeNull(); // publisher
    });

    it('defaults source to google_books and openLibraryId to null when omitted', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      await upsertBook({
        googleBooksId: 'g',
        slug: 's',
        title: 'T',
        authorName: 'A',
      });
      const args = mockQuery.mock.calls[0][1];
      expect(args[14]).toBeNull(); // openLibraryId
      expect(args[15]).toBe('google_books'); // source
    });
  });

  describe('addToLibrary', () => {
    it('calls fn_add_to_library and returns the row', async () => {
      const row = { id: 10, status: 'read' };
      mockQuery.mockResolvedValue({ rows: [row] });
      const result = await addToLibrary(1, 10, 'read');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM fn_add_to_library($1, $2, $3)',
        [1, 10, 'read'],
      );
      expect(result).toEqual(row);
    });
  });

  describe('removeFromLibrary', () => {
    it('returns the boolean result from the stored procedure', async () => {
      mockQuery.mockResolvedValue({ rows: [{ fn_remove_from_library: true }] });
      const result = await removeFromLibrary(1, 5);
      expect(result).toBe(true);
    });
  });

  describe('addUserRelated', () => {
    it('calls fn_add_user_related and returns the relation', async () => {
      const relation = { id: 99 };
      mockQuery.mockResolvedValue({ rows: [{ fn_add_user_related: relation }] });
      const result = await addUserRelated(1, 5, 6);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM fn_add_user_related($1, $2, $3)',
        [1, 5, 6],
      );
      expect(result).toEqual(relation);
    });
  });

  describe('removeUserRelated', () => {
    it('calls fn_remove_user_related and returns the result', async () => {
      mockQuery.mockResolvedValue({ rows: [{ fn_remove_user_related: true }] });
      const result = await removeUserRelated(1, 5, 6);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM fn_remove_user_related($1, $2, $3)',
        [1, 5, 6],
      );
      expect(result).toBe(true);
    });
  });
});
