import { getBooksByGoogleIds } from '../../../models/books/get-by-google-ids';
import * as booksData from '../../../data/books-data';

jest.mock('../../../data/books-data');

const mockGetBooksByGoogleIds = booksData.getBooksByGoogleIds as jest.Mock;

describe('getBooksByGoogleIds model', () => {
  it('re-exports the data layer function', async () => {
    const rows = [{ book_id: 1, google_books_id: 'abc123' }];
    mockGetBooksByGoogleIds.mockResolvedValue(rows);

    const result = await getBooksByGoogleIds(['abc123']);

    expect(mockGetBooksByGoogleIds).toHaveBeenCalledWith(['abc123']);
    expect(result).toEqual(rows);
  });
});
