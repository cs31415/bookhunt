import { Request, Response } from 'express';
import { getLibrary } from '../../../controllers/library/get-library';
import * as getLibraryModel from '../../../models/library/get-library';

jest.mock('../../../models/library/get-library');

const mockGetLibrary = getLibraryModel.getLibrary as jest.Mock;

function makeReq(userId: number, query: Record<string, unknown> = {}) {
  return { user: { id: userId, email: 'a@b.com' }, query } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('getLibrary controller', () => {
  it('returns library data for the authenticated user, passing query through for pagination', async () => {
    const data = { entries: [{ id: 1 }], stats: { total: 1 }, total: 1, page: 2, pageSize: 24 };
    mockGetLibrary.mockResolvedValue(data);
    const res = makeRes();
    const query = { page: '2' };
    await getLibrary(makeReq(7, query), res);
    expect(mockGetLibrary).toHaveBeenCalledWith(7, query);
    expect(res.json).toHaveBeenCalledWith(data);
  });

  it('returns 500 on error', async () => {
    mockGetLibrary.mockRejectedValue(new Error('db fail'));
    const res = makeRes();
    await getLibrary(makeReq(7), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
