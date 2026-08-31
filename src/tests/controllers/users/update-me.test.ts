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
  /*
   * The controller destructures the body, so a field it does not name is
   * silently dropped -- the model sees undefined, reads it as "unchanged", and
   * the response returns the old value. That is exactly what happened to
   * shareReviews: the switch appeared to do nothing and reset itself.
   *
   * Tested here rather than only on the model, because the model was already
   * right and its test passed throughout (LOS-266).
   */
  it('passes shareReviews through, rather than dropping it', async () => {
    const res = makeRes();
    await updateMe(makeReq({ shareReviews: true }), res);

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ shareReviews: true }),
    );
  });

  // False is the value that turns it off, so it must survive as a value rather
  // than being read as absent.
  it('passes shareReviews false, not as an absence', async () => {
    const res = makeRes();
    await updateMe(makeReq({ shareReviews: false }), res);

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ shareReviews: false }),
    );
  });

  it('refuses a shareReviews that is not a boolean', async () => {
    const res = makeRes();
    await updateMe(makeReq({ shareReviews: 'yes' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('passes only the fields that were sent', async () => {
    const res = makeRes();
    await updateMe(makeReq({ displayName: 'Ada R.' }), res);

    expect(mockUpdateProfile).toHaveBeenCalledWith(7, {
      displayName: 'Ada R.',
      handle: undefined,
      isDiscoverable: undefined,
      shareReviews: undefined,
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
