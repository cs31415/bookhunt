import { resendVerification } from '../../../models/auth/resend-verification';
import * as authData from '../../../data/auth-data';
import { sendEmail } from '../../../lib/email/send-email';

jest.mock('../../../data/auth-data');
jest.mock('../../../lib/email/send-email');
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'fresh-uuid'),
}));

const mockFindUserByEmail = authData.findUserByEmail as jest.Mock;
const mockSetVerificationToken = authData.setVerificationToken as jest.Mock;
const mockSendEmail = sendEmail as jest.Mock;

const unverified = {
  id: 1,
  email: 'reader@example.com',
  display_name: 'Ada Reader',
  email_verified_at: null,
};

beforeEach(() => {
  mockSendEmail.mockResolvedValue(true);
  process.env.FRONTEND_URL = 'http://localhost:5173';
});

afterEach(() => {
  delete process.env.FRONTEND_URL;
});

describe('resendVerification model', () => {
  it('issues and mails a fresh token for an unverified account', async () => {
    mockFindUserByEmail.mockResolvedValue(unverified);

    await resendVerification('  Reader@Example.COM ');

    expect(mockFindUserByEmail).toHaveBeenCalledWith('reader@example.com');
    expect(mockSetVerificationToken).toHaveBeenCalledWith(
      'reader@example.com',
      'fresh-uuid',
      expect.any(Date),
    );
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'reader@example.com',
        text: expect.stringContaining('/verify-email?token=fresh-uuid'),
      }),
    );
  });

  it('does nothing for an address with no account', async () => {
    mockFindUserByEmail.mockResolvedValue(null);

    await resendVerification('nobody@example.com');

    expect(mockSetVerificationToken).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('does nothing for an account that is already verified', async () => {
    // Otherwise this is a way to mail arbitrary verified readers on demand.
    mockFindUserByEmail.mockResolvedValue({
      ...unverified,
      email_verified_at: new Date('2026-01-01T00:00:00Z'),
    });

    await resendVerification('reader@example.com');

    expect(mockSetVerificationToken).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
