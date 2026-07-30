import { Request, Response } from 'express';
import { presign } from '../../../controllers/upload/presign';
import * as presignModel from '../../../models/upload/create-presigned-upload';
import { MAX_IMAGES_PER_SCAN } from '../../../lib/upload-constraints';

jest.mock('../../../models/upload/create-presigned-upload');

const mockCreatePresignedUpload = presignModel.createPresignedUpload as jest.Mock;

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
  it('returns an array of { url, fields, key } for valid files', async () => {
    mockCreatePresignedUpload
      .mockResolvedValueOnce({ url: 'https://s3.example.com/bucket', fields: { 'Content-Type': 'image/jpeg' } })
      .mockResolvedValueOnce({ url: 'https://s3.example.com/bucket', fields: { 'Content-Type': 'image/png' } });
    const res = makeRes();
    await presign(makeReq({ files: [{ contentType: 'image/jpeg' }, { contentType: 'image/png' }] }), res);
    expect(mockCreatePresignedUpload).toHaveBeenCalledTimes(2);
    const [result] = (res.json as jest.Mock).mock.calls;
    expect(result[0]).toHaveLength(2);
    expect(result[0][0]).toMatchObject({
      url: 'https://s3.example.com/bucket',
      fields: { 'Content-Type': 'image/jpeg' },
    });
    expect(result[0][0].key).toMatch(/^uploads\/1\//);
    expect(result[0][1]).toMatchObject({ fields: { 'Content-Type': 'image/png' } });
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

  it('returns 400 when files exceeds the scan limit', async () => {
    const res = makeRes();
    await presign(
      makeReq({ files: Array(MAX_IMAGES_PER_SCAN + 1).fill({ contentType: 'image/jpeg' }) }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: `files must contain at most ${MAX_IMAGES_PER_SCAN} items`,
    });
  });

  it('returns 400 when a file has a non-image contentType', async () => {
    const res = makeRes();
    await presign(makeReq({ files: [{ contentType: 'image/jpeg' }, { contentType: 'text/plain' }] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'each file must have a contentType of image/jpeg, image/png, image/webp',
    });
  });

  it('returns 400 for image types outside the allowlist', async () => {
    const res = makeRes();
    await presign(makeReq({ files: [{ contentType: 'image/svg+xml' }] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockCreatePresignedUpload).not.toHaveBeenCalled();
  });
});
