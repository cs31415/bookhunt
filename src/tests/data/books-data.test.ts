import { getBookBySlug, getLibraryEntry, getBooksByIds } from '../../data/books-data';
import { pool } from '../../lib/db';

jest.mock('../../lib/db', () => ({
  pool: { query: jest.fn() },
}));

const mockQuery = (pool as any).query as jest.Mock;

describe('books-data', () => {
  describe('getBookBySlug', () => {
    it('returns the book row when found', async () => {
      const row = { id: 1, slug: 'a-book' };
      mockQuery.mockResolvedValue({ rows: [row] });
      const result = await getBookBySlug('a-book');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM fn_get_book_by_slug($1)',
        ['a-book'],
      );
      expect(result).toEqual(row);
    });

    it('returns null when no book is found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await getBookBySlug('missing');
      expect(result).toBeNull();
    });
  });

  describe('getLibraryEntry', () => {
    it('returns the entry row when found', async () => {
      const row = { user_id: 1, book_id: 2 };
      mockQuery.mockResolvedValue({ rows: [row] });
      const result = await getLibraryEntry(1, 2);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM library_entries WHERE user_id = $1 AND book_id = $2',
        [1, 2],
      );
      expect(result).toEqual(row);
    });

    it('returns null when no entry is found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await getLibraryEntry(1, 999);
      expect(result).toBeNull();
    });
  });

  describe('getBooksByIds', () => {
    it('calls fn_get_books_by_ids with the id array and returns rows', async () => {
      const rows = [{ book_id: 1, title: 'A Book' }, { book_id: 2, title: 'B Book' }];
      mockQuery.mockResolvedValue({ rows });
      const result = await getBooksByIds([1, 2]);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM fn_get_books_by_ids($1)',
        [[1, 2]],
      );
      expect(result).toEqual(rows);
    });
  });
});
