import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { scan } from '../../../controllers/upload/scan';
import * as scanModel from '../../../models/upload/scan';
import { ImageValidationError } from '../../../models/upload/validate-image-keys';

jest.mock('../../../models/upload/scan');

const mockDetect = scanModel.detectBooksFromImages as jest.Mock;

function makeReq(body: unknown, userId = 1) {
  return { body, user: { id: userId, email: 'a@b.com' } } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('scan controller', () => {
  it('returns 400 when imageKeys is missing', async () => {
    const res = makeRes();
    await scan(makeReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'imageKeys must be a non-empty array' });
  });

  it('returns 400 when imageKeys is not an array', async () => {
    const res = makeRes();
    await scan(makeReq({ imageKeys: 'uploads/1/abc' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'imageKeys must be a non-empty array' });
  });

  it('returns 400 when imageKeys is an empty array', async () => {
    const res = makeRes();
    await scan(makeReq({ imageKeys: [] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'imageKeys must be a non-empty array' });
  });

  it('returns 400 when imageKeys exceeds 10 items', async () => {
    const res = makeRes();
    await scan(makeReq({ imageKeys: Array(11).fill('uploads/1/key') }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'imageKeys must contain at most 10 items' });
  });

  it('returns 400 when imageKeys contains non-string items', async () => {
    const res = makeRes();
    await scan(makeReq({ imageKeys: ['uploads/1/abc', 42] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'imageKeys must be an array of strings' });
  });

  it('returns detected books on success', async () => {
    const books = [{ title: 'Dune', author: 'Frank Herbert', matchedBookId: 7 }];
    mockDetect.mockResolvedValue(books);
    const res = makeRes();
    await scan(makeReq({ imageKeys: ['uploads/1/abc', 'uploads/1/def'] }), res);
    expect(mockDetect).toHaveBeenCalledWith(['uploads/1/abc', 'uploads/1/def'], 1);
    expect(res.json).toHaveBeenCalledWith({ detectedBooks: books });
  });

  it('returns 400 when a key fails image validation', async () => {
    mockDetect.mockRejectedValue(new ImageValidationError('uploads/2/abc'));
    const res = makeRes();
    await scan(makeReq({ imageKeys: ['uploads/2/abc'] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'invalid or unsupported image: uploads/2/abc' });
  });

  it('returns 503 when Anthropic API throws APIError', async () => {
    mockDetect.mockRejectedValue(new Anthropic.APIError(503, undefined, 'upstream', {}));
    const res = makeRes();
    await scan(makeReq({ imageKeys: ['uploads/1/abc'] }), res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'Book detection service unavailable' });
  });

  it('returns 500 on unexpected error', async () => {
    mockDetect.mockRejectedValue(new Error('db down'));
    const res = makeRes();
    await scan(makeReq({ imageKeys: ['uploads/1/abc'] }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
