import { Request, Response } from 'express';
import {
  getPublicProfile,
  getPublicLibrary,
} from '../../../controllers/users/get-public-profile';
import * as model from '../../../models/users/public-profile';

jest.mock('../../../models/users/public-profile');

const mockProfile = model.publicProfile as jest.Mock;
const mockLibrary = model.publicLibrary as jest.Mock;

function makeReq(handle: string, query: Record<string, unknown> = {}) {
  return { params: { handle }, query } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

const profile = {
  handle: 'ada',
  displayName: 'Ada Reader',
  joinedAt: '2026-01-01T00:00:00Z',
  counts: { total: 3, reading: 1, finished: 1, favorites: 2 },
};

beforeEach(() => {
  mockProfile.mockResolvedValue(profile);
  mockLibrary.mockResolvedValue({ entries: [], total: 0, page: 1, pageSize: 24 });
});

describe('getPublicProfile', () => {
  it('returns the profile for a public handle', async () => {
    const res = makeRes();
    await getPublicProfile(makeReq('ada'), res);

    expect(res.json).toHaveBeenCalledWith({ profile });
  });

  it('answers a private page and an unknown handle identically', async () => {
    // The model returns null for both, and the controller must not distinguish
    // them: a different answer for each is an oracle for which handles exist.
    mockProfile.mockResolvedValue(null);

    const privateRes = makeRes();
    await getPublicProfile(makeReq('ada'), privateRes);

    const unknownRes = makeRes();
    await getPublicProfile(makeReq('nobody-at-all'), unknownRes);

    expect(privateRes.status).toHaveBeenCalledWith(404);
    expect(unknownRes.status).toHaveBeenCalledWith(404);
    expect((privateRes.json as jest.Mock).mock.calls[0]).toEqual(
      (unknownRes.json as jest.Mock).mock.calls[0],
    );
  });
});

describe('getPublicLibrary', () => {
  it('checks the profile before reading the shelf', async () => {
    mockProfile.mockResolvedValue(null);

    const res = makeRes();
    await getPublicLibrary(makeReq('ada'), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockLibrary).not.toHaveBeenCalled();
  });

  it('distinguishes an empty public shelf from a private one', async () => {
    // Empty is 200 with no entries; private is 404. Collapsing the two would
    // tell a visitor a reader exists but has read nothing.
    const res = makeRes();
    await getPublicLibrary(makeReq('ada'), res);

    expect(res.json).toHaveBeenCalledWith({
      entries: [],
      total: 0,
      page: 1,
      pageSize: 24,
    });
  });

  it('passes the filters through', async () => {
    const res = makeRes();
    await getPublicLibrary(makeReq('ada', { status: 'reading', favorites: 'true' }), res);

    expect(mockLibrary).toHaveBeenCalledWith(
      'ada',
      expect.objectContaining({ status: 'reading', favorites: 'true' }),
    );
  });

  it('returns 500 on an unexpected error', async () => {
    mockProfile.mockRejectedValue(new Error('DB error'));

    const res = makeRes();
    await getPublicLibrary(makeReq('ada'), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
