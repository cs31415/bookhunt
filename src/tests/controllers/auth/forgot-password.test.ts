import { Request, Response } from 'express';
import { forgotPassword } from '../../../controllers/auth/forgot-password';
import * as forgotPasswordModel from '../../../models/auth/forgot-password';

jest.mock('../../../models/auth/forgot-password');
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'test-uuid'),
}));

const mockSetResetToken = forgotPasswordModel.setResetToken as jest.Mock;

function makeReq(body = {}) { return { body } as Request; }

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('forgotPassword controller', () => {
  it('calls setResetToken with email, uuid, and expiry, returns ok', async () => {
    mockSetResetToken.mockResolvedValue(undefined);
    const res = makeRes();
    await forgotPassword(makeReq({ email: 'a@b.com' }), res);
    expect(mockSetResetToken).toHaveBeenCalledWith('a@b.com', 'test-uuid', expect.any(Date));
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('returns 500 on error', async () => {
    mockSetResetToken.mockRejectedValue(new Error('fail'));
    const res = makeRes();
    await forgotPassword(makeReq({ email: 'a@b.com' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
