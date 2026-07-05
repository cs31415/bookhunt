import { Request, Response } from 'express';
import { searchBooks } from '../../../controllers/search/search-books';
import * as searchBooksModel from '../../../models/search/search-books';

jest.mock('../../../models/search/search-books');

const mockSearchBooks = searchBooksModel.searchBooks as jest.Mock;

function makeReq(query: Record<string, unknown>, userId?: number) {
  return {
    query,
    user: userId ? { id: userId, email: 'a@b.com' } : null,
  } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('searchBooks controller', () => {
  it('passes the query and authenticated user id to the model', async () => {
    const data = { books: [{ book_id: 1 }], total: 1, page: 1, pageSize: 24, query: 'evolution' };
    mockSearchBooks.mockResolvedValue(data);
    const res = makeRes();

    await searchBooks(makeReq({ q: 'evolution' }, 7), res);

    expect(mockSearchBooks).toHaveBeenCalledWith({ q: 'evolution' }, 7);
    expect(res.json).toHaveBeenCalledWith(data);
  });

  it('passes null user id for unauthenticated requests', async () => {
    mockSearchBooks.mockResolvedValue({ books: [], total: 0, page: 1, pageSize: 24, query: '' });
    const res = makeRes();

    await searchBooks(makeReq({}), res);

    expect(mockSearchBooks).toHaveBeenCalledWith({}, null);
  });

  it('returns 500 on error', async () => {
    mockSearchBooks.mockRejectedValue(new Error('db fail'));
    const res = makeRes();

    await searchBooks(makeReq({ q: 'x' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
