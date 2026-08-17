import { Request, Response } from 'express';
import { repairCover } from '../../../controllers/books/repair-cover';
import * as repairCoverModel from '../../../models/books/repair-cover';

jest.mock('../../../models/books/repair-cover');

const mockRepairCover = repairCoverModel.repairCover as jest.Mock;

function makeReq(slug: string) {
  return { params: { slug } } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

const COVER = 'https://books.google.com/books/content?id=abc&img=1';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('repair-cover controller', () => {
  it('returns the replacement cover', async () => {
    mockRepairCover.mockResolvedValue({ outcome: 'repaired', coverUrl: COVER });

    const res = makeRes();
    await repairCover(makeReq('enlightenment'), res);

    expect(mockRepairCover).toHaveBeenCalledWith('enlightenment');
    expect(res.json).toHaveBeenCalledWith({ outcome: 'repaired', coverUrl: COVER });
  });

  it('returns the existing cover when it turned out to be alive', async () => {
    mockRepairCover.mockResolvedValue({ outcome: 'alive', coverUrl: COVER });

    const res = makeRes();
    await repairCover(makeReq('enlightenment'), res);

    expect(res.json).toHaveBeenCalledWith({ outcome: 'alive', coverUrl: COVER });
  });

  // Null rather than an absent field, so the client can tell "nothing found"
  // from a response it failed to read.
  it('reports no replacement with a null cover', async () => {
    mockRepairCover.mockResolvedValue({ outcome: 'no_replacement' });

    const res = makeRes();
    await repairCover(makeReq('enlightenment'), res);

    expect(res.json).toHaveBeenCalledWith({ outcome: 'no_replacement', coverUrl: null });
  });

  it('404s when there is no book or no cover on it', async () => {
    mockRepairCover.mockResolvedValue({ outcome: 'not_found' });

    const res = makeRes();
    await repairCover(makeReq('nope'), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('500s when the model throws', async () => {
    mockRepairCover.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = makeRes();
    await repairCover(makeReq('enlightenment'), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
