import { searchBooks } from '../../../models/search/search-books';
import * as searchData from '../../../data/search-data';

jest.mock('../../../data/search-data');

const mockSearchBooksData = searchData.searchBooks as jest.Mock;

describe('searchBooks model', () => {
  beforeEach(() => {
    mockSearchBooksData.mockReset();
  });

  it('tokenizes the query, strips stop words, and defaults sort to relevance when q is present', async () => {
    mockSearchBooksData.mockResolvedValue([{ book_id: 1, title: 'A', total_count: 3 }]);

    const result = await searchBooks({ q: 'the evolution of a species' }, null);

    expect(mockSearchBooksData).toHaveBeenCalledWith(
      expect.objectContaining({
        terms: ['evolution', 'species'],
        phrase: 'the evolution of a species',
        sort: 'relevance',
        userId: null,
        status: null,
        inLibraryOnly: false,
        limit: 24,
        offset: 0,
      }),
    );
    expect(result).toEqual({
      books: [{ book_id: 1, title: 'A' }],
      total: 3,
      page: 1,
      pageSize: 24,
      query: 'the evolution of a species',
    });
  });

  it('defaults sort to newest and terms to null when no query is given', async () => {
    mockSearchBooksData.mockResolvedValue([]);

    await searchBooks({}, null);

    expect(mockSearchBooksData).toHaveBeenCalledWith(
      expect.objectContaining({ terms: null, phrase: null, sort: 'newest' }),
    );
  });

  it('ignores status and inLibraryOnly for unauthenticated callers', async () => {
    mockSearchBooksData.mockResolvedValue([]);

    await searchBooks({ status: 'reading', inLibraryOnly: 'true' }, null);

    expect(mockSearchBooksData).toHaveBeenCalledWith(
      expect.objectContaining({ status: null, inLibraryOnly: false, userId: null }),
    );
  });

  it('honors status and inLibraryOnly for authenticated callers', async () => {
    mockSearchBooksData.mockResolvedValue([]);

    await searchBooks({ status: 'reading', inLibraryOnly: 'true' }, 7);

    expect(mockSearchBooksData).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'reading', inLibraryOnly: true, userId: 7 }),
    );
  });

  it('normalizes repeated subjects/moods params to arrays', async () => {
    mockSearchBooksData.mockResolvedValue([]);

    await searchBooks({ subjects: ['Fiction', 'History'], moods: 'Bleak' }, null);

    expect(mockSearchBooksData).toHaveBeenCalledWith(
      expect.objectContaining({ subjects: ['Fiction', 'History'], moods: ['Bleak'] }),
    );
  });

  it('clamps limit to the max and computes offset from page', async () => {
    mockSearchBooksData.mockResolvedValue([]);

    await searchBooks({ page: '3', limit: '9999' }, null);

    expect(mockSearchBooksData).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 60, offset: 120 }),
    );
  });

  it('parses decade as an integer', async () => {
    mockSearchBooksData.mockResolvedValue([]);

    await searchBooks({ decade: '1990' }, null);

    expect(mockSearchBooksData).toHaveBeenCalledWith(expect.objectContaining({ decade: 1990 }));
  });

  it('returns total 0 when no rows are found', async () => {
    mockSearchBooksData.mockResolvedValue([]);

    const result = await searchBooks({ q: 'nothing matches' }, null);

    expect(result.total).toBe(0);
    expect(result.books).toEqual([]);
  });
});
