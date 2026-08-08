import { Request, Response } from 'express';
import { resendVerification } from '../../../controllers/auth/resend-verification';
import * as resendModel from '../../../models/auth/resend-verification';

jest.mock('../../../models/auth/resend-verification');

const mockResendVerification = resendModel.resendVerification as jest.Mock;

function makeReq(body: unknown = {}) { return { body } as Request; }

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('resendVerification controller', () => {
  it('sends a fresh link and returns ok', async () => {
    mockResendVerification.mockResolvedValue(undefined);

    const res = makeRes();
    await resendVerification(makeReq({ email: 'reader@example.com' }), res);

    expect(mockResendVerification).toHaveBeenCalledWith('reader@example.com');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('returns the same ok for an unknown or already-verified address', async () => {
    // The model quietly does nothing in both cases. Replying differently would
    // turn this into a way to test which addresses have accounts.
    mockResendVerification.mockResolvedValue(undefined);

    const res = makeRes();
    await resendVerification(makeReq({ email: 'nobody@example.com' }), res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('returns 400 for a malformed address', async () => {
    const res = makeRes();
    await resendVerification(makeReq({ email: 'not-an-address' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockResendVerification).not.toHaveBeenCalled();
  });

  it('returns 500 on an unexpected error', async () => {
    mockResendVerification.mockRejectedValue(new Error('DB down'));

    const res = makeRes();
    await resendVerification(makeReq({ email: 'reader@example.com' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
