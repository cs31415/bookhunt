import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { login } from '../../../controllers/auth/login';
import * as loginModel from '../../../models/auth/login';
import { signAuthToken } from '../../../lib/auth/sign-auth-token';

jest.mock('../../../models/auth/login');
jest.mock('../../../lib/auth/sign-auth-token');
jest.mock('bcryptjs');

const mockFindUserByEmail = loginModel.findUserByEmail as jest.Mock;
const mockCompare = bcrypt.compare as jest.Mock;
const mockSignAuthToken = signAuthToken as jest.Mock;

function makeReq(body: unknown = {}) { return { body } as Request; }

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

const verifiedUser = {
  id: 1,
  email: 'a@b.com',
  display_name: 'Alice',
  password_hash: 'hash',
  email_verified_at: new Date('2026-01-01T00:00:00Z'),
};

describe('login controller', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    mockSignAuthToken.mockReturnValue('jwt-token');
  });

  it('returns user and token on valid credentials', async () => {
    mockFindUserByEmail.mockResolvedValue(verifiedUser);
    mockCompare.mockResolvedValue(true);

    const res = makeRes();
    await login(makeReq({ email: 'a@b.com', password: 'pass' }), res);

    expect(res.json).toHaveBeenCalledWith({
      user: { id: 1, email: 'a@b.com', displayName: 'Alice' },
      token: 'jwt-token',
    });
  });

  it('returns 401 when user is not found', async () => {
    mockFindUserByEmail.mockResolvedValue(null);
    const res = makeRes();
    await login(makeReq({ email: 'x@x.com', password: 'p' }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
  });

  it('returns 401 when password does not match', async () => {
    mockFindUserByEmail.mockResolvedValue(verifiedUser);
    mockCompare.mockResolvedValue(false);
    const res = makeRes();
    await login(makeReq({ email: 'a@b.com', password: 'wrong' }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
  });

  it('returns 400 when a field is missing', async () => {
    const res = makeRes();
    await login(makeReq({ email: 'a@b.com' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockFindUserByEmail).not.toHaveBeenCalled();
  });

  describe('the verification gate', () => {
    const unverified = { ...verifiedUser, email_verified_at: null };

    it('returns 403 when the address has not been verified', async () => {
      mockFindUserByEmail.mockResolvedValue(unverified);
      mockCompare.mockResolvedValue(true);

      const res = makeRes();
      await login(makeReq({ email: 'a@b.com', password: 'pass' }), res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Please verify your email address before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    });

    it('issues no token to an unverified account', async () => {
      mockFindUserByEmail.mockResolvedValue(unverified);
      mockCompare.mockResolvedValue(true);

      const res = makeRes();
      await login(makeReq({ email: 'a@b.com', password: 'pass' }), res);

      expect(mockSignAuthToken).not.toHaveBeenCalled();
    });

    it('checks the password before the gate', async () => {
      // Answering "verify your email" to a wrong password would confirm the
      // account exists to someone who cannot sign into it.
      mockFindUserByEmail.mockResolvedValue(unverified);
      mockCompare.mockResolvedValue(false);

      const res = makeRes();
      await login(makeReq({ email: 'a@b.com', password: 'wrong' }), res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });
  });

  it('returns 500 on unexpected error', async () => {
    mockFindUserByEmail.mockRejectedValue(new Error('DB down'));
    const res = makeRes();
    await login(makeReq({ email: 'a@b.com', password: 'p' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
