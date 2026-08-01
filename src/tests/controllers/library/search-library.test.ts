import { Request, Response } from 'express';
import { searchLibrary } from '../../../controllers/library/search-library';
import * as searchLibraryModel from '../../../models/library/search-library';

jest.mock('../../../models/library/search-library');

const mockSearchLibrary = searchLibraryModel.searchLibrary as jest.Mock;

function makeReq(userId: number, query: Record<string, unknown> = {}) {
  return { user: { id: userId, email: 'a@b.com' }, query } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('searchLibrary controller', () => {
  it('searches the authenticated user library, passing the query through', async () => {
    const data = { entries: [{ book_id: 1 }], total: 1, page: 1, pageSize: 24, query: 'sagan' };
    mockSearchLibrary.mockResolvedValue(data);
    const res = makeRes();
    const query = { q: 'sagan', sort: 'title' };

    await searchLibrary(makeReq(4, query), res);

    expect(mockSearchLibrary).toHaveBeenCalledWith(4, query);
    expect(res.json).toHaveBeenCalledWith(data);
  });

  it('returns 500 on error', async () => {
    mockSearchLibrary.mockRejectedValue(new Error('db fail'));
    const res = makeRes();

    await searchLibrary(makeReq(4, { q: 'sagan' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
