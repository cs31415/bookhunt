import { getBooksByIds } from '../../../models/books/get-by-ids';
import * as booksData from '../../../data/books-data';

jest.mock('../../../data/books-data');

const mockGetBooksByIds = booksData.getBooksByIds as jest.Mock;

describe('getBooksByIds model', () => {
  it('re-exports the data layer function', async () => {
    const rows = [{ book_id: 1 }];
    mockGetBooksByIds.mockResolvedValue(rows);

    const result = await getBooksByIds([1]);

    expect(mockGetBooksByIds).toHaveBeenCalledWith([1]);
    expect(result).toEqual(rows);
  });
});
