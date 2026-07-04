import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getSummary } from '../../../controllers/ai/get-summary';
import * as getSummaryModel from '../../../models/ai/get-summary';

jest.mock('../../../models/ai/get-summary');

const mockGetSummaryModel = getSummaryModel.getSummary as jest.Mock;

function makeReq(bookId: string) {
  return { params: { bookId } } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('getSummary controller', () => {
  it('returns 400 for a non-numeric bookId', async () => {
    const res = makeRes();
    await getSummary(makeReq('abc'), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid book ID' });
  });

  it('returns 404 when the model returns null', async () => {
    mockGetSummaryModel.mockResolvedValue(null);
    const res = makeRes();
    await getSummary(makeReq('1'), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns the summary from the model on success', async () => {
    mockGetSummaryModel.mockResolvedValue({ bookId: 1, summary: 'A summary', generatedAt: null });
    const res = makeRes();
    await getSummary(makeReq('1'), res);
    expect(res.json).toHaveBeenCalledWith({ bookId: 1, summary: 'A summary', generatedAt: null });
  });

  it('returns 503 when Claude raises an API error', async () => {
    mockGetSummaryModel.mockRejectedValue(new Anthropic.APIError(503, undefined, 'unavailable', {}));
    const res = makeRes();
    await getSummary(makeReq('1'), res);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetSummaryModel.mockRejectedValue(new Error('boom'));
    const res = makeRes();
    await getSummary(makeReq('1'), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
