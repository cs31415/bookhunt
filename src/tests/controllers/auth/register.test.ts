import { Request, Response } from 'express';
import { register } from '../../../controllers/auth/register';
import * as registerModel from '../../../models/auth/register';

jest.mock('../../../models/auth/register');

const mockRegisterUser = registerModel.registerUser as jest.Mock;

function makeReq(body: unknown = {}) {
  return { body } as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

const validBody = {
  email: 'reader@example.com',
  password: 'b00kW0rm!',
  displayName: 'Ada Reader',
};

describe('register controller', () => {
  it('creates the account and reports that verification is required', async () => {
    mockRegisterUser.mockResolvedValue({
      id: 1,
      email: 'reader@example.com',
      displayName: 'Ada Reader',
    });

    const res = makeRes();
    await register(makeReq(validBody), res);

    expect(mockRegisterUser).toHaveBeenCalledWith(
      'reader@example.com',
      'b00kW0rm!',
      'Ada Reader',
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      user: { id: 1, email: 'reader@example.com', displayName: 'Ada Reader' },
      verificationRequired: true,
    });
  });

  it('issues no session token', async () => {
    mockRegisterUser.mockResolvedValue({
      id: 1,
      email: 'reader@example.com',
      displayName: 'Ada Reader',
    });

    const res = makeRes();
    await register(makeReq(validBody), res);

    // The whole point of the hard gate: registering does not sign anyone in.
    const [payload] = (res.json as jest.Mock).mock.calls[0];
    expect(payload).not.toHaveProperty('token');
  });

  it('returns 409 when the email is already registered', async () => {
    const err: any = new Error('duplicate key');
    err.code = '23505';
    mockRegisterUser.mockRejectedValue(err);

    const res = makeRes();
    await register(makeReq(validBody), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Email already registered' });
  });

  describe('validation', () => {
    it.each([
      ['a missing password', { ...validBody, password: undefined }, 'Password is required.'],
      [
        'a short password',
        { ...validBody, password: 'short' },
        'Password must be at least 8 characters.',
      ],
      [
        'a malformed email',
        { ...validBody, email: 'not-an-address' },
        'A valid email address is required.',
      ],
      [
        'a missing email',
        { ...validBody, email: undefined },
        'A valid email address is required.',
      ],
      [
        'a blank display name',
        { ...validBody, displayName: '   ' },
        'Display name is required.',
      ],
    ])('returns 400 for %s', async (_label, body, error) => {
      const res = makeRes();
      await register(makeReq(body), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error });
      // Nothing is written when the request never made sense.
      expect(mockRegisterUser).not.toHaveBeenCalled();
    });

    it('returns 400 rather than 500 for an absent body', async () => {
      const res = makeRes();
      await register(makeReq(undefined), res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  it('returns 500 on an unexpected error', async () => {
    mockRegisterUser.mockRejectedValue(new Error('DB error'));

    const res = makeRes();
    await register(makeReq(validBody), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
