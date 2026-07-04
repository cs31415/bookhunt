import { Request, Response } from 'express';
import { presign } from '../../../controllers/upload/presign';
import * as presignModel from '../../../models/upload/presign';

jest.mock('../../../models/upload/presign');

const mockCreatePresignedUrl = presignModel.createPresignedUrl as jest.Mock;

function makeReq(body: unknown, userId = 1) {
  return { body, user: { id: userId, email: 'a@b.com' } } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('presign controller', () => {
  it('returns an array of { url, key } for valid files', async () => {
    mockCreatePresignedUrl
      .mockResolvedValueOnce('https://s3.example.com/put-url-1')
      .mockResolvedValueOnce('https://s3.example.com/put-url-2');
    const res = makeRes();
    await presign(makeReq({ files: [{ contentType: 'image/jpeg' }, { contentType: 'image/png' }] }), res);
    expect(mockCreatePresignedUrl).toHaveBeenCalledTimes(2);
    const [result] = (res.json as jest.Mock).mock.calls;
    expect(result[0]).toHaveLength(2);
    expect(result[0][0]).toMatchObject({ url: 'https://s3.example.com/put-url-1' });
    expect(result[0][1]).toMatchObject({ url: 'https://s3.example.com/put-url-2' });
  });

  it('returns 400 when files is missing', async () => {
    const res = makeRes();
    await presign(makeReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'files must be a non-empty array' });
  });

  it('returns 400 when files is an empty array', async () => {
    const res = makeRes();
    await presign(makeReq({ files: [] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'files must be a non-empty array' });
  });

  it('returns 400 when files exceeds 10 items', async () => {
    const res = makeRes();
    await presign(makeReq({ files: Array(11).fill({ contentType: 'image/jpeg' }) }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'files must contain at most 10 items' });
  });

  it('returns 400 when a file has a non-image contentType', async () => {
    const res = makeRes();
    await presign(makeReq({ files: [{ contentType: 'image/jpeg' }, { contentType: 'text/plain' }] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'each file must have a contentType that is an image type' });
  });
});
