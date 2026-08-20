import { Request, Response } from 'express';
import { verifyEmail } from '../../../controllers/auth/verify-email';
import * as verifyEmailModel from '../../../models/auth/verify-email';
import { signAuthToken } from '../../../lib/auth/sign-auth-token';

jest.mock('../../../models/auth/verify-email');
jest.mock('../../../lib/auth/sign-auth-token');

const mockVerifyEmail = verifyEmailModel.verifyEmail as jest.Mock;
const mockSignAuthToken = signAuthToken as jest.Mock;

function makeReq(body: unknown = {}) { return { body } as Request; }

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

beforeEach(() => {
  mockSignAuthToken.mockReturnValue('jwt-token');
});

describe('verifyEmail controller', () => {
  it('verifies the address and signs the reader in', async () => {
    mockVerifyEmail.mockResolvedValue({
      id: 7,
      email: 'reader@example.com',
      display_name: 'Ada Reader',
    });

    const res = makeRes();
    await verifyEmail(makeReq({ token: 'tok-1' }), res);

    expect(mockVerifyEmail).toHaveBeenCalledWith('tok-1');
    expect(res.json).toHaveBeenCalledWith({
      user: { id: 7, email: 'reader@example.com', displayName: 'Ada Reader' },
      token: 'jwt-token',
    });
  });

  it('names a link that was already used, and mints nothing from it', async () => {
    // A link we really did send, presented a second time. Safe to name: holding
    // the token is proof of having received the email (LOS-298).
    mockVerifyEmail.mockResolvedValue({ already_used: true });

    const res = makeRes();
    await verifyEmail(makeReq({ token: 'tok-1' }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'That address is already confirmed. Sign in to carry on.',
      code: 'ALREADY_VERIFIED',
    });
    // One link, one sign-in: a replay must not carry a session back.
    expect(mockSignAuthToken).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown token', null],
    ['an expired token', null],
  ])('returns 400 for %s', async (_label, result) => {
    // Unknown and expired stay one case: telling them apart would tell someone
    // feeding in guessed tokens which ones exist.
    mockVerifyEmail.mockResolvedValue(result);

    const res = makeRes();
    await verifyEmail(makeReq({ token: 'tok-1' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'This verification link is invalid or has expired.',
    });
  });

  it('issues no token when verification fails', async () => {
    mockVerifyEmail.mockResolvedValue(null);

    const res = makeRes();
    await verifyEmail(makeReq({ token: 'tok-1' }), res);

    expect(mockSignAuthToken).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing token', {}],
    ['a blank token', { token: '   ' }],
    ['a non-string token', { token: 42 }],
    ['no body at all', undefined],
  ])('returns 400 for %s', async (_label, body) => {
    const res = makeRes();
    await verifyEmail(makeReq(body), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockVerifyEmail).not.toHaveBeenCalled();
  });

  it('returns 500 on an unexpected error', async () => {
    mockVerifyEmail.mockRejectedValue(new Error('DB down'));

    const res = makeRes();
    await verifyEmail(makeReq({ token: 'tok-1' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
