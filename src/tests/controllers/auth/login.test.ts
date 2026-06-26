import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { login } from '../../../controllers/auth/login';
import * as loginModel from '../../../models/auth/login';

jest.mock('../../../models/auth/login');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

const mockFindUserByEmail = loginModel.findUserByEmail as jest.Mock;
const mockCompare = bcrypt.compare as jest.Mock;
const mockSign = jwt.sign as jest.Mock;

function makeReq(body = {}) { return { body } as Request; }

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('login controller', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  it('returns user and token on valid credentials', async () => {
    const user = { id: 1, email: 'a@b.com', display_name: 'Alice', password_hash: 'hash' };
    mockFindUserByEmail.mockResolvedValue(user);
    mockCompare.mockResolvedValue(true);
    mockSign.mockReturnValue('jwt-token');

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
    mockFindUserByEmail.mockResolvedValue({ id: 1, email: 'a@b.com', password_hash: 'hash' });
    mockCompare.mockResolvedValue(false);
    const res = makeRes();
    await login(makeReq({ email: 'a@b.com', password: 'wrong' }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
  });

  it('returns 500 on unexpected error', async () => {
    mockFindUserByEmail.mockRejectedValue(new Error('DB down'));
    const res = makeRes();
    await login(makeReq({ email: 'a@b.com', password: 'p' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
