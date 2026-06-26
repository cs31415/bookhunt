import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { register } from '../../../controllers/auth/register';
import * as registerModel from '../../../models/auth/register';

jest.mock('../../../models/auth/register');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

const mockRegisterUser = registerModel.registerUser as jest.Mock;
const mockHash = bcrypt.hash as jest.Mock;
const mockSign = jwt.sign as jest.Mock;

function makeReq(body = {}) { return { body } as Request; }

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('register controller', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  it('returns user and token on successful registration', async () => {
    mockHash.mockResolvedValue('hashed');
    mockRegisterUser.mockResolvedValue({ id: 1, email: 'a@b.com', display_name: 'Alice' });
    mockSign.mockReturnValue('jwt');

    const res = makeRes();
    await register(makeReq({ email: 'a@b.com', password: 'pass', displayName: 'Alice' }), res);

    expect(mockHash).toHaveBeenCalledWith('pass', 10);
    expect(res.json).toHaveBeenCalledWith({
      user: { id: 1, email: 'a@b.com', displayName: 'Alice' },
      token: 'jwt',
    });
  });

  it('returns 409 when email is already registered', async () => {
    mockHash.mockResolvedValue('hashed');
    const err: any = new Error('duplicate key');
    err.code = '23505';
    mockRegisterUser.mockRejectedValue(err);

    const res = makeRes();
    await register(makeReq({ email: 'a@b.com', password: 'p', displayName: 'A' }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Email already registered' });
  });

  it('returns 500 on unexpected error', async () => {
    mockHash.mockResolvedValue('hashed');
    mockRegisterUser.mockRejectedValue(new Error('DB error'));

    const res = makeRes();
    await register(makeReq({ email: 'a@b.com', password: 'p', displayName: 'A' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
