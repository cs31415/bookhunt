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

const row = {
  id: 1,
  email: 'reader@example.com',
  display_name: 'Ada Reader',
  handle: 'ada',
};

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
    await registerUser('  Reader@Example.COM ', 'b00kW0rm!', 'Ada Reader', 'Ada', 'CODE-1');

    // The bug this closes: the row used to keep whatever case was typed while
    // lookups matched on LOWER(email), so two accounts could share an address.
    expect(mockInsertUser).toHaveBeenCalledWith(
      'reader@example.com',
      'hashed',
      'Ada Reader',
      'ada',
      'test-uuid',
      expect.any(Date),
      'CODE-1',
    );
  });

  it('trims the display name', async () => {
    await registerUser('reader@example.com', 'b00kW0rm!', '  Ada Reader  ', 'ada', 'CODE-1');

    expect(mockInsertUser).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'Ada Reader',
      expect.any(String),
      expect.any(String),
      expect.any(Date),
      'CODE-1',
    );
  });

  it('hashes the password rather than storing it', async () => {
    await registerUser('reader@example.com', 'b00kW0rm!', 'Ada Reader', 'ada', 'CODE-1');

    expect(mockHash).toHaveBeenCalledWith('b00kW0rm!', 10);
    expect(mockInsertUser).not.toHaveBeenCalledWith(
      expect.anything(),
      'b00kW0rm!',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('mails a verification link that expires in 24 hours', async () => {
    const before = Date.now();
    await registerUser('reader@example.com', 'b00kW0rm!', 'Ada Reader', 'ada', 'CODE-1');

    const expiresAt: Date = mockInsertUser.mock.calls[0][5];
    const ttlMs = expiresAt.getTime() - before;
    expect(ttlMs).toBeGreaterThan(23 * 60 * 60 * 1000);
    // The upper bound needs slack: the model reads its own Date.now() after
    // `before` was taken, so the measured span is 24 hours plus however long
    // the call took. Under a loaded full-suite run that overshot a hard 24.
    expect(ttlMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 60 * 1000);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'reader@example.com',
        subject: 'Confirm your BookHunt address',
        text: expect.stringContaining('/verify-email?token=test-uuid'),
      }),
    );
  });

  it('returns the created user in camelCase', async () => {
    await expect(registerUser('reader@example.com', 'b00kW0rm!', 'Ada Reader', 'ada', 'CODE-1')).resolves.toEqual({
      id: 1,
      email: 'reader@example.com',
      displayName: 'Ada Reader',
      handle: 'ada',
    });
  });

  it('still succeeds when the verification email cannot be sent', async () => {
    // The account is committed before the send. Failing here would report an
    // error for work that succeeded, and invite a retry against an address that
    // is now taken. Recovery is the resend endpoint.
    mockSendEmail.mockResolvedValue(false);

    await expect(
      registerUser('reader@example.com', 'b00kW0rm!', 'Ada Reader', 'ada', 'CODE-1'),
    ).resolves.toMatchObject({ id: 1 });
  });

  it('propagates a duplicate-address error for the controller to map', async () => {
    const err: any = new Error('duplicate key');
    err.code = '23505';
    mockInsertUser.mockRejectedValue(err);

    await expect(registerUser('reader@example.com', 'b00kW0rm!', 'Ada Reader', 'ada', 'CODE-1')).rejects.toMatchObject({
      code: '23505',
    });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  /*
   * The whole reason registration is gated (LOS-376). fn_register_user raises
   * on a spent or unknown code, which rolls its own insert back -- so the model
   * must return before it reaches sendEmail. If it did not, a bot could still
   * make this server mail any address it liked simply by guessing wrong, which
   * is precisely the abuse LOS-363 found.
   */
  it('sends no email when the invite code is refused', async () => {
    mockInsertUser.mockRejectedValue(
      Object.assign(new Error('invite code is not available'), { code: '22023' }),
    );

    await expect(
      registerUser('reader@example.com', 'b00kW0rm!', 'Ada Reader', 'ada', 'SPENT'),
    ).rejects.toMatchObject({ code: '22023' });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('passes null through when no code is required', async () => {
    await registerUser('reader@example.com', 'b00kW0rm!', 'Ada Reader', 'ada', null);

    expect(mockInsertUser).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(Date),
      null,
    );
  });
});
