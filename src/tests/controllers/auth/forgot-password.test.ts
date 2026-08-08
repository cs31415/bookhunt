import { Request, Response } from 'express';
import { forgotPassword } from '../../../controllers/auth/forgot-password';
import * as forgotPasswordModel from '../../../models/auth/forgot-password';

jest.mock('../../../models/auth/forgot-password');

const mockRequestPasswordReset = forgotPasswordModel.requestPasswordReset as jest.Mock;

function makeReq(body: unknown = {}) { return { body } as Request; }

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('forgotPassword controller', () => {
  it('requests a reset and returns ok', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);
    const res = makeRes();
    await forgotPassword(makeReq({ email: 'a@b.com' }), res);
    expect(mockRequestPasswordReset).toHaveBeenCalledWith('a@b.com');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('returns ok for an address with no account', async () => {
    // The model does nothing in that case; the reply must not give it away.
    mockRequestPasswordReset.mockResolvedValue(undefined);
    const res = makeRes();
    await forgotPassword(makeReq({ email: 'nobody@example.com' }), res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('returns 400 for a malformed address', async () => {
    const res = makeRes();
    await forgotPassword(makeReq({ email: 'not-an-address' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockRequestPasswordReset).not.toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    mockRequestPasswordReset.mockRejectedValue(new Error('fail'));
    const res = makeRes();
    await forgotPassword(makeReq({ email: 'a@b.com' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
