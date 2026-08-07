import { Request, Response } from 'express';
import { list } from '../../../controllers/canned-searches/list';
import { pin, unpin } from '../../../controllers/canned-searches/pin';
import * as getPillRowModel from '../../../models/canned-searches/get-pill-row';
import * as pinSearchModel from '../../../models/canned-searches/pin-search';
import * as unpinSearchModel from '../../../models/canned-searches/unpin-search';
import {
  PinLimitReachedError,
  UnknownCannedSearchError,
} from '../../../models/canned-searches/pin-errors';

jest.mock('../../../models/canned-searches/get-pill-row');
jest.mock('../../../models/canned-searches/pin-search');
jest.mock('../../../models/canned-searches/unpin-search');

const mockGetPillRow = getPillRowModel.getPillRow as jest.Mock;
const mockPinSearch = pinSearchModel.pinSearch as jest.Mock;
const mockUnpinSearch = unpinSearchModel.unpinSearch as jest.Mock;

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

function makeReq(query: Record<string, unknown> = {}, user: { id: number } | null = null) {
  return { query, params: {}, user } as unknown as Request;
}

describe('canned searches list controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPillRow.mockResolvedValue({ pinned: [], suggested: [] });
  });

  it('passes the signed-in reader through', async () => {
    await list(makeReq({}, { id: 7 }), makeRes());

    expect(mockGetPillRow).toHaveBeenCalledWith(expect.objectContaining({ userId: 7 }));
  });

  it('treats a logged-out visitor as a guest rather than failing', async () => {
    const res = makeRes();

    await list(makeReq(), res);

    expect(mockGetPillRow).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
    expect(res.json).toHaveBeenCalledWith({ pinned: [], suggested: [] });
  });

  it('parses a comma-separated pinnedIds list', async () => {
    await list(makeReq({ pinnedIds: '12, 88' }), makeRes());

    expect(mockGetPillRow).toHaveBeenCalledWith(expect.objectContaining({ pinnedIds: [12, 88] }));
  });

  it('drops junk from pinnedIds instead of rejecting the request', async () => {
    await list(makeReq({ pinnedIds: 'abc,-1,0,5' }), makeRes());

    expect(mockGetPillRow).toHaveBeenCalledWith(expect.objectContaining({ pinnedIds: [5] }));
  });

  it('caps the row size a caller can ask for', async () => {
    await list(makeReq({ limit: '500' }), makeRes());

    expect(mockGetPillRow).toHaveBeenCalledWith(expect.objectContaining({ rowSize: 12 }));
  });

  it('falls back to the default row size for a nonsense limit', async () => {
    await list(makeReq({ limit: 'lots' }), makeRes());

    expect(mockGetPillRow).toHaveBeenCalledWith(expect.objectContaining({ rowSize: 6 }));
  });
});

describe('canned searches pin controller', () => {
  beforeEach(() => jest.clearAllMocks());

  function makePinReq(id: string) {
    return { params: { id }, query: {}, user: { id: 7 } } as unknown as Request;
  }

  it('pins and returns the search', async () => {
    const search = { id: 3, query: 'a query', category: 'mood' };
    mockPinSearch.mockResolvedValue(search);
    const res = makeRes();

    await pin(makePinReq('3'), res);

    expect(mockPinSearch).toHaveBeenCalledWith(7, 3);
    expect(res.json).toHaveBeenCalledWith(search);
  });

  it('404s an unknown canned search', async () => {
    mockPinSearch.mockRejectedValue(new UnknownCannedSearchError(999));
    const res = makeRes();

    await pin(makePinReq('999'), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('409s when the reader is at the pin limit', async () => {
    mockPinSearch.mockRejectedValue(new PinLimitReachedError(6));
    const res = makeRes();

    await pin(makePinReq('3'), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ limit: 6 }));
  });

  it('400s a non-numeric id without touching the model', async () => {
    const res = makeRes();

    await pin(makePinReq('abc'), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPinSearch).not.toHaveBeenCalled();
  });

  it('unpins and returns 204', async () => {
    const res = makeRes();

    await unpin(makePinReq('3'), res);

    expect(mockUnpinSearch).toHaveBeenCalledWith(7, 3);
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
