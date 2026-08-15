import { Request, Response } from 'express';
import { updateMe } from '../../../controllers/users/update-me';
import * as updateProfileModel from '../../../models/users/update-profile';

jest.mock('../../../models/users/update-profile');

const mockUpdateProfile = updateProfileModel.updateProfile as jest.Mock;

function makeReq(body: unknown = {}) {
  return { user: { id: 7 }, body } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

const profile = {
  id: 7,
  email: 'reader@example.com',
  displayName: 'Ada Reader',
  handle: 'ada',
  isDiscoverable: false,
};

beforeEach(() => {
  mockUpdateProfile.mockResolvedValue(profile);
});

describe('updateMe controller', () => {
  it('passes only the fields that were sent', async () => {
    const res = makeRes();
    await updateMe(makeReq({ displayName: 'Ada R.' }), res);

    expect(mockUpdateProfile).toHaveBeenCalledWith(7, {
      displayName: 'Ada R.',
      handle: undefined,
      isDiscoverable: undefined,
    });
    expect(res.json).toHaveBeenCalledWith({ user: profile });
  });

  it('normalizes a renamed handle', async () => {
    const res = makeRes();
    await updateMe(makeReq({ handle: '  Ada_Reader ' }), res);

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ handle: 'ada_reader' }),
    );
  });

  it('carries a false isDiscoverable through rather than dropping it', async () => {
    // The value that takes a public page down again. An absent field means
    // unchanged, so false has to be distinguishable from missing.
    const res = makeRes();
    await updateMe(makeReq({ isDiscoverable: false }), res);

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ isDiscoverable: false }),
    );
  });

  it.each([
    ['a blank display name', { displayName: '  ' }, 'displayName'],
    ['a reserved handle', { handle: 'settings' }, 'handle'],
    ['a malformed handle', { handle: 'ada reader' }, 'handle'],
  ])('returns 400 for %s and names the field', async (_label, body, field) => {
    const res = makeRes();
    await updateMe(makeReq(body), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ field }));
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('rejects a non-boolean isDiscoverable', async () => {
    const res = makeRes();
    await updateMe(makeReq({ isDiscoverable: 'yes' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('answers a taken handle exactly as registration does', async () => {
    const err: any = new Error('duplicate key');
    err.code = '23505';
    err.constraint = 'idx_users_handle_lower';
    mockUpdateProfile.mockRejectedValue(err);

    const res = makeRes();
    await updateMe(makeReq({ handle: 'taken' }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'That handle is taken.',
      code: 'HANDLE_TAKEN',
      field: 'handle',
    });
  });

  it('accepts an empty body as a no-op rather than an error', async () => {
    const res = makeRes();
    await updateMe(makeReq({}), res);

    expect(res.json).toHaveBeenCalledWith({ user: profile });
  });

  it('returns 500 on an unexpected error', async () => {
    mockUpdateProfile.mockRejectedValue(new Error('DB error'));

    const res = makeRes();
    await updateMe(makeReq({ displayName: 'Ada' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
