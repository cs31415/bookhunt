import { requestPasswordReset } from '../../../models/auth/forgot-password';
import * as authData from '../../../data/auth-data';
import { sendEmail } from '../../../lib/email/send-email';

jest.mock('../../../data/auth-data');
jest.mock('../../../lib/email/send-email');
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'reset-uuid'),
}));

const mockFindUserByEmail = authData.findUserByEmail as jest.Mock;
const mockSetResetToken = authData.setResetToken as jest.Mock;
const mockSendEmail = sendEmail as jest.Mock;

beforeEach(() => {
  mockSendEmail.mockResolvedValue(true);
  process.env.FRONTEND_URL = 'http://localhost:5173';
});

afterEach(() => {
  delete process.env.FRONTEND_URL;
});

describe('requestPasswordReset model', () => {
  it('stores a token and mails the link', async () => {
    // Until LOS-218 the token was stored and nobody was told, so the flow could
    // not be completed at all.
    mockFindUserByEmail.mockResolvedValue({ id: 1, email: 'reader@example.com' });

    await requestPasswordReset('  Reader@Example.COM ');

    expect(mockSetResetToken).toHaveBeenCalledWith(
      'reader@example.com',
      'reset-uuid',
      expect.any(Date),
    );
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'reader@example.com',
        subject: 'Reset your BookHunt password',
        text: expect.stringContaining('/reset-password?token=reset-uuid'),
      }),
    );
  });

  it('sends nothing for an address with no account', async () => {
    // Minting and mailing unconditionally would let anyone make this server
    // send mail to any address they like.
    mockFindUserByEmail.mockResolvedValue(null);

    await requestPasswordReset('nobody@example.com');

    expect(mockSetResetToken).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
