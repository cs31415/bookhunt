import { searchBooks, getSearchFacets } from '../../data/search-data';
import { pool } from '../../lib/db';

jest.mock('../../lib/db', () => ({
  pool: { query: jest.fn() },
}));

const mockQuery = (pool as any).query as jest.Mock;

describe('search-data', () => {
  describe('searchBooks', () => {
    it('passes all params to fn_search_books in order and returns rows', async () => {
      const rows = [{ book_id: 1, title: 'A Book', total_count: 1 }];
      mockQuery.mockResolvedValue({ rows });

      const params = {
        terms: ['evolution'],
        phrase: 'evolution',
        subjects: ['Science'],
        moods: null,
        decade: 1990,
        authorSlug: null,
        userId: 5,
        status: null,
        inLibraryOnly: false,
        sort: 'relevance',
        limit: 24,
        offset: 0,
      };

      const result = await searchBooks(params);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM fn_search_books($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
        [
          params.terms,
          params.phrase,
          params.subjects,
          params.moods,
          params.decade,
          params.authorSlug,
          params.userId,
          params.status,
          params.inLibraryOnly,
          params.sort,
          params.limit,
          params.offset,
        ],
      );
      expect(result).toEqual(rows);
    });
  });

  describe('getSearchFacets', () => {
    it('calls fn_search_facets and returns the single row', async () => {
      const row = { subjects: ['History', 'Science'], moods: ['Lyrical'] };
      mockQuery.mockResolvedValue({ rows: [row] });

      const result = await getSearchFacets();

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM fn_search_facets()');
      expect(result).toEqual(row);
    });
  });
});
