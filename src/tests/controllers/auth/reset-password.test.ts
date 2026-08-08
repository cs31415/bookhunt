import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { resetPassword } from '../../../controllers/auth/reset-password';
import * as resetPasswordModel from '../../../models/auth/reset-password';

jest.mock('../../../models/auth/reset-password');
jest.mock('bcryptjs');

const mockResetPassword = resetPasswordModel.resetPassword as jest.Mock;
const mockHash = bcrypt.hash as jest.Mock;

function makeReq(body: unknown = {}) { return { body } as Request; }

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

const validBody = { token: 'tok-1', password: 'n3wP4ssw0rd' };

describe('resetPassword controller', () => {
  it('hashes the new password and reports success', async () => {
    mockHash.mockResolvedValue('hashed');
    mockResetPassword.mockResolvedValue(true);

    const res = makeRes();
    await resetPassword(makeReq(validBody), res);

    expect(mockHash).toHaveBeenCalledWith('n3wP4ssw0rd', 10);
    expect(mockResetPassword).toHaveBeenCalledWith('tok-1', 'hashed');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('returns 400 when the token is invalid or expired', async () => {
    mockHash.mockResolvedValue('hashed');
    mockResetPassword.mockResolvedValue(false);

    const res = makeRes();
    await resetPassword(makeReq(validBody), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired reset token' });
  });

  it.each([
    ['a missing token', { password: 'n3wP4ssw0rd' }],
    ['a missing password', { token: 'tok-1' }],
    ['a short password', { token: 'tok-1', password: 'short' }],
    ['no body at all', undefined],
  ])('returns 400 for %s', async (_label, body) => {
    const res = makeRes();
    await resetPassword(makeReq(body), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('returns 500 on an unexpected error', async () => {
    mockHash.mockResolvedValue('hashed');
    mockResetPassword.mockRejectedValue(new Error('DB down'));

    const res = makeRes();
    await resetPassword(makeReq(validBody), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
