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
  handle: 'ada',
};

const createdUser = {
  id: 1,
  email: 'reader@example.com',
  displayName: 'Ada Reader',
  handle: 'ada',
};

describe('register controller', () => {
  it('creates the account and reports that verification is required', async () => {
    mockRegisterUser.mockResolvedValue(createdUser);

    const res = makeRes();
    await register(makeReq(validBody), res);

    expect(mockRegisterUser).toHaveBeenCalledWith(
      'reader@example.com',
      'b00kW0rm!',
      'Ada Reader',
      'ada',
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      user: createdUser,
      verificationRequired: true,
    });
  });

  it('issues no session token', async () => {
    mockRegisterUser.mockResolvedValue(createdUser);

    const res = makeRes();
    await register(makeReq(validBody), res);

    // The whole point of the hard gate: registering does not sign anyone in.
    const [payload] = (res.json as jest.Mock).mock.calls[0];
    expect(payload).not.toHaveProperty('token');
  });

  it('normalizes the handle before storing it', async () => {
    mockRegisterUser.mockResolvedValue(createdUser);

    const res = makeRes();
    await register(makeReq({ ...validBody, handle: '  Ada  ' }), res);

    // Refusing a capital letter would tell a reader their own name is invalid.
    expect(mockRegisterUser).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      'ada',
    );
  });

  it('returns 409 when the email is already registered', async () => {
    const err: any = new Error('duplicate key');
    err.code = '23505';
    err.constraint = 'idx_users_email_lower';
    mockRegisterUser.mockRejectedValue(err);

    const res = makeRes();
    await register(makeReq(validBody), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Email already registered' });
  });

  it('returns 409 with HANDLE_TAKEN when the handle collided instead', async () => {
    // Both collisions arrive as 23505. Naming the wrong field would send the
    // reader to change their email address when the handle was the problem.
    const err: any = new Error('duplicate key');
    err.code = '23505';
    err.constraint = 'idx_users_handle_lower';
    mockRegisterUser.mockRejectedValue(err);

    const res = makeRes();
    await register(makeReq(validBody), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'That handle is taken.',
      code: 'HANDLE_TAKEN',
      field: 'handle',
    });
  });

  it('treats an unlabelled 23505 as an address collision', async () => {
    // The plain UNIQUE on users.email reports its own constraint name, and an
    // older driver may report none at all. Either way it is not the handle.
    const err: any = new Error('duplicate key');
    err.code = '23505';
    mockRegisterUser.mockRejectedValue(err);

    const res = makeRes();
    await register(makeReq(validBody), res);

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

    it.each([
      ['a missing handle', undefined, 'Handle is required.'],
      ['a short handle', 'ab', 'Handle must be between 3 and 30 characters.'],
      ['a spaced handle', 'ada reader', 'Handle can contain only letters, numbers and underscores.'],
      ['a handle starting with a digit', '92ada', 'Handle must start with a letter.'],
      ['a reserved handle', 'settings', 'That handle is reserved.'],
    ])('returns 400 for %s', async (_label, handle, error) => {
      const res = makeRes();
      await register(makeReq({ ...validBody, handle }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      // The field is named so the form can mark the right box.
      expect(res.json).toHaveBeenCalledWith({ error, field: 'handle' });
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
