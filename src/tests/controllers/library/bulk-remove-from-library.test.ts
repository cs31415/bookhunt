import { Request, Response } from 'express';
import { bulkRemoveFromLibrary } from '../../../controllers/library/bulk-remove-from-library';
import * as bulkModel from '../../../models/library/bulk-remove-from-library';

jest.mock('../../../models/library/bulk-remove-from-library');

const mockBulkRemove = bulkModel.bulkRemoveFromLibrary as jest.Mock;

function makeReq(body: unknown) {
  return { body, user: { id: 1, email: 'a@b.com' } } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('bulkRemoveFromLibrary controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBulkRemove.mockResolvedValue({ removed: 0, requested: 0 });
  });

  it.each([
    ['missing', {}],
    ['not an array', { bookIds: 'not-array' }],
    ['empty', { bookIds: [] }],
  ])('returns 400 when bookIds is %s', async (_label, body) => {
    const res = makeRes();
    await bulkRemoveFromLibrary(makeReq(body), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'bookIds must be a non-empty array' });
    expect(mockBulkRemove).not.toHaveBeenCalled();
  });

  it('returns 400 when bookIds exceeds the cap', async () => {
    const res = makeRes();
    await bulkRemoveFromLibrary(makeReq({ bookIds: Array.from({ length: 21 }, (_, i) => i + 1) }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'bookIds must contain at most 20 items' });
    expect(mockBulkRemove).not.toHaveBeenCalled();
  });

  // A stray string would reach the query as a book id of NaN. A delete is not
  // the place to guess what was meant.
  it.each([['a string', ['3']], ['a float', [1.5]], ['null', [null]]])(
    'returns 400 when bookIds holds %s',
    async (_label, bookIds) => {
      const res = makeRes();
      await bulkRemoveFromLibrary(makeReq({ bookIds }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'bookIds must contain only integers' });
      expect(mockBulkRemove).not.toHaveBeenCalled();
    },
  );

  it('passes the ids through and returns the counts', async () => {
    mockBulkRemove.mockResolvedValue({ removed: 2, requested: 3 });
    const res = makeRes();

    await bulkRemoveFromLibrary(makeReq({ bookIds: [1, 2, 3] }), res);

    expect(mockBulkRemove).toHaveBeenCalledWith(1, [1, 2, 3]);
    expect(res.json).toHaveBeenCalledWith({ removed: 2, requested: 3 });
  });

  // Asking to remove a book you do not have is not a failure: what you asked
  // for -- it not being in your library -- holds either way.
  it('reports a removal of nothing as a success', async () => {
    mockBulkRemove.mockResolvedValue({ removed: 0, requested: 1 });
    const res = makeRes();

    await bulkRemoveFromLibrary(makeReq({ bookIds: [999] }), res);

    expect(res.status).not.toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ removed: 0, requested: 1 });
  });

  it('returns 500 when the model throws', async () => {
    mockBulkRemove.mockRejectedValue(new Error('db down'));
    const res = makeRes();

    await bulkRemoveFromLibrary(makeReq({ bookIds: [1] }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
