import bcrypt from 'bcryptjs';
import { registerUser } from '../../../models/auth/register';
import * as authData from '../../../data/auth-data';
import { sendEmail } from '../../../lib/email/send-email';

jest.mock('../../../data/auth-data');
jest.mock('../../../lib/email/send-email');
jest.mock('bcryptjs');
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'test-uuid'),
}));

const mockInsertUser = authData.registerUser as jest.Mock;
const mockSendEmail = sendEmail as jest.Mock;
const mockHash = bcrypt.hash as jest.Mock;

const row = { id: 1, email: 'reader@example.com', display_name: 'Ada Reader' };

beforeEach(() => {
  mockHash.mockResolvedValue('hashed');
  mockInsertUser.mockResolvedValue(row);
  mockSendEmail.mockResolvedValue(true);
  process.env.FRONTEND_URL = 'http://localhost:5173';
});

afterEach(() => {
  delete process.env.FRONTEND_URL;
});

describe('registerUser model', () => {
  it('stores the address in canonical form', async () => {
    await registerUser('  Reader@Example.COM ', 'b00kW0rm!', 'Ada Reader');

    // The bug this closes: the row used to keep whatever case was typed while
    // lookups matched on LOWER(email), so two accounts could share an address.
    expect(mockInsertUser).toHaveBeenCalledWith(
      'reader@example.com',
      'hashed',
      'Ada Reader',
      'test-uuid',
      expect.any(Date),
    );
  });

  it('trims the display name', async () => {
    await registerUser('reader@example.com', 'b00kW0rm!', '  Ada Reader  ');

    expect(mockInsertUser).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'Ada Reader',
      expect.any(String),
      expect.any(Date),
    );
  });

  it('hashes the password rather than storing it', async () => {
    await registerUser('reader@example.com', 'b00kW0rm!', 'Ada Reader');

    expect(mockHash).toHaveBeenCalledWith('b00kW0rm!', 10);
    expect(mockInsertUser).not.toHaveBeenCalledWith(
      expect.anything(),
      'b00kW0rm!',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('mails a verification link that expires in 24 hours', async () => {
    const before = Date.now();
    await registerUser('reader@example.com', 'b00kW0rm!', 'Ada Reader');

    const expiresAt: Date = mockInsertUser.mock.calls[0][4];
    const ttlMs = expiresAt.getTime() - before;
    expect(ttlMs).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'reader@example.com',
        subject: 'Confirm your BookHunt address',
        text: expect.stringContaining('/verify-email?token=test-uuid'),
      }),
    );
  });

  it('returns the created user in camelCase', async () => {
    await expect(registerUser('reader@example.com', 'b00kW0rm!', 'Ada Reader')).resolves.toEqual({
      id: 1,
      email: 'reader@example.com',
      displayName: 'Ada Reader',
    });
  });

  it('still succeeds when the verification email cannot be sent', async () => {
    // The account is committed before the send. Failing here would report an
    // error for work that succeeded, and invite a retry against an address that
    // is now taken. Recovery is the resend endpoint.
    mockSendEmail.mockResolvedValue(false);

    await expect(
      registerUser('reader@example.com', 'b00kW0rm!', 'Ada Reader'),
    ).resolves.toMatchObject({ id: 1 });
  });

  it('propagates a duplicate-address error for the controller to map', async () => {
    const err: any = new Error('duplicate key');
    err.code = '23505';
    mockInsertUser.mockRejectedValue(err);

    await expect(registerUser('reader@example.com', 'b00kW0rm!', 'Ada Reader')).rejects.toMatchObject({
      code: '23505',
    });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
