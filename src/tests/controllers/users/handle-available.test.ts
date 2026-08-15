import { Request, Response } from 'express';
import { handleAvailable } from '../../../controllers/users/handle-available';
import * as checkHandleModel from '../../../models/users/check-handle';

jest.mock('../../../models/users/check-handle');

const mockCheckHandle = checkHandleModel.checkHandle as jest.Mock;

function makeReq(query: unknown = {}) {
  return { query } as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('handleAvailable controller', () => {
  it('returns the model answer unchanged', async () => {
    const answer = { handle: 'ada', available: true, reason: null };
    mockCheckHandle.mockResolvedValue(answer);

    const res = makeRes();
    await handleAvailable(makeReq({ handle: 'ada' }), res);

    expect(mockCheckHandle).toHaveBeenCalledWith('ada');
    expect(res.json).toHaveBeenCalledWith(answer);
  });

  it.each([
    ['a missing handle', {}],
    ['a blank handle', { handle: '   ' }],
    ['a repeated parameter', { handle: ['ada', 'bob'] }],
  ])('returns 400 for %s', async (_label, query) => {
    const res = makeRes();
    await handleAvailable(makeReq(query), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockCheckHandle).not.toHaveBeenCalled();
  });

  it('returns 500 on an unexpected error', async () => {
    mockCheckHandle.mockRejectedValue(new Error('DB error'));

    const res = makeRes();
    await handleAvailable(makeReq({ handle: 'ada' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
